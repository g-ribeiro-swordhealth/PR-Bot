'use strict';

/**
 * Manual Test Script
 *
 * Fetches open PRs from GitHub and posts/updates them in Slack.
 * Use this to test the bot without setting up GitHub webhooks.
 *
 * Usage:
 *   node test/manual/index.js <repo-name> [channel-id]
 *
 * Example:
 *   node test/manual/index.js api-member C01234ABC
 */

require('module-alias/register');
require('dotenv').config();

const { App } = require('@slack/bolt');
const { Octokit } = require('@octokit/rest');
const { initDatabase } = require('../../src/database');
const { initGitHubClient } = require('../../src/clients/github');
const { fetchPRData } = require('../../src/service/github/pr-service');
const { initSlackClient, postOrUpdatePR, postHistoricalReviews } = require('../../src/service/slack/message-service');
const { getFullTeamConfig, findTeamsTrackingUserAndRepo } = require('../../src/database/team-config');
const { loadConfig } = require('../../config');
const { logger } = require('../../src/logger');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           PR-Bot Manual Test Script                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Usage:');
    console.log('  node test/manual/index.js <repo-name> [channel-id]');
    console.log('');
    console.log('Examples:');
    console.log('  node test/manual/index.js api-member C01234ABC');
    console.log('  node test/manual/index.js api-patient-app');
    console.log('');
    process.exit(1);
  }

  const repoName = args[0];
  const channelId = args[1];

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           PR-Bot Manual Test — Posting to Slack               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  const config = loadConfig();
  initDatabase();
  initGitHubClient(config.githubToken);

  const app = new App({
    token: config.slackBotToken,
    signingSecret: config.slackSigningSecret,
  });
  initSlackClient(app.client);

  console.log(`🔍 Fetching open PRs from ${config.githubOrg}/${repoName}...`);
  console.log('');

  const octokit = new Octokit({ auth: config.githubToken });

  try {
    const { data: prs } = await octokit.pulls.list({
      owner: config.githubOrg,
      repo: repoName,
      state: 'open',
      per_page: 50,
    });

    console.log(`📊 Found ${prs.length} open PR(s)`);
    console.log('');

    if (prs.length === 0) {
      console.log('✅ No open PRs in this repo!');
      console.log('');
      return;
    }

    for (const pr of prs) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📋 PR #${pr.number}: ${pr.title}`);
      console.log(`   Author: ${pr.user?.login}`);
      console.log(`   Status: ${pr.draft ? 'Draft' : 'Open'}`);
      console.log(`   URL: ${pr.html_url}`);
      console.log('');

      if (pr.draft) {
        console.log('   ⏩ Skipping draft PR');
        console.log('');
        continue;
      }

      const author = pr.user?.login || '';
      let targetChannels = [];

      if (channelId) {
        const teamConfig = getFullTeamConfig(channelId);

        if (teamConfig && teamConfig.members.length > 0) {
          const isTracked = teamConfig.members.some(m => m.github === author);
          if (!isTracked) {
            console.log(`   ⏩ Skipping: ${author} is not in the team members list for this channel`);
            console.log('');
            continue;
          }
        }

        targetChannels = [channelId];
        console.log(`   🎯 Posting to specified channel: ${channelId}`);
      } else {
        targetChannels = findTeamsTrackingUserAndRepo(author, repoName);

        if (targetChannels.length === 0) {
          console.log(`   ⏩ Skipping: No teams configured to track ${author} in ${repoName}`);
          console.log('');
          continue;
        }

        console.log(`   🎯 Posting to ${targetChannels.length} channel(s): ${targetChannels.join(', ')}`);
      }

      const prData = await fetchPRData(config.githubOrg, repoName, pr.number, config.requiredApprovals);

      if (!prData) {
        console.log('   ⚠️  Could not fetch PR data, skipping...');
        console.log('');
        continue;
      }

      for (const channel of targetChannels) {
        try {
          const teamConfig = getFullTeamConfig(channel);
          const configWithChannel = {
            ...config,
            slackChannel: channel,
            slackChannelId: channel,
            requiredApprovals: teamConfig?.requiredApprovals || config.requiredApprovals,
          };

          await postOrUpdatePR(prData, configWithChannel);
          await postHistoricalReviews(config.githubOrg, repoName, pr.number, pr.html_url, channel);
          console.log(`   ✅ Posted/updated in channel ${channel}`);
        } catch (error) {
          console.log(`   ❌ Error posting to ${channel}: ${error.message}`);
        }
      }

      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('✅ Done! Check your Slack channels for the messages.');
    console.log('');
    console.log('💡 Tips:');
    console.log('  • Run this script again to test message updates (update-in-place)');
    console.log('  • Approve a PR on GitHub, then run again to see the message update');
    console.log('  • Use App Home to configure which users/repos to track per channel');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');

    if (error.message.includes('Not Found')) {
      console.error('💡 Make sure:');
      console.error(`  • Repo "${repoName}" exists in org "${config.githubOrg}"`);
      console.error('  • Your GITHUB_TOKEN has access to this repo');
      console.error('');
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
