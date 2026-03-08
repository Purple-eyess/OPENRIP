// ═══════════════════════════════════════════════════════
// OpenRIP — Tools: save_memory & recall_memory
// Lets the agent persist and retrieve facts via SQLite.
// ═══════════════════════════════════════════════════════

import type { Tool } from "./types.js";
import { saveFact, getFact, getAllFacts } from "../memory/database.js";

export const saveMemoryTool: Tool = {
    name: "save_memory",
    description:
        "Save a piece of information to persistent memory. Use this when the user tells you something you should remember (preferences, facts, names, etc.).",
    parameters: {
        type: "object",
        properties: {
            key: {
                type: "string",
                description:
                    "A short descriptive key for the information (e.g. 'favorite_color', 'user_name').",
            },
            value: {
                type: "string",
                description: "The information to remember.",
            },
        },
        required: ["key", "value"],
    },
    execute: async (args) => {
        const key = args.key as string;
        const value = args.value as string;
        const userId = (args._userId as string) ?? "default";

        saveFact(userId, key, value);
        return JSON.stringify({
            success: true,
            message: `Saved "${key}" = "${value}" to memory.`,
        });
    },
};

export const recallMemoryTool: Tool = {
    name: "recall_memory",
    description:
        "Retrieve a specific piece of information from memory by key, or list all stored facts if no key is provided.",
    parameters: {
        type: "object",
        properties: {
            key: {
                type: "string",
                description:
                    "The key of the fact to recall. If omitted, returns all stored facts.",
            },
        },
    },
    execute: async (args) => {
        const key = args.key as string | undefined;
        const userId = (args._userId as string) ?? "default";

        if (key) {
            const value = getFact(userId, key);
            return JSON.stringify({
                key,
                value: value ?? "No memory found for this key.",
                found: value !== null,
            });
        }

        const facts = getAllFacts(userId);
        return JSON.stringify({
            total: facts.length,
            facts,
        });
    },
};
