// ═══════════════════════════════════════════════════════
// OpenRIP — Proactive Loop
// Automatically triggers scheduled reminders and messages.
// ═══════════════════════════════════════════════════════

import { getPendingReminders, markReminderDone } from "../memory/database.js";
import { runAgentLoop } from "../agent/loop.js";
import { sendToUser } from "./telegram.js";

const CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds

export function startProactiveLoop() {
    console.log("⏰ Started proactive reminder loop.");
    setInterval(checkReminders, CHECK_INTERVAL_MS);
}

async function checkReminders() {
    try {
        const nowIso = new Date().toISOString();
        const pending = getPendingReminders(nowIso);

        for (const reminder of pending) {
            console.log(`⏰ Triggering reminder ${reminder.id} for user ${reminder.user_id}: ${reminder.topic}`);

            // Mark as done immediately to avoid double triggers
            markReminderDone(reminder.id);

            // Construct a silent prompt for the agent to process the reminder
            const hiddenPrompt = `[SYSTEM NOTIFICATION]\nEs momento de enviar un recordatorio programado al usuario.
Tema del recordatorio: "${reminder.topic}".
Por favor, formula un mensaje natural, directo y fiel a tu personalidad (usando tu swag y emojis si es necesario) para avisarle de esto al usuario de forma proactiva. No digas que esto es un prompt automático, actúa como si te acabaras de acordar y le escribes.`;

            try {
                // Run the agent loop with this prompt
                const reply = await runAgentLoop(reminder.user_id, hiddenPrompt);

                // Send the agent's generated reply directly to the user
                await sendToUser(reminder.user_id, reply);
            } catch (err) {
                console.error(`❌ Failed to process reminder ${reminder.id}:`, err);
            }
        }
    } catch (err) {
        console.error("❌ Error in proactive loop:", err);
    }
}
