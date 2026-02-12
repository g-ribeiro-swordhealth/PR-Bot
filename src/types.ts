export interface AppConfig {
  // GitHub
  githubToken: string;
  githubOrg: string;
  githubRepos: string[];
  githubWebhookSecret: string;
  teamMembers: string[];
  requiredApprovals: number;

  // Slack
  slackBotToken: string;
  slackSigningSecret: string;
  slackChannel: string;
  slackChannelId?: string; // For team-specific user mapping resolution

  // GitHub→Slack user mappings (comma-separated "ghUser:slackId" pairs)
  userMappings: string;

  // Server
  port: number;
}

export interface PRData {
  repo: string;
  owner: string;
  number: number;
  title: string;
  author: string;
  url: string;
  approvals: number;
  requiredApprovals: number;
  reviewers: ReviewerInfo[];
  isDraft: boolean;
  state: 'open' | 'closed' | 'merged';
  createdAt: string;
  updatedAt: string;
}

export interface ReviewerInfo {
  login: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED';
}

export interface PRMessageRow {
  pr_url: string;
  slack_channel: string;
  slack_message_ts: string;
  pr_state: string;
  owner: string;
  repo: string;
  pr_number: number;
  last_updated: string;
}

export interface UserMappingRow {
  github_username: string;
  slack_user_id: string;
}

export interface WebhookPRPayload {
  action: string;
  number: number;
  pull_request: {
    number: number;
    title: string;
    html_url: string;
    state: string;
    draft: boolean;
    merged: boolean;
    user: { login: string };
    created_at: string;
    updated_at: string;
    base: { repo: { name: string; owner: { login: string } } };
  };
  repository: {
    name: string;
    full_name: string;
    owner: { login: string };
  };
  review?: {
    state: string;
    user: { login: string };
  };
  sender: { login: string };
}

// Multi-team configuration types
export interface TeamConfigRow {
  channel_id: string;
  channel_name: string | null;
  required_approvals: number;
  notify_on_open: number; // SQLite boolean (0 or 1)
  notify_on_ready: number;
  notify_on_changes_requested: number;
  notify_on_approved: number;
  notify_on_merged: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberRow {
  id: number;
  channel_id: string;
  github_username: string;
  slack_user_id: string | null;
  added_by_slack_user: string | null;
  added_at: string;
}

export interface TeamRepoRow {
  id: number;
  channel_id: string;
  repo_name: string;
  added_at: string;
}

export interface TeamConfig {
  channelId: string;
  channelName: string | null;
  requiredApprovals: number;
  notifyOnOpen: boolean;
  notifyOnReady: boolean;
  notifyOnChangesRequested: boolean;
  notifyOnApproved: boolean;
  notifyOnMerged: boolean;
  members: Array<{ github: string; slack?: string }>; // GitHub usernames with optional Slack mapping
  repos: string[]; // Repo names (e.g., "api-member")
}
