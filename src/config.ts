import dotenv from 'dotenv';
import { AppConfig } from './types';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

export function loadConfig(): AppConfig {
  return {
    githubToken: requireEnv('GITHUB_TOKEN'),
    githubOrg: requireEnv('GITHUB_ORG'),
    githubRepos: parseList(process.env.GITHUB_REPOS),
    githubWebhookSecret: requireEnv('GITHUB_WEBHOOK_SECRET'),
    teamMembers: parseList(process.env.TEAM_MEMBERS),
    requiredApprovals: parseInt(process.env.REQUIRED_APPROVALS || '2', 10),

    slackBotToken: requireEnv('SLACK_BOT_TOKEN'),
    slackSigningSecret: requireEnv('SLACK_SIGNING_SECRET'),
    slackChannel: requireEnv('SLACK_CHANNEL'),

    userMappings: process.env.USER_MAPPINGS || '',

    port: parseInt(process.env.PORT || '3000', 10),
  };
}
