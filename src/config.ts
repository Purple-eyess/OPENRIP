// ═══════════════════════════════════════════════════════
// OpenRIP — Configuration
// Loads and validates all environment variables.
// ═══════════════════════════════════════════════════════

import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    // Telegram
    TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
    TELEGRAM_ALLOWED_USER_IDS: z
        .string()
        .min(1, "TELEGRAM_ALLOWED_USER_IDS is required")
        .transform((val) =>
            val
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean)
        ),

    // LLM — Gemini (primary)
    GEMINI_API_KEY: z.string().default(""),

    // LLM — Groq (secondary fallback)
    GROQ_API_KEY: z.string().default(""),

    // LLM — OpenRouter (fallback)
    OPENROUTER_API_KEY: z.string().default(""),
    OPENROUTER_MODEL: z
        .string()
        .default("meta-llama/llama-3.3-70b-instruct:free"),

    // Database
    DB_PATH: z.string().default(
        process.env.RENDER ? "/var/data/memory.db" :
            process.env.RAILWAY_ENVIRONMENT ? "/data/memory.db" :
                "./memory.db"
    ),

    // Google Cloud (future)
    GOOGLE_APPLICATION_CREDENTIALS: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error("❌ Invalid environment configuration:");
    for (const issue of parsed.error.issues) {
        console.error(`   → ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
}

export const config = parsed.data;
