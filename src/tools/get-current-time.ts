// ═══════════════════════════════════════════════════════
// OpenRIP — Tool: get_current_time
// Returns the current date and time.
// ═══════════════════════════════════════════════════════

import type { Tool } from "./types.js";

export const getCurrentTimeTool: Tool = {
    name: "get_current_time",
    description:
        "Returns the current date and time in ISO format and human-readable format. Use this when the user asks for the current time or date.",
    parameters: {
        type: "object",
        properties: {
            timezone: {
                type: "string",
                description:
                    'IANA timezone string (e.g. "America/New_York", "Europe/Madrid"). Defaults to system timezone.',
            },
        },
    },
    execute: async (args) => {
        const tz = (args.timezone as string) || undefined;
        const now = new Date();

        const isoString = now.toISOString();
        const humanReadable = now.toLocaleString("es-ES", {
            timeZone: tz,
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });

        return JSON.stringify({
            iso: isoString,
            human: humanReadable,
            timezone: tz ?? "system",
        });
    },
};
