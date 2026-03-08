// ═══════════════════════════════════════════════════════
// OpenRIP — LLM Type Definitions
// ═══════════════════════════════════════════════════════

export interface LLMMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string | null;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
}

export interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

export interface ToolDefinition {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
}

export interface LLMResponse {
    content: string | null;
    tool_calls: ToolCall[] | null;
    finish_reason: string;
}
