// ═══════════════════════════════════════════════════════
// OpenRIP — Entry Point
// Initializes all modules and starts the bot.
// ═══════════════════════════════════════════════════════

import { config } from "./config.js";
import { initDatabase, closeDatabase } from "./memory/database.js";
import { startBot, stopBot } from "./bot/telegram.js";

console.log("═══════════════════════════════════════════════════════");
console.log("  OpenRIP — Personal AI Agent");
console.log("═══════════════════════════════════════════════════════");
console.log(`  DB Path: ${config.DB_PATH}`);
console.log(`  LLM: Groq (primary) + OpenRouter (fallback)`);
console.log("");

// ── Initialize ───────────────────────────────────────
initDatabase();

// ── Start Bot ────────────────────────────────────────
startBot();

// ── Graceful Shutdown ────────────────────────────────
function shutdown(signal: string) {
    console.log(`\n🛑 Received ${signal}, shutting down...`);
    stopBot();
    closeDatabase();
    console.log("👋 OpenRIP is offline. Goodbye!");
    process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
