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
