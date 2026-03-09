// ═══════════════════════════════════════════════════════
// OpenRIP — LLM Provider Facade
// Tries Gemini first, then Groq, then OpenRouter as fallback.
// ═══════════════════════════════════════════════════════

import { geminiChatCompletion } from "./gemini.js";
import { groqChatCompletion } from "./groq.js";
import { openRouterChatCompletion } from "./openrouter.js";
import { config } from "../config.js";
import type { LLMMessage, LLMResponse, ToolDefinition } from "./types.js";

export type { LLMMessage, LLMResponse, ToolDefinition };

export async function chatCompletion(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
): Promise<LLMResponse> {
    // Try Gemini first (if API key is set)
    if (config.GEMINI_API_KEY) {
        try {
            console.log("🧠 LLM → Gemini 2.0 Flash");
            return await geminiChatCompletion(messages, tools);
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.warn(`⚠️  Gemini failed: ${errMsg}`);
        }
    }

    // Try Groq as fallback
    if (config.GROQ_API_KEY) {
        try {
            console.log("🧠 LLM → Groq (fallback)");
            return await groqChatCompletion(messages, tools);
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.warn(`⚠️  Groq failed: ${errMsg}`);
        }
    }

    // Final fallback: OpenRouter
    console.log("🧠 LLM → OpenRouter (last resort)");
    return await openRouterChatCompletion(messages, tools);
}
