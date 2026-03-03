'use strict';

const { Octokit } = require('@octokit/rest');

/** @type {InstanceType<typeof Octokit>} */
let octokitInstance;

/**
 * @param {string} token
 * @returns {InstanceType<typeof Octokit>}
 */
function initGitHubClient(token) {
  octokitInstance = new Octokit({
    auth: token,
    request: { timeout: 10000 },
  });
  return octokitInstance;
}

/**
 * @returns {InstanceType<typeof Octokit>}
 */
function getOctokit() {
  if (!octokitInstance) {
    throw new Error('GitHub client not initialized. Call initGitHubClient() first.');
  }
  return octokitInstance;
}

module.exports = { initGitHubClient, getOctokit };
