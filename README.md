# PR Bot - Slack PR Notification System

> Real-time GitHub pull request notifications for Slack with **multi-team self-service configuration**

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🚀 What is PR Bot?

PR Bot is a Slack application that delivers intelligent, real-time pull request notifications to your team. Inspired by PullNotifier, it posts **one message per PR** and updates it in place as the PR progresses—no channel flooding!

### ✨ Key Features

- **📱 Update-in-Place Messages** - One message per PR that updates as the PR changes
- **👥 Multi-Team Support** - Each channel configures their own tracked users and repos
- **⚙️ Self-Service Configuration** - Teams manage settings through Slack's App Home tab (no code changes!)
- **🎯 Smart Routing** - Notifications go to the right channels based on PR author and repo
- **🔔 Customizable Notifications** - Each team chooses which PR events to receive
- **🧵 Threaded Updates** - Reviews, comments, and approvals appear in threads
- **🎨 Rich Formatting** - Beautiful Slack Block Kit messages with status indicators
- **🔒 Secure** - Webhook signature verification and proper authentication

---

## 🚦 Quick Start

### Prerequisites
- Node.js 18+
- A Slack workspace (admin access)
- GitHub organization/repos
- A server to host the bot (or ngrok for local testing)

### Installation

```bash
# Clone the repository
cd pr-bot

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Configuration

1. **Create Slack App** - Follow [SLACK-SETUP.md](./SLACK-SETUP.md)
2. **Configure `.env`**:

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

# Optional: User mappings for @mentions
USER_MAPPINGS=github-user:U01234ABC,another-user:U56789DEF
```

3. **Set up GitHub webhooks** on your repositories
4. **Start the server**:

```bash
npm start
```

### Team Setup

Each team manages their own configuration:

1. Invite bot to channel: `/invite @PR Bot`
2. Open App Home tab in Slack
3. Add GitHub team members to track
4. (Optional) Add specific repos to monitor
5. Customize notification settings

**That's it! No code changes needed.**

---

## 📋 Team Configuration Example

### Frontend Team (`#frontend-prs`)
```
👥 Team Members:
   • alice-frontend
   • bob-ui-dev
   • carol-designer

📦 Repos:
   • ui-admin
   • ui-patient-app
   • ui-components

⚙️ Settings:
   Required Approvals: 2
   Notify on: Open, Ready, Changes Requested, Approved
```

### Backend Team (`#backend-prs`)
```
👥 Team Members:
   • dan-backend
   • eve-api-dev
   • frank-db-admin

📦 Repos:
   • api-member
   • api-patient-app
   • api-eligibility

⚙️ Settings:
   Required Approvals: 2
   Notify on: Open, Changes Requested
```

---

## 🎛️ Features

### Multi-Team Support
- Unlimited teams/channels with independent configuration
- Track specific repos or all repos in the org
- Different approval thresholds and notification preferences per team

### App Home Configuration
- Visual interface - no JSON or YAML editing
- Simple modals for team management
- Real-time updates

### Smart Notifications
- Intelligent routing - PRs appear in channels tracking the author
- Event filtering - choose which PR events to receive
- Draft handling - automatically skip draft PRs
- Update-in-place - one message per PR, always current

---

## 📊 Database Schema

PR Bot uses SQLite to store:

- **team_configs** - Channel-specific settings
- **team_members** - GitHub users tracked per channel
- **team_repos** - Repositories tracked per channel (optional)
- **pr_messages** - Message state for update-in-place functionality
- **user_mappings** - GitHub username → Slack user ID mappings

---

## 🔧 Configuration Reference

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub personal access token (repo scope) |
| `GITHUB_ORG` | Yes | GitHub organization name |
| `GITHUB_WEBHOOK_SECRET` | Yes | Secret for webhook signature verification |
| `SLACK_BOT_TOKEN` | Yes | Slack bot token (xoxb-...) |
| `SLACK_SIGNING_SECRET` | Yes | Slack signing secret |
| `PORT` | No | Server port (default: 3000) |
| `USER_MAPPINGS` | No | GitHub→Slack user mappings (user1:U123,user2:U456) |

### Slack Permissions Required

- `chat:write` - Post messages to channels
- `users:read` - Read user info for @mentions
- `commands` - Slash command support

---

## 🚀 Deployment

See [SLACK-SETUP.md](./SLACK-SETUP.md) for detailed deployment instructions.

---

## 🆘 Support

- **Documentation**: See [SLACK-SETUP.md](./SLACK-SETUP.md) for detailed setup
- **Issues**: Report bugs or request features via GitHub Issues

---

**Made with ❤️ for developers who love clean Slack channels**
