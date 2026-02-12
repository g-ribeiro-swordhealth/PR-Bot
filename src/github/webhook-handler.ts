import crypto from 'crypto';
import { Request, Response } from 'express';
import { AppConfig, WebhookPRPayload } from '../types';
import { fetchPRData, isTeamMember } from './pr-service';
import { postOrUpdatePR, postThreadReply } from '../slack/message-service';
import { resolveSlackUser } from '../slack/user-mapping';
import { logger } from '../utils/logger';
import { findTeamsTrackingUserAndRepo, getFullTeamConfig } from '../db/team-config';

function verifySignature(payload: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

const PR_ACTIONS = new Set([
  'opened',
  'closed',
  'reopened',
  'synchronize',
  'ready_for_review',
  'converted_to_draft',
  'edited',
]);

const REVIEW_ACTIONS = new Set([
  'submitted',
  'dismissed',
]);

function formatTimestamp(): string {
  return new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export function createWebhookHandler(config: AppConfig) {
  return async (req: Request, res: Response): Promise<void> => {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const event = req.headers['x-github-event'] as string;
    const rawBody = (req as any).rawBody as string;

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

    // Respond immediately
    res.status(200).json({ ok: true });

    try {
      if (event === 'pull_request' && PR_ACTIONS.has(req.body.action)) {
        await handlePREvent(req.body as WebhookPRPayload, config);
      } else if (event === 'pull_request_review' && REVIEW_ACTIONS.has(req.body.action)) {
        await handleReviewEvent(req.body as WebhookPRPayload, config);
      } else if (event === 'issue_comment' && req.body.action === 'created' && req.body.issue?.pull_request) {
        await handleCommentEvent(req.body, config);
      } else {
        logger.debug(`Ignoring event: ${event}/${req.body?.action}`);
      }
    } catch (error: any) {
      logger.error('Error handling webhook', { event, action: req.body?.action, error: error.message });
    }
  };
}

async function handlePREvent(payload: WebhookPRPayload, config: AppConfig): Promise<void> {
  const pr = payload.pull_request;
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const author = pr.user.login;

  logger.info(`PR event: ${payload.action} on ${owner}/${repo}#${pr.number} by ${author}`);

  // Find teams tracking this user and repo
  const teamChannelIds = findTeamsTrackingUserAndRepo(author, repo);

  if (teamChannelIds.length === 0) {
    logger.debug(`No teams tracking ${author} in ${repo}`);
    return;
  }

  logger.info(`Found ${teamChannelIds.length} team(s) tracking this PR`, { teams: teamChannelIds });

  // Post/update to each team's channel
  for (const channelId of teamChannelIds) {
    const teamConfig = getFullTeamConfig(channelId);
    if (!teamConfig) continue;

    // Check if team wants notifications for this PR action
    const action = payload.action;
    const isDraft = pr.draft;

    let shouldNotify = false;
    if (action === 'opened' && !isDraft && teamConfig.notifyOnOpen) shouldNotify = true;
    if (action === 'ready_for_review' && teamConfig.notifyOnReady) shouldNotify = true;

    // For other actions, always update the message if it exists
    if (!shouldNotify && !['opened', 'ready_for_review'].includes(action)) {
      shouldNotify = true; // Update existing messages for synchronize, reopened, etc.
    }

    if (!shouldNotify) {
      logger.debug(`Team ${channelId} doesn't want notifications for ${action}`);
      continue;
    }

    const prData = await fetchPRData(owner, repo, pr.number, teamConfig.requiredApprovals);
    if (!prData) continue;

    // Create a team-specific config for this channel
    const teamSpecificConfig: AppConfig = {
      ...config,
      slackChannel: channelId,
      slackChannelId: channelId, // For user mapping resolution
      requiredApprovals: teamConfig.requiredApprovals,
    };

    await postOrUpdatePR(prData, teamSpecificConfig);
  }
}

async function handleReviewEvent(payload: WebhookPRPayload, config: AppConfig): Promise<void> {
  const pr = payload.pull_request;
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const author = pr.user.login;
  const reviewer = payload.review?.user.login || 'someone';
  const reviewState = payload.review?.state || '';

  logger.info(`Review event: ${payload.action} on ${owner}/${repo}#${pr.number} by ${reviewer}`);

  // Find teams tracking this PR
  const teamChannelIds = findTeamsTrackingUserAndRepo(author, repo);
  if (teamChannelIds.length === 0) {
    logger.debug(`No teams tracking ${author} in ${repo}`);
    return;
  }

  // Post to each team's channel
  for (const channelId of teamChannelIds) {
    const teamConfig = getFullTeamConfig(channelId);
    if (!teamConfig) continue;

    // Check if team wants notifications for this review type
    let shouldNotify = false;
    if (reviewState === 'approved' && teamConfig.notifyOnApproved) shouldNotify = true;
    if (reviewState === 'changes_requested' && teamConfig.notifyOnChangesRequested) shouldNotify = true;

    // Update the main message with fresh approval count
    const prData = await fetchPRData(owner, repo, pr.number, teamConfig.requiredApprovals);
    if (!prData) continue;

    const teamSpecificConfig: AppConfig = {
      ...config,
      slackChannel: channelId,
      slackChannelId: channelId, // For user mapping resolution
      requiredApprovals: teamConfig.requiredApprovals,
    };

    await postOrUpdatePR(prData, teamSpecificConfig);

    // Post a thread reply about the review (only if team wants this notification)
    if (shouldNotify) {
      const reviewerMention = resolveSlackUser(reviewer, channelId);
      const timestamp = formatTimestamp();
      let threadText: string;

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

async function handleCommentEvent(payload: any, config: AppConfig): Promise<void> {
  const prUrl = payload.issue.pull_request.html_url;
  const repo = payload.repository.name;
  const commenter = payload.comment.user.login;

  logger.info(`Comment event on ${repo}#${payload.issue.number} by ${commenter}`);

  // Comments are posted to all channels that have this PR
  // Note: We don't have channelId here, so it will use global mapping fallback
  const commenterMention = resolveSlackUser(commenter);
  const timestamp = formatTimestamp();
  const threadText = `:speech_balloon: ${commenterMention} *commented* on this PR — ${timestamp}`;

  await postThreadReply(prUrl, threadText);
}
