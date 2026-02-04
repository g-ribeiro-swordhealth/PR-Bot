# Email Version Setup Guide

Send PR status reports directly to your email inbox!

## Quick Start

### Step 1: Get Your GitHub Token
1. Go to: https://github.com/settings/tokens/new
2. Name it "PR Tracker"
3. Check: `repo` and `read:org`
4. Generate and copy the token

### Step 2: Setup Email (Choose Your Provider)

#### Option A: Gmail (Recommended for Testing)

1. **Enable 2-Factor Authentication** on your Google account (required)
2. **Create an App Password:**
   - Go to: https://myaccount.google.com/apppasswords
   - Select app: "Mail"
   - Select device: "Other" (name it "PR Tracker")
   - Click "Generate"
   - Copy the 16-character password

3. **Your .env settings:**
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password
   EMAIL_TO=your-email@gmail.com
   EMAIL_FROM="PR Tracker <your-email@gmail.com>"
   ```

#### Option B: Outlook/Hotmail

1. **Enable 2-Factor Authentication**
2. **Create an App Password:**
   - Go to: https://account.live.com/proofs/manage/additional
   - Create a new app password

3. **Your .env settings:**
   ```
   SMTP_HOST=smtp-mail.outlook.com
   SMTP_PORT=587
   SMTP_USER=your-email@outlook.com
   SMTP_PASS=your-app-password
   EMAIL_TO=your-email@outlook.com
   EMAIL_FROM="PR Tracker <your-email@outlook.com>"
   ```

#### Option C: SendGrid (Best for Production)

1. **Sign up:** https://sendgrid.com (free tier: 100 emails/day)
2. **Create API Key:**
   - Go to Settings → API Keys
   - Create API Key with "Mail Send" permission
   - Copy the key

3. **Your .env settings:**
   ```
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASS=your-sendgrid-api-key
   EMAIL_TO=your-email@example.com
   EMAIL_FROM="PR Tracker <noreply@yourdomain.com>"
   ```

#### Option D: Company Email Server

Ask your IT department for SMTP settings:
```
SMTP_HOST=smtp.yourcompany.com
SMTP_PORT=587 (or 465 for SSL)
SMTP_USER=your-work-email@company.com
SMTP_PASS=your-password
```

### Step 3: Install and Configure

```bash
# Install dependencies
npm install

# Create .env file
cp env-email-example.txt .env

# Edit .env with your actual values
nano .env
```

Your `.env` should look like:
```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
GITHUB_ORG=your-company
GITHUB_REPOS=repo1,repo2,repo3
TEAM_MEMBERS=alice,bob,charlie
REQUIRED_APPROVALS=2

EMAIL_TO=you@example.com
EMAIL_FROM="PR Tracker <noreply@yourdomain.com>"
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Step 4: Test It

```bash
npm start
```

Check your inbox! You should receive a beautifully formatted HTML email.

### Step 5: Automate with GitHub Actions

1. Push code to your GitHub repo
2. Go to Settings → Secrets → Actions
3. Add these secrets:
   - `GH_PAT` - your GitHub token
   - `GITHUB_ORG` - your organization name
   - `GITHUB_REPOS` - comma-separated repo names
   - `TEAM_MEMBERS` - comma-separated usernames
   - `EMAIL_TO` - your email address
   - `EMAIL_FROM` - sender email
   - `SMTP_HOST` - SMTP server
   - `SMTP_PORT` - SMTP port (usually 587)
   - `SMTP_USER` - SMTP username
   - `SMTP_PASS` - SMTP password/app password

4. The workflow will run every weekday at 9 AM

## Email Features

✨ **What You'll Get:**
- Beautiful HTML emails with color coding
- Plain text fallback for email clients that don't support HTML
- PRs grouped by repository
- Visual approval indicators (✅⭕)
- Age of each PR with color coding (red for old, yellow for medium, green for new)
- Clickable links to PRs
- Clean summary when all PRs are approved

## Troubleshooting

### "Authentication failed"
- **Gmail/Outlook:** Make sure you're using an App Password, not your regular password
- Enable 2FA first, then create App Password
- Check that the app password has no spaces

