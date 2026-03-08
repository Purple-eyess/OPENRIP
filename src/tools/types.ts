// ═══════════════════════════════════════════════════════
// OpenRIP — Tool Type Definitions
// ═══════════════════════════════════════════════════════

export interface Tool {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: Record<string, unknown>;
        required?: string[];
    };
    execute: (args: Record<string, unknown>) => Promise<string>;
}
