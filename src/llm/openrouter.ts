// ═══════════════════════════════════════════════════════
// OpenRIP — OpenRouter LLM Provider (Fallback)
// Uses the OpenAI-compatible API.
// ═══════════════════════════════════════════════════════

import { config } from "../config.js";
import type { LLMMessage, LLMResponse, ToolDefinition } from "./types.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export async function openRouterChatCompletion(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
): Promise<LLMResponse> {
    if (!config.OPENROUTER_API_KEY) {
        throw new Error("OpenRouter API key is not configured");
    }

    const body: Record<string, unknown> = {
        model: config.OPENROUTER_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
    };

    if (tools && tools.length > 0) {
        body.tools = tools;
        body.tool_choice = "auto";
    }

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/openrip",
            "X-Title": "OpenRIP Agent",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
        choices: Array<{
            message: {
                content: string | null;
                tool_calls?: LLMResponse["tool_calls"];
            };
            finish_reason: string;
        }>;
    };

    const choice = data.choices[0];

    return {
        content: choice.message.content ?? null,
        tool_calls: choice.message.tool_calls ?? null,
        finish_reason: choice.finish_reason ?? "stop",
    };
}
