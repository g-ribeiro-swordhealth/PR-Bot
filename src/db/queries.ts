import { getDatabase } from './database';
import { PRMessageRow, UserMappingRow } from '../types';

// --- PR Messages ---

export function upsertPRMessage(row: PRMessageRow): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO pr_messages (pr_url, slack_channel, slack_message_ts, pr_state, owner, repo, pr_number, last_updated)
    VALUES (@pr_url, @slack_channel, @slack_message_ts, @pr_state, @owner, @repo, @pr_number, @last_updated)
    ON CONFLICT(pr_url) DO UPDATE SET
      slack_message_ts = @slack_message_ts,
      pr_state = @pr_state,
      last_updated = @last_updated
  `).run(row);
}

export function getPRMessage(prUrl: string): PRMessageRow | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM pr_messages WHERE pr_url = ?').get(prUrl) as PRMessageRow | undefined;
}

export function getOpenPRMessages(): PRMessageRow[] {
  const db = getDatabase();
  return db.prepare("SELECT * FROM pr_messages WHERE pr_state = 'open'").all() as PRMessageRow[];
}

export function updatePRState(prUrl: string, state: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE pr_messages SET pr_state = ?, last_updated = datetime('now') WHERE pr_url = ?
  `).run(state, prUrl);
}

// --- User Mappings ---

export function upsertUserMapping(githubUsername: string, slackUserId: string): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO user_mappings (github_username, slack_user_id)
    VALUES (?, ?)
    ON CONFLICT(github_username) DO UPDATE SET slack_user_id = ?
  `).run(githubUsername, slackUserId, slackUserId);
}

export function getUserMapping(githubUsername: string): string | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT slack_user_id FROM user_mappings WHERE github_username = ?').get(githubUsername) as UserMappingRow | undefined;
  return row?.slack_user_id;
}

export function getAllUserMappings(): UserMappingRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM user_mappings').all() as UserMappingRow[];
}

export function seedUserMappings(mappingsStr: string): void {
  if (!mappingsStr) return;
  const pairs = mappingsStr.split(',').map(s => s.trim()).filter(Boolean);
  for (const pair of pairs) {
    const [ghUser, slackId] = pair.split(':').map(s => s.trim());
    if (ghUser && slackId) {
      upsertUserMapping(ghUser, slackId);
    }
  }
}
