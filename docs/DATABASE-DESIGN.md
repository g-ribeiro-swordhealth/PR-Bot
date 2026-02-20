# PR Bot Database Design

> Complete database schema documentation for the PR Bot multi-team notification system

---

## 📋 Table Definitions

### 1. `team_configs` - Channel Configuration

**Purpose**: Store per-channel notification settings and preferences.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `channel_id` | TEXT | PRIMARY KEY | Slack channel ID (e.g., C01234ABC) |
| `channel_name` | TEXT | NULLABLE | Human-readable channel name (e.g., #frontend-prs) |
| `required_approvals` | INTEGER | DEFAULT 2 | Number of approvals needed before PR is "ready" |
| `notify_on_open` | INTEGER | DEFAULT 1 | Boolean: Notify when PR opened (0=false, 1=true) |
| `notify_on_ready` | INTEGER | DEFAULT 1 | Boolean: Notify when PR ready for review |
| `notify_on_changes_requested` | INTEGER | DEFAULT 1 | Boolean: Notify when changes requested |
| `notify_on_approved` | INTEGER | DEFAULT 1 | Boolean: Notify when PR approved |
| `notify_on_merged` | INTEGER | DEFAULT 0 | Boolean: Notify when PR merged |
| `created_at` | TEXT | DEFAULT now() | Timestamp of config creation |
| `updated_at` | TEXT | DEFAULT now() | Timestamp of last update |

**Indexes**:
- PRIMARY KEY on `channel_id`

**Example Data**:
```sql
INSERT INTO team_configs (channel_id, channel_name, required_approvals, notify_on_open, notify_on_ready)
VALUES ('C0123456789', '#frontend-prs', 2, 1, 1);
```

---

### 2. `team_members` - Tracked GitHub Users per Channel

**Purpose**: Define which GitHub users are tracked in each channel.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Auto-generated unique ID |
| `channel_id` | TEXT | FOREIGN KEY, NOT NULL | References `team_configs(channel_id)` |
| `github_username` | TEXT | NOT NULL | GitHub username to track |
| `slack_user_id` | TEXT | NULLABLE | Optional Slack user ID for @mentions |
| `added_by_slack_user` | TEXT | NULLABLE | Slack user ID who added this member |
| `added_at` | TEXT | DEFAULT now() | Timestamp when member was added |

**Constraints**:
- `FOREIGN KEY (channel_id) REFERENCES team_configs(channel_id) ON DELETE CASCADE`
- `UNIQUE(channel_id, github_username)` - No duplicate members per channel

**Indexes**:
- `idx_team_members_channel` on `channel_id`
- `idx_team_members_github` on `github_username`

**Example Data**:
```sql
INSERT INTO team_members (channel_id, github_username, slack_user_id, added_by_slack_user)
VALUES
  ('C0123456789', 'john-doe', 'U01ABC123', 'U99XYZ999'),
  ('C0123456789', 'jane-smith', 'U02DEF456', 'U99XYZ999'),
  ('C0123456789', 'bob-jones', NULL, 'U99XYZ999');
```

**Cascade Behavior**:
- When a `team_configs` row is deleted, all related `team_members` are automatically deleted.

---

### 3. `team_repos` - Tracked Repositories per Channel

**Purpose**: Define which repositories are tracked in each channel (optional - if empty, all repos are tracked).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Auto-generated unique ID |
| `channel_id` | TEXT | FOREIGN KEY, NOT NULL | References `team_configs(channel_id)` |
| `repo_name` | TEXT | NOT NULL | Repository name (e.g., "api-member") |
| `added_at` | TEXT | DEFAULT now() | Timestamp when repo was added |

**Constraints**:
- `FOREIGN KEY (channel_id) REFERENCES team_configs(channel_id) ON DELETE CASCADE`
- `UNIQUE(channel_id, repo_name)` - No duplicate repos per channel

**Indexes**:
- `idx_team_repos_channel` on `channel_id`

**Example Data**:
```sql
INSERT INTO team_repos (channel_id, repo_name)
VALUES
  ('C0123456789', 'api-member'),
  ('C0123456789', 'api-patient-app'),
  ('C0123456789', 'ui-admin');
```

**Special Case**:
- If a channel has **no entries** in `team_repos`, the bot tracks **ALL repositories** in the organization.

**Cascade Behavior**:
- When a `team_configs` row is deleted, all related `team_repos` are automatically deleted.

---

### 4. `pr_messages` - Message State Tracking

**Purpose**: Track which Slack message corresponds to which GitHub PR for update-in-place functionality.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `pr_url` | TEXT | PRIMARY KEY | GitHub PR URL (unique identifier) |
| `slack_channel` | TEXT | NOT NULL | Slack channel ID where message was posted |
| `slack_message_ts` | TEXT | NOT NULL | Slack message timestamp (unique per channel) |
| `pr_state` | TEXT | DEFAULT 'open' | Current PR state: open, closed, merged |
| `owner` | TEXT | NOT NULL | GitHub org/user who owns the repo |
| `repo` | TEXT | NOT NULL | Repository name |
| `pr_number` | INTEGER | NOT NULL | PR number within the repo |
| `last_updated` | TEXT | DEFAULT now() | Last time this message was updated |

**Indexes**:
- PRIMARY KEY on `pr_url`
- `idx_pr_messages_state` on `pr_state`
- `idx_pr_messages_repo` on `(owner, repo)`

**Example Data**:
```sql
INSERT INTO pr_messages (pr_url, slack_channel, slack_message_ts, pr_state, owner, repo, pr_number)
VALUES (
  'https://github.com/YourOrg/api-member/pull/123',
  'C0123456789',
  '1234567890.123456',
  'open',
  'YourOrg',
  'api-member',
  123
);
```

**Usage**:
- When a PR webhook arrives, lookup by `pr_url` to find the Slack message
- Update the existing message instead of posting a new one
- Keeps channels clean with one message per PR

---

### 5. `user_mappings` - Global GitHub ↔ Slack Mappings

**Purpose**: Global fallback for GitHub username to Slack user ID mappings (legacy/optional).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `github_username` | TEXT | PRIMARY KEY | GitHub username |
| `slack_user_id` | TEXT | NOT NULL | Slack user ID (e.g., U01234ABC) |

**Indexes**:
- PRIMARY KEY on `github_username`

**Example Data**:
```sql
INSERT INTO user_mappings (github_username, slack_user_id)
VALUES
  ('john-doe', 'U01ABC123'),
  ('jane-smith', 'U02DEF456');
```

**Priority System** (from `src/slack/user-mapping.ts`):
1. **Team-specific mapping**: `team_members.slack_user_id` (preferred)
2. **Global mapping**: `user_mappings.slack_user_id` (fallback)
3. **Plain text**: Just show GitHub username in backticks

---

## 🔗 Relationships

### One-to-Many Relationships

```
team_configs (1) ──── (N) team_members
   ↓
   Each channel config can have multiple team members

team_configs (1) ──── (N) team_repos
   ↓
   Each channel config can track multiple repositories
```

### Cascade Delete Behavior

When a `team_configs` row is deleted:
- ✅ All related `team_members` are automatically deleted
- ✅ All related `team_repos` are automatically deleted

**Example**:
```sql
-- Deleting a team config removes all associated data
DELETE FROM team_configs WHERE channel_id = 'C0123456789';
-- This automatically deletes:
--   - All team_members with channel_id = 'C0123456789'
--   - All team_repos with channel_id = 'C0123456789'
```

---

## 🔍 Common Queries

### Find channels tracking a GitHub user
```sql
SELECT DISTINCT channel_id
FROM team_members
WHERE github_username = 'john-doe';
```

### Find channels tracking a specific repo
```sql
SELECT DISTINCT channel_id
FROM team_repos
WHERE repo_name = 'api-member';
```

### Find channels tracking ALL repos (no specific repos configured)
```sql
SELECT channel_id
FROM team_configs
WHERE channel_id NOT IN (
  SELECT DISTINCT channel_id FROM team_repos
);
```

### Get full configuration for a channel
```sql
-- Get config
SELECT * FROM team_configs WHERE channel_id = 'C0123456789';

-- Get members
SELECT * FROM team_members WHERE channel_id = 'C0123456789' ORDER BY added_at;

-- Get repos
SELECT * FROM team_repos WHERE channel_id = 'C0123456789' ORDER BY added_at;
```

### Find which channels should receive a PR notification
```sql
-- For PR from github_username='alice' in repo='api-member'
SELECT DISTINCT tm.channel_id
FROM team_members tm
LEFT JOIN team_repos tr ON tm.channel_id = tr.channel_id
WHERE tm.github_username = 'alice'
  AND (tr.repo_name = 'api-member' OR tr.repo_name IS NULL);
```

### Find existing Slack message for a PR
```sql
SELECT slack_channel, slack_message_ts
FROM pr_messages
WHERE pr_url = 'https://github.com/YourOrg/api-member/pull/123';
```

### Resolve Slack user ID for @mention
```sql
-- Priority 1: Team-specific mapping
SELECT slack_user_id
FROM team_members
WHERE github_username = 'alice'
  AND channel_id = 'C0123456789'
  AND slack_user_id IS NOT NULL;

-- Priority 2: Global mapping (fallback)
SELECT slack_user_id
FROM user_mappings
WHERE github_username = 'alice';
```

---

## 📈 Indexes for Performance

| Index Name | Table | Column(s) | Purpose |
|------------|-------|-----------|---------|
| `idx_pr_messages_state` | `pr_messages` | `pr_state` | Filter open/closed/merged PRs |
| `idx_pr_messages_repo` | `pr_messages` | `(owner, repo)` | Find PRs by repository |
| `idx_team_members_channel` | `team_members` | `channel_id` | List members for a channel |
| `idx_team_members_github` | `team_members` | `github_username` | Find channels tracking a user |
| `idx_team_repos_channel` | `team_repos` | `channel_id` | List repos for a channel |

---

## 💡 Design Decisions

### 1. **Why SQLite?**
- ✅ Simple deployment (single file)
- ✅ No separate database server needed
- ✅ WAL mode for good concurrency
- ✅ Perfect for read-heavy workloads (PR updates)

### 2. **Why channel_id as PRIMARY KEY?**
- Each Slack channel has exactly one configuration
- Natural identifier for team-specific settings
- Prevents duplicate configs per channel

### 3. **Why separate team_members and user_mappings?**
- `team_members`: Team-specific, managed via Slack App Home
- `user_mappings`: Global fallback, seeded from `.env`
- Allows gradual migration from global to team-specific mappings

### 4. **Why UNIQUE(channel_id, github_username)?**
- Prevents duplicate tracking of the same user in a channel
- Each user should only appear once per channel configuration

### 5. **Why store repo_name instead of repo_id?**
- Simpler for users to configure (just type "api-member")
- Matches how GitHub repos are referenced in webhooks
- No need to lookup repo IDs

### 6. **Why INTEGER for booleans?**
- SQLite doesn't have native BOOLEAN type
- Convention: 0 = false, 1 = true
- Allows easy filtering with `WHERE notify_on_open = 1`

---

## 🧪 Example: Complete Team Setup

```sql
-- 1. Create team config for #frontend-prs
INSERT INTO team_configs (channel_id, channel_name, required_approvals, notify_on_open, notify_on_ready)
VALUES ('C0123456789', '#frontend-prs', 2, 1, 1);

-- 2. Add team members
INSERT INTO team_members (channel_id, github_username, slack_user_id) VALUES
  ('C0123456789', 'alice-frontend', 'U01ABC123'),
  ('C0123456789', 'bob-ui-dev', 'U02DEF456'),
  ('C0123456789', 'carol-designer', NULL);

-- 3. Add tracked repositories
INSERT INTO team_repos (channel_id, repo_name) VALUES
  ('C0123456789', 'ui-admin'),
  ('C0123456789', 'ui-patient-app'),
  ('C0123456789', 'ui-components');

-- 4. When PR webhook arrives for alice-frontend's PR in ui-admin:
--    - Bot finds channel C0123456789 (tracking alice-frontend + ui-admin)
--    - Posts message to #frontend-prs
--    - Stores message in pr_messages for future updates

-- 5. When PR gets approved:
--    - Bot looks up message in pr_messages by pr_url
--    - Updates the existing Slack message (update-in-place)
--    - No new message, keeps channel clean!
```

---

## 🚀 Database Migrations

The current schema is created in `src/db/database.ts:23-79` using `CREATE TABLE IF NOT EXISTS`.

### Future Migration Strategy

If you need to modify the schema:

1. **Create migration files**: `migrations/001_add_column.sql`
2. **Track migrations**: Add a `migrations` table
3. **Apply on startup**: Run pending migrations before app starts

**Example migration**:
```sql
-- migrations/001_add_pr_labels.sql
ALTER TABLE pr_messages ADD COLUMN labels TEXT DEFAULT '[]';
```

---

## 📊 Database File Location

- **Path**: `data/pr-bot.db`
- **Created automatically** on first run
- **Backed by SQLite WAL** (write-ahead logging)
- **Concurrent access**: Multiple readers + single writer

---

## 🔍 Debugging Queries

```bash
# Connect to database
sqlite3 data/pr-bot.db

# List all tables
.tables

# Show schema for a table
.schema team_configs

# See all team configurations
SELECT * FROM team_configs;

# See all tracked users
SELECT
  tc.channel_name,
  tm.github_username,
  tm.slack_user_id
FROM team_members tm
JOIN team_configs tc ON tm.channel_id = tc.channel_id
ORDER BY tc.channel_name, tm.github_username;

# See all PR messages
SELECT
  repo,
  pr_number,
  pr_state,
  slack_channel,
  last_updated
FROM pr_messages
ORDER BY last_updated DESC;
```

---

**Made with ❤️ for clean database design**
