'use strict';

const { getOctokit } = require('../../clients/github');
const { withRetry } = require('../../helper/retry');
const { logger } = require('../../logger');

const PER_PAGE = 100;

/**
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<object[]>}
 */
async function fetchPRsForRepo(owner, repo) {
  const octokit = getOctokit();
  const allPRs = [];
  let page = 1;

  try {
    while (true) {
      const { data: prs } = await withRetry(
        () => octokit.pulls.list({ owner, repo, state: 'open', per_page: PER_PAGE, page }),
        { label: `fetchPRs(${owner}/${repo})` }
      );
      allPRs.push(...prs);
      if (prs.length < PER_PAGE) break;
      page++;
    }
  } catch (error) {
    logger.error(`Error fetching PRs for ${owner}/${repo}`, { error: error.message });
  }

  return allPRs;
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {number} pullNumber
 * @returns {Promise<object[]>}
 */
async function getReviews(owner, repo, pullNumber) {
  const octokit = getOctokit();
  try {
    const { data: reviews } = await withRetry(
      () => octokit.pulls.listReviews({ owner, repo, pull_number: pullNumber }),
      { label: `getReviews(${owner}/${repo}#${pullNumber})` }
    );
    return reviews;
  } catch (error) {
    logger.error(`Error fetching reviews for PR #${pullNumber}`, { error: error.message });
    return [];
  }
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {number} pullNumber
 * @returns {Promise<object[]>}
 */
async function getReviewComments(owner, repo, pullNumber) {
  const octokit = getOctokit();
  try {
    const { data: comments } = await withRetry(
      () => octokit.pulls.listReviewComments({ owner, repo, pull_number: pullNumber }),
      { label: `getReviewComments(${owner}/${repo}#${pullNumber})` }
    );
    return comments;
  } catch (error) {
    logger.error(`Error fetching review comments for PR #${pullNumber}`, { error: error.message });
    return [];
  }
}

/**
 * @param {object[]} reviews
 * @returns {number}
 */
function countApprovals(reviews) {
  const latestReviews = {};

  for (const review of reviews) {
    const reviewer = review.user.login;
    if (!latestReviews[reviewer] || new Date(review.submitted_at) > new Date(latestReviews[reviewer].submitted_at)) {
      latestReviews[reviewer] = review;
    }
  }

  return Object.values(latestReviews).filter(r => r.state === 'APPROVED').length;
}

/**
 * @param {object[]} reviews
 * @returns {{ login: string, state: string }[]}
 */
function getReviewers(reviews) {
  const latestReviews = {};

  for (const review of reviews) {
    const reviewer = review.user.login;
    if (!latestReviews[reviewer] || new Date(review.submitted_at) > new Date(latestReviews[reviewer].submitted_at)) {
      latestReviews[reviewer] = review;
    }
  }

  return Object.values(latestReviews).map(r => ({
    login: r.user.login,
    state: r.state,
  }));
}

/**
 * @param {string} author
 * @param {string[]} teamMembers
 * @returns {boolean}
 */
function isTeamMember(author, teamMembers) {
  if (teamMembers.length === 0) return true;
  return teamMembers.includes(author);
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {number} pullNumber
 * @param {number} requiredApprovals
 * @returns {Promise<object|null>}
 */
async function fetchPRData(owner, repo, pullNumber, requiredApprovals) {
  const octokit = getOctokit();

  try {
    const { data: pr } = await withRetry(
      () => octokit.pulls.get({ owner, repo, pull_number: pullNumber }),
      { label: `fetchPR(${owner}/${repo}#${pullNumber})` }
    );

    const reviews = await getReviews(owner, repo, pullNumber);
    const approvals = countApprovals(reviews);
    const reviewers = getReviewers(reviews);

    let state = 'open';
    if (pr.merged) {
      state = 'merged';
    } else if (pr.state === 'closed') {
      state = 'closed';
    }

    return {
      repo,
      owner,
      number: pr.number,
      title: pr.title,
      author: pr.user.login,
      url: pr.html_url,
      approvals,
      requiredApprovals,
      reviewers,
      isDraft: pr.draft || false,
      state,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
    };
  } catch (error) {
    logger.error(`Error fetching PR data for ${owner}/${repo}#${pullNumber}`, { error: error.message });
    return null;
  }
}

module.exports = {
  fetchPRsForRepo,
  getReviews,
  getReviewComments,
  countApprovals,
  getReviewers,
  isTeamMember,
  fetchPRData,
};
