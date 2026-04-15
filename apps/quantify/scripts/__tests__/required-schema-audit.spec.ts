import {
  buildSchemaRepairStatements,
  detectSchemaDrift,
  REQUIRED_QUANTIFY_SCHEMA,
  summarizeSchemaAudit,
} from '../required-schema-audit'

describe('required-schema-audit', () => {
  it('summarizes missing required table and column', () => {
    const summary = summarizeSchemaAudit({
      existingTables: new Set<string>(),
      existingColumns: new Set<string>(),
      appliedMigrations: new Set<string>(),
      activeCapabilityConfig: null,
    })

    expect(summary.missingTables).toEqual(['public.backtest_capability_configs'])
    expect(summary.missingColumns).toEqual(['public.llm_strategy_codegen_sessions.strategy_instance_id'])
    expect(summary.missingActiveCapabilityConfig).toBe(true)
    expect(summary.invalidActiveCapabilityConfig).toBe(false)
    expect(summary.staleLegacyDefaultCapabilityConfig).toBe(false)
    expect(summary.isHealthy).toBe(false)
  })

  it('builds idempotent repair statements for every missing structure', () => {
    const statements = buildSchemaRepairStatements({
      existingTables: new Set<string>(),
      existingColumns: new Set<string>(),
      appliedMigrations: new Set<string>(),
      activeCapabilityConfig: null,
    })

    expect(statements.slice(0, 3)).toEqual([
      expect.stringContaining('CREATE TABLE IF NOT EXISTS "backtest_capability_configs"'),
      expect.stringContaining('CREATE INDEX IF NOT EXISTS "idx_backtest_capability_configs_active_updated"'),
      expect.stringContaining('ALTER TABLE "llm_strategy_codegen_sessions"'),
    ])
    expect(statements[3]).toContain('INSERT INTO "backtest_capability_configs"')
  })

  it('flags drift when migration is recorded but required structure is still missing', () => {
    const drift = detectSchemaDrift({
      existingTables: new Set<string>(),
      existingColumns: new Set<string>(),
      appliedMigrations: new Set<string>(REQUIRED_QUANTIFY_SCHEMA.map(item => item.migrationName)),
      activeCapabilityConfig: null,
    })

    expect(drift).toEqual([
      '20260325103000_add_backtest_capability_configs',
      '20260327034000_add_codegen_session_strategy_instance_id',
    ])
  })

  it('flags the legacy default capability tuple as stale so repair can upgrade it explicitly', () => {
    const summary = summarizeSchemaAudit({
      existingTables: new Set<string>(['public.backtest_capability_configs']),
      existingColumns: new Set<string>(['public.llm_strategy_codegen_sessions.strategy_instance_id']),
      appliedMigrations: new Set<string>(REQUIRED_QUANTIFY_SCHEMA.map(item => item.migrationName)),
      activeCapabilityConfig: {
        allowedSymbols: ['BTCUSDT'],
        allowedBaseTimeframes: ['15m', '1h'],
      },
    })

    expect(summary.isHealthy).toBe(false)
    expect(summary.missingTables).toEqual([])
    expect(summary.missingColumns).toEqual([])
    expect(summary.driftedMigrations).toEqual([])
    expect(summary.missingActiveCapabilityConfig).toBe(false)
    expect(summary.invalidActiveCapabilityConfig).toBe(false)
    expect(summary.staleLegacyDefaultCapabilityConfig).toBe(true)
  })

  it('stays healthy when all required structures exist with a non-legacy capability config', () => {
    const summary = summarizeSchemaAudit({
      existingTables: new Set<string>(['public.backtest_capability_configs']),
      existingColumns: new Set<string>(['public.llm_strategy_codegen_sessions.strategy_instance_id']),
      appliedMigrations: new Set<string>(REQUIRED_QUANTIFY_SCHEMA.map(item => item.migrationName)),
      activeCapabilityConfig: {
        allowedSymbols: ['BTCUSDT'],
        allowedBaseTimeframes: ['3m', '15m'],
      },
    })

    expect(summary.isHealthy).toBe(true)
    expect(summary.staleLegacyDefaultCapabilityConfig).toBe(false)
  })

  it('flags active capability config as invalid when arrays are empty or dirty', () => {
    const summary = summarizeSchemaAudit({
      existingTables: new Set<string>(['public.backtest_capability_configs']),
      existingColumns: new Set<string>(['public.llm_strategy_codegen_sessions.strategy_instance_id']),
      appliedMigrations: new Set<string>(REQUIRED_QUANTIFY_SCHEMA.map(item => item.migrationName)),
      activeCapabilityConfig: {
        allowedSymbols: ['BTCUSDT', ''],
        allowedBaseTimeframes: [],
      },
    })

    expect(summary.isHealthy).toBe(false)
    expect(summary.missingActiveCapabilityConfig).toBe(false)
    expect(summary.invalidActiveCapabilityConfig).toBe(true)
    expect(summary.staleLegacyDefaultCapabilityConfig).toBe(false)
  })

  it('builds repair statements when active capability config is the legacy default tuple', () => {
    const statements = buildSchemaRepairStatements({
      existingTables: new Set<string>(['public.backtest_capability_configs']),
      existingColumns: new Set<string>(['public.llm_strategy_codegen_sessions.strategy_instance_id']),
      appliedMigrations: new Set<string>(REQUIRED_QUANTIFY_SCHEMA.map(item => item.migrationName)),
      activeCapabilityConfig: {
        allowedSymbols: ['BTCUSDT'],
        allowedBaseTimeframes: ['15m', '1h'],
      },
    })

    expect(statements).toHaveLength(1)
    expect(statements[0]).toContain('UPDATE "backtest_capability_configs"')
    expect(statements[0]).toContain('"allowed_base_timeframes"')
  })
})
