'use strict';

const { getDatabase } = require('./index');

// --- Team Config CRUD ---

/**
 * @param {object} config - must include channel_id
 */
function upsertTeamConfig(config) {
  const db = getDatabase();
  const defaults = {
    channel_name: null,
    required_approvals: 2,
    notify_on_open: 1,
    notify_on_ready: 1,
    notify_on_changes_requested: 1,
    notify_on_approved: 1,
    notify_on_merged: 0,
    exclude_bot_comments: 1,
    post_trigger: 'on_open',
    trigger_label: null,
  };

  const merged = { ...defaults, ...config, updated_at: new Date().toISOString() };

  db.prepare(`
    INSERT INTO team_configs (
      channel_id, channel_name, required_approvals,
      notify_on_open, notify_on_ready, notify_on_changes_requested,
      notify_on_approved, notify_on_merged, exclude_bot_comments,
      post_trigger, trigger_label, updated_at
    ) VALUES (
      @channel_id, @channel_name, @required_approvals,
      @notify_on_open, @notify_on_ready, @notify_on_changes_requested,
      @notify_on_approved, @notify_on_merged, @exclude_bot_comments,
      @post_trigger, @trigger_label, @updated_at
    )
    ON CONFLICT(channel_id) DO UPDATE SET
      channel_name = @channel_name,
      required_approvals = @required_approvals,
      notify_on_open = @notify_on_open,
      notify_on_ready = @notify_on_ready,
      notify_on_changes_requested = @notify_on_changes_requested,
      notify_on_approved = @notify_on_approved,
      notify_on_merged = @notify_on_merged,
      exclude_bot_comments = @exclude_bot_comments,
      post_trigger = @post_trigger,
      trigger_label = @trigger_label,
      updated_at = @updated_at
  `).run(merged);
}

/**
 * @param {string} channelId
 * @returns {object|undefined}
 */
function getTeamConfig(channelId) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM team_configs WHERE channel_id = ?').get(channelId);
}

/**
 * @returns {object[]}
 */
function getAllTeamConfigs() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM team_configs').all();
}

/**
 * @param {string} channelId
 */
function deleteTeamConfig(channelId) {
  const db = getDatabase();
  db.prepare('DELETE FROM team_configs WHERE channel_id = ?').run(channelId);
}

// --- Team Members CRUD ---

/**
 * @param {string} channelId
 * @param {string} githubUsername
 * @param {string} [slackUserId]
 * @param {string} [addedBy]
 */
function addTeamMember(channelId, githubUsername, slackUserId, addedBy) {
  const db = getDatabase();
  try {
    db.prepare(`
      INSERT INTO team_members (channel_id, github_username, slack_user_id, added_by_slack_user)
      VALUES (?, ?, ?, ?)
    `).run(channelId, githubUsername, slackUserId || null, addedBy || null);
  } catch (error) {
    if (!error.message?.includes('UNIQUE constraint')) {
      throw error;
    }
  }
}

/**
 * @param {string} channelId
 * @param {string} githubUsername
 */
function removeTeamMember(channelId, githubUsername) {
  const db = getDatabase();
  db.prepare('DELETE FROM team_members WHERE channel_id = ? AND github_username = ?').run(channelId, githubUsername);
}

/**
 * @param {string} channelId
 * @returns {object[]}
 */
function getTeamMembers(channelId) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM team_members WHERE channel_id = ? ORDER BY added_at').all(channelId);
}

/**
 * @param {string} channelId
 */
function clearTeamMembers(channelId) {
  const db = getDatabase();
  db.prepare('DELETE FROM team_members WHERE channel_id = ?').run(channelId);
}

// --- Team Repos CRUD ---

/**
 * @param {string} channelId
 * @param {string} repoName
 */
function addTeamRepo(channelId, repoName) {
  const db = getDatabase();
  try {
    db.prepare(`
      INSERT INTO team_repos (channel_id, repo_name)
      VALUES (?, ?)
    `).run(channelId, repoName);
  } catch (error) {
    if (!error.message?.includes('UNIQUE constraint')) {
      throw error;
    }
  }
}

/**
 * @param {string} channelId
 * @param {string} repoName
 */
function removeTeamRepo(channelId, repoName) {
  const db = getDatabase();
  db.prepare('DELETE FROM team_repos WHERE channel_id = ? AND repo_name = ?').run(channelId, repoName);
}

/**
 * @param {string} channelId
 * @returns {object[]}
 */
function getTeamRepos(channelId) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM team_repos WHERE channel_id = ? ORDER BY added_at').all(channelId);
}

/**
 * @param {string} channelId
 */
function clearTeamRepos(channelId) {
  const db = getDatabase();
  db.prepare('DELETE FROM team_repos WHERE channel_id = ?').run(channelId);
}

