import dotenv from 'dotenv';
dotenv.config();

import { Octokit } from '@octokit/rest';
import { PRData } from './types';

const CONFIG = {
  githubToken: process.env.GITHUB_TOKEN!,
  githubOrg: process.env.GITHUB_ORG!,
  repos: (process.env.GITHUB_REPOS || '').split(',').map(r => r.trim()).filter(Boolean),
  teamMembers: (process.env.TEAM_MEMBERS || '').split(',').map(m => m.trim()).filter(Boolean),
  requiredApprovals: parseInt(process.env.REQUIRED_APPROVALS || '2', 10),
};

const octokit = new Octokit({ auth: CONFIG.githubToken });

async function getReviews(owner: string, repo: string, prNumber: number) {
  try {
    const { data } = await octokit.pulls.listReviews({ owner, repo, pull_number: prNumber });
    return data;
  } catch {
    return [];
  }
}

interface ReviewActivity {
  login: string;
  state: string;
  date: string;
}

function processReviews(reviews: any[]): { approvals: number; reviewers: any[]; activity: ReviewActivity[] } {
  const latest: Record<string, any> = {};
  const activity: ReviewActivity[] = [];

  for (const r of reviews) {
    const login = r.user.login;
    if (!latest[login] || new Date(r.submitted_at) > new Date(latest[login].submitted_at)) {
      latest[login] = r;
    }
    activity.push({
      login: r.user.login,
      state: r.state,
      date: new Date(r.submitted_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
      }),
    });
  }
  const approvals = Object.values(latest).filter(r => r.state === 'APPROVED').length;
  const reviewers = Object.values(latest).map(r => ({ login: r.user.login, state: r.state }));
  return { approvals, reviewers, activity };
}

function statusEmoji(pr: PRData): string {
  if (pr.isDraft) return '🚧';
  if (pr.state === 'merged') return '🟣';
  if (pr.state === 'closed') return '🔴';
  if (pr.approvals >= pr.requiredApprovals) return '✅';
  return '👀';
}

function approvalBar(approvals: number, required: number): string {
  return '🟢'.repeat(Math.min(approvals, required)) + '⚪'.repeat(Math.max(0, required - approvals));
}

function reviewerIcon(state: string): string {
  if (state === 'APPROVED') return '✅';
  if (state === 'CHANGES_REQUESTED') return '❌';
  return '💬';
}

function daysOld(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

function activityIcon(state: string): string {
  if (state === 'APPROVED') return '✅';
  if (state === 'CHANGES_REQUESTED') return '❌';
  if (state === 'DISMISSED') return '⏪';
  return '💬';
}

function activityLabel(state: string): string {
  if (state === 'APPROVED') return 'approved this PR';
  if (state === 'CHANGES_REQUESTED') return 'requested changes';
  if (state === 'DISMISSED') return 'review was dismissed';
  return 'left a review';
}

function printSlackMessage(pr: PRData, activity: ReviewActivity[]): void {
  const emoji = statusEmoji(pr);
  const bar = approvalBar(pr.approvals, pr.requiredApprovals);
  const stateLabel = pr.isDraft ? 'Draft' : pr.state === 'merged' ? 'Merged' : pr.state === 'closed' ? 'Closed' : 'Open';
  const age = daysOld(pr.createdAt);

  console.log('┌─────────────────────────────────────────────────────────────────');
  console.log(`│ ${emoji} #${pr.number}: ${pr.title}`);
  console.log(`│ Repo: ${pr.owner}/${pr.repo}  │  Author: ${pr.author}  │  Status: ${stateLabel}`);
  console.log('│');
  console.log(`│ Approvals: ${bar}  (${pr.approvals}/${pr.requiredApprovals})`);
  console.log(`│ 🕐 ${age} day${age !== 1 ? 's' : ''} old`);
  console.log(`│ 🔗 ${pr.url}`);
  if (activity.length > 0) {
    console.log('│');
    console.log('│  💬 Thread replies:');
    for (const a of activity) {
      console.log(`│    ${activityIcon(a.state)} ${a.login} *${activityLabel(a.state)}* — ${a.date}`);
    }
  }
  console.log('└─────────────────────────────────────────────────────────────────');
  console.log();
}

async function main() {
  console.log();
  console.log('╔═════════════════════════════════════════════════════════════════╗');
  console.log('║              PR-Bot Demo — Slack Message Preview               ║');
  console.log('╚═════════════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`  Org: ${CONFIG.githubOrg}`);
  console.log(`  Repos: ${CONFIG.repos.join(', ')}`);
  console.log(`  Team: ${CONFIG.teamMembers.length > 0 ? CONFIG.teamMembers.join(', ') : 'ALL'}`);
  console.log(`  Required approvals: ${CONFIG.requiredApprovals}`);
  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  const allPRs: PRData[] = [];
  const prActivity = new Map<string, ReviewActivity[]>();

  for (const repo of CONFIG.repos) {
    process.stdout.write(`  Scanning ${CONFIG.githubOrg}/${repo}...`);

    try {
      const { data: prs } = await octokit.pulls.list({
        owner: CONFIG.githubOrg,
        repo,
        state: 'open',
        per_page: 100,
      });

      let count = 0;
      for (const pr of prs) {
        if (pr.draft) continue;
        if (CONFIG.teamMembers.length > 0 && !CONFIG.teamMembers.includes(pr.user!.login)) continue;

        const reviews = await getReviews(CONFIG.githubOrg, repo, pr.number);
        const { approvals, activity } = processReviews(reviews);

        allPRs.push({
          repo,
          owner: CONFIG.githubOrg,
          number: pr.number,
          title: pr.title,
          author: pr.user!.login,
          url: pr.html_url,
          approvals,
          requiredApprovals: CONFIG.requiredApprovals,
          reviewers: [],
          isDraft: pr.draft || false,
          state: 'open',
          createdAt: pr.created_at,
          updatedAt: pr.updated_at,
        });
        prActivity.set(pr.html_url, activity);
        count++;
      }

      console.log(` ${count} PR(s) found`);
    } catch (error: any) {
      console.log(` error: ${error.message}`);
    }
  }

  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  if (allPRs.length === 0) {
    console.log('  ✅ All clear! No open PRs needing attention.');
    console.log();
    console.log('  This is what the bot would show in Slack:');
    console.log();
    console.log('┌─────────────────────────────────────────────────────────────────');
    console.log('│ ✅ No open PRs being tracked. All clear!');
    console.log('└─────────────────────────────────────────────────────────────────');
  } else {
    console.log(`  The bot would post/update these ${allPRs.length} message(s) in Slack:`);
    console.log();

    for (const pr of allPRs) {
      printSlackMessage(pr, prActivity.get(pr.url) || []);
    }

    // Show the /pr-status summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log();
    console.log('  /pr-status command would show:');
    console.log();
    console.log('┌─────────────────────────────────────────────────────────────────');
    console.log(`│ 📊 ${allPRs.length} Open PR(s)`);
    console.log('│');
    for (const pr of allPRs) {
      const emoji = statusEmoji(pr);
      console.log(`│ ${emoji} #${pr.number} ${pr.title} — ${pr.approvals}/${pr.requiredApprovals} approvals`);
    }
    console.log('└─────────────────────────────────────────────────────────────────');
  }

  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  How it works in production:');
  console.log('  • Each PR above gets ONE Slack message, updated in-place as events happen');
  console.log('  • When someone approves → message updates instantly (via GitHub webhook)');
  console.log('  • When PR is merged/closed → message updates with final status');
  console.log('  • /pr-status slash command shows the summary on demand');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
