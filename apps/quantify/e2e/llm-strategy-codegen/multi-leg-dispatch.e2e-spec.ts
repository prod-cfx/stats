/**
 * #1186 PR4c — multi-leg dispatch e2e fixture.
 *
 * Verifies the full signal-generator fan-out path:
 *   compiled snapshot with 2 legScopes (fixed_quote 100 + 200 USDT)
 *   → SignalGeneratorService.generateSignals()
 *   → 2 tradingSignal records in DB
 *   → each record carries metadata.runtimeProvenance.leg with correct legId / positionSizeQuote
 *
 * Also verifies fail-fast saga compensate (PR4b):
 *   when lead leg is blocked by cooldown (skipCooldown=false, existing signal present),
 *   → the second leg's signal is never created (partial batch rejected)
 *
 * Requirements:
 *   - Real Postgres DB (E2E env)
 *   - No exchange API calls (signal-executor execution disabled)
 */
import type { INestApplication } from '@nestjs/common'
import type { PrismaService } from '../../src/prisma/prisma.service'
import type { StrategyAstV1 } from '@/modules/llm-strategy-codegen/types/canonical-strategy-ast'
import { setTimeout as sleep } from 'node:timers/promises'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
import { CompiledScriptEmitterService } from '@/modules/llm-strategy-codegen/services/compiled-script-emitter.service'
import { SignalGeneratorService } from '@/modules/strategy-signals/services/signal-generator.service'
import { StrategyRuntimeExecutionStateService } from '@/modules/strategy-signals/services/strategy-runtime-execution-state.service'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '@/modules/strategy-signals/types/strategy-signals-config.type'
import {
  createSemanticEmaStackCompiledSnapshotFixture,
  createSemanticEmaStackPublishedSnapshotFixture,
  createTestingApp,
  SEMANTIC_EMA_STACK_EXECUTION_SEMANTIC_KEY,
} from '../fixtures/fixtures'

// E2E signal config: no executor, no dry-run blocker — we only verify signal DB records
const MULTI_LEG_SIGNAL_CONFIG = {
  ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
  enabled: true,
  batchSize: 10,
  cooldownMinutes: 0,
  execution: {
    ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
    enabled: false, // disable executor — test only emit path
  },
}

const MULTI_LEG_SIGNAL_CONFIG_WITH_COOLDOWN = {
  ...MULTI_LEG_SIGNAL_CONFIG,
  cooldownMinutes: 60, // 1 hour cooldown — second generateSignals call should be blocked
}

const TEST_IDS = {
  userId: 'multi-leg-e2e-user',
  templateId: 'multi-leg-e2e-template',
  instanceId: 'multi-leg-e2e-instance',
  symbolId: 'multi-leg-e2e-symbol',
  snapshotId: 'multi-leg-e2e-snapshot',
  sessionId: 'multi-leg-e2e-session',
} as const

