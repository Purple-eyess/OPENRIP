// ═══════════════════════════════════════════════════════
// OpenRIP — Telegram Bot
// Grammy bot with long polling, user whitelist, and
// automatic file delivery for code blocks in replies.
// ═══════════════════════════════════════════════════════

import { Bot, InputFile } from "grammy";
import { config } from "../config.js";
import { runAgentLoop } from "../agent/loop.js";
import { getSystemMetrics } from "../memory/database.js";

const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

// ── File Detection ────────────────────────────────────

interface ExtractedFile {
    filename: string;
    content: string;
    language: string;
}

const LANG_TO_EXTENSION: Record<string, string> = {
    html: "html",
    css: "css",
    javascript: "js",
    js: "js",
    typescript: "ts",
    ts: "ts",
    json: "excalidraw", // JSON from excalidraw skill → .excalidraw file
    python: "py",
    sql: "sql",
    yaml: "yaml",
    toml: "toml",
    markdown: "md",
    md: "md",
};

function extractCodeBlocks(text: string): { cleanText: string; files: ExtractedFile[] } {
    const files: ExtractedFile[] = [];
    let fileCounter = 1;

    // Match fenced code blocks: ```language\n...content...\n```
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

    const cleanText = text.replace(codeBlockRegex, (match, lang: string, content: string) => {
        const language = (lang ?? "txt").toLowerCase();
        const ext = LANG_TO_EXTENSION[language] ?? language;

        // Only extract "heavy" blocks likely to be skill output
        if (content.trim().length > 100) {
            // Generate a descriptive filename
            const name = language === "json" ? `diagram-${fileCounter}` : `file-${fileCounter}`;
            const filename = `${name}.${ext}`;
            files.push({ filename, content: content.trim(), language });
            fileCounter++;
            return `📎 *Archivo adjunto:* \`${filename}\``;
        }

        return match; // Keep small code blocks inline
    });

    return { cleanText, files };
}

// ── Whitelist Middleware ──────────────────────────────
bot.use(async (ctx, next) => {
    const userId = ctx.from?.id?.toString();

    if (!userId || !config.TELEGRAM_ALLOWED_USER_IDS.includes(userId)) {
        console.log(`🚫 Unauthorized access attempt from user: ${userId ?? "unknown"}`);
        return;
    }

    await next();
});

// ── Message Handler ──────────────────────────────────
bot.on("message:text", async (ctx) => {
    const userId = ctx.from.id.toString();
    const userMessage = ctx.message.text;

    console.log(`\n📩 Message from ${userId}: "${userMessage.slice(0, 80)}..."`);

    try {
        await ctx.replyWithChatAction("typing");

        const reply = await runAgentLoop(userId, userMessage);

        // Extract code blocks → files
        const { cleanText, files } = extractCodeBlocks(reply);

        // Send the text reply
        const textToSend = cleanText.trim() || reply;
        const chunks = splitMessage(textToSend, 4096);

        for (const chunk of chunks) {
            await ctx.reply(chunk, { parse_mode: "Markdown" }).catch(async () => {
                await ctx.reply(chunk);
            });
        }

        // Send each extracted file as a document
        for (const file of files) {
            await ctx.replyWithChatAction("upload_document");
            const buffer = Buffer.from(file.content, "utf-8");
            await ctx.replyWithDocument(new InputFile(buffer, file.filename), {
                caption: `📎 ${file.filename}`,
            });
            console.log(`📎 File sent: ${file.filename} (${buffer.length} bytes)`);
        }

        console.log(`📤 Reply sent (${reply.length} chars, ${files.length} files)`);
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error processing message: ${errMsg}`);
        await ctx.reply("⚠️ Algo ha ido mal procesando tu mensaje. Inténtalo de nuevo.");
    }
});

// ── /start Command ───────────────────────────────────
bot.command("start", async (ctx) => {
    await ctx.reply(
        "🔥 **OpenRIP Operativo**\n\n" +
        "Soy tu asistente personal de élite. 🧠\n\n" +
        "Escribe *skills* para ver todo lo que puedo hacer por ti.\n",
        { parse_mode: "Markdown" }
    );
});

// ── /stats Command (Admin Only) ──────────────────────
bot.command("stats", async (ctx) => {
    try {
        const metrics = getSystemMetrics();
        
        let msg = "📊 **Métricas de OpenRIP**\n\n";
        msg += `👥 Usuarios únicos: ${metrics.totalUsers}\n`;
        msg += `💬 Mensajes recibidos: ${metrics.totalMessages}\n`;
        msg += `💾 Datos en memoria: ${metrics.totalFacts}\n\n`;
        
        msg += "🔧 **Uso de Herramientas:**\n";
        const tools = Object.entries(metrics.toolsUsed);
        if (tools.length === 0) {
            msg += "— Ninguna usada todavía\n";
        } else {
            for (const [tool, count] of tools) {
                msg += `— \`${tool}\`: ${count} veces\n`;
            }
        }
        
        await ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (err) {
        console.error("Error fetching stats:", err);
        await ctx.reply("❌ Error al cargar las métricas.");
    }
});

// ── Utility ──────────────────────────────────────────
function splitMessage(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxLength) {
            chunks.push(remaining);
            break;
        }

        let splitIndex = remaining.lastIndexOf("\n", maxLength);
        if (splitIndex === -1 || splitIndex < maxLength / 2) {
            splitIndex = remaining.lastIndexOf(" ", maxLength);
        }
        if (splitIndex === -1) splitIndex = maxLength;

        chunks.push(remaining.slice(0, splitIndex));
        remaining = remaining.slice(splitIndex).trimStart();
    }

    return chunks;
}

// ── Public API ───────────────────────────────────────

export function startBot(): void {
    bot.start({
        onStart: (botInfo) => {
            console.log(`\n🤖 OpenRIP is alive!`);
            console.log(`   Bot: @${botInfo.username}`);
            console.log(`   Allowed users: ${config.TELEGRAM_ALLOWED_USER_IDS.join(", ")}`);
            console.log(`   Listening for messages...\n`);
        },
    });
}

export function stopBot(): void {
    bot.stop();
}
