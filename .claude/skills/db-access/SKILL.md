---
name: db-access
description: Access PostgreSQL database in development environment. Use when needing to query database schema, inspect data, analyze relationships, or debug database-related issues. Provides verified connection methods and schema locations to avoid token waste on trial-and-error.
---

# Database Access Skill

## Purpose

Provide efficient access to the project's PostgreSQL database in the development environment, eliminating the need to repeatedly discover connection methods, schema locations, and query patterns.

## When to Use

Activate this skill when:

- Inspecting database schema or table structure
- Querying data for debugging or analysis
- Understanding table relationships and foreign keys
- Analyzing data distribution or statistics
- Verifying data integrity or checking constraints

## Database Connection

### Environment

- **Database**: PostgreSQL
- **Environment**: Development (`ai_dev`)
- **Connection Details**: From `.env.development.local`
  - Host: `localhost`
  - Port: `5432`
  - User: `postgres`
  - Password: `postgres`
  - Database: `ai_dev`

### Access Method

Use `psql` command-line client with environment variable for password:

```bash
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "<command>"
```

**Important**:

- Always use `PGPASSWORD=postgres` to avoid password prompts
- Pass commands via `-c` parameter (non-interactive)
- Use `2>&1` to capture both stdout and stderr
- Limit output with `| head -N` or SQL `LIMIT` clause

## Core Workflows

### 1. Explore Database Structure

```bash
# List all tables
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "\dt"

# View table structure (detailed)
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "\d+ <table_name>"
```

### 2. Query Data

```bash
# Count records
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT COUNT(*) FROM <table_name>;"

# Sample data
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT * FROM <table_name> LIMIT 10;"
```

### 3. Analyze Relationships

```bash
# View foreign keys for a table
PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "\d+ <table_name>" | grep -i "foreign-key"
```

### 4. Access Prisma Schema

Prisma schema files are modularized by domain in:

```
/Users/a1/work/ai_monorepo_main/apps/backend/prisma/schema/
```

To find schema files:

```bash
# List all schema files
find /Users/a1/work/ai_monorepo_main/apps/backend/prisma/schema -name "*.prisma"
```

To read schema for a specific model (e.g., User):

```
Read: /Users/a1/work/ai_monorepo_main/apps/backend/prisma/schema/user.prisma
```

**Key schema files**:

- `schema.prisma` - Generator and datasource config
- `user.prisma` - User model
- `wallet.prisma` - Wallet model
- `character.prisma` - Character model
- `activity.prisma` - Activity model
- ... (27 files total)

## Detailed References

For comprehensive command references, security guidelines, and usage examples, refer to:

- `references/psql_commands.md` - Complete psql command reference
- `references/query_patterns.md` - Common query patterns and examples
- `references/troubleshooting.md` - Common issues and solutions

## Safety Guidelines

⚠️ **Development Only**: This skill is for local development environment only

⚠️ **Read-First Approach**: Prioritize SELECT queries; use modification operations cautiously

⚠️ **Forbidden Operations**:

- No `DROP TABLE` or `TRUNCATE`
- No bulk deletes without WHERE clause
- Schema changes must use Prisma migrations (`./scripts/dx db migrate`)

## Quick Reference

| Task            | Command                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| List tables     | `PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "\dt"`                            |
| Table structure | `PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "\d+ <table>"`                    |
| Count records   | `PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT COUNT(*) FROM <table>"`   |
| Sample data     | `PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d ai_dev -c "SELECT * FROM <table> LIMIT 10"` |
| Find schema     | `find /Users/a1/work/ai_monorepo_main/apps/backend/prisma/schema -name "*.prisma"`                        |

---

**Verified**: All commands tested on 2025-10-27
