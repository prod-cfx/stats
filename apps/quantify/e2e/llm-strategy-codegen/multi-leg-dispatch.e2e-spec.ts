/**
 * #1186 PR4c — multi-leg dispatch e2e fixture (real runtime decision pipeline).
 *
 * Verifies the full signal-generator fan-out path:
 *   compiled snapshot with 2 legScopes (fixed_quote 100 + 200 USDT)
 *   → SignalGeneratorService.generateSignals()
 *   → 2 tradingSignal records in DB with leg metadata.
 *
 * Setup mirrors the proven TC-SIGNAL-009 published-snapshot runtime continuity
 * fixture from `apps/quantify/e2e/strategy-signals/strategy-signals.e2e-spec.ts`.
 * Notably:
 *   - PrismaService is acquired via the class token (not the string token).
 *   - LlmStrategyCodegenSession parent rows are upserted before the snapshot
 *     (FK published_strategy_snapshots.session_id).
 *   - StrategyTemplate.status = 'live' so findRunningInstances accepts it.
 *   - StrategyInstance.runtimeBindingStatus = 'READY' + metadata.publishedSnapshotId
 *     so resolveRuntimeStrategySource enters the PUBLISHED_SNAPSHOT branch.
 *   - ConfigService.get('strategySignals') is mocked to return the e2e config.
 *
 * Requirements:
 *   - Real Postgres DB (E2E env)
 *   - No exchange API calls (signal-executor execution disabled)
 */
import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { StrategyAstV1 } from '@/modules/llm-strategy-codegen/types/canonical-strategy-ast'
import { setTimeout as sleep } from 'node:timers/promises'
import { ConfigService } from '@nestjs/config'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
import { CompiledScriptEmitterService } from '@/modules/llm-strategy-codegen/services/compiled-script-emitter.service'
import { SignalGeneratorService } from '@/modules/strategy-signals/services/signal-generator.service'
import { StrategyRuntimeExecutionStateService } from '@/modules/strategy-signals/services/strategy-runtime-execution-state.service'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '@/modules/strategy-signals/types/strategy-signals-config.type'
import { PrismaService } from '@/prisma/prisma.service'
import {
  createSemanticEmaStackCompiledSnapshotFixture,
  createSemanticEmaStackPublishedSnapshotFixture,
  createTestingApp,
} from '../fixtures/fixtures'

// E2E signal config: no executor — we only verify signal DB records
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
  symbolCode: 'MULTILEGE2EBTCUSDT:SPOT',
  snapshotId: 'multi-leg-e2e-snapshot',
  snapshotHash: 'multi-leg-e2e-snapshot-hash',
  sessionId: 'multi-leg-e2e-session',
  // The default fixture sessionId — referenced by createSemanticEmaStackPublishedSnapshotFixture
  // when no override is provided downstream.
  defaultFixtureSessionId: 'semantic-ema-stack-session',
} as const