// --- Helper: Get full team configuration ---

/**
 * @param {string} channelId
 * @returns {object|null}
 */
function getFullTeamConfig(channelId) {
  const config = getTeamConfig(channelId);
  if (!config) return null;

  const members = getTeamMembers(channelId);
  const repos = getTeamRepos(channelId);

  return {
    channelId: config.channel_id,
    channelName: config.channel_name,
    requiredApprovals: config.required_approvals,
    postTrigger: config.post_trigger === 'on_label' ? 'on_label' : 'on_open',
    triggerLabel: config.trigger_label,
    notifyOnReady: Boolean(config.notify_on_ready),
    notifyOnChangesRequested: Boolean(config.notify_on_changes_requested),
    notifyOnApproved: Boolean(config.notify_on_approved),
    notifyOnMerged: Boolean(config.notify_on_merged),
    excludeBotComments: Boolean(config.exclude_bot_comments),
    members: members.map(m => ({
      github: m.github_username,
      slack: m.slack_user_id ? `<@${m.slack_user_id}>` : undefined,
    })),
    repos: repos.map(r => r.repo_name),
  };
}

// --- Query: Find teams tracking a GitHub user ---

/**
 * @param {string} githubUsername
 * @returns {string[]}
 */
function findTeamsTrackingUser(githubUsername) {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT DISTINCT channel_id FROM team_members WHERE github_username = ?
  `).all(githubUsername);
  return rows.map(r => r.channel_id);
}

// --- Query: Get Slack user ID for a GitHub user from team mappings ---

/**
 * @param {string} githubUsername
 * @param {string} [channelId]
 * @returns {string|undefined}
 */
function getSlackUserIdForGithubUser(githubUsername, channelId) {
  const db = getDatabase();

  if (channelId) {
    const row = db.prepare(`
      SELECT slack_user_id FROM team_members
      WHERE github_username = ? AND channel_id = ? AND slack_user_id IS NOT NULL
    `).get(githubUsername, channelId);
    if (row) return row.slack_user_id;
  }

  const row = db.prepare(`
    SELECT slack_user_id FROM team_members
    WHERE github_username = ? AND slack_user_id IS NOT NULL
    LIMIT 1
  `).get(githubUsername);

  return row?.slack_user_id;
}

// --- Query: Find teams tracking a repo ---

/**
 * @param {string} repoName
 * @returns {string[]}
 */
function findTeamsTrackingRepo(repoName) {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT DISTINCT channel_id FROM team_repos WHERE repo_name = ?
  `).all(repoName);
  return rows.map(r => r.channel_id);
}

// --- Query: Find teams tracking a user AND repo ---

/**
 * @param {string} githubUsername
 * @param {string} repoName
 * @returns {string[]}
 */
function findTeamsTrackingUserAndRepo(githubUsername, repoName) {
  const db = getDatabase();

  const userTeams = findTeamsTrackingUser(githubUsername);
  if (userTeams.length === 0) return [];

  const repoTeams = findTeamsTrackingRepo(repoName);

  const allRepoTeams = db.prepare(`
    SELECT channel_id FROM team_configs
    WHERE channel_id NOT IN (SELECT DISTINCT channel_id FROM team_repos)
  `).all();

  const allRepoTeamIds = allRepoTeams.map(t => t.channel_id);

  return userTeams.filter(channelId =>
    repoTeams.includes(channelId) || allRepoTeamIds.includes(channelId)
  );
}

// --- User App Home State Management ---

/**
 * @param {string} userId
 * @param {string} channelId
 */
function setUserSelectedChannel(userId, channelId) {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO user_app_home_state (user_id, selected_channel_id, last_updated)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      selected_channel_id = ?,
      last_updated = datetime('now')
  `).run(userId, channelId, channelId);
}

/**
 * @param {string} userId
 * @returns {string|null}
 */
function getUserSelectedChannel(userId) {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT selected_channel_id FROM user_app_home_state WHERE user_id = ?
  `).get(userId);
  return row?.selected_channel_id || null;
}

module.exports = {
  upsertTeamConfig,
  getTeamConfig,
  getAllTeamConfigs,
  deleteTeamConfig,
  addTeamMember,
  removeTeamMember,
  getTeamMembers,
  clearTeamMembers,
  addTeamRepo,
  removeTeamRepo,
  getTeamRepos,
  clearTeamRepos,
  getFullTeamConfig,
  findTeamsTrackingUser,
  getSlackUserIdForGithubUser,
  findTeamsTrackingRepo,
  findTeamsTrackingUserAndRepo,
  setUserSelectedChannel,
  getUserSelectedChannel,
};
