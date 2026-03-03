'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { logger } = require('../logger');

/** @type {import('better-sqlite3').Database} */
let db;

/**
 * @param {string} [dbPath]
 * @returns {import('better-sqlite3').Database}
 */
function initDatabase(dbPath) {
  const resolvedPath = dbPath || path.join(process.cwd(), 'data', 'pr-bot.db');

  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);

  db.pragma('journal_mode = WAL');

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

    CREATE TABLE IF NOT EXISTS team_configs (
      channel_id TEXT PRIMARY KEY,
      channel_name TEXT,
      required_approvals INTEGER DEFAULT 2,
      notify_on_open INTEGER DEFAULT 1,
      notify_on_ready INTEGER DEFAULT 1,
      notify_on_changes_requested INTEGER DEFAULT 1,
      notify_on_approved INTEGER DEFAULT 1,
      notify_on_merged INTEGER DEFAULT 0,
      exclude_bot_comments INTEGER DEFAULT 1,
      post_trigger TEXT DEFAULT 'on_open',
      trigger_label TEXT,
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

    CREATE TABLE IF NOT EXISTS user_app_home_state (
      user_id TEXT PRIMARY KEY,
      selected_channel_id TEXT,
      last_updated TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_pr_messages_state ON pr_messages(pr_state);
    CREATE INDEX IF NOT EXISTS idx_pr_messages_repo ON pr_messages(owner, repo);
    CREATE INDEX IF NOT EXISTS idx_team_members_channel ON team_members(channel_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_github ON team_members(github_username);
    CREATE INDEX IF NOT EXISTS idx_team_repos_channel ON team_repos(channel_id);
  `);

  runMigrations(db);

  logger.info('Database initialized', { path: resolvedPath });
  return db;
}

/**
 * @param {import('better-sqlite3').Database} db
 */
function runMigrations(db) {
  try {
    const tableInfo = db.prepare('PRAGMA table_info(team_configs)').all();

    if (!tableInfo.some(col => col.name === 'exclude_bot_comments')) {
      db.exec('ALTER TABLE team_configs ADD COLUMN exclude_bot_comments INTEGER DEFAULT 1');
      logger.info('Migration applied: Added exclude_bot_comments column');
    }

    if (!tableInfo.some(col => col.name === 'post_trigger')) {
      db.exec("ALTER TABLE team_configs ADD COLUMN post_trigger TEXT DEFAULT 'on_open'");
      db.exec('ALTER TABLE team_configs ADD COLUMN trigger_label TEXT');
      logger.info('Migration applied: Added post_trigger and trigger_label columns');
    }
  } catch (error) {
    logger.error('Migration error', { error: error.message });
  }
}

/**
 * @returns {import('better-sqlite3').Database}
 */
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

module.exports = { initDatabase, getDatabase };
