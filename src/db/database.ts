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

    -- Multi-team configuration tables
    CREATE TABLE IF NOT EXISTS team_configs (
      channel_id TEXT PRIMARY KEY,
      channel_name TEXT,
      required_approvals INTEGER DEFAULT 2,
      notify_on_open INTEGER DEFAULT 1,
      notify_on_ready INTEGER DEFAULT 1,
      notify_on_changes_requested INTEGER DEFAULT 1,
      notify_on_approved INTEGER DEFAULT 1,
      notify_on_merged INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      github_username TEXT NOT NULL,
      slack_user_id TEXT,
      added_by_slack_user TEXT,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (channel_id) REFERENCES team_configs(channel_id) ON DELETE CASCADE,
      UNIQUE(channel_id, github_username)
    );

    CREATE TABLE IF NOT EXISTS team_repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      repo_name TEXT NOT NULL,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (channel_id) REFERENCES team_configs(channel_id) ON DELETE CASCADE,
      UNIQUE(channel_id, repo_name)
    );

    CREATE INDEX IF NOT EXISTS idx_pr_messages_state ON pr_messages(pr_state);
    CREATE INDEX IF NOT EXISTS idx_pr_messages_repo ON pr_messages(owner, repo);
    CREATE INDEX IF NOT EXISTS idx_team_members_channel ON team_members(channel_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_github ON team_members(github_username);
    CREATE INDEX IF NOT EXISTS idx_team_repos_channel ON team_repos(channel_id);
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
