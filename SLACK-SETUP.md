# Slack App Setup Guide

This guide will help you set up the PR Bot Slack app with the new **multi-team configuration** feature.

## 🎯 What You Get

- **Self-Service Configuration**: Teams manage their own settings through Slack's App Home tab
- **Per-Channel Setup**: Each channel can track different GitHub users and repos
- **No Code Changes**: Add/remove team members without touching `.env` or code
- **Multiple Teams**: Support unlimited teams, each with their own configuration
- **Customizable Notifications**: Each team chooses which PR events to receive

---

## Step 1: Create Slack App

1. Go to https://api.slack.com/apps
2. Click **"Create New App" → "From scratch"**
3. Name it: **"PR Bot"**
4. Select your workspace
5. Click **"Create App"**

---

## Step 2: Configure Bot Permissions

Go to **"OAuth & Permissions"** → **"Bot Token Scopes"** and add:

### Required Scopes:
- `chat:write` - Post messages to channels
- `users:read` - Read user info for mentions
- `commands` - Slash commands support

### That's it!
Since teams will invite the bot to their channels, you don't need `chat:write.public` or channel listing permissions.

---

## Step 3: Enable App Home

1. Go to **"App Home"**
2. Toggle **"Home Tab"** to **ON**
3. Check **"Allow users to send Slash commands and messages from the messages tab"**

---

## Step 4: Enable Interactivity

1. Go to **"Interactivity & Shortcuts"**
2. Toggle **"Interactivity"** to **ON**
3. Set **Request URL** to: `https://yourdomain.com/slack/events`
   - For local testing with ngrok: `https://your-ngrok-url.ngrok.io/slack/events`

---

## Step 5: Install to Workspace

1. Go to **"OAuth & Permissions"**
2. Click **"Install to Workspace"**
3. Review permissions and click **"Allow"**
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)
   - Save as `SLACK_BOT_TOKEN` in `.env`

---

## Step 6: Get Credentials

### Signing Secret:
1. Go to **"Basic Information"**
2. Under **"App Credentials"**, copy **Signing Secret**
3. Save as `SLACK_SIGNING_SECRET` in `.env`

---

## Step 7: Configure GitHub Webhook

For each repository you want to track:

1. Go to repo **Settings → Webhooks → Add webhook**
2. **Payload URL**: `https://yourdomain.com/github/webhook`
3. **Content type**: `application/json`
4. **Secret**: Generate a random string
   - Save as `GITHUB_WEBHOOK_SECRET` in `.env`
5. **Events**: Select:
   - ✅ Pull requests
   - ✅ Pull request reviews
   - ✅ Issue comments
6. Click **"Add webhook"**

---

## Step 8: Update `.env` File

```env
# GitHub Configuration
GITHUB_TOKEN=ghp_your_github_token_here
GITHUB_ORG=YourOrganization
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your_signing_secret_here

# Server Port
PORT=3000

# Optional: GitHub→Slack user mappings (for @mentions)
USER_MAPPINGS=github-user1:U01234ABC,github-user2:U05678DEF
```

**Note**: You no longer need `SLACK_CHANNEL`, `TEAM_MEMBERS`, or `GITHUB_REPOS` in `.env`!
Teams configure these themselves through the App Home tab.

---

## Step 9: Deploy and Start

### Local Development:
```bash
npm run build
npm run dev
```

### With ngrok (for local testing):
```bash
ngrok http 3000
# Update Slack Interactivity URL with ngrok URL
npm run dev
```

### Production:
Deploy to your server and ensure:
- Slack Interactivity URL points to your production domain
- GitHub webhooks point to your production domain

---

## Step 10: Team Setup

### For Each Team/Channel:

1. **Invite the bot to your channel:**
   ```
   /invite @PR Bot
   ```

2. **Open App Home:**
   - Click on "PR Bot" in the Apps section
   - Click the **"Home"** tab

3. **Configure your team:**
   - Click **"➕ Add Team Members"**
   - Enter GitHub usernames (one per line):
     ```
     g-ribeiro-swordhealth
     jorge-costa-sword
     emiliomarin
     ```
   - Click **"Add"**

4. **(Optional) Add specific repositories:**
   - Click **"➕ Add Repos"**
   - Enter repo names (one per line):
     ```
     api-member
     api-patient-app
     ui-admin
     ```
   - Click **"Add"**
   - **Note**: If you don't add repos, the bot will track ALL repos in your organization

5. **(Optional) Customize settings:**
   - Click **"✏️ Edit Settings"**
   - Set required approvals (default: 2)
   - Choose which events to receive notifications for:
     - ✅ PR opened
     - ✅ PR ready for review
     - ✅ Changes requested
     - ✅ PR approved
     - ❌ PR merged (optional)

---

## 🎉 You're Done!

Each team can now manage their own PR notifications independently:

- **Add/remove team members** without code changes
- **Track specific repos** or all repos
- **Customize notification preferences** per team
- **Multiple channels** can have different configurations

---

## Usage Examples

### Scenario 1: Frontend Team
**Channel**: `#frontend-prs`
- **Team Members**: `alice`, `bob`, `carol`
- **Repos**: `ui-admin`, `ui-patient-app`, `ui-components`
- **Required Approvals**: 2
- **Notifications**: All events

### Scenario 2: Backend Team
**Channel**: `#backend-prs`
- **Team Members**: `dan`, `eve`, `frank`
- **Repos**: `api-member`, `api-patient-app`, `api-eligibility`
- **Required Approvals**: 2
- **Notifications**: Only PR opened and changes requested

### Scenario 3: Leadership Team
**Channel**: `#all-prs`
- **Team Members**: (all engineers)
- **Repos**: (all repos - don't specify any)
- **Required Approvals**: 1
- **Notifications**: Only PR merged

---

## Troubleshooting

### Bot doesn't respond when invited
- Check that the bot token is correct in `.env`
- Verify the bot is properly installed to the workspace
- Check server logs for errors

### App Home doesn't show
- Ensure App Home tab is enabled in Slack app settings
- Reinstall the app to workspace if needed

### Notifications not appearing
- Verify GitHub webhook is configured correctly
- Check webhook secret matches in `.env`
- Ensure team members are added in App Home
- Check server logs for webhook events

### Cannot add team members
- Ensure Interactivity is enabled in Slack app settings
- Verify Request URL is correct and server is accessible
- Check server logs for errors

---

## Support

For issues or questions:
- Check server logs: `tail -f logs/pr-bot.log`
- Verify database: `sqlite3 data/pr-bot.db "SELECT * FROM team_configs;"`
- Test GitHub webhooks: Go to repo Settings → Webhooks → Recent Deliveries

---

## Next Steps

- Set up GitHub→Slack user mappings in `.env` for better @mentions
- Customize notification messages in `src/slack/messages.ts`
- Add more teams and channels as needed
- Monitor webhook activity and adjust settings
