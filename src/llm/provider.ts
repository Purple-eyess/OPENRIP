// ═══════════════════════════════════════════════════════
// OpenRIP — LLM Provider Facade
// Tries Groq first, falls back to OpenRouter on error.
// ═══════════════════════════════════════════════════════

import { groqChatCompletion } from "./groq.js";
import { openRouterChatCompletion } from "./openrouter.js";
import type { LLMMessage, LLMResponse, ToolDefinition } from "./types.js";

export type { LLMMessage, LLMResponse, ToolDefinition };

export async function chatCompletion(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
): Promise<LLMResponse> {
    try {
        console.log("🧠 LLM → Groq");
        return await groqChatCompletion(messages, tools);
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️  Groq failed: ${errMsg}`);
        console.log("🧠 LLM → OpenRouter (fallback)");

        try {
            return await openRouterChatCompletion(messages, tools);
        } catch (fallbackError) {
            const fbMsg =
                fallbackError instanceof Error
                    ? fallbackError.message
                    : String(fallbackError);
            throw new Error(
                `All LLM providers failed.\n  Groq: ${errMsg}\n  OpenRouter: ${fbMsg}`
            );
        }
    }
}
