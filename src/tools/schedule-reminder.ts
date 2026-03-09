import type { Tool } from "./types.js";
import { addReminder } from "../memory/database.js";

interface ScheduleReminderArgs {
    _userId: string;
    topic: string;
    triggerTimeIso: string;
}

export const scheduleReminderTool: Tool = {
    name: "schedule_reminder",
    description: "Schedules a proactive message or reminder to be sent to the user in the future. The system will automatically wake up and prompt you to send a message about this topic at the specified time.",
    parameters: {
        type: "object",
        properties: {
            topic: {
                type: "string",
                description: "The topic or content of the reminder. Example: 'Remind the user to drink water' or 'Send a daily summary of scheduled tasks'.",
            },
            triggerTimeIso: {
                type: "string",
                description: "The exact time to trigger the reminder, in ISO 8601 format. Example: '2026-03-08T15:30:00Z'. ALWAYS use the get_current_time tool first if you need to calculate relative times (e.g. 'in 2 hours').",
            },
        },
        required: ["topic", "triggerTimeIso"],
    },
    async execute(args: string | Record<string, unknown>) {
        const { _userId, topic, triggerTimeIso } = (
            typeof args === "string" ? JSON.parse(args) : args
        ) as ScheduleReminderArgs;

        if (!_userId) throw new Error("Missing user ID");
        if (!topic) throw new Error("Missing topic");
        if (!triggerTimeIso) throw new Error("Missing triggerTimeIso");

        // Validate date
        const date = new Date(triggerTimeIso);
        if (isNaN(date.getTime())) {
            throw new Error(`Invalid ISO date format: ${triggerTimeIso}`);
        }

        try {
            addReminder(_userId, topic, date.toISOString());
            return `✅ Reminder scheduled successfully for ${date.toLocaleString()}. I will automatically wake up at that time to send the message.`;
        } catch (error) {
            return `❌ Failed to schedule reminder: ${error instanceof Error ? error.message : String(error)}`;
        }
    },
};
