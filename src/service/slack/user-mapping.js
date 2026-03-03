'use strict';

const { getUserMapping } = require('../../database/queries');
const { getSlackUserIdForGithubUser } = require('../../database/team-config');

/**
 * @param {string} githubUsername
 * @param {string} [channelId]
 * @returns {string}
 */
function resolveSlackUser(githubUsername, channelId) {
  const teamMappingId = getSlackUserIdForGithubUser(githubUsername, channelId);
  if (teamMappingId) {
    return `<@${teamMappingId}>`;
  }

  const globalMappingId = getUserMapping(githubUsername);
  if (globalMappingId) {
    return `<@${globalMappingId}>`;
  }

  return `\`${githubUsername}\``;
}

module.exports = { resolveSlackUser };
