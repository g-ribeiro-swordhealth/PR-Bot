import { AllMiddlewareArgs, SlackCommandMiddlewareArgs } from '@slack/bolt';
import { AppConfig, PRData } from '../types';
import { getOpenPRMessages } from '../db/queries';
import { fetchPRData } from '../github/pr-service';
import { buildStatusSummary } from './messages';
import { logger } from '../utils/logger';

export function createPRStatusHandler(config: AppConfig) {
  return async ({ ack, respond }: AllMiddlewareArgs & SlackCommandMiddlewareArgs): Promise<void> => {
    await ack();

    try {
      const openMessages = getOpenPRMessages();

      if (openMessages.length === 0) {
        const { text, blocks } = buildStatusSummary([]);
        await respond({ text, blocks, response_type: 'ephemeral' });
        return;
      }

      // Fetch fresh data for each tracked PR
      const prDataList: PRData[] = [];
      for (const msg of openMessages) {
        const prData = await fetchPRData(msg.owner, msg.repo, msg.pr_number, config.requiredApprovals);
        if (prData && prData.state === 'open') {
          prDataList.push(prData);
        }
      }

      const { text, blocks } = buildStatusSummary(prDataList);
      await respond({ text, blocks, response_type: 'ephemeral' });
    } catch (error: any) {
      logger.error('Error handling /pr-status command', { error: error.message });
      await respond({ text: 'Something went wrong fetching PR status.', response_type: 'ephemeral' });
    }
  };
}
