import { getUserMapping } from '../db/queries';

export function resolveSlackUser(githubUsername: string): string {
  const slackId = getUserMapping(githubUsername);
  if (slackId) {
    return `<@${slackId}>`;
  }
  return githubUsername;
}
