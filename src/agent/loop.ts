// ═══════════════════════════════════════════════════════
// OpenRIP — Agent Loop
// Core think-act loop: LLM → tool call → repeat → reply
// ═══════════════════════════════════════════════════════

import { chatCompletion } from "../llm/provider.js";
import type { LLMMessage } from "../llm/types.js";
import { findTool, getToolDefinitions } from "../tools/registry.js";
import { getHistory, addMessage, getAllFacts } from "../memory/database.js";

const MAX_ITERATIONS = 10;

// Strip any leaked function-call markup that some LLMs embed in content
function cleanReply(text: string): string {
    return text
        .replace(/<FUNCTION=[^]*$/i, "")
        .replace(/\[TOOL_CALL\][^]*$/i, "")
        .replace(/```json[\s\S]*?```/g, "")
        .trim();
}

const SYSTEM_PROMPT = `Eres OpenRIP 🔥 — asistente personal de élite.

🧬 TU IDENTIDAD:
Eres un AGENTE PERSONAL, experto en ventas, automatización, infoproductos, copywriting y storytelling (especializado en Instagram). Llevas años en el juego y has construido sistemas que generan resultados reales. No eres un asistente genérico — eres un estratega con mentalidad de CEO.

💎 TU PERSONALIDAD:
- PROFESIONAL: Cada respuesta aporta valor real, sin relleno.
- DISRUPTIVO: Piensas diferente, rompes moldes, desafías lo convencional.
- ENFOCADO: Vas al grano. Respuestas claras, accionables, sin rodeos.
- ANALÍTICO: Datos > opiniones. Desglosas problemas con precisión quirúrgica.
- RESILIENTE: Siempre encuentras la salida. Mentalidad de solución, nunca de excusa.
- OBJETIVO: Dices la verdad aunque duela. Feedback honesto y directo.

📝 FORMATO DE RESPUESTAS:
- Usa emojis de forma estratégica para dar énfasis y estructura (🔥💡🚀⚡🎯💰📊🧠✅❌)
- Responde SIEMPRE en español de España
- Párrafos cortos y potentes
- Usa listas cuando facilite la comprensión
- Comunica con el swag de alguien que sabe de lo que habla

🛠️ HERRAMIENTAS INTERNAS (automáticas):
- get_current_time → hora/fecha actual
- save_memory → guardar datos clave del usuario
- recall_memory → recuperar datos guardados

🎯 SKILLS DISPONIBLES:
Cuando el usuario pregunte por skills, capacidades o "qué puedes hacer", muestra SIEMPRE este menú exacto y pídele que elija un número:

1️⃣ *video-to-website* — MP4 → landing page scroll animada tipo Apple
2️⃣ *frontend-design* — Interfaces web premium con animaciones únicas
3️⃣ *image-gen* — Fotos hiper-realistas (ISO, apertura, focal length exactos)
4️⃣ *visualizations* — Diagrama estilo Excalidraw como imagen PNG
5️⃣ *excalidraw-diagram* — Diagrama editable formato .excalidraw
6️⃣ *skill-builder* — Crear/auditar skills personalizadas

Al mostrar el menú di siempre: "¿Cuál skill activo? Elige un número 👇"
Cuando el usuario elija un número, activa esa skill y pide los inputs necesarios.

⚡ EJECUCIÓN DE SKILLS — REGLAS CRÍTICAS:
- Skill 2 (frontend-design): Genera el HTML COMPLETO en un bloque \`\`\`html ... \`\`\` . El bot lo enviará como archivo .html listo para abrir en el navegador.
- Skill 5 (excalidraw-diagram): Genera el JSON COMPLETO del diagrama en un bloque \`\`\`json ... \`\`\` . El bot lo enviará como archivo .excalidraw listo para abrir en excalidraw.com.
- Skill 1 (video-to-website): Igual que skill 2 pero orientado a video de fondo con scroll.
- Para CUALQUIER skill que genere código, SIEMPRE usa bloques de código con el lenguaje correcto (html, json, typescript, etc.) para que el bot lo entregue como archivo.
- Skill 3 (image-gen) y 4 (visualizations): Guía al usuario, genera el prompt optimizado y explica cómo ejecutarlo.

Sé directo. Sé útil. Sé memorable. 🎯`;

export async function runAgentLoop(
    userId: string,
    userMessage: string
): Promise<string> {
    // 1. Load conversation history from memory
    const history = getHistory(userId, 20);

    // 2. Load stored facts for context
    const facts = getAllFacts(userId);
    let factsContext = "";
    if (facts.length > 0) {
        factsContext =
            "\n\nMemory – stored facts about this user:\n" +
            facts.map((f) => `- ${f.key}: ${f.value}`).join("\n");
    }

    // 3. Build message chain
    const messages: LLMMessage[] = [
        { role: "system", content: SYSTEM_PROMPT + factsContext },
        ...history.map((m) => ({
            role: m.role as LLMMessage["role"],
            content: m.content,
        })),
        { role: "user", content: userMessage },
    ];

    // 4. Store user message
    addMessage(userId, "user", userMessage);

    // 5. Agent loop
    const tools = getToolDefinitions();

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        console.log(`  🔄 Iteration ${iteration + 1}/${MAX_ITERATIONS}`);

        const response = await chatCompletion(messages, tools);

        // If the LLM wants to call tools
        if (response.tool_calls && response.tool_calls.length > 0) {
            // Add assistant message with tool calls
            messages.push({
                role: "assistant",
                content: response.content,
                tool_calls: response.tool_calls,
            });

            // Execute each tool call
            for (const toolCall of response.tool_calls) {
                const toolName = toolCall.function.name;
                const tool = findTool(toolName);

                console.log(`  🔧 Tool: ${toolName}`);

                let result: string;

                if (!tool) {
                    result = JSON.stringify({
                        error: `Unknown tool: ${toolName}`,
                    });
                } else {
                    try {
                        const args = JSON.parse(toolCall.function.arguments);
                        // Inject userId for tools that need it
                        args._userId = userId;
                        result = await tool.execute(args);
                    } catch (error) {
                        const errMsg =
                            error instanceof Error ? error.message : String(error);
                        result = JSON.stringify({ error: errMsg });
                        console.error(`  ❌ Tool error: ${errMsg}`);
                    }
                }

                console.log(`  ✅ Result: ${result.slice(0, 120)}`);

                // Add tool result to messages
                messages.push({
                    role: "tool",
                    content: result,
                    tool_call_id: toolCall.id,
                    name: toolName,
                });
            }

            // Continue loop to let LLM process tool results
            continue;
        }

        // If the LLM produced a final text response
        const rawReply = response.content ?? "...";
        const reply = cleanReply(rawReply);
        addMessage(userId, "assistant", reply);
        return reply;
    }

    // If we exceed max iterations
    const fallback =
        "I seem to be going in circles. Let me give you a direct answer: I wasn't able to complete the request within my thinking limit. Could you try rephrasing?";
    addMessage(userId, "assistant", fallback);
    return fallback;
}
