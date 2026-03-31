import { Client } from 'pg'
import {
  normalizeBacktestCapabilityConfig,
  resolveConfiguredBacktestCapabilityConfig,
} from '../src/modules/backtesting/backtest-capability-config'

type RequiredStructureKind = 'table' | 'column'

interface RequiredStructure {
  kind: RequiredStructureKind
  key: string
  migrationName: string
  applyStatements: string[]
}

export interface SchemaAuditInput {
  existingTables: Set<string>
  existingColumns: Set<string>
  appliedMigrations: Set<string>
  activeCapabilityConfig: {
    allowedSymbols?: unknown
    allowedBaseTimeframes?: unknown
  } | null
}

export interface SchemaAuditSummary {
  isHealthy: boolean
  missingTables: string[]
  missingColumns: string[]
  driftedMigrations: string[]
  missingActiveCapabilityConfig: boolean
  invalidActiveCapabilityConfig: boolean
}

export const REQUIRED_QUANTIFY_SCHEMA: RequiredStructure[] = [
  {
    kind: 'table',
    key: 'public.backtest_capability_configs',
    migrationName: '20260325103000_add_backtest_capability_configs',
    applyStatements: [
      `CREATE TABLE IF NOT EXISTS "backtest_capability_configs" (
  "id" TEXT NOT NULL,
  "allowed_symbols" JSONB NOT NULL,
  "allowed_base_timeframes" JSONB NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "backtest_capability_configs_pkey" PRIMARY KEY ("id")
)`,
      'CREATE INDEX IF NOT EXISTS "idx_backtest_capability_configs_active_updated" ON "backtest_capability_configs"("is_active", "updated_at")',
    ],
  },
  {
    kind: 'column',
    key: 'public.llm_strategy_codegen_sessions.strategy_instance_id',
    migrationName: '20260327034000_add_codegen_session_strategy_instance_id',
    applyStatements: [
      'ALTER TABLE "llm_strategy_codegen_sessions" ADD COLUMN IF NOT EXISTS "strategy_instance_id" TEXT',
    ],
  },
]

function hasRequiredStructure(input: SchemaAuditInput, item: RequiredStructure): boolean {
  return item.kind === 'table'
    ? input.existingTables.has(item.key)
    : input.existingColumns.has(item.key)
}

export function detectSchemaDrift(input: SchemaAuditInput): string[] {
  return REQUIRED_QUANTIFY_SCHEMA
    .filter(item => input.appliedMigrations.has(item.migrationName) && !hasRequiredStructure(input, item))
    .map(item => item.migrationName)
}

export function summarizeSchemaAudit(input: SchemaAuditInput): SchemaAuditSummary {
  const missingTables = REQUIRED_QUANTIFY_SCHEMA
    .filter(item => item.kind === 'table' && !hasRequiredStructure(input, item))
    .map(item => item.key)

  const missingColumns = REQUIRED_QUANTIFY_SCHEMA
    .filter(item => item.kind === 'column' && !hasRequiredStructure(input, item))
    .map(item => item.key)

  const driftedMigrations = detectSchemaDrift(input)
  const normalizedConfig = normalizeBacktestCapabilityConfig(input.activeCapabilityConfig)
  const missingActiveCapabilityConfig = input.activeCapabilityConfig == null
  const invalidActiveCapabilityConfig = input.activeCapabilityConfig != null && normalizedConfig == null

  return {
    isHealthy: missingTables.length === 0
      && missingColumns.length === 0
      && driftedMigrations.length === 0
      && !missingActiveCapabilityConfig
      && !invalidActiveCapabilityConfig,
    missingTables,
    missingColumns,
    driftedMigrations,
    missingActiveCapabilityConfig,
    invalidActiveCapabilityConfig,
  }
}

