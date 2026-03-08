// ═══════════════════════════════════════════════════════
// OpenRIP — SQLite Memory Module
// Persistent storage for conversations and facts.
// ═══════════════════════════════════════════════════════

import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { config } from "../config.js";

let db: Database.Database;

export function initDatabase(): void {
    // Ensure the directory exists (needed for Railway/Render persistent volumes)
    mkdirSync(dirname(config.DB_PATH), { recursive: true });
    db = new Database(config.DB_PATH);

    // Enable WAL mode for better concurrency
    db.pragma("journal_mode = WAL");

    db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   TEXT    NOT NULL,
      role      TEXT    NOT NULL,
      content   TEXT,
      timestamp TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS facts (
      key       TEXT PRIMARY KEY,
      value     TEXT NOT NULL,
      user_id   TEXT NOT NULL,
      updated   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   TEXT    NOT NULL,
      event_type TEXT   NOT NULL,
      data      TEXT,
      timestamp TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_conv_user
      ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_facts_user
      ON facts(user_id);
    CREATE INDEX IF NOT EXISTS idx_events_user
      ON events(user_id);
  `);

    console.log("💾 SQLite database initialized");
}

// ── Conversation History ──────────────────────────────

export function addMessage(
    userId: string,
    role: string,
    content: string
): void {
    db.prepare(
        `INSERT INTO conversations (user_id, role, content) VALUES (?, ?, ?)`
    ).run(userId, role, content);
}

export function getHistory(
    userId: string,
    limit: number = 20
): Array<{ role: string; content: string }> {
    return db
        .prepare(
            `SELECT role, content FROM conversations
       WHERE user_id = ?
       ORDER BY id DESC LIMIT ?`
        )
        .all(userId, limit)
        .reverse() as Array<{ role: string; content: string }>;
}

// ── Persistent Facts ──────────────────────────────────

export function saveFact(
    userId: string,
    key: string,
    value: string
): void {
    db.prepare(
        `INSERT OR REPLACE INTO facts (key, value, user_id, updated)
     VALUES (?, ?, ?, datetime('now'))`
    ).run(key, value, userId);
}

export function getFact(
    userId: string,
    key: string
): string | null {
    const row = db
        .prepare(`SELECT value FROM facts WHERE key = ? AND user_id = ?`)
        .get(key, userId) as { value: string } | undefined;
    return row?.value ?? null;
}

export function getAllFacts(
    userId: string
): Array<{ key: string; value: string }> {
    return db
        .prepare(`SELECT key, value FROM facts WHERE user_id = ?`)
        .all(userId) as Array<{ key: string; value: string }>;
}

// ── Analytics & Metrics ───────────────────────────────

export function logEvent(
    userId: string,
    eventType: string,
    data?: string
): void {
    db.prepare(
        `INSERT INTO events (user_id, event_type, data) VALUES (?, ?, ?)`
    ).run(userId, eventType, data ?? null);
}

export interface SystemMetrics {
    totalUsers: number;
    totalMessages: number;
    totalFacts: number;
    toolsUsed: Record<string, number>;
}

export function getSystemMetrics(): SystemMetrics {
    const totalUsers = (db.prepare(`SELECT COUNT(DISTINCT user_id) as count FROM conversations`).get() as any).count;
    const totalMessages = (db.prepare(`SELECT COUNT(*) as count FROM conversations WHERE role = 'user'`).get() as any).count;
    const totalFacts = (db.prepare(`SELECT COUNT(*) as count FROM facts`).get() as any).count;
    
    const toolRows = db.prepare(`SELECT data as tool_name, COUNT(*) as count FROM events WHERE event_type = 'tool_executed' GROUP BY tool_name`).all() as Array<{ tool_name: string, count: number }>;
    const toolsUsed: Record<string, number> = {};
    for (const row of toolRows) {
        if (row.tool_name) toolsUsed[row.tool_name] = row.count;
    }

    return { totalUsers, totalMessages, totalFacts, toolsUsed };
}

export function closeDatabase(): void {
    db?.close();
}