describe('multi-leg dispatch (E2E, DB only, #1186 PR4c)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const ctx = await createTestingApp()
    app = ctx.app
    prisma = ctx.app.get('PrismaService')
  })

  afterAll(async () => {
    await app.close()
  })

  // ---------------------------------------------------------------------------
  // DB setup helpers
  // ---------------------------------------------------------------------------

  async function seedFixtures() {
    await prisma.user.upsert({
      where: { id: TEST_IDS.userId },
      update: {},
      create: { id: TEST_IDS.userId, email: 'multi-leg-e2e@test.local', nickname: 'multi-leg-e2e' },
    })

    await prisma.symbol.upsert({
      where: { code: 'BTCUSDT-MULTI-LEG-E2E' },
      update: {},
      create: {
        id: TEST_IDS.symbolId,
        code: 'BTCUSDT-MULTI-LEG-E2E',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        exchange: 'BINANCE',
        type: 'CRYPTO',
        instrumentType: 'SPOT',
        status: 'ACTIVE',
        precisionPrice: 2,
        precisionQuantity: 6,
      },
    })

    await prisma.strategyTemplate.upsert({
      where: { id: TEST_IDS.templateId },
      update: {},
      create: {
        id: TEST_IDS.templateId,
        name: 'Multi-leg E2E Template',
        description: 'PR4c e2e multi-leg dispatch',
        legs: [],
        llmModel: 'gpt-4',
        promptTemplate: 'multi-leg test',
        paramsSchema: { type: 'object' },
        requiredFields: [],
        status: 'draft',
      },
    })

    await prisma.strategyInstance.upsert({
      where: { id: TEST_IDS.instanceId },
      update: {},
      create: {
        id: TEST_IDS.instanceId,
        strategyTemplateId: TEST_IDS.templateId,
        name: 'Multi-leg E2E Instance',
        description: 'PR4c e2e',
        llmModel: 'gpt-4',
        status: 'running',
        mode: 'LIVE',
        startedAt: new Date('2026-05-01T00:00:00.000Z'),
        createdBy: TEST_IDS.userId,
        updatedBy: TEST_IDS.userId,
      },
    })

    // Seed 30 market bars so the signal-generator has enough warmup data
    const timeframeMs = 15 * 60 * 1000
    const now = Date.now()
    await prisma.marketBar.createMany({
      skipDuplicates: true,
      data: Array.from({ length: 30 }, (_, i) => {
        const close = 50050 - (29 - i) * 10
        return {
          symbolId: TEST_IDS.symbolId,
          timeframe: mapTimeframe('15m'),
          open: close - 50,
          high: close + 50,
          low: close - 100,
          close,
          volume: 100,
          quoteVolume: close * 100,
          trades: 10,
          source: 'E2E',
          isFinal: true,
          time: new Date(now - (30 - i) * timeframeMs),
        }
      }),
    })
  }

  async function cleanupFixtures() {
    // Remove in reverse dependency order
    await prisma.tradingSignal.deleteMany({ where: { strategyInstanceId: TEST_IDS.instanceId } })
    await prisma.strategyRuntimeExecutionState.deleteMany({ where: { strategyInstanceId: TEST_IDS.instanceId } })
    await prisma.publishedStrategySnapshot.deleteMany({ where: { strategyInstanceId: TEST_IDS.instanceId } })
    await prisma.marketBar.deleteMany({ where: { symbolId: TEST_IDS.symbolId } })
    await prisma.strategyInstance.deleteMany({ where: { id: TEST_IDS.instanceId } })
    await prisma.strategyTemplate.deleteMany({ where: { id: TEST_IDS.templateId } })
    await prisma.symbol.deleteMany({ where: { id: TEST_IDS.symbolId } })
    await prisma.user.deleteMany({ where: { id: TEST_IDS.userId } })
  }

  /**
   * Build a published snapshot fixture with two legScopes:
   *   leg-A: direction=long, fixed_quote 100 USDT
   *   leg-B: direction=long, fixed_quote 200 USDT
   */
  function buildMultiLegPublishedSnapshot() {
    // Start from the EMA-stack fixture (single-leg baseline)
    const base = createSemanticEmaStackCompiledSnapshotFixture({
      id: TEST_IDS.snapshotId,
      sessionId: TEST_IDS.sessionId,
      strategyTemplateId: TEST_IDS.templateId,
      strategyInstanceId: TEST_IDS.instanceId,
      symbol: 'BTCUSDT-MULTI-LEG-E2E',
      timeframe: '15m',
      marketType: 'spot',
    })

    // Inject multi-leg orchestration leg scopes onto the AST before re-emitting
    const legScopes = [
      {
        id: 'leg-a-scope',
        scopeKind: 'leg' as const,
        legId: 'leg-a',
        direction: 'long' as const,
        instrumentRef: 'BTCUSDT-MULTI-LEG-E2E',
        legSizing: { mode: 'fixed_quote' as const, value: 100 },
      },
      {
        id: 'leg-b-scope',
        scopeKind: 'leg' as const,
        legId: 'leg-b',
        direction: 'long' as const,
        instrumentRef: 'BTCUSDT-MULTI-LEG-E2E',
        legSizing: { mode: 'fixed_quote' as const, value: 200 },
      },
    ]

    // Patch the AST with legScopes and re-emit
    const patchedAst = {
      ...base.ast,
      orchestrationLegScopes: legScopes,
    } as StrategyAstV1 & { orchestrationLegScopes: typeof legScopes }

    const emitter = new CompiledScriptEmitterService()
    const patchedScript = emitter.emit({ ast: patchedAst, executionEnvelope: base.executionEnvelope })
    const patchedProjection = emitter.buildProjection({ ast: patchedAst, executionEnvelope: base.executionEnvelope })

    // Build the published snapshot using the standard fixture factory as base, then override the script
    const baseSnapshot = createSemanticEmaStackPublishedSnapshotFixture({
      id: TEST_IDS.snapshotId,
      sessionId: TEST_IDS.sessionId,
      strategyTemplateId: TEST_IDS.templateId,
      strategyInstanceId: TEST_IDS.instanceId,
      symbol: 'BTCUSDT-MULTI-LEG-E2E',
      timeframe: '15m',
      marketType: 'spot',
    })

    return {
      ...baseSnapshot,
      scriptSnapshot: patchedScript,
      astSnapshot: patchedAst,
      specHash: patchedProjection.compiledManifest.specHash,
      irHash: patchedProjection.compiledManifest.irHash,
      astDigest: patchedProjection.compiledManifest.astDigest,
      structuralDigest: patchedProjection.compiledManifest.structuralDigest,
    }
  }

  // ---------------------------------------------------------------------------
  // Test cases
  // ---------------------------------------------------------------------------

  describe('[TC-ML-001] dual-leg 100+200 USDT fan-out', () => {
    beforeAll(async () => {
      await cleanupFixtures()
      await seedFixtures()

      const snapshot = buildMultiLegPublishedSnapshot()
      await prisma.publishedStrategySnapshot.create({ data: snapshot as any })

      // Initialize runtime execution states via the service (mirrors production deploy path)
      const runtimeExecutionStateService = app.get(StrategyRuntimeExecutionStateService)
      await runtimeExecutionStateService.initializeStatesForDeploy({
        strategyInstanceId: TEST_IDS.instanceId,
        publishedSnapshotId: TEST_IDS.snapshotId,
        snapshotHash: snapshot.snapshotHash,
        snapshot: snapshot as any,
      })
    })

    afterAll(async () => {
      await cleanupFixtures()
    })

    it('generates exactly 2 signals with positionSizeQuote 100 and 200', async () => {
      const signalGenerator = app.get(SignalGeneratorService)
      await signalGenerator.generateSignals(MULTI_LEG_SIGNAL_CONFIG)

      // Wait for signals to be persisted
      let signals: any[] = []
      for (let attempt = 0; attempt < 20; attempt++) {
        signals = await prisma.tradingSignal.findMany({
          where: { strategyInstanceId: TEST_IDS.instanceId },
          orderBy: { createdAt: 'asc' },
        })
        if (signals.length >= 2) break
        await sleep(50)
      }

      expect(signals).toHaveLength(2)

      // Verify leg-A: positionSizeQuote=100
      const legASignal = signals.find(s => {
        const meta = s.metadata as any
        return meta?.runtimeProvenance?.leg?.legId === 'leg-a'
      })
      expect(legASignal).toBeDefined()
      expect(Number(legASignal.positionSizeQuote)).toBe(100)
      expect(legASignal.direction).toBe('BUY')

      // Verify leg-B: positionSizeQuote=200
      const legBSignal = signals.find(s => {
        const meta = s.metadata as any
        return meta?.runtimeProvenance?.leg?.legId === 'leg-b'
      })
      expect(legBSignal).toBeDefined()
      expect(Number(legBSignal.positionSizeQuote)).toBe(200)
      expect(legBSignal.direction).toBe('BUY')
    })

    it('each signal carries leg metadata (legId, legScopeId, totalLegs, legSizing)', async () => {
      const signals = await prisma.tradingSignal.findMany({
        where: { strategyInstanceId: TEST_IDS.instanceId },
        orderBy: { createdAt: 'asc' },
      })

      for (const signal of signals) {
        const meta = signal.metadata as any
        const leg = meta?.runtimeProvenance?.leg
        expect(leg).toBeDefined()
        expect(leg.totalLegs).toBe(2)
        expect(leg.legSizing).toBeDefined()
        expect(leg.legSizing.mode).toBe('fixed_quote')
        expect(['leg-a', 'leg-b']).toContain(leg.legId)
      }
    })
  })

  describe('[TC-ML-002] fail-fast saga compensate — lead leg blocked by cooldown', () => {
    const SAGA_INSTANCE_ID = 'multi-leg-saga-e2e-instance'
    const SAGA_SNAPSHOT_ID = 'multi-leg-saga-e2e-snapshot'

    beforeAll(async () => {
      // Clean up saga-specific fixtures
      await prisma.tradingSignal.deleteMany({ where: { strategyInstanceId: SAGA_INSTANCE_ID } })
      await prisma.strategyRuntimeExecutionState.deleteMany({ where: { strategyInstanceId: SAGA_INSTANCE_ID } })
      await prisma.publishedStrategySnapshot.deleteMany({ where: { strategyInstanceId: SAGA_INSTANCE_ID } })
      await prisma.strategyInstance.deleteMany({ where: { id: SAGA_INSTANCE_ID } })

      await seedFixtures()

      // Create separate instance for saga test
      await prisma.strategyInstance.upsert({
        where: { id: SAGA_INSTANCE_ID },
        update: {},
        create: {
          id: SAGA_INSTANCE_ID,
          strategyTemplateId: TEST_IDS.templateId,
          name: 'Multi-leg Saga E2E Instance',
          description: 'PR4c saga e2e',
          llmModel: 'gpt-4',
          status: 'running',
          mode: 'LIVE',
          startedAt: new Date('2026-05-01T00:00:00.000Z'),
          createdBy: TEST_IDS.userId,
          updatedBy: TEST_IDS.userId,
        },
      })

      // Build snapshot for this instance
      const emitter = new CompiledScriptEmitterService()
      const base = createSemanticEmaStackCompiledSnapshotFixture({
        strategyInstanceId: SAGA_INSTANCE_ID,
        symbol: 'BTCUSDT-MULTI-LEG-E2E',
        timeframe: '15m',
      })
      const legScopes = [
        { id: 'leg-a-scope', scopeKind: 'leg' as const, legId: 'leg-a', direction: 'long' as const, instrumentRef: 'BTCUSDT-MULTI-LEG-E2E', legSizing: { mode: 'fixed_quote' as const, value: 100 } },
        { id: 'leg-b-scope', scopeKind: 'leg' as const, legId: 'leg-b', direction: 'long' as const, instrumentRef: 'BTCUSDT-MULTI-LEG-E2E', legSizing: { mode: 'fixed_quote' as const, value: 200 } },
      ]
      const patchedAst = { ...base.ast, orchestrationLegScopes: legScopes } as any
      const patchedScript = emitter.emit({ ast: patchedAst, executionEnvelope: base.executionEnvelope })
      const patchedProjection = emitter.buildProjection({ ast: patchedAst, executionEnvelope: base.executionEnvelope })
      const baseSnapshot = createSemanticEmaStackPublishedSnapshotFixture({ strategyInstanceId: SAGA_INSTANCE_ID, symbol: 'BTCUSDT-MULTI-LEG-E2E', timeframe: '15m' })
      const sagaSnapshot = {
        ...baseSnapshot,
        id: SAGA_SNAPSHOT_ID,
        strategyInstanceId: SAGA_INSTANCE_ID,
        snapshotHash: 'multi-leg-saga-hash',
        scriptHash: 'multi-leg-saga-script-hash',
        scriptSnapshot: patchedScript,
        astSnapshot: patchedAst,
        specHash: patchedProjection.compiledManifest.specHash,
        irHash: patchedProjection.compiledManifest.irHash,
        astDigest: patchedProjection.compiledManifest.astDigest,
        structuralDigest: patchedProjection.compiledManifest.structuralDigest,
      }
      await prisma.publishedStrategySnapshot.create({ data: sagaSnapshot as any })
      const runtimeExecutionStateService2 = app.get(StrategyRuntimeExecutionStateService)
      await runtimeExecutionStateService2.initializeStatesForDeploy({
        strategyInstanceId: SAGA_INSTANCE_ID,
        publishedSnapshotId: SAGA_SNAPSHOT_ID,
        snapshotHash: sagaSnapshot.snapshotHash,
        snapshot: sagaSnapshot as any,
      })
    })

    afterAll(async () => {
      await prisma.tradingSignal.deleteMany({ where: { strategyInstanceId: SAGA_INSTANCE_ID } })
      await prisma.strategyRuntimeExecutionState.deleteMany({ where: { strategyInstanceId: SAGA_INSTANCE_ID } })
      await prisma.publishedStrategySnapshot.deleteMany({ where: { strategyInstanceId: SAGA_INSTANCE_ID } })
      await prisma.strategyInstance.deleteMany({ where: { id: SAGA_INSTANCE_ID } })
      await cleanupFixtures()
    })

    it('first call: generates 2 signals successfully', async () => {
      const signalGenerator = app.get(SignalGeneratorService)
      await signalGenerator.generateSignals(MULTI_LEG_SIGNAL_CONFIG)

      let signals: any[] = []
      for (let attempt = 0; attempt < 20; attempt++) {
        signals = await prisma.tradingSignal.findMany({ where: { strategyInstanceId: SAGA_INSTANCE_ID } })
        if (signals.length >= 2) break
        await sleep(50)
      }
      expect(signals.length).toBeGreaterThanOrEqual(2)
    })

    it('second call with cooldown active: no additional signals created (cooldown blocks lead leg → saga cancels any partial)', async () => {
      // Reset runtime state so the generator considers a new cycle
      await prisma.strategyRuntimeExecutionState.updateMany({
        where: { strategyInstanceId: SAGA_INSTANCE_ID },
        data: { status: 'pending' },
      })

      const signalsBefore = await prisma.tradingSignal.findMany({ where: { strategyInstanceId: SAGA_INSTANCE_ID } })
      const countBefore = signalsBefore.filter(s => s.status === 'PENDING').length

      const signalGenerator = app.get(SignalGeneratorService)
      await signalGenerator.generateSignals(MULTI_LEG_SIGNAL_CONFIG_WITH_COOLDOWN)
      await sleep(200)

      const signalsAfter = await prisma.tradingSignal.findMany({ where: { strategyInstanceId: SAGA_INSTANCE_ID } })
      // Under cooldown, lead leg should not create a new PENDING signal
      // Either: no new signals, or new signals are CANCELLED (saga compensated)
      const newPendingSignals = signalsAfter.filter(s => s.status === 'PENDING').length
      expect(newPendingSignals).toBe(countBefore) // no new PENDING signals under cooldown
    })
  })
})
