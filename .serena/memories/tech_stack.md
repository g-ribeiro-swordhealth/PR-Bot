# Tech Stack

## Runtime
- **Node.js**: 18+
- **Language**: TypeScript 5.3.3 (compiles to ES2020)
- **Module System**: CommonJS

## Core Dependencies
- **@slack/bolt** (^3.17.1): Slack app framework for handling events, commands, and interactivity
- **@octokit/rest** (^20.0.2): GitHub API client for fetching PR data
- **better-sqlite3** (^11.7.0): SQLite database for storing team configs and message state
- **dotenv** (^16.3.1): Environment variable management

## Dev Dependencies
- **typescript** (^5.3.3): TypeScript compiler
- **@types/node**: Node.js type definitions
- **@types/better-sqlite3**: SQLite type definitions

## TypeScript Configuration
- Target: ES2020
- Module: CommonJS
- Strict mode: enabled
- Source maps: enabled
- Output directory: `dist/`
- Source directory: `src/`

## Database
- **SQLite 3** with WAL (Write-Ahead Logging) mode
- File location: `data/pr-bot.db`
- 5 tables: team_configs, team_members, team_repos, pr_messages, user_mappings
- See DATABASE-DESIGN.md for full schema

## No Testing/Linting (Currently)
- No test framework configured
- No ESLint or Prettier configuration
- Manual code quality management
