import { KnownBlock } from '@slack/bolt';
import { PRData } from '../types';
import { resolveSlackUser } from './user-mapping';

function statusEmoji(state: PRData['state'], isDraft: boolean, approvals: number, required: number): string {
  if (isDraft) return ':construction:';
  if (state === 'merged') return ':merged-pr:';
  if (state === 'closed') return ':closed-pr:';
  if (approvals >= required) return ':white_check_mark:';
  return ':eyes:';
}

function approvalBar(approvals: number, required: number): string {
  const filled = Math.min(approvals, required);
  return ':large_green_circle:'.repeat(filled) + ':white_circle:'.repeat(Math.max(0, required - filled));
}

function daysOld(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

export function buildPRMessage(pr: PRData): { text: string; blocks: KnownBlock[] } {
  const emoji = statusEmoji(pr.state, pr.isDraft, pr.approvals, pr.requiredApprovals);
  const authorMention = resolveSlackUser(pr.author);
  const age = daysOld(pr.createdAt);

  const stateLabel = pr.isDraft ? 'Draft' : pr.state === 'merged' ? 'Merged' : pr.state === 'closed' ? 'Closed' : 'Open';
  const text = `${emoji} [${pr.repo}] #${pr.number}: ${pr.title} by ${pr.author}`;

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *<${pr.url}|#${pr.number}: ${pr.title}>*\n*Repo:* ${pr.owner}/${pr.repo} | *Author:* ${authorMention} | *Status:* ${stateLabel}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Approvals:* ${approvalBar(pr.approvals, pr.requiredApprovals)} (${pr.approvals}/${pr.requiredApprovals})` +
          `\n:clock1: ${age} day${age !== 1 ? 's' : ''} old`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Last updated: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
        },
      ],
    },
  ];

  return { text, blocks };
}

export function buildStatusSummary(prs: PRData[]): { text: string; blocks: KnownBlock[] } {
  if (prs.length === 0) {
    return {
      text: 'No open PRs being tracked.',
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: ':white_check_mark: *No open PRs being tracked.* All clear!' },
        },
      ],
    };
  }

  const lines = prs.map(pr => {
    const emoji = statusEmoji(pr.state, pr.isDraft, pr.approvals, pr.requiredApprovals);
    return `${emoji} <${pr.url}|#${pr.number}> ${pr.title} — ${pr.approvals}/${pr.requiredApprovals} approvals`;
  });

  return {
    text: `${prs.length} open PR(s) tracked`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:bar_chart: *${prs.length} Open PR(s)*\n\n` + lines.join('\n'),
        },
      },
    ],
  };
}
