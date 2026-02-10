import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

let db: Database.Database;

export function initDatabase(dbPath?: string): Database.Database {
  const resolvedPath = dbPath || path.join(process.cwd(), 'data', 'pr-bot.db');

  // Ensure directory exists
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS pr_messages (
      pr_url TEXT PRIMARY KEY,
      slack_channel TEXT NOT NULL,
      slack_message_ts TEXT NOT NULL,
      pr_state TEXT NOT NULL DEFAULT 'open',
      owner TEXT NOT NULL,
      repo TEXT NOT NULL,
      pr_number INTEGER NOT NULL,
      last_updated TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_mappings (
      github_username TEXT PRIMARY KEY,
      slack_user_id TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pr_messages_state ON pr_messages(pr_state);
    CREATE INDEX IF NOT EXISTS idx_pr_messages_repo ON pr_messages(owner, repo);
  `);

  logger.info('Database initialized', { path: resolvedPath });
  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}
