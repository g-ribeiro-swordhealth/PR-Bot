'use strict';

const { getOpenPRMessages } = require('../../database/queries');
const { fetchPRData } = require('../github/pr-service');
const { buildStatusSummary } = require('./messages');
const { logger } = require('../../logger');

/**
 * @param {object} config
 * @returns {(args: object) => Promise<void>}
 */
function createPRStatusHandler(config) {
  return async ({ ack, respond }) => {
    await ack();

    try {
      const openMessages = getOpenPRMessages();

      if (openMessages.length === 0) {
        const { text, blocks } = buildStatusSummary([]);
        await respond({ text, blocks, response_type: 'ephemeral' });
        return;
      }

      const prDataList = [];
      for (const msg of openMessages) {
        const prData = await fetchPRData(msg.owner, msg.repo, msg.pr_number, config.requiredApprovals);
        if (prData && prData.state === 'open') {
          prDataList.push(prData);
        }
      }

      const { text, blocks } = buildStatusSummary(prDataList);
      await respond({ text, blocks, response_type: 'ephemeral' });
    } catch (error) {
      logger.error('Error handling /pr-status command', { error: error.message });
      await respond({ text: 'Something went wrong fetching PR status.', response_type: 'ephemeral' });
    }
  };
}

module.exports = { createPRStatusHandler };
