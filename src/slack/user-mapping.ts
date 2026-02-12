import { getUserMapping } from '../db/queries';
import { getSlackUserIdForGithubUser } from '../db/team-config';

export function resolveSlackUser(githubUsername: string, channelId?: string): string {
  // Priority 1: Team-specific mapping (from team_members table)
  const teamMappingId = getSlackUserIdForGithubUser(githubUsername, channelId);
  if (teamMappingId) {
    return `<@${teamMappingId}>`;
  }

  // Priority 2: Global mapping (from user_mappings table / env)
  const globalMappingId = getUserMapping(githubUsername);
  if (globalMappingId) {
    return `<@${globalMappingId}>`;
  }

  // Priority 3: Plain text fallback
  return `\`${githubUsername}\``;
}
