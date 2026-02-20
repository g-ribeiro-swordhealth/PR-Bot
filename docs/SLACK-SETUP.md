# PR Bot — Slack App Setup

## Step 1: Create the App

1. Go to https://api.slack.com/apps
2. Click **"Create New App" → "From scratch"**
3. Name it **"PR Bot"**, select the workspace, click **"Create App"**

---

## Step 2: Set Bot Permissions

Go to **OAuth & Permissions** → **Bot Token Scopes** and add:

| Scope | Purpose |
|---|---|
| `chat:write` | Post and update messages in channels |
| `users:read` | Resolve user info for @mentions |
| `channels:read` | List public channels the bot is in |
| `groups:read` | List private channels the bot is in |

---

## Step 3: Enable App Home

Go to **App Home** and:
- Toggle **Home Tab** → **ON**
- Check **"Allow users to send Slash commands and messages from the messages tab"**

---

## Step 4: Enable Interactivity

Go to **Interactivity & Shortcuts**:
- Toggle **Interactivity** → **ON**
- Set **Request URL** to: `https://team-engagement-slack-app.staging.swordhealth.com/slack/events`

---

## Step 5: Enable Event Subscriptions

Go to **Event Subscriptions**:
- Toggle **Enable Events** → **ON**
- Set **Request URL** to: `https://team-engagement-slack-app.staging.swordhealth.com/slack/events` (same as above)
- Under **Subscribe to bot events**, add: `app_home_opened`
- Click **Save Changes**

> The URL verification will only pass once the server is running.

---

## Step 6: Install to Workspace

Go to **OAuth & Permissions** → **Install to Workspace** → **Allow**

After installing, copy:
- **Bot User OAuth Token** (`xoxb-...`) → needed for server config
- **Signing Secret** (found under **Basic Information → App Credentials**) → needed for server config

---

## Step 7: (Optional) Set App Icon

Go to **Basic Information → Display Information** and upload a square image (min 512×512 px).
