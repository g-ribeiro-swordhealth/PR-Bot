'use strict';

const crypto = require('crypto');
const { fetchPRData } = require('./pr-service');
const { postOrUpdatePR, postThreadReply } = require('../slack/message-service');
const { resolveSlackUser } = require('../slack/user-mapping');
const { logger } = require('../../logger');
const { findTeamsTrackingUserAndRepo, getFullTeamConfig } = require('../../database/team-config');
const { getPRMessage } = require('../../database/queries');

/**
 * @param {string} payload
 * @param {string|undefined} signature
 * @param {string} secret
 * @returns {boolean}
 */
function verifySignature(payload, signature, secret) {
  if (!signature) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

const PR_ACTIONS = new Set([
  'opened', 'closed', 'reopened', 'synchronize',
  'ready_for_review', 'converted_to_draft', 'edited',
]);

const REVIEW_ACTIONS = new Set(['submitted', 'dismissed']);

function formatTimestamp() {
  return new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/**
 * @param {object} config
 * @returns {(req: object, res: object) => Promise<void>}
 */
function createWebhookHandler(config) {
  return async (req, res) => {
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];
    const rawBody = req.rawBody;

    if (!rawBody) {
      logger.error('No raw body available for webhook verification');
      res.status(400).json({ error: 'No body' });
      return;
    }

    if (!verifySignature(rawBody, signature, config.githubWebhookSecret)) {
      logger.warn('Webhook signature verification failed');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    res.status(200).json({ ok: true });

    try {
      if (event === 'pull_request' && PR_ACTIONS.has(req.body.action)) {
        await handlePREvent(req.body, config);
      } else if (event === 'pull_request_review' && REVIEW_ACTIONS.has(req.body.action)) {
        await handleReviewEvent(req.body, config);
      } else if (event === 'issue_comment' && req.body.action === 'created' && req.body.issue?.pull_request) {
        await handleCommentEvent(req.body, config);
      } else {
        logger.debug(`Ignoring event: ${event}/${req.body?.action}`);
      }
    } catch (error) {
      logger.error('Error handling webhook', { event, action: req.body?.action, error: error.message });
    }
  };
}

/**
 * @param {object} payload
 * @param {object} config
 */
async function handlePREvent(payload, config) {
  const pr = payload.pull_request;
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const author = pr.user.login;

  logger.info(`PR event: ${payload.action} on ${owner}/${repo}#${pr.number} by ${author}`);

  const teamChannelIds = findTeamsTrackingUserAndRepo(author, repo);

  if (teamChannelIds.length === 0) {
    logger.debug(`No teams tracking ${author} in ${repo}`);
    return;
  }

  logger.info(`Found ${teamChannelIds.length} team(s) tracking this PR`, { teams: teamChannelIds });

  for (const channelId of teamChannelIds) {
    const teamConfig = getFullTeamConfig(channelId);
    if (!teamConfig) continue;

    const action = payload.action;
    const isDraft = pr.draft;

    let shouldNotify = false;

    if (action === 'opened' && !isDraft && teamConfig.postTrigger === 'on_open') shouldNotify = true;
    if (action === 'ready_for_review' && teamConfig.notifyOnReady) shouldNotify = true;
    if (action === 'labeled' && teamConfig.postTrigger === 'on_label' && payload.label?.name === teamConfig.triggerLabel) shouldNotify = true;

    if (!shouldNotify && !['opened', 'ready_for_review', 'labeled'].includes(action)) {
      if (teamConfig.postTrigger === 'on_label') {
        if (getPRMessage(pr.html_url)) shouldNotify = true;
      } else {
        shouldNotify = true;
      }
    }

    if (!shouldNotify) {
      logger.debug(`Team ${channelId} doesn't want notifications for ${action}`);
      continue;
    }

    const prData = await fetchPRData(owner, repo, pr.number, teamConfig.requiredApprovals);
    if (!prData) continue;

    const teamSpecificConfig = {
      ...config,
      slackChannel: channelId,
      slackChannelId: channelId,
      requiredApprovals: teamConfig.requiredApprovals,
    };

    await postOrUpdatePR(prData, teamSpecificConfig);
  }
}

/**
 * @param {object} payload
 * @param {object} config
 */
async function handleReviewEvent(payload, config) {
  const pr = payload.pull_request;
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const author = pr.user.login;
  const reviewer = payload.review?.user.login || 'someone';
  const reviewState = payload.review?.state || '';

  logger.info(`Review event: ${payload.action} on ${owner}/${repo}#${pr.number} by ${reviewer}`);

  const teamChannelIds = findTeamsTrackingUserAndRepo(author, repo);
  if (teamChannelIds.length === 0) {
    logger.debug(`No teams tracking ${author} in ${repo}`);
    return;
  }

  for (const channelId of teamChannelIds) {
    const teamConfig = getFullTeamConfig(channelId);
    if (!teamConfig) continue;

    let shouldNotify = false;
    if (reviewState === 'approved' && teamConfig.notifyOnApproved) shouldNotify = true;
    if (reviewState === 'changes_requested' && teamConfig.notifyOnChangesRequested) shouldNotify = true;

    const prData = await fetchPRData(owner, repo, pr.number, teamConfig.requiredApprovals);
    if (!prData) continue;

    const teamSpecificConfig = {
      ...config,
      slackChannel: channelId,
      slackChannelId: channelId,
      requiredApprovals: teamConfig.requiredApprovals,
    };

    await postOrUpdatePR(prData, teamSpecificConfig);

    if (shouldNotify) {
      const reviewerMention = resolveSlackUser(reviewer, channelId);
      const timestamp = formatTimestamp();
      let threadText;

      if (reviewState === 'approved') {
        threadText = `:white_check_mark: ${reviewerMention} *approved* this PR — ${timestamp}`;
      } else if (reviewState === 'changes_requested') {
        threadText = `:x: ${reviewerMention} *requested changes* — ${timestamp}`;
      } else if (reviewState === 'dismissed') {
        threadText = `:rewind: Review by ${reviewerMention} was *dismissed* — ${timestamp}`;
      } else {
        threadText = `:speech_balloon: ${reviewerMention} *left a review* — ${timestamp}`;
      }

      await postThreadReply(pr.html_url, threadText);
    }
  }
}

/**
 * @param {object} payload
 * @param {object} _config
 */
async function handleCommentEvent(payload, _config) {
  const prUrl = payload.issue.pull_request.html_url;
  const repo = payload.repository.name;
  const commenter = payload.comment.user.login;

  logger.info(`Comment event on ${repo}#${payload.issue.number} by ${commenter}`);

  const commenterMention = resolveSlackUser(commenter);
  const timestamp = formatTimestamp();
  const threadText = `:speech_balloon: ${commenterMention} *commented* on this PR — ${timestamp}`;

  await postThreadReply(prUrl, threadText);
}

module.exports = { createWebhookHandler };
