// ═══════════════════════════════════════════════════════
// OpenRIP — Tool Registry
// Central registry of all available tools.
// ═══════════════════════════════════════════════════════

import type { Tool } from "./types.js";
import type { ToolDefinition } from "../llm/types.js";
import { getCurrentTimeTool } from "./get-current-time.js";
import { saveMemoryTool, recallMemoryTool } from "./memory-tools.js";
import { scheduleReminderTool } from "./schedule-reminder.js";

// ── Register all tools here ───────────────────────────
const allTools: Tool[] = [
    getCurrentTimeTool,
    saveMemoryTool,
    recallMemoryTool,
    scheduleReminderTool,
];

// ── Public API ────────────────────────────────────────

/** All registered tools */
export function getTools(): Tool[] {
    return allTools;
}

/** Find a tool by name */
export function findTool(name: string): Tool | undefined {
    return allTools.find((t) => t.name === name);
}

/** Convert tools to OpenAI-style function definitions for the LLM */
export function getToolDefinitions(): ToolDefinition[] {
    return allTools.map((tool) => ({
        type: "function" as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        },
    }));
}
