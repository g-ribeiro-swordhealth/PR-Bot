# PR Bot - Slack PR Notification System

> Real-time GitHub pull request notifications for Slack with **multi-team self-service configuration**

---

## What is PR Bot?

PR Bot is a Slack application that delivers intelligent, real-time pull request notifications to your team. It posts **one message per PR** and updates it in place as the PR progresses — no channel flooding.

### Key Features

- **Update-in-Place Messages** - One message per PR that updates as the PR changes
- **Multi-Team Support** - Each channel configures their own tracked users and repos
- **Self-Service Configuration** - Teams manage settings through Slack's App Home tab (no code changes)
- **Smart Routing** - Notifications go to the right channels based on PR author and repo
- **Customizable Notifications** - Each team chooses which PR events to receive
- **Threaded Updates** - Reviews, comments, and approvals appear in threads
- **Bot Comment Filtering** - Optionally exclude bot/automated comments (e.g. Copilot) from threads
- **Rich Formatting** - Slack Block Kit messages with status indicators
- **Secure** - Webhook signature verification and proper authentication

---

## Quick Start

### Prerequisites
- Node.js 18+
- A Slack workspace (admin access or IT to create the app)
- GitHub organization/repos
- A server to host the bot (or ngrok for local testing)

### Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Configuration

1. **Create Slack App** - Follow [docs/SLACK-SETUP.md](./docs/SLACK-SETUP.md)
2. **Configure `.env`** (copy from `.env.example`):

```env
# GitHub
GITHUB_TOKEN=ghp_your_token_here
GITHUB_ORG=YourOrganization
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Slack
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your_signing_secret

# Server
PORT=3000

# Optional: Global GitHub→Slack user mappings for @mentions
# Prefer setting these per-team via the App Home tab instead
USER_MAPPINGS=github-user:U01234ABC,another-user:U56789DEF
```

3. **Set up GitHub webhooks** pointing to `https://your-server/github/webhook`
4. **Start the server**:

```bash
# Production
npm start

# Development (builds then runs)
npm run dev

# Manual test (post PRs without webhooks)
npm run test-manual <repo-name> <slack-channel-id>
```

### Team Setup

Each team manages their own configuration through Slack:

1. Invite bot to channel: `/invite @PR Bot`
2. Open **App Home** tab (click "PR Bot" in the Apps sidebar)
3. Add GitHub team members to track
4. (Optional) Add specific repos — if skipped, **all org repos are tracked**
5. Customize notification settings

**No code changes needed.**

---

## Team Configuration Example

### Frontend Team (`#frontend-prs`)
```
Team Members:
   • alice-frontend
   • bob-ui-dev

Repos:
   • ui-admin
   • ui-patient-app

Settings:
   Required Approvals: 2
   Notify on: Open, Ready, Changes Requested, Approved
   Exclude bot comments: ON
```

### Backend Team (`#backend-prs`)
```
Team Members:
   • dan-backend
   • eve-api-dev

Repos: (none — tracks all org repos)

Settings:
   Required Approvals: 2
   Notify on: Open, Changes Requested
```

---

## Features

### Multi-Team Support
- Unlimited teams/channels with independent configuration
- Track specific repos or all repos in the org
- Different approval thresholds and notification preferences per team

### App Home Configuration
Per-channel settings configurable via the Slack App Home tab:

| Setting | Description |
|---|---|
| Team members | GitHub usernames to track (with optional Slack user ID for @mentions) |
| Repos | Specific repos to watch (empty = all org repos) |
| Required approvals | How many approvals before a PR is considered "ready" |
| Notify on open | Post when a PR is opened |
| Notify on ready | Post when a PR is marked ready for review |
| Notify on changes requested | Post when reviewer requests changes |
| Notify on approved | Post when a PR is approved |
| Notify on merged | Post when a PR is merged |
| Exclude bot comments | Filter out bot/automated comments from threads (e.g. Copilot) |

### Smart Notifications
- Intelligent routing — PRs appear in channels tracking the author
- Event filtering — choose which PR events to receive
- Draft handling — automatically skip draft PRs
- Update-in-place — one message per PR, always current

---

## Database Schema

PR Bot uses SQLite (`data/pr-bot.db`, created automatically on first run).

| Table | Purpose |
|---|---|
| `team_configs` | Per-channel notification settings |
| `team_members` | GitHub users tracked per channel, with optional Slack user ID |
| `team_repos` | Repos tracked per channel (optional — empty means all repos) |
| `pr_messages` | Slack message state for update-in-place |
| `user_mappings` | Global GitHub → Slack ID fallback mappings |

See [docs/DATABASE-DESIGN.md](./docs/DATABASE-DESIGN.md) for full schema and query reference.

---

## Configuration Reference

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Yes | GitHub personal access token (repo scope) |
| `GITHUB_ORG` | Yes | GitHub organization name |
| `GITHUB_WEBHOOK_SECRET` | Yes | Secret for webhook signature verification |
| `SLACK_BOT_TOKEN` | Yes | Slack bot token (`xoxb-...`) |
| `SLACK_SIGNING_SECRET` | Yes | Slack signing secret |
| `PORT` | No | Server port (default: 3000) |
| `USER_MAPPINGS` | No | Global GitHub→Slack mappings (`user1:U123,user2:U456`) |

### Slack Permissions Required

| Scope | Purpose |
|---|---|
| `chat:write` | Post and update messages |
| `users:read` | Resolve user info for @mentions |
| `channels:read` | List public channels for App Home |
| `groups:read` | List private channels for App Home |

---

## Support

- **Slack setup**: [docs/SLACK-SETUP.md](./docs/SLACK-SETUP.md)
- **Database design**: [docs/DATABASE-DESIGN.md](./docs/DATABASE-DESIGN.md)
- **Issues**: Report bugs via GitHub Issues