export function buildSchemaRepairStatements(input: SchemaAuditInput): string[] {
  const statements = REQUIRED_QUANTIFY_SCHEMA
    .filter(item => !hasRequiredStructure(input, item))
    .flatMap(item => item.applyStatements)

  if (input.activeCapabilityConfig == null || normalizeBacktestCapabilityConfig(input.activeCapabilityConfig) == null) {
    const configured = resolveConfiguredBacktestCapabilityConfig()
    const allowedSymbols = JSON.stringify(configured.allowedSymbols)
    const allowedBaseTimeframes = JSON.stringify(configured.allowedBaseTimeframes)

    statements.push(`
WITH latest_active AS (
  SELECT "id"
  FROM "backtest_capability_configs"
  WHERE "is_active" = true
  ORDER BY "updated_at" DESC, "created_at" DESC
  LIMIT 1
),
updated AS (
  UPDATE "backtest_capability_configs"
  SET
    "allowed_symbols" = '${allowedSymbols}'::jsonb,
    "allowed_base_timeframes" = '${allowedBaseTimeframes}'::jsonb,
    "updated_at" = CURRENT_TIMESTAMP
  WHERE "id" IN (SELECT "id" FROM latest_active)
  RETURNING 1
)
INSERT INTO "backtest_capability_configs" (
  "id",
  "allowed_symbols",
  "allowed_base_timeframes",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  substr(md5(random()::text || clock_timestamp()::text), 1, 24),
  '${allowedSymbols}'::jsonb,
  '${allowedBaseTimeframes}'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM updated)
    `.trim())
  }

  return statements
}

async function collectSchemaAuditInput(connectionString: string): Promise<SchemaAuditInput> {
  const client = new Client({ connectionString })
  await client.connect()

  try {
    const tablesResult = await client.query<{ key: string }>(`
      select table_schema || '.' || table_name as key
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('backtest_capability_configs', 'llm_strategy_codegen_sessions')
    `)

    const columnsResult = await client.query<{ key: string }>(`
      select table_schema || '.' || table_name || '.' || column_name as key
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'llm_strategy_codegen_sessions'
        and column_name = 'strategy_instance_id'
    `)

    const migrationsResult = await client.query<{ migration_name: string }>(`
      select migration_name
      from _prisma_migrations
      where migration_name in ('20260325103000_add_backtest_capability_configs', '20260327034000_add_codegen_session_strategy_instance_id')
    `)

    let activeCapabilityConfig: SchemaAuditInput['activeCapabilityConfig'] = null
    if (tablesResult.rows.some(row => row.key === 'public.backtest_capability_configs')) {
      const capabilityResult = await client.query<{
        allowed_symbols: unknown
        allowed_base_timeframes: unknown
      }>(`
        select allowed_symbols, allowed_base_timeframes
        from backtest_capability_configs
        where is_active = true
        order by updated_at desc, created_at desc
        limit 1
      `)
      const row = capabilityResult.rows[0]
      activeCapabilityConfig = row
        ? {
            allowedSymbols: row.allowed_symbols,
            allowedBaseTimeframes: row.allowed_base_timeframes,
          }
        : null
    }

    return {
      existingTables: new Set(tablesResult.rows.map(row => row.key)),
      existingColumns: new Set(columnsResult.rows.map(row => row.key)),
      appliedMigrations: new Set(migrationsResult.rows.map(row => row.migration_name)),
      activeCapabilityConfig,
    }
  } finally {
    await client.end()
  }
}

async function applyRepairStatements(connectionString: string, statements: string[]): Promise<void> {
  if (statements.length === 0) return
  const client = new Client({ connectionString })
  await client.connect()
  try {
    for (const statement of statements) {
      await client.query(statement)
    }
  } finally {
    await client.end()
  }
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const apply = args.has('--apply')
  const connectionString = process.env.DATABASE_URL?.trim()

  if (!connectionString) {
    console.error('[ERROR] DATABASE_URL is required')
    process.exit(1)
  }

  const before = await collectSchemaAuditInput(connectionString)
  const summary = summarizeSchemaAudit(before)
  const statements = buildSchemaRepairStatements(before)

  if (summary.isHealthy) {
    console.log(JSON.stringify({ ok: true, ...summary }, null, 2))
    return
  }

  if (!apply) {
    console.error(JSON.stringify({ ok: false, ...summary, repairStatements: statements }, null, 2))
    process.exit(1)
  }

  await applyRepairStatements(connectionString, statements)
  const after = await collectSchemaAuditInput(connectionString)
  const afterSummary = summarizeSchemaAudit(after)

  if (!afterSummary.isHealthy) {
    console.error(JSON.stringify({ ok: false, ...afterSummary }, null, 2))
    process.exit(1)
  }

  console.log(JSON.stringify({ ok: true, applied: statements.length, ...afterSummary }, null, 2))
}

if (require.main === module) {
  void main()
}
