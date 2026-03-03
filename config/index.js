'use strict';

require('dotenv').config();

/**
 * @param {string} name
 * @returns {string}
 */
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * @param {string|undefined} value
 * @returns {string[]}
 */
function parseList(value) {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * @returns {{ githubToken: string, githubOrg: string, githubRepos: string[], githubWebhookSecret: string, teamMembers: string[], requiredApprovals: number, slackBotToken: string, slackSigningSecret: string, slackChannel: string, userMappings: string, port: number }}
 */
function loadConfig() {
  return {
    githubToken: requireEnv('GITHUB_TOKEN'),
    githubOrg: requireEnv('GITHUB_ORG'),
    githubRepos: parseList(process.env.GITHUB_REPOS),
    githubWebhookSecret: requireEnv('GITHUB_WEBHOOK_SECRET'),
    teamMembers: parseList(process.env.TEAM_MEMBERS),
    requiredApprovals: parseInt(process.env.REQUIRED_APPROVALS || '2', 10),

    slackBotToken: requireEnv('SLACK_BOT_TOKEN'),
    slackSigningSecret: requireEnv('SLACK_SIGNING_SECRET'),
    slackChannel: process.env.SLACK_CHANNEL || '',

    userMappings: process.env.USER_MAPPINGS || '',

    port: parseInt(process.env.PORT || '3000', 10),
  };
}

module.exports = { loadConfig };
