// ═══════════════════════════════════════════════════════
// OpenRIP — Groq LLM Provider (Primary)
// ═══════════════════════════════════════════════════════

import Groq from "groq-sdk";
import type {
    ChatCompletionCreateParamsNonStreaming,
    ChatCompletionMessageParam,
    ChatCompletionTool,
} from "groq-sdk/resources/chat/completions.js";
import { config } from "../config.js";
import type { LLMMessage, LLMResponse, ToolDefinition } from "./types.js";

const groq = new Groq({ apiKey: config.GROQ_API_KEY });

const MODEL = "llama-3.3-70b-versatile";

export async function groqChatCompletion(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
): Promise<LLMResponse> {
    const params: ChatCompletionCreateParamsNonStreaming = {
        model: MODEL,
        messages: messages as ChatCompletionMessageParam[],
        temperature: 0.7,
        max_tokens: 2048,
    };

    if (tools && tools.length > 0) {
        params.tools = tools as ChatCompletionTool[];
        params.tool_choice = "auto";
    }

    const response = await groq.chat.completions.create(params);
    const choice = response.choices[0];

    return {
        content: choice.message.content ?? null,
        tool_calls: (choice.message.tool_calls as LLMResponse["tool_calls"]) ?? null,
        finish_reason: choice.finish_reason ?? "stop",
    };
}