describe('multi-leg dispatch (E2E, DB only, #1186 PR4c — real runtime pipeline)', () => {
  let app: INestApplication
  let moduleFixture: TestingModule
  let prisma: PrismaService

  beforeAll(async () => {
    const ctx = await createTestingApp()
    app = ctx.app
    moduleFixture = ctx.moduleFixture
    if (!ctx.prisma) {
      throw new Error('PrismaService unavailable for multi-leg-dispatch e2e')
    }
    prisma = ctx.prisma

    // Mock ConfigService so the signal-generator's internal getConfig() (used
    // for cooldown/batch decisions outside the explicit config arg) reads the
    // e2e config consistently with the value passed to generateSignals().
    const configService = app.get(ConfigService)
    const originalGet = configService.get.bind(configService)
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'strategySignals') {
        return MULTI_LEG_SIGNAL_CONFIG
      }
      return originalGet(key)
    })
  })

  afterAll(async () => {
    await app.close()
  })

  // ---------------------------------------------------------------------------
  // DB setup helpers
  // ---------------------------------------------------------------------------

  async function seedBaseFixtures() {
    await prisma.user.upsert({
      where: { id: TEST_IDS.userId },
      update: {},
      create: { id: TEST_IDS.userId, email: 'multi-leg-e2e@test.local', nickname: 'multi-leg-e2e' },
    })

    await prisma.symbol.upsert({
      where: { code: TEST_IDS.symbolCode },
      update: {},
      create: {
        id: TEST_IDS.symbolId,
        code: TEST_IDS.symbolCode,
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

    // status='live' — required by findRunningInstances filter
    await prisma.strategyTemplate.upsert({
      where: { id: TEST_IDS.templateId },
      update: { status: 'live' },
      create: {
        id: TEST_IDS.templateId,
        name: 'Multi-leg E2E Template',
        description: 'PR4c e2e multi-leg dispatch',
        legs: [],
        llmModel: 'gpt-4',
        promptTemplate: 'multi-leg test',
        paramsSchema: { type: 'object' },
        requiredFields: [],
        status: 'live',
      },
    })

    // 30 monotonically rising bars so EMA(7) > EMA(21) → entry decision triggered.
    // Mirrors TC-SIGNAL-009's seedRuntimeBar shape (same rising-close structure).
    const timeframeMs = 15 * 60 * 1000
    const referenceTime = new Date('2026-04-22T00:00:00.000Z')
    await prisma.marketBar.createMany({
      skipDuplicates: true,
      data: Array.from({ length: 30 }, (_, i) => {
        const close = 60000 - (29 - i) * 100
        return {
          symbolId: TEST_IDS.symbolId,
          timeframe: mapTimeframe('15m'),
          open: close - 50,
          high: close + 50,
          low: close - 100,
          close,
          volume: 10,
          quoteVolume: close * 10,
          trades: 5,
          source: 'E2E',
          isFinal: true,
          time: new Date(referenceTime.getTime() - (29 - i) * timeframeMs),
        }
      }),
    })

    // Codegen sessions — published_strategy_snapshots.session_id FK targets.
    // We seed both the explicit one for our snapshot AND the default one used
    // by createSemanticEmaStackPublishedSnapshotFixture when sessionId override
    // is not supplied (defensive; the fixture default would otherwise dangle).
    for (const sessionId of [TEST_IDS.sessionId, TEST_IDS.defaultFixtureSessionId]) {
      await prisma.llmStrategyCodegenSession.upsert({
        where: { id: sessionId },
        update: {},
        create: {
          id: sessionId,
          userId: TEST_IDS.userId,
          status: 'PUBLISHED',
        },
      })
    }
  }

  async function bindInstanceToSnapshot(instanceId: string, snapshotId: string, snapshotHash: string) {
    await prisma.strategyInstance.update({
      where: { id: instanceId },
      data: {
        mode: 'TESTNET',
        runtimeBindingStatus: 'READY',
        runtimeBindingErrorCode: null,
        runtimeBindingUpdatedAt: new Date('2026-04-22T00:00:00.000Z'),
        metadata: {
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: snapshotId,
          snapshotHash,
          sourceStrategyInstanceId: instanceId,
          sourceStrategyTemplateId: TEST_IDS.templateId,
        },
      },
    })
  }

  async function cleanupAllFixtures(extraInstanceIds: string[] = []) {
    const instanceIds = [TEST_IDS.instanceId, ...extraInstanceIds]
    await prisma.tradingSignal.deleteMany({ where: { strategyInstanceId: { in: instanceIds } } })
    await prisma.strategyRuntimeExecutionState.deleteMany({ where: { strategyInstanceId: { in: instanceIds } } })
    await prisma.publishedStrategySnapshot.deleteMany({ where: { strategyInstanceId: { in: instanceIds } } })
    await prisma.strategyInstance.deleteMany({ where: { id: { in: instanceIds } } })
    await prisma.marketBar.deleteMany({ where: { symbolId: TEST_IDS.symbolId } })
    await prisma.strategyTemplate.deleteMany({ where: { id: TEST_IDS.templateId } })
    await prisma.symbol.deleteMany({ where: { id: TEST_IDS.symbolId } })
    await prisma.llmStrategyCodegenSession.deleteMany({
      where: { id: { in: [TEST_IDS.sessionId, TEST_IDS.defaultFixtureSessionId] } },
    })
    await prisma.user.deleteMany({ where: { id: TEST_IDS.userId } })
  }

  /**
   * Build a published snapshot with two legScopes by patching the EMA-stack
   * AST and re-emitting the script + projection. The compiled adapter will
   * surface `orchestrationLegScopes` so the runtime caller fans out the single
   * onBar entry decision into 2 per-leg signals.
   */
  function buildMultiLegPublishedSnapshot(params: {
    snapshotId: string
    snapshotHash: string
    sessionId: string
    strategyInstanceId: string
  }) {
    const base = createSemanticEmaStackCompiledSnapshotFixture({
      id: params.snapshotId,
      sessionId: params.sessionId,
      strategyTemplateId: TEST_IDS.templateId,
      strategyInstanceId: params.strategyInstanceId,
      symbol: TEST_IDS.symbolCode,
      timeframe: '15m',
      marketType: 'spot',
    })

    const legScopes = [
      {
        id: 'leg-a-scope',
        scopeKind: 'leg' as const,
        legId: 'leg-a',
        direction: 'long' as const,
        instrumentRef: TEST_IDS.symbolCode,
        legSizing: { mode: 'fixed_quote' as const, value: 100 },
      },
      {
        id: 'leg-b-scope',
        scopeKind: 'leg' as const,
        legId: 'leg-b',
        direction: 'long' as const,
        instrumentRef: TEST_IDS.symbolCode,
        legSizing: { mode: 'fixed_quote' as const, value: 200 },
      },
    ]

    const patchedAst = {
      ...base.ast,
      orchestrationLegScopes: legScopes,
    } as StrategyAstV1 & { orchestrationLegScopes: typeof legScopes }

    const emitter = new CompiledScriptEmitterService()
    const patchedScript = emitter.emit({ ast: patchedAst, executionEnvelope: base.executionEnvelope })
    const patchedProjection = emitter.buildProjection({ ast: patchedAst, executionEnvelope: base.executionEnvelope })

    const baseSnapshot = createSemanticEmaStackPublishedSnapshotFixture({
      id: params.snapshotId,
      sessionId: params.sessionId,
      strategyTemplateId: TEST_IDS.templateId,
      strategyInstanceId: params.strategyInstanceId,
      symbol: TEST_IDS.symbolCode,
      timeframe: '15m',
      marketType: 'spot',
    })

    return {
      ...baseSnapshot,
      id: params.snapshotId,
      snapshotHash: params.snapshotHash,
      strategyInstanceId: params.strategyInstanceId,
      sessionId: params.sessionId,
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
      await cleanupAllFixtures()
      await seedBaseFixtures()

      await prisma.strategyInstance.create({
        data: {
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

      const snapshot = buildMultiLegPublishedSnapshot({
        snapshotId: TEST_IDS.snapshotId,
        snapshotHash: TEST_IDS.snapshotHash,
        sessionId: TEST_IDS.sessionId,
        strategyInstanceId: TEST_IDS.instanceId,
      })
      await prisma.publishedStrategySnapshot.create({ data: snapshot as any })

      await bindInstanceToSnapshot(TEST_IDS.instanceId, TEST_IDS.snapshotId, TEST_IDS.snapshotHash)

      const runtimeExecutionStateService = app.get(StrategyRuntimeExecutionStateService)
      await runtimeExecutionStateService.initializeStatesForDeploy({
        strategyInstanceId: TEST_IDS.instanceId,
        publishedSnapshotId: TEST_IDS.snapshotId,
        snapshotHash: snapshot.snapshotHash,
        snapshot: snapshot as any,
      })
    })

    afterAll(async () => {
      await cleanupAllFixtures()
    })

    it('generates exactly 2 signals with positionSizeQuote 100 and 200', async () => {
      const signalGenerator = app.get(SignalGeneratorService)
      await signalGenerator.generateSignals(MULTI_LEG_SIGNAL_CONFIG)

      let signals: any[] = []
      for (let attempt = 0; attempt < 40; attempt++) {
        signals = await prisma.tradingSignal.findMany({
          where: { strategyInstanceId: TEST_IDS.instanceId },
          orderBy: { createdAt: 'asc' },
        })
        if (signals.length >= 2) break
        await sleep(50)
      }

      expect(signals).toHaveLength(2)

      const legASignal = signals.find(s => {
        const meta = s.metadata as any
        return meta?.runtimeProvenance?.leg?.legId === 'leg-a'
      })
      expect(legASignal).toBeDefined()
      expect(Number(legASignal!.positionSizeQuote)).toBe(100)
      expect(legASignal!.direction).toBe('BUY')

      const legBSignal = signals.find(s => {
        const meta = s.metadata as any
        return meta?.runtimeProvenance?.leg?.legId === 'leg-b'
      })
      expect(legBSignal).toBeDefined()
      expect(Number(legBSignal!.positionSizeQuote)).toBe(200)
      expect(legBSignal!.direction).toBe('BUY')
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

  describe('[TC-ML-002] fail-fast saga compensate — second call under cooldown blocks new signals', () => {
    const SAGA_INSTANCE_ID = 'multi-leg-saga-e2e-instance'
    const SAGA_SNAPSHOT_ID = 'multi-leg-saga-e2e-snapshot'
    const SAGA_SNAPSHOT_HASH = 'multi-leg-saga-e2e-snapshot-hash'

    beforeAll(async () => {
      await cleanupAllFixtures([SAGA_INSTANCE_ID])
      await seedBaseFixtures()

      await prisma.strategyInstance.create({
        data: {
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

      const sagaSnapshot = buildMultiLegPublishedSnapshot({
        snapshotId: SAGA_SNAPSHOT_ID,
        snapshotHash: SAGA_SNAPSHOT_HASH,
        sessionId: TEST_IDS.sessionId,
        strategyInstanceId: SAGA_INSTANCE_ID,
      })
      await prisma.publishedStrategySnapshot.create({ data: sagaSnapshot as any })

      await bindInstanceToSnapshot(SAGA_INSTANCE_ID, SAGA_SNAPSHOT_ID, SAGA_SNAPSHOT_HASH)

      const runtimeExecutionStateService = app.get(StrategyRuntimeExecutionStateService)
      await runtimeExecutionStateService.initializeStatesForDeploy({
        strategyInstanceId: SAGA_INSTANCE_ID,
        publishedSnapshotId: SAGA_SNAPSHOT_ID,
        snapshotHash: sagaSnapshot.snapshotHash,
        snapshot: sagaSnapshot as any,
      })
    })

    afterAll(async () => {
      await cleanupAllFixtures([SAGA_INSTANCE_ID])
    })

    it('first call: generates 2 signals successfully', async () => {
      const signalGenerator = app.get(SignalGeneratorService)
      await signalGenerator.generateSignals(MULTI_LEG_SIGNAL_CONFIG)

      let signals: any[] = []
      for (let attempt = 0; attempt < 40; attempt++) {
        signals = await prisma.tradingSignal.findMany({ where: { strategyInstanceId: SAGA_INSTANCE_ID } })
        if (signals.length >= 2) break
        await sleep(50)
      }
      expect(signals.length).toBeGreaterThanOrEqual(2)
    })

    it('second call with cooldown active: no additional PENDING signals are created', async () => {
      // Reset runtime execution state so the generator considers a new cycle.
      await prisma.strategyRuntimeExecutionState.updateMany({
        where: { strategyInstanceId: SAGA_INSTANCE_ID },
        data: { status: 'pending' },
      })

      const signalsBefore = await prisma.tradingSignal.findMany({ where: { strategyInstanceId: SAGA_INSTANCE_ID } })
      const pendingBefore = signalsBefore.filter(s => s.status === 'PENDING').length

      const signalGenerator = app.get(SignalGeneratorService)
      await signalGenerator.generateSignals(MULTI_LEG_SIGNAL_CONFIG_WITH_COOLDOWN)
      await sleep(200)

      const signalsAfter = await prisma.tradingSignal.findMany({ where: { strategyInstanceId: SAGA_INSTANCE_ID } })
      const pendingAfter = signalsAfter.filter(s => s.status === 'PENDING').length
      expect(pendingAfter).toBe(pendingBefore)
    })
  })
})
