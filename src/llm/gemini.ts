// ═══════════════════════════════════════════════════════
// OpenRIP — Google Gemini LLM Provider (Primary)
// ═══════════════════════════════════════════════════════

import { GoogleGenerativeAI, type Content, type Tool } from "@google/generative-ai";
import { config } from "../config.js";
import type { LLMMessage, LLMResponse, ToolDefinition } from "./types.js";

const MODEL = "gemini-2.0-flash";

// Convert OpenAI-style messages to Gemini format
function toGeminiContents(messages: LLMMessage[]): {
    systemInstruction: string;
    contents: Content[];
} {
    let systemInstruction = "";
    const contents: Content[] = [];

    for (const msg of messages) {
        if (msg.role === "system") {
            systemInstruction += (msg.content ?? "") + "\n";
            continue;
        }

        if (msg.role === "tool") {
            // Tool result → functionResponse part
            contents.push({
                role: "user",
                parts: [
                    {
                        functionResponse: {
                            name: msg.name ?? "unknown",
                            response: { result: msg.content ?? "" },
                        },
                    },
                ],
            });
            continue;
        }

        if (msg.role === "assistant") {
            const parts: Content["parts"] = [];

            // If there are tool calls, add them as functionCall parts
            if (msg.tool_calls && msg.tool_calls.length > 0) {
                for (const tc of msg.tool_calls) {
                    let args: Record<string, unknown> = {};
                    try {
                        args = JSON.parse(tc.function.arguments);
                    } catch { }
                    parts.push({
                        functionCall: {
                            name: tc.function.name,
                            args,
                        },
                    });
                }
            } else if (msg.content) {
                parts.push({ text: msg.content });
            }

            if (parts.length > 0) {
                contents.push({ role: "model", parts });
            }
            continue;
        }

        // user message
        contents.push({
            role: "user",
            parts: [{ text: msg.content ?? "" }],
        });
    }

    return { systemInstruction: systemInstruction.trim(), contents };
}

// Convert our tool definitions to Gemini format
function toGeminiTools(tools: ToolDefinition[]): Tool[] {
    return [
        {
            functionDeclarations: tools.map((t) => ({
                name: t.function.name,
                description: t.function.description,
                parameters: t.function.parameters as any,
            })),
        },
    ];
}

export async function geminiChatCompletion(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
): Promise<LLMResponse> {
    if (!config.GEMINI_API_KEY) {
        throw new Error("Gemini API key is not configured");
    }

    const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    const { systemInstruction, contents } = toGeminiContents(messages);

    const modelConfig: any = { model: MODEL };
    if (systemInstruction) {
        modelConfig.systemInstruction = systemInstruction;
    }
    if (tools && tools.length > 0) {
        modelConfig.tools = toGeminiTools(tools);
    }

    const model = genAI.getGenerativeModel(modelConfig as Parameters<typeof genAI.getGenerativeModel>[0]);

    const result = await model.generateContent({ contents });
    const candidate = result.response.candidates?.[0];

    if (!candidate) {
        throw new Error("Gemini returned no candidates");
    }

    const parts = candidate.content?.parts ?? [];

    // Check for function calls
    const functionCallParts = parts.filter((p: any) => p.functionCall);
    if (functionCallParts.length > 0) {
        const tool_calls = functionCallParts.map((p: any, i: number) => ({
            id: `gemini-call-${i}`,
            type: "function" as const,
            function: {
                name: p.functionCall!.name,
                arguments: JSON.stringify(p.functionCall!.args ?? {}),
            },
        }));

        return {
            content: null,
            tool_calls,
            finish_reason: "tool_calls",
        };
    }

    // Text response
    const text = parts
        .filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join("");

    return {
        content: text || null,
        tool_calls: null,
        finish_reason: "stop",
    };
}
