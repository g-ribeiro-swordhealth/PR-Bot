# Code Style and Conventions

## TypeScript Style

### Naming Conventions
- **Files**: kebab-case (e.g., `webhook-handler.ts`, `team-config.ts`)
- **Functions**: camelCase (e.g., `findTeamsTrackingUser`, `buildAppHomeView`)
- **Interfaces/Types**: PascalCase (e.g., `PRData`, `TeamConfig`, `UserMappingRow`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `REQUIRED_APPROVALS`, `SLACK_BOT_TOKEN`)
- **Database columns**: snake_case (e.g., `github_username`, `slack_user_id`)

### Type Annotations
- **Always** use explicit return types for exported functions
- **Always** define interfaces for data structures
- **Strict mode** enabled (no implicit any)
- Database row types end in `Row` suffix (e.g., `TeamMemberRow`, `PRMessageRow`)

### Code Organization
- One main export per file when possible
- Group imports: external packages, then local imports
- Export interfaces from `src/types.ts` for reuse
- Database operations in `src/db/` directory
- Integration code in dedicated directories (`src/github/`, `src/slack/`)

### Error Handling
- Use `try-catch` blocks for async operations
- Log errors with `logger.error()` including context
- Don't expose internal errors to users (log them, show generic message)
- Use optional chaining (`?.`) and nullish coalescing (`??`) where appropriate

### Database Operations
- Use prepared statements for all SQL queries (prevents injection)
- Use transactions for multi-step operations
- Index frequently queried columns
- Use `ON CONFLICT` for upsert operations

### Comments
- Avoid obvious comments
- Add comments for complex business logic
- Use JSDoc for public API functions (when needed)
- Explain "why" not "what" in comments

### Example Function Style
```typescript
export function findTeamsTrackingUser(githubUsername: string): string[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT DISTINCT channel_id FROM team_members WHERE github_username = ?
  `).all(githubUsername) as { channel_id: string }[];
  return rows.map(r => r.channel_id);
}
```

## Project-Specific Patterns

### Environment Variables
- Load via `dotenv` in `config.ts`
- Validate required variables at startup with `requireEnv()`
- Use `process.env.VAR_NAME` only in `config.ts`, pass via config object elsewhere

### Logging
- Use custom logger from `src/utils/logger.ts`
- Levels: debug, info, warn, error
- Include context object: `logger.info('Message', { key: value })`

### Slack Block Kit
- Build UI with Block Kit objects (not message strings)
- Use `buildAppHomeView()` pattern for complex UIs
- Keep block building separate from data logic

### Database Initialization
- Tables created with `CREATE TABLE IF NOT EXISTS`
- No migration system currently
- Schema defined in `src/db/database.ts`

## No Linting/Formatting Tools
Currently, there's no ESLint, Prettier, or automated code formatting configured. Code style is maintained manually.
