import { getDatabase } from './database';
import { TeamConfigRow, TeamMemberRow, TeamRepoRow, TeamConfig } from '../types';

// --- Team Config CRUD ---

export function upsertTeamConfig(config: Partial<TeamConfigRow> & { channel_id: string }): void {
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
  };

  const merged = { ...defaults, ...config, updated_at: new Date().toISOString() };

  db.prepare(`
    INSERT INTO team_configs (
      channel_id, channel_name, required_approvals,
      notify_on_open, notify_on_ready, notify_on_changes_requested,
      notify_on_approved, notify_on_merged, exclude_bot_comments, updated_at
    ) VALUES (
      @channel_id, @channel_name, @required_approvals,
      @notify_on_open, @notify_on_ready, @notify_on_changes_requested,
      @notify_on_approved, @notify_on_merged, @exclude_bot_comments, @updated_at
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
      updated_at = @updated_at
  `).run(merged);
}

export function getTeamConfig(channelId: string): TeamConfigRow | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM team_configs WHERE channel_id = ?').get(channelId) as TeamConfigRow | undefined;
}

export function getAllTeamConfigs(): TeamConfigRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM team_configs').all() as TeamConfigRow[];
}

export function deleteTeamConfig(channelId: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM team_configs WHERE channel_id = ?').run(channelId);
}

// --- Team Members CRUD ---

export function addTeamMember(channelId: string, githubUsername: string, slackUserId?: string, addedBy?: string): void {
  const db = getDatabase();
  try {
    db.prepare(`
      INSERT INTO team_members (channel_id, github_username, slack_user_id, added_by_slack_user)
      VALUES (?, ?, ?, ?)
    `).run(channelId, githubUsername, slackUserId || null, addedBy || null);
  } catch (error: any) {
    // Ignore duplicate entries
    if (!error.message?.includes('UNIQUE constraint')) {
      throw error;
    }
  }
}

export function removeTeamMember(channelId: string, githubUsername: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM team_members WHERE channel_id = ? AND github_username = ?').run(channelId, githubUsername);
}

export function getTeamMembers(channelId: string): TeamMemberRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM team_members WHERE channel_id = ? ORDER BY added_at').all(channelId) as TeamMemberRow[];
}

export function clearTeamMembers(channelId: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM team_members WHERE channel_id = ?').run(channelId);
}

// --- Team Repos CRUD ---

export function addTeamRepo(channelId: string, repoName: string): void {
  const db = getDatabase();
  try {
    db.prepare(`
      INSERT INTO team_repos (channel_id, repo_name)
      VALUES (?, ?)
    `).run(channelId, repoName);
  } catch (error: any) {
    // Ignore duplicate entries
    if (!error.message?.includes('UNIQUE constraint')) {
      throw error;
    }
  }
}

export function removeTeamRepo(channelId: string, repoName: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM team_repos WHERE channel_id = ? AND repo_name = ?').run(channelId, repoName);
}

export function getTeamRepos(channelId: string): TeamRepoRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM team_repos WHERE channel_id = ? ORDER BY added_at').all(channelId) as TeamRepoRow[];
}

export function clearTeamRepos(channelId: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM team_repos WHERE channel_id = ?').run(channelId);
}

// --- Helper: Get full team configuration ---

export function getFullTeamConfig(channelId: string): TeamConfig | null {
  const config = getTeamConfig(channelId);
  if (!config) return null;

  const members = getTeamMembers(channelId);
  const repos = getTeamRepos(channelId);

  return {
    channelId: config.channel_id,
    channelName: config.channel_name,
    requiredApprovals: config.required_approvals,
    notifyOnOpen: Boolean(config.notify_on_open),
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

export function findTeamsTrackingUser(githubUsername: string): string[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT DISTINCT channel_id FROM team_members WHERE github_username = ?
  `).all(githubUsername) as { channel_id: string }[];
  return rows.map(r => r.channel_id);
}

// --- Query: Get Slack user ID for a GitHub user from team mappings ---

export function getSlackUserIdForGithubUser(githubUsername: string, channelId?: string): string | undefined {
  const db = getDatabase();

  // If channel specified, check team-specific mapping first
  if (channelId) {
    const row = db.prepare(`
      SELECT slack_user_id FROM team_members
      WHERE github_username = ? AND channel_id = ? AND slack_user_id IS NOT NULL
    `).get(githubUsername, channelId) as { slack_user_id: string } | undefined;
    if (row) return row.slack_user_id;
  }

  // Fallback: check if any team has this user mapped
  const row = db.prepare(`
    SELECT slack_user_id FROM team_members
    WHERE github_username = ? AND slack_user_id IS NOT NULL
    LIMIT 1
  `).get(githubUsername) as { slack_user_id: string } | undefined;

  return row?.slack_user_id;
}

// --- Query: Find teams tracking a repo ---

export function findTeamsTrackingRepo(repoName: string): string[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT DISTINCT channel_id FROM team_repos WHERE repo_name = ?
  `).all(repoName) as { channel_id: string }[];
  return rows.map(r => r.channel_id);
}

// --- Query: Find teams tracking a user AND repo ---

export function findTeamsTrackingUserAndRepo(githubUsername: string, repoName: string): string[] {
  const db = getDatabase();

  // Get teams tracking this user
  const userTeams = findTeamsTrackingUser(githubUsername);
  if (userTeams.length === 0) return [];

  // Get teams tracking this repo (or tracking all repos - no specific repos configured)
  const repoTeams = findTeamsTrackingRepo(repoName);

  // Get teams with no specific repos configured (they track all repos)
  const allRepoTeams = db.prepare(`
    SELECT channel_id FROM team_configs
    WHERE channel_id NOT IN (SELECT DISTINCT channel_id FROM team_repos)
  `).all() as { channel_id: string }[];

  const allRepoTeamIds = allRepoTeams.map(t => t.channel_id);

  // Teams must be tracking the user AND (tracking the repo OR tracking all repos)
  return userTeams.filter(channelId =>
    repoTeams.includes(channelId) || allRepoTeamIds.includes(channelId)
  );
}

// --- User App Home State Management ---

export function setUserSelectedChannel(userId: string, channelId: string): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO user_app_home_state (user_id, selected_channel_id, last_updated)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      selected_channel_id = ?,
      last_updated = datetime('now')
  `).run(userId, channelId, channelId);
}

export function getUserSelectedChannel(userId: string): string | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT selected_channel_id FROM user_app_home_state WHERE user_id = ?
  `).get(userId) as { selected_channel_id: string | null } | undefined;
  return row?.selected_channel_id || null;
}
