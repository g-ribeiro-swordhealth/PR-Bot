import { WebClient } from '@slack/web-api';
import { AppConfig, PRData } from '../types';
import { getPRMessage, upsertPRMessage, updatePRState } from '../db/queries';
import { buildPRMessage } from './messages';
import { withRetry } from '../utils/retry';
import { logger } from '../utils/logger';

let slackClient: WebClient;

export function initSlackClient(client: WebClient): void {
  slackClient = client;
}

export async function postOrUpdatePR(prData: PRData, config: AppConfig): Promise<void> {
  const { text, blocks } = buildPRMessage(prData);
  const existing = getPRMessage(prData.url);

  if (existing) {
    // Update existing message
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

      // Update state in DB
      const state = prData.state === 'merged' ? 'merged' : prData.state === 'closed' ? 'closed' : 'open';
      updatePRState(prData.url, state);

      logger.info(`Updated Slack message for ${prData.owner}/${prData.repo}#${prData.number}`);
    } catch (error: any) {
      logger.error(`Failed to update message for ${prData.url}`, { error: error.message });
    }
  } else {
    // Post new message
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
      }
    } catch (error: any) {
      logger.error(`Failed to post message for ${prData.url}`, { error: error.message });
    }
  }
}

export async function postThreadReply(prUrl: string, text: string): Promise<void> {
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
  } catch (error: any) {
    logger.error(`Failed to post thread reply for ${prUrl}`, { error: error.message });
  }
}
