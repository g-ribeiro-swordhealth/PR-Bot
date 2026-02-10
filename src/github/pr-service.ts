import { getOctokit } from './client';
import { withRetry } from '../utils/retry';
import { logger } from '../utils/logger';
import { PRData, ReviewerInfo } from '../types';

const PER_PAGE = 100;

export async function fetchPRsForRepo(owner: string, repo: string): Promise<any[]> {
  const octokit = getOctokit();
  const allPRs: any[] = [];
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
  } catch (error: any) {
    logger.error(`Error fetching PRs for ${owner}/${repo}`, { error: error.message });
  }

  return allPRs;
}

export async function getReviews(owner: string, repo: string, pullNumber: number): Promise<any[]> {
  const octokit = getOctokit();
  try {
    const { data: reviews } = await withRetry(
      () => octokit.pulls.listReviews({ owner, repo, pull_number: pullNumber }),
      { label: `getReviews(${owner}/${repo}#${pullNumber})` }
    );
    return reviews;
  } catch (error: any) {
    logger.error(`Error fetching reviews for PR #${pullNumber}`, { error: error.message });
    return [];
  }
}

export function countApprovals(reviews: any[]): number {
  const latestReviews: Record<string, any> = {};

  for (const review of reviews) {
    const reviewer = review.user.login;
    if (!latestReviews[reviewer] || new Date(review.submitted_at) > new Date(latestReviews[reviewer].submitted_at)) {
      latestReviews[reviewer] = review;
    }
  }

  return Object.values(latestReviews).filter(r => r.state === 'APPROVED').length;
}

export function getReviewers(reviews: any[]): ReviewerInfo[] {
  const latestReviews: Record<string, any> = {};

  for (const review of reviews) {
    const reviewer = review.user.login;
    if (!latestReviews[reviewer] || new Date(review.submitted_at) > new Date(latestReviews[reviewer].submitted_at)) {
      latestReviews[reviewer] = review;
    }
  }

  return Object.values(latestReviews).map(r => ({
    login: r.user.login,
    state: r.state as ReviewerInfo['state'],
  }));
}

export function isTeamMember(author: string, teamMembers: string[]): boolean {
  if (teamMembers.length === 0) return true;
  return teamMembers.includes(author);
}

export async function fetchPRData(
  owner: string,
  repo: string,
  pullNumber: number,
  requiredApprovals: number
): Promise<PRData | null> {
  const octokit = getOctokit();

  try {
    const { data: pr } = await withRetry(
      () => octokit.pulls.get({ owner, repo, pull_number: pullNumber }),
      { label: `fetchPR(${owner}/${repo}#${pullNumber})` }
    );

    const reviews = await getReviews(owner, repo, pullNumber);
    const approvals = countApprovals(reviews);
    const reviewers = getReviewers(reviews);

    let state: PRData['state'] = 'open';
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
      author: pr.user!.login,
      url: pr.html_url,
      approvals,
      requiredApprovals,
      reviewers,
      isDraft: pr.draft || false,
      state,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
    };
  } catch (error: any) {
    logger.error(`Error fetching PR data for ${owner}/${repo}#${pullNumber}`, { error: error.message });
    return null;
  }
}
