// ═══════════════════════════════════════════════════════
// OpenRIP — SQLite Memory Module
// Persistent storage for conversations and facts.
// ═══════════════════════════════════════════════════════

import Database from "better-sqlite3";
import { config } from "../config.js";

let db: Database.Database;

export function initDatabase(): void {
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

    CREATE INDEX IF NOT EXISTS idx_conv_user
      ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_facts_user
      ON facts(user_id);
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

export function closeDatabase(): void {
    db?.close();
}
