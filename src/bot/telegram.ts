// ═══════════════════════════════════════════════════════
// OpenRIP — Telegram Bot
// Grammy bot with long polling, user whitelist, and
// automatic file delivery for code blocks in replies.
// ═══════════════════════════════════════════════════════

import { Bot, InputFile } from "grammy";
import { config } from "../config.js";
import { runAgentLoop } from "../agent/loop.js";
import { getSystemMetrics } from "../memory/database.js";
import { startProactiveLoop } from "./proactive.js";
import Groq from "groq-sdk";
import fs from "fs";
import os from "os";
import path from "path";

export const bot = new Bot(config.TELEGRAM_BOT_TOKEN);
const groq = new Groq({ apiKey: config.GROQ_API_KEY });

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
    json: "excalidraw",
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

    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

    const cleanText = text.replace(codeBlockRegex, (match, lang: string, content: string) => {
        const language = (lang ?? "txt").toLowerCase();
        const ext = LANG_TO_EXTENSION[language] ?? language;

        if (content.trim().length > 100) {
            const name = language === "json" ? `diagram-${fileCounter}` : `file-${fileCounter}`;
            const filename = `${name}.${ext}`;
            files.push({ filename, content: content.trim(), language });
            fileCounter++;
            return `📎 *Archivo adjunto:* \`${filename}\``;
        }

        return match;
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

// ── Comandos (Deben ir ANTES de message:text) ─────────

bot.command("start", async (ctx) => {
    await ctx.reply(
        "🔥 **OpenRIP Operativo**\n\n" +
        "Soy tu asistente personal de élite. 🧠\n\n" +
        "Escribe *skills* para ver todo lo que puedo hacer por ti.\n",
        { parse_mode: "Markdown" }
    );
});

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

// ── Shared Send Logic ────────────────────────────────

export async function sendToUser(userId: string | number, text: string): Promise<void> {
    const { cleanText, files } = extractCodeBlocks(text);
    const textToSend = cleanText.trim() || text;
    const chunks = splitMessage(textToSend, 4096);

    for (const chunk of chunks) {
        await bot.api.sendMessage(userId, chunk, { parse_mode: "Markdown" }).catch(async () => {
            await bot.api.sendMessage(userId, chunk);
        });
    }

    for (const file of files) {
        const buffer = Buffer.from(file.content, "utf-8");
        await bot.api.sendDocument(userId, new InputFile(buffer, file.filename), {
            caption: `📎 ${file.filename}`,
        });
        console.log(`📎 File sent: ${file.filename} (${buffer.length} bytes)`);
    }
}

// ── User Queue ───────────────────────────────────────
const userQueues = new Map<string, Promise<void>>();

function enqueueUserTask(userId: string, task: () => Promise<void>): Promise<void> {
    const currentQueue = userQueues.get(userId) || Promise.resolve();
    const nextQueue = currentQueue.then(async () => {
        // Wrap task in a 60 second timeout to prevent deadlocks
        let timeoutId: NodeJS.Timeout;
        const timeoutPromise = new Promise<void>((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error("Timeout: La tarea tardó más de 60 segundos en completarse."));
            }, 60000);
        });

        try {
            await Promise.race([task(), timeoutPromise]);
        } finally {
            clearTimeout(timeoutId!);
        }
    }).catch(error => {
        const msg = `❌ Queued task error for user ${userId}: ${error instanceof Error ? error.message : error}\n`;
        console.error(msg);
        fs.appendFileSync('debug.log', msg);
        // Reply to user if the queue catches a timeout or unhandled promise rejection
        bot.api.sendMessage(userId, "⚠️ Ocurrió un error inesperado o la conexión se agotó (timeout). Por favor, inténtalo de nuevo.").catch(() => { });
    });
    userQueues.set(userId, nextQueue);
    return nextQueue;
}

// ── Message Handler ──────────────────────────────────
bot.on("message:text", (ctx) => {
    const userId = ctx.from.id.toString();
    const userMessage = ctx.message.text;

    enqueueUserTask(userId, async () => {
        console.log(`\n📩 Message from ${userId}: "${userMessage.slice(0, 80)}..."`);

        try {
            await ctx.replyWithChatAction("typing");

            const reply = await runAgentLoop(userId, userMessage);

            await sendToUser(userId, reply);

            console.log(`📤 Reply sent (${reply.length} chars)`);
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error(`❌ Error processing message: ${errMsg}`);
            await ctx.reply("⚠️ Algo ha ido mal procesando tu mensaje. Inténtalo de nuevo.");
        }
    });
});

