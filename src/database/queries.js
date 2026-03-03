'use strict';

const { getDatabase } = require('./index');

// --- PR Messages ---

/**
 * @param {{ pr_url: string, slack_channel: string, slack_message_ts: string, pr_state: string, owner: string, repo: string, pr_number: number, last_updated: string }} row
 */
function upsertPRMessage(row) {
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

/**
 * @param {string} prUrl
 * @returns {object|undefined}
 */
function getPRMessage(prUrl) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM pr_messages WHERE pr_url = ?').get(prUrl);
}

/**
 * @returns {object[]}
 */
function getOpenPRMessages() {
  const db = getDatabase();
  return db.prepare("SELECT * FROM pr_messages WHERE pr_state = 'open'").all();
}

/**
 * @param {string} prUrl
 * @param {string} state
 */
function updatePRState(prUrl, state) {
  const db = getDatabase();
  db.prepare(`
    UPDATE pr_messages SET pr_state = ?, last_updated = datetime('now') WHERE pr_url = ?
  `).run(state, prUrl);
}

// --- User Mappings ---

/**
 * @param {string} githubUsername
 * @param {string} slackUserId
 */
function upsertUserMapping(githubUsername, slackUserId) {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO user_mappings (github_username, slack_user_id)
    VALUES (?, ?)
    ON CONFLICT(github_username) DO UPDATE SET slack_user_id = ?
  `).run(githubUsername, slackUserId, slackUserId);
}

/**
 * @param {string} githubUsername
 * @returns {string|undefined}
 */
function getUserMapping(githubUsername) {
  const db = getDatabase();
  const row = db.prepare('SELECT slack_user_id FROM user_mappings WHERE github_username = ?').get(githubUsername);
  return row?.slack_user_id;
}

/**
 * @returns {object[]}
 */
function getAllUserMappings() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM user_mappings').all();
}

/**
 * @param {string} mappingsStr
 */
function seedUserMappings(mappingsStr) {
  if (!mappingsStr) return;
  const pairs = mappingsStr.split(',').map(s => s.trim()).filter(Boolean);
  for (const pair of pairs) {
    const [ghUser, slackId] = pair.split(':').map(s => s.trim());
    if (ghUser && slackId) {
      upsertUserMapping(ghUser, slackId);
    }
  }
}

module.exports = {
  upsertPRMessage,
  getPRMessage,
  getOpenPRMessages,
  updatePRState,
  upsertUserMapping,
  getUserMapping,
  getAllUserMappings,
  seedUserMappings,
};
