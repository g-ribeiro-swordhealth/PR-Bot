# Task Completion Checklist

## When a Task is Completed

### 1. Build the Project
```bash
npm run build
```
- Ensure TypeScript compiles without errors
- Check for type errors or warnings
- Compiled output goes to `dist/` directory

### 2. Test Locally (Manual)
Since there are no automated tests, manually verify:

**For Code Changes:**
```bash
npm run dev
```
- Start the application
- Verify it starts without errors
- Check logs for warnings

**For Database Changes:**
```bash
sqlite3 data/pr-bot.db ".schema"
sqlite3 data/pr-bot.db "SELECT * FROM [table_name];"
```
- Verify schema changes applied correctly
- Check data integrity

**For Slack Integration Changes:**
- Test App Home functionality
- Test message formatting
- Test button interactions and modals
- Verify webhooks receive events

**For GitHub Integration Changes:**
- Send test webhook payloads
- Verify PR data fetching
- Check webhook signature validation

### 3. Environment Variables
- If new env vars added, update `.env.example` (if it exists)
- Update README.md or SLACK-SETUP.md with new configuration
- Verify all required env vars are documented

### 4. Documentation
- Update README.md if user-facing changes
- Update DATABASE-DESIGN.md if schema changed
- Update SLACK-SETUP.md if Slack configuration changed
- Add comments for complex logic

### 5. Git Workflow
```bash
git status                    # Check changes
git add <files>               # Stage changes
git commit -m "message"       # Commit with clear message
```

**Commit Message Guidelines:**
- Use imperative mood: "Add feature" not "Added feature"
- Be specific: "Fix webhook signature validation" not "Fix bug"
- Include context if needed

### 6. Deployment Considerations
Before deploying to production:
- Ensure `.env` is configured on production server
- Verify GitHub webhook URLs point to production
- Verify Slack Interactivity URL points to production
- Check database file location and permissions
- Ensure port is available and accessible
- Test with ngrok first if possible

### 7. No Automated Quality Checks
**Currently NOT Available:**
- ❌ Automated tests (no test framework)
- ❌ Linting (no ESLint)
- ❌ Code formatting (no Prettier)
- ❌ Pre-commit hooks
- ❌ CI/CD pipeline

These should be verified manually until tooling is added.

## Common Issues to Check

### TypeScript Compilation Errors
```bash
npx tsc --noEmit
```
- Check for type errors
- Verify imports are correct
- Ensure interfaces match actual data

### Port Already in Use
```bash
lsof -i :3000
kill -9 <PID>
```

### Database Locked
- Stop all running instances
- Check for stale SQLite lock files
- Ensure WAL mode is enabled

### Environment Variables Missing
- Check `.env` file exists
- Verify all required vars are set
- Check for typos in variable names