// ── Voice Message Handler ────────────────────────────
bot.on("message:voice", (ctx) => {
    const userId = ctx.from.id.toString();

    enqueueUserTask(userId, async () => {
        console.log(`\n🎙️ Voice message from ${userId}`);
        fs.appendFileSync('debug.log', `\n[${new Date().toISOString()}] 🎙️ VOICE: Start processing for ${userId}\n`);
        let tempPath = "";

        try {
            await ctx.replyWithChatAction("typing");
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 🎙️ VOICE: Sent typing action\n`);

            // 1. Get file link from Telegram
            const file = await ctx.getFile();
            const url = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 🎙️ VOICE: Got file URL (${file.file_id})\n`);

            // 2. Download to a temporary file
            tempPath = path.join(os.tmpdir(), `${file.file_id}.ogg`);
            const response = await fetch(url);
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 🎙️ VOICE: Download fetch complete (status: ${response.status})\n`);

            const buffer = await response.arrayBuffer();
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 🎙️ VOICE: Buffer received (${buffer.byteLength} bytes)\n`);

            fs.writeFileSync(tempPath, Buffer.from(buffer));
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 🎙️ VOICE: Written to ${tempPath}\n`);

            // 3. Transcribe using Groq Whisper
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 🎙️ VOICE: Calling Groq SDK...\n`);
            const transcription = await groq.audio.transcriptions.create({
                file: fs.createReadStream(tempPath),
                model: "whisper-large-v3-turbo",
                response_format: "json",
                language: "es", // Assume spanish as it's the requested behavior
            });
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 🎙️ VOICE: Groq call complete\n`);

            const transcriptText = transcription.text.trim();
            console.log(`🎙️ Transcript: "${transcriptText}"`);

            if (!transcriptText) {
                fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 🎙️ VOICE: Empty transcript\n`);
                await ctx.reply("❌ No pude entender el audio o estaba vacío.");
                return;
            }

            // 4. Pass transcript as a normal message
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 🎙️ VOICE: Calling runAgentLoop\n`);
            const reply = await runAgentLoop(userId, transcriptText);
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 🎙️ VOICE: runAgentLoop complete. Sending reply...\n`);
            await sendToUser(userId, reply);
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 🎙️ VOICE: Complete!\n`);

        } catch (error) {
            const errStr = error instanceof Error ? error.stack : String(error);
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] ❌ VOICE ERROR: ${errStr}\n`);
            console.error(`❌ Error processing voice message:`, error);
            await ctx.reply("⚠️ Hubo un error procesando tu nota de voz.");
        } finally {
            if (tempPath && fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
                fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 🎙️ VOICE: Cleaned up temp file\n`);
            }
        }
    });
});

// ── Photo Message Handler ────────────────────────────
bot.on("message:photo", (ctx) => {
    const userId = ctx.from.id.toString();

    // Get highest resolution photo (last in array)
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const userCaption = ctx.message.caption || "";

    enqueueUserTask(userId, async () => {
        console.log(`\n📸 Photo from ${userId}${userCaption ? ` with caption: "${userCaption}"` : ""}`);
        fs.appendFileSync('debug.log', `\n[${new Date().toISOString()}] 📸 PHOTO: Start processing for ${userId}\n`);

        try {
            await ctx.replyWithChatAction("typing");
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 📸 PHOTO: Sent typing action\n`);

            // 1. Get photo URL
            const file = await ctx.getFile();
            const url = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 📸 PHOTO: Got file URL (${file.file_id})\n`);

            // 2. Ask OpenRouter Vision API to analyze image
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

            let visionResponse;
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 📸 PHOTO: Calling OpenRouter API...\n`);
            try {
                visionResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${config.OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    signal: controller.signal,
                    body: JSON.stringify({
                        model: "google/gemini-2.5-pro", // Best robust vision model, or use gpt-4o
                        messages: [
                            {
                                role: "user",
                                content: [
                                    { type: "text", text: "Describe esta imagen en gran detalle. Si la imagen contiene texto o logotipos, transcríbelos y descríbelos con la mayor precisión posible. Tu respuesta será leída por un agente de IA que no puede ver la imagen." },
                                    { type: "image_url", image_url: { url } }
                                ]
                            }
                        ]
                    })
                });
            } finally {
                clearTimeout(timeoutId);
            }

            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 📸 PHOTO: OpenRouter call complete (status: ${visionResponse.status})\n`);

            const visionData = await visionResponse.json() as any;
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 📸 PHOTO: Parsed JSON\n`);
            const imageDescription = visionData.choices?.[0]?.message?.content || "No se pudo describir la imagen.";

            // 3. Inject description and caption into context
            const combinedMessage = `[IMAGEN RECIBIDA]\nDescripción visual de la imagen generada por IA:\n"${imageDescription}"\n\nTiene el siguiente título o mensaje del usuario acompañándola: "${userCaption}"`;

            // 4. Pass to main agent loop
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 📸 PHOTO: Calling runAgentLoop\n`);
            const reply = await runAgentLoop(userId, combinedMessage);
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 📸 PHOTO: runAgentLoop complete. Sending reply...\n`);
            await sendToUser(userId, reply);
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] 📸 PHOTO: Complete!\n`);

        } catch (error) {
            const errStr = error instanceof Error ? error.stack : String(error);
            fs.appendFileSync('debug.log', `[${new Date().toISOString()}] ❌ PHOTO ERROR: ${errStr}\n`);
            const isTimeout = error instanceof Error && error.name === "AbortError";
            console.error(`❌ Error processing photo:`, isTimeout ? "Request timed out" : error);
            await ctx.reply(isTimeout ? "⚠️ La lectura de imagen tardó demasiado y el sistema la canceló." : "⚠️ Hubo un error procesando la imagen.");
        }
    });
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

            // Start checking for scheduled reminders
            startProactiveLoop();
        },
    });
}

export function stopBot(): void {
    bot.stop();
}
