# Suggested Commands

## Development Workflow

### Installation
```bash
npm install
```

### Building
```bash
npm run build          # Compile TypeScript to JavaScript
```

### Running
```bash
npm start              # Run compiled code (production)
npm run dev            # Build and run (development)
```

### Project Structure
```bash
ls -la                 # List files in project root
tree src/              # View source code structure (if tree is installed)
```

### Database Operations
```bash
sqlite3 data/pr-bot.db                    # Connect to database
sqlite3 data/pr-bot.db "SELECT * FROM team_configs;"  # Query teams
sqlite3 data/pr-bot.db ".schema"          # Show database schema
```

### Git Operations
```bash
git status                      # Check repository status
git log --oneline -10           # View recent commits
git diff                        # See changes
```

### Logs and Debugging
```bash
tail -f logs/pr-bot.log         # Watch logs (if log file exists)
node dist/index.js              # Run with console output
```

### Environment
```bash
cat .env                        # View environment variables (careful - contains secrets!)
cp .env .env.backup             # Backup environment file
```

### TypeScript
```bash
npx tsc --noEmit                # Type check without building
npx tsc --watch                 # Watch mode (rebuild on changes)
```

### Port Management
```bash
lsof -i :3000                   # Check what's running on port 3000
kill -9 <PID>                   # Kill process by PID
```

### Testing Locally with ngrok
```bash
ngrok http 3000                 # Expose local server to internet
# Update Slack Interactivity URL with ngrok URL
# Update GitHub webhook URL with ngrok URL
```

## Important Slack Setup Notes

### Event Subscriptions (CRITICAL!)
For App Home to work, you MUST enable Event Subscriptions:
1. Slack App Settings → Event Subscriptions → Enable Events: ON
2. Request URL: https://your-domain.com/slack/events
3. Subscribe to bot events: `app_home_opened`
4. Common issue: "URL didn't respond with challenge" = wrong SLACK_SIGNING_SECRET

### Signing Secret vs Bot Token
- SLACK_BOT_TOKEN starts with `xoxb-` (from OAuth & Permissions)
- SLACK_SIGNING_SECRET is a hex string (from Basic Information → App Credentials)
- They are DIFFERENT values! Don't mix them up.

## No Testing/Linting Commands
Currently, there are no test, lint, or format commands configured in this project.
