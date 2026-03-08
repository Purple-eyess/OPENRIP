// ═══════════════════════════════════════════════════════
// OpenRIP — Telegram Bot
// Grammy bot with long polling and user whitelist.
// ═══════════════════════════════════════════════════════

import { Bot } from "grammy";
import { config } from "../config.js";
import { runAgentLoop } from "../agent/loop.js";

const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

// ── Whitelist Middleware ──────────────────────────────
bot.use(async (ctx, next) => {
    const userId = ctx.from?.id?.toString();

    if (!userId || !config.TELEGRAM_ALLOWED_USER_IDS.includes(userId)) {
        console.log(`🚫 Unauthorized access attempt from user: ${userId ?? "unknown"}`);
        // Silently ignore unauthorized users
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
        // Show "typing..." indicator
        await ctx.replyWithChatAction("typing");

        // Run agent loop
        const reply = await runAgentLoop(userId, userMessage);

        // Send reply (split if too long for Telegram's 4096 char limit)
        if (reply.length <= 4096) {
            await ctx.reply(reply, { parse_mode: "Markdown" }).catch(async () => {
                // Fallback without Markdown if parsing fails
                await ctx.reply(reply);
            });
        } else {
            // Split into chunks
            const chunks = splitMessage(reply, 4096);
            for (const chunk of chunks) {
                await ctx.reply(chunk, { parse_mode: "Markdown" }).catch(async () => {
                    await ctx.reply(chunk);
                });
            }
        }

        console.log(`📤 Reply sent (${reply.length} chars)`);
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error processing message: ${errMsg}`);
        await ctx.reply(
            "⚠️ Algo ha ido mal procesando tu mensaje. Inténtalo de nuevo."
        );
    }
});

// ── /start Command ───────────────────────────────────
bot.command("start", async (ctx) => {
    await ctx.reply(
        "🔥 **OpenRIP Operativo**\n\n" +
        "Soy tu asistente personal de élite. 🧠\n\n" +
        "Mándame lo que necesites y nos ponemos a ello. Sin rodeos.\n",
        { parse_mode: "Markdown" }
    );
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

        // Try to split at a newline
        let splitIndex = remaining.lastIndexOf("\n", maxLength);
        if (splitIndex === -1 || splitIndex < maxLength / 2) {
            // Fall back to splitting at a space
            splitIndex = remaining.lastIndexOf(" ", maxLength);
        }
        if (splitIndex === -1) {
            splitIndex = maxLength;
        }

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
