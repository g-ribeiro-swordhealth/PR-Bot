import { Octokit } from '@octokit/rest';

let octokitInstance: Octokit;

export function initGitHubClient(token: string): Octokit {
  octokitInstance = new Octokit({
    auth: token,
    request: { timeout: 10000 },
  });
  return octokitInstance;
}

export function getOctokit(): Octokit {
  if (!octokitInstance) {
    throw new Error('GitHub client not initialized. Call initGitHubClient() first.');
  }
  return octokitInstance;
}
