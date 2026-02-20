# PR Bot - Project Overview

## Purpose
PR Bot is a Slack application that delivers intelligent, real-time GitHub pull request notifications to teams. It posts ONE message per PR and updates it in place as the PR progresses (no channel flooding).

## Key Features
- **Update-in-Place Messages**: One message per PR that updates as the PR changes
- **Multi-Team Support**: Each channel configures their own tracked users and repos
- **Self-Service Configuration**: Teams manage settings through Slack's App Home tab (no code changes needed!)
- **Smart Routing**: Notifications go to the right channels based on PR author and repo
- **Customizable Notifications**: Each team chooses which PR events to receive
- **Threaded Updates**: Reviews, comments, and approvals appear in threads
- **Rich Formatting**: Beautiful Slack Block Kit messages with status indicators

## Architecture
- **Backend**: Node.js + TypeScript
- **Database**: SQLite (local file-based)
- **Integrations**: GitHub webhooks + Slack Bolt framework
- **Message Tracking**: Stores PR-to-Slack-message mappings for update-in-place functionality

## Prerequisites
- Node.js 18+
- Slack workspace (admin access)
- GitHub organization/repos
- Server to host the bot (or ngrok for local testing)

## Version
Current version: 2.0.0 (multi-team support)
