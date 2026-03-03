'use strict';

const { getPRMessage, upsertPRMessage, updatePRState } = require('../../database/queries');
const { getTeamConfig } = require('../../database/team-config');
const { buildPRMessage } = require('./messages');
const { withRetry } = require('../../helper/retry');
const { logger } = require('../../logger');
const { getReviews, getReviewComments } = require('../github/pr-service');
const { resolveSlackUser } = require('./user-mapping');

/** @type {import('@slack/web-api').WebClient} */
let slackClient;

/**
 * @param {import('@slack/web-api').WebClient} client
 */
function initSlackClient(client) {
  slackClient = client;
}

/**
 * @param {object} prData
 * @param {object} config
 */
async function postOrUpdatePR(prData, config) {
  const { text, blocks } = buildPRMessage(prData, config.slackChannelId);
  const existing = getPRMessage(prData.url);

  if (existing) {
    try {
      await withRetry(
        () => slackClient.chat.update({
          channel: existing.slack_channel,
          ts: existing.slack_message_ts,
          text,
          blocks,
        }),
        { label: `updateMessage(${prData.url})` }
      );

      const state = prData.state === 'merged' ? 'merged' : prData.state === 'closed' ? 'closed' : 'open';
      updatePRState(prData.url, state);

      logger.info(`Updated Slack message for ${prData.owner}/${prData.repo}#${prData.number}`);
    } catch (error) {
      logger.error(`Failed to update message for ${prData.url}`, { error: error.message });
    }
  } else {
    try {
      const result = await withRetry(
        () => slackClient.chat.postMessage({
          channel: config.slackChannel,
          text,
          blocks,
          unfurl_links: false,
          unfurl_media: false,
        }),
        { label: `postMessage(${prData.url})` }
      );

      if (result.ts) {
        upsertPRMessage({
          pr_url: prData.url,
          slack_channel: result.channel || config.slackChannel,
          slack_message_ts: result.ts,
          pr_state: prData.state,
          owner: prData.owner,
          repo: prData.repo,
          pr_number: prData.number,
          last_updated: new Date().toISOString(),
        });

        logger.info(`Posted new Slack message for ${prData.owner}/${prData.repo}#${prData.number}`, { ts: result.ts });

        await postHistoricalReviews(
          prData.owner,
          prData.repo,
          prData.number,
          prData.url,
          config.slackChannelId
        );
      }
    } catch (error) {
      logger.error(`Failed to post message for ${prData.url}`, { error: error.message });
    }
  }
}

/**
 * @param {string} prUrl
 * @param {string} text
 */
async function postThreadReply(prUrl, text) {
  const existing = getPRMessage(prUrl);
  if (!existing) {
    logger.warn(`No tracked message for ${prUrl}, skipping thread reply`);
    return;
  }

  try {
    await withRetry(
      () => slackClient.chat.postMessage({
        channel: existing.slack_channel,
        thread_ts: existing.slack_message_ts,
        text,
      }),
      { label: `threadReply(${prUrl})` }
    );
  } catch (error) {
    logger.error(`Failed to post thread reply for ${prUrl}`, { error: error.message });
  }
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {number} pullNumber
 * @param {string} prUrl
 * @param {string} [channelId]
 */
async function postHistoricalReviews(owner, repo, pullNumber, prUrl, channelId) {
  try {
    const [reviews, reviewComments] = await Promise.all([
      getReviews(owner, repo, pullNumber),
      getReviewComments(owner, repo, pullNumber),
    ]);

    let shouldExcludeBots = true;
    if (channelId) {
      const config = getTeamConfig(channelId);
      logger.info('Bot filtering config', {
        channelId,
        configFound: !!config,
        excludeBotComments: config?.exclude_bot_comments,
        shouldExcludeBots: config ? Boolean(config.exclude_bot_comments) : true,
      });
      if (config) {
        shouldExcludeBots = Boolean(config.exclude_bot_comments);
      }
    }

    logger.info('Reviews fetched', {
      totalReviews: reviews.length,
      totalComments: reviewComments.length,
      shouldExcludeBots,
      reviewUsers: reviews.map(r => r.user?.login),
      commentUsers: reviewComments.map(c => c.user?.login),
    });

    const filterBots = (item) => {
      if (!shouldExcludeBots) return true;
      const user = item.user?.login;
      if (!user) return false;
      const userLower = user.toLowerCase();
      if (userLower.endsWith('[bot]') || userLower.endsWith('-bot')) return false;
      if (userLower.includes('copilot')) return false;
      return true;
    };

    const humanReviews = reviews.filter(filterBots);
    const humanComments = reviewComments.filter(filterBots);

    logger.info('After bot filtering', {
      humanReviews: humanReviews.length,
      humanComments: humanComments.length,
      filteredReviews: humanReviews.map(r => r.user?.login),
      filteredComments: humanComments.map(c => c.user?.login),
    });

    const allActivity = [];

    humanReviews.forEach(review => {
      allActivity.push({ type: 'review', data: review, timestamp: new Date(review.submitted_at) });
    });

    humanComments.forEach(comment => {
      allActivity.push({ type: 'comment', data: comment, timestamp: new Date(comment.created_at) });
    });

    allActivity.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (allActivity.length === 0) {
      logger.debug(`No reviews or comments found for ${owner}/${repo}#${pullNumber}`);
      return;
    }

    for (const activity of allActivity) {
      const user = activity.data.user?.login;
      const userMention = resolveSlackUser(user, channelId);
      const timestamp = activity.timestamp.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      let threadText;

      if (activity.type === 'review') {
        const state = activity.data.state?.toLowerCase();
        if (state === 'approved') {
          threadText = `:white_check_mark: ${userMention} *approved* this PR — ${timestamp}`;
        } else if (state === 'changes_requested') {
          threadText = `:x: ${userMention} *requested changes* — ${timestamp}`;
        } else if (state === 'dismissed') {
          threadText = `:leftwards_arrow_with_hook: ${userMention}'s *review was dismissed* — ${timestamp}`;
        } else {
          threadText = `:speech_balloon: ${userMention} *left a review* — ${timestamp}`;
        }
      } else {
        threadText = `:speech_balloon: ${userMention} *commented on code* — ${timestamp}`;
      }

      await postThreadReply(prUrl, threadText);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info(`Posted ${allActivity.length} historical reviews/comments for ${owner}/${repo}#${pullNumber}`);
  } catch (error) {
    logger.error(`Error posting historical reviews for ${owner}/${repo}#${pullNumber}`, { error: error.message });
  }
}

module.exports = { initSlackClient, postOrUpdatePR, postThreadReply, postHistoricalReviews };