### "Connection timeout"
- Check your SMTP_HOST and SMTP_PORT
- Try port 465 if 587 doesn't work
- Some networks block SMTP - try from a different network

### "No email received"
- Check spam folder
- Verify EMAIL_TO is correct
- Check GitHub Actions logs for errors
- Try sending a test email with: `npm start`

### "Too many login attempts"
- Gmail/Outlook may temporarily block logins if you test too frequently
- Wait 15 minutes and try again
- Consider using SendGrid for production

## Advanced Configuration

### Send to Multiple Recipients

```
EMAIL_TO=person1@example.com,person2@example.com,person3@example.com
```

### Change Email Schedule

Edit the cron in your GitHub Actions workflow:
- `0 9 * * 1-5` - 9 AM weekdays (default)
- `0 9,15 * * 1-5` - 9 AM and 3 PM weekdays
- `0 9 * * *` - 9 AM every day
- `0 */6 * * *` - Every 6 hours

### Custom Email Subject

Edit `pr-tracker-email.js` around line 240 to customize the subject line.

## Security Notes

⚠️ **Never commit your .env file to GitHub!**

Make sure your `.gitignore` includes:
```
node_modules/
.env
```

✅ **Use GitHub Secrets** for automation - they're encrypted and secure.

✅ **Use App Passwords** instead of your main account password.

## Need Help?

Common issues:
1. Make sure 2FA is enabled before creating app passwords
2. Use the correct SMTP host for your provider
3. Check that all environment variables are set
4. Look at the error messages - they usually tell you what's wrong

Still stuck? Check the full README.md or create an issue!

## Future Improvements

### Slack Integration

A future enhancement would allow sending PR status reports directly to Slack channels instead of (or in addition to) email.

#### How It Would Work

1. **Create a Slack App**
   - Go to https://api.slack.com/apps and create a new app
   - Choose "From scratch" and select your workspace
   - Name it "PR Tracker Bot"

2. **Configure Bot Permissions**
   Add these OAuth scopes under "OAuth & Permissions":
   - `chat:write` - Send messages to channels
   - `chat:write.public` - Send messages to channels without joining
   - `channels:read` - View basic channel info (optional)

3. **Install to Workspace**
   - Click "Install to Workspace" and authorize
   - Copy the "Bot User OAuth Token" (starts with `xoxb-`)

4. **Environment Variables**
   ```
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_CHANNEL=#pr-reviews
   NOTIFICATION_MODE=slack  # or "both" for email + slack
   ```

5. **Message Format**
   The Slack message would use Block Kit for rich formatting:
   ```
   PR Status Report - Monday, February 3, 2026

   6 PRs need more approvals (2 required)

   api-member
   ├─ ✅⭕ #123: Add user authentication
   │     @alice • 3 days old
   └─ ⭕⭕ #124: Fix login bug
         @bob • 1 day old

   api-patient-app
   └─ ✅⭕ #456: Update dashboard
         @charlie • 5 days old
   ```

6. **Implementation Outline**
   ```javascript
   // New dependency: @slack/web-api
   const { WebClient } = require('@slack/web-api');
   const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

   async function sendSlackMessage(prs) {
     const blocks = formatPRsAsSlackBlocks(prs);
     await slack.chat.postMessage({
       channel: process.env.SLACK_CHANNEL,
       blocks: blocks,
       text: `${prs.length} PRs need approval` // Fallback
     });
   }
   ```

#### Benefits Over Email
- **Real-time visibility** - Messages appear in team channels instantly
- **Interactive** - Team members can react, thread discussions
- **Mentions** - Can @mention PR authors or reviewers
- **Mobile** - Better mobile experience via Slack app
- **Searchable** - Easy to find past reports in Slack

#### Additional Slack Features to Consider
- **Daily digest thread** - Post updates as replies to keep channel clean
- **Direct messages** - Send personal reminders to PR authors
- **Slash commands** - `/pr-status` to get on-demand reports
- **Button actions** - "Review Now" buttons linking directly to PRs
- **Scheduled reminders** - Multiple daily notifications at configurable times
