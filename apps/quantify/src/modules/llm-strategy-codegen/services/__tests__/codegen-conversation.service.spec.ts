import type { ContinueCodegenSessionDto } from '../../dto/continue-codegen-session.dto'
import type { StartCodegenSessionDto } from '../../dto/start-codegen-session.dto'
import type { CodegenSessionsRepository } from '../../repositories/codegen-sessions.repository'
import type { PublishedStrategySnapshotsRepository } from '../../repositories/published-strategy-snapshots.repository'
import type { RecommendationIndexService } from '../recommendation-index.service'
import type { AiService } from '@/modules/ai/ai.service'
import { restoreProcessEnv, setProcessEnvValue, snapshotProcessEnv } from '@/common/env/env.accessor'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2DigestService } from '../canonical-spec-v2-digest.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CodegenConversationService } from '../codegen-conversation.service'
import { CodegenSessionPublicationPipelineService } from '../codegen-session-publication-pipeline.service'
import { CompiledPublicationGateService } from '../compiled-publication-gate.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'
import { RuntimeGuardrailService } from '../runtime-guardrail.service'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { SpecDescBuilderService } from '../spec-desc-builder.service'
import { StaticGuardrailService } from '../static-guardrail.service'
import { StrategyClarificationQuestionService } from '../strategy-clarification-question.service'
import { StrategyClarificationRulesService } from '../strategy-clarification-rules.service'
import { StrategyCompileabilityDecisionService } from '../strategy-compileability-decision.service'
import { StrategyConsistencyService } from '../strategy-consistency.service'
import { StrategySummaryBuilderService } from '../strategy-summary-builder.service'
import { StrategySummaryObservationService } from '../strategy-summary-observation.service'
import { buildSemanticSlotId } from '../../types/semantic-state'
import { bollingerGoldenCase, maGoldenCase } from './fixtures/semantic-state-golden-cases'

jest.mock('../../repositories/published-strategy-snapshots.repository', () => ({
  PublishedStrategySnapshotsRepository: class PublishedStrategySnapshotsRepository {},
}))

describe('codegenConversationService (llm orchestrated flow)', () => {
  jest.setTimeout(120_000)

  const envSnapshot = snapshotProcessEnv([
    'LLM_CODEGEN_STRICT_ENABLED',
    'LLM_CODEGEN_STRICT_FALLBACK',
    'LLM_CODEGEN_STRICT_UNSUPPORTED_TTL_MS',
  ])

  const mockRepo = {
    createSession: jest.fn(),
    findById: jest.fn(),
    listByUser: jest.fn(),
    updateSession: jest.fn(),
    tryMarkGenerating: jest.fn(),
    tryRequeueFromProcessing: jest.fn(),
    findSessionStrategyInstanceId: jest.fn(),
    bindStrategyInstanceIfEmpty: jest.fn(),
    createVersion: jest.fn(),
    create: jest.fn(),
    findLatestBySessionId: jest.fn(),
    createDraftStrategyInstanceFromPublishedSession: jest.fn().mockResolvedValue({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    }),
    ensureDraftStrategyInstanceBoundForPublishedSession: jest.fn().mockResolvedValue({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    }),
  }
  const mockAi = {
    chat: jest.fn(),
  }
  const mockRecommendation = {
    onSpecDescPersisted: jest.fn(),
  }
  const mockConversationsRepo = {
    listByUser: jest.fn(),
    listKnownSessionIdsByUser: jest.fn(),
    findByCodegenSessionId: jest.fn(),
    upsertConversationSnapshot: jest.fn(),
    archiveByIdAndUser: jest.fn(),
  }
  const canonicalSpecBuilder = new CanonicalSpecBuilderService()
  const canonicalDigestService = new CanonicalSpecV2DigestService()
  const specDescBuilder = new SpecDescBuilderService(canonicalSpecBuilder)
  const publicationPipeline = new CodegenSessionPublicationPipelineService(
    mockRepo as unknown as CodegenSessionsRepository,
    mockRecommendation as unknown as RecommendationIndexService,
    canonicalSpecBuilder,
    specDescBuilder,
    new StrategyConsistencyService(new ScriptProfileExtractorService()),
    new StrategySummaryBuilderService(new ScriptProfileExtractorService()),
    new CanonicalSpecV2IrCompilerService(),
    new CanonicalStrategyAstCompilerService(),
    new CompiledScriptEmitterService(),
    new CompiledScriptExecutionEnvelopeService(),
    new CompiledScriptParserService(),
    new StrategySummaryObservationService(),
    new CompiledPublicationGateService(mockRepo as unknown as PublishedStrategySnapshotsRepository),
  )
  const buildConfirmedCanonicalDigest = (
    checklist: Record<string, unknown> = {},
    semanticState?: Record<string, unknown>,
  ): string => {
    const clarification = (service as any).resolveClarificationArtifacts(checklist)
    const normalization = semanticState
      ? (service as any).buildNormalizationFromSemanticState(semanticState)
      : clarification.normalization
    const canonicalSpec = (service as any).buildCanonicalSpecForConversation(checklist, normalization, semanticState)
    return canonicalDigestService.hash(canonicalSpec)
  }
  const readPersistedChecklist = (
    session: { checklist?: Record<string, unknown>; semanticState?: Record<string, unknown> },
  ): Record<string, unknown> => {
    if (session.checklist) {
      return session.checklist
    }
    if (session.semanticState) {
      return (service as any).projectLegacyChecklistFromSemanticState(session.semanticState, {})
    }
    return {}
  }

  const completeRiskRules = (riskRules: Record<string, any> = {}) => ({
    exchange: 'okx',
    marketType: 'perp',
    positionPct: 10,
    stopLossPct: 5,
    stopLossBasis: 'entry_avg_price',
    takeProfitPct: 10,
    takeProfitBasis: 'entry_avg_price',
    ...riskRules,
  })
  const completeChecklist = (checklist: Record<string, any> = {}) => ({
    ...checklist,
    symbols: checklist.symbols ?? ['BTCUSDT'],
    timeframes: checklist.timeframes ?? ['1h'],
    riskRules: completeRiskRules(checklist.riskRules ?? {}),
  })
  const buildLockedMaSemanticState = (overrides: Record<string, any> = {}) => ({
    version: 1,
    families: ['single-leg'],
    triggers: [
      {
        id: 'entry-ma',
        key: 'indicator.above',
        phase: 'entry',
        params: {
          indicator: 'ma',
          referenceRole: 'long_term',
          'reference.period': 50,
          confirmationMode: 'close_confirm',
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      {
        id: 'exit-ma',
        key: 'indicator.below',
        phase: 'exit',
        params: {
          indicator: 'ma',
          referenceRole: 'short_term',
          'reference.period': 20,
          confirmationMode: 'close_confirm',
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    ],
    actions: [
      { id: 'action-1', key: 'open_long', status: 'locked', source: 'user_explicit' },
      { id: 'action-2', key: 'close_long', status: 'locked', source: 'user_explicit' },
    ],
    risk: [],
    position: {
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
    },
    contextSlots: {
      exchange: {
        slotKey: 'exchange',
        fieldPath: 'contextSlots.exchange',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认交易所（binance / okx / hyperliquid）。',
        affectsExecution: true,
        value: 'okx',
      },
      symbol: {
        slotKey: 'symbol',
        fieldPath: 'contextSlots.symbol',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认策略交易标的（例如 BTCUSDT）。',
        affectsExecution: true,
        value: 'BTCUSDT',
      },
      marketType: {
        slotKey: 'marketType',
        fieldPath: 'contextSlots.marketType',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认市场类型（现货或合约/perp）。',
        affectsExecution: true,
        value: 'perp',
      },
      timeframe: {
        slotKey: 'timeframe',
        fieldPath: 'contextSlots.timeframe',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认策略主周期（例如 15m 或 1h）。',
        affectsExecution: true,
        value: '1h',
      },
    },
    normalizationNotes: [],
    updatedAt: '2026-04-15T10:00:00.000Z',
    ...overrides,
  })
  const buildLockedBollingerSemanticState = (overrides: Record<string, any> = {}) => ({
    version: 1,
    families: ['single-leg'],
    triggers: [
      {
        id: 'entry-bollinger-upper',
        key: 'bollinger.touch_upper',
        phase: 'entry',
        params: {
          indicator: 'bollinger',
          period: 20,
          stdDev: 2,
          confirmationMode: 'close_confirm',
        },
        sideScope: 'short',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      {
        id: 'exit-bollinger-middle',
        key: 'bollinger.touch_middle',
        phase: 'exit',
        params: {
          indicator: 'bollinger',
          period: 20,
          stdDev: 2,
          confirmationMode: 'close_confirm',
        },
        sideScope: 'short',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    ],
    actions: [
      { id: 'action-open-short', key: 'open_short', status: 'locked', source: 'user_explicit' },
      { id: 'action-close-short', key: 'close_short', status: 'locked', source: 'user_explicit' },
    ],
    risk: [],
    position: {
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'short_only',
      status: 'locked',
      source: 'user_explicit',
    },
    contextSlots: {
      exchange: {
        slotKey: 'exchange',
        fieldPath: 'contextSlots.exchange',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认交易所（binance / okx / hyperliquid）。',
        affectsExecution: true,
        value: 'okx',
      },
      symbol: {
        slotKey: 'symbol',
        fieldPath: 'contextSlots.symbol',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认策略交易标的（例如 BTCUSDT）。',
        affectsExecution: true,
        value: 'BTCUSDT',
      },
      marketType: {
        slotKey: 'marketType',
        fieldPath: 'contextSlots.marketType',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认市场类型（现货或合约/perp）。',
        affectsExecution: true,
        value: 'perp',
      },
      timeframe: {
        slotKey: 'timeframe',
        fieldPath: 'contextSlots.timeframe',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认策略主周期（例如 15m 或 1h）。',
        affectsExecution: true,
        value: '15m',
      },
    },
    normalizationNotes: [],
    updatedAt: '2026-04-15T10:00:00.000Z',
    ...overrides,
  })
  const buildPersistedSessionSnapshot = (
    sessionId: string,
    createdSession: Record<string, unknown>,
    overrides: Record<string, unknown> = {},
  ) => ({
    id: sessionId,
    userId: 'u1',
    status: 'DRAFTING',
    checklist: {},
    semanticState: null,
    clarificationState: null,
    constraintPack: {},
    latestDraftCode: null,
    latestSpecDesc: null,
    consistencyReport: null,
    rejectReason: null,
    strategyInstanceId: null,
    createdAt: new Date('2026-04-16T09:00:00.000Z'),
    updatedAt: new Date('2026-04-16T09:00:00.000Z'),
    ...createdSession,
    ...overrides,
  })
  const withRequiredMarketContext = completeChecklist
  const startGoldenCase = async (args: {
    sessionId: string
    message: string
    plannerLogic: Record<string, unknown>
  }) => {
    mockRepo.createSession.mockResolvedValue({ id: args.sessionId })
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        logic: args.plannerLogic,
      }),
    })

    return service.startSession({
      userId: 'u1',
      initialMessage: args.message,
    })
  }
  let service: CodegenConversationService
  const buildSemanticEraSessionFixture = (overrides: Record<string, any>) => {
    const fixture = buildPersistedSessionSnapshot(
      overrides.id ?? 'semantic-era-session',
      {},
      overrides,
    ) as Record<string, any>
    const rawChecklist = fixture.checklist && typeof fixture.checklist === 'object' && !Array.isArray(fixture.checklist)
      ? fixture.checklist as Record<string, any>
      : {}
    const normalizedChecklist = fixture.checklist && typeof fixture.checklist === 'object' && !Array.isArray(fixture.checklist)
      ? (service as any).normalizeChecklist(fixture.checklist)
      : {}
    const semanticState = (service as any).hasPersistedSemanticState(fixture.semanticState)
      ? fixture.semanticState
      : (Object.keys(normalizedChecklist).length > 0
          ? (service as any).buildFallbackSemanticState(normalizedChecklist)
          : null)
    const baselineChecklist = semanticState
      ? (service as any).projectLegacyChecklistFromSemanticState(semanticState, normalizedChecklist)
      : normalizedChecklist
    const normalization = semanticState
      ? (service as any).buildNormalizationFromSemanticState(semanticState)
      : (service as any).resolveClarificationArtifacts(baselineChecklist).normalization
    const canonicalSpec = (service as any).buildCanonicalSpecForConversation(
      baselineChecklist,
      normalization,
      semanticState ?? undefined,
    )
    const executionContext = (service as any).resolveClarificationArtifacts(baselineChecklist).executionContext.context
    const latestSpecDesc = specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '', {
      normalizedIntent: normalization.normalizedIntent,
      executionContext,
    })
    const inferredAssumptions = new Set<string>(
      Array.isArray(rawChecklist.riskRules?._inferredAssumptions)
        ? rawChecklist.riskRules._inferredAssumptions.filter((item): item is string => typeof item === 'string')
        : [],
    )
    if (
      typeof rawChecklist.riskRules?.stopLossPct === 'number'
      && rawChecklist.riskRules?.stopLossBasis == null
      && normalizedChecklist.riskRules?.stopLossBasis === 'entry_avg_price'
    ) {
      inferredAssumptions.add('risk.stopLossBasis')
    }
    if (
      typeof rawChecklist.riskRules?.takeProfitPct === 'number'
      && rawChecklist.riskRules?.takeProfitBasis == null
      && normalizedChecklist.riskRules?.takeProfitBasis === 'entry_avg_price'
    ) {
      inferredAssumptions.add('risk.takeProfitBasis')
    }
    if (Array.isArray((latestSpecDesc as any).normalizedIntent?.risk) && inferredAssumptions.size > 0) {
      ;(latestSpecDesc as any).normalizedIntent.risk = (latestSpecDesc as any).normalizedIntent.risk.map((risk: Record<string, any>) => {
        if (risk?.key === 'risk.stop_loss_pct' && inferredAssumptions.has('risk.stopLossBasis')) {
          return {
            ...risk,
            source: 'system_default',
            params: {
              ...(risk.params ?? {}),
              basisSource: 'system_default',
            },
          }
        }
        if (risk?.key === 'risk.take_profit_pct' && inferredAssumptions.has('risk.takeProfitBasis')) {
          return {
            ...risk,
            source: 'system_default',
            params: {
              ...(risk.params ?? {}),
              basisSource: 'system_default',
            },
          }
        }

        return risk
      })
    }

    return {
      ...fixture,
      ...(semanticState ? { semanticState } : {}),
      latestSpecDesc,
    }
  }
  const readCanonicalDigestFromSpecDesc = (specDesc: Record<string, any> | null | undefined): string => {
    const digest = specDesc?.canonicalDigest
    if (typeof digest !== 'string' || !digest) {
      throw new Error('missing spec desc canonical digest')
    }
    return digest
  }
  const readFixtureCanonicalDigest = (fixture: Record<string, any>): string =>
    readCanonicalDigestFromSpecDesc(fixture.latestSpecDesc)
  const buildSemanticOnlyCanonicalDigest = (semanticState: Record<string, any>): string => {
    const projectedChecklist = (service as any).projectLegacyChecklistFromSemanticState(semanticState, {})
    return buildConfirmedCanonicalDigest(projectedChecklist, semanticState)
  }
  const markFixtureInferredRiskBasisDefaults = (
    fixture: Record<string, any>,
    keys: string[] = ['risk.stopLossBasis', 'risk.takeProfitBasis'],
  ) => {
    const riskItems = fixture.latestSpecDesc?.normalizedIntent?.risk
    if (!Array.isArray(riskItems)) return fixture

    fixture.latestSpecDesc.normalizedIntent.risk = riskItems.map((risk: Record<string, any>) => {
      if (risk?.key === 'risk.stop_loss_pct' && keys.includes('risk.stopLossBasis')) {
        return {
          ...risk,
          source: 'system_default',
          params: {
            ...(risk.params ?? {}),
            basisSource: 'system_default',
          },
        }
      }
      if (risk?.key === 'risk.take_profit_pct' && keys.includes('risk.takeProfitBasis')) {
        return {
          ...risk,
          source: 'system_default',
          params: {
            ...(risk.params ?? {}),
            basisSource: 'system_default',
          },
        }
      }
      return risk
    })

    return fixture
  }
  const waitForTerminalStatus = async (
    sessionId: string,
    timeoutMs = 20_000,
  ): Promise<void> => {
    const startedAt = Date.now()
    while (Date.now() - startedAt <= timeoutMs) {
      const hasTerminal = mockRepo.updateSession.mock.calls.some((call) => {
        const currentId = call[0] as string
        const payload = call[1] as { status?: string }
        return currentId === sessionId
          && (payload.status === 'PUBLISHED' || payload.status === 'CONSISTENCY_FAILED' || payload.status === 'REJECTED')
      })
      if (hasTerminal) return
      await new Promise(resolve => setTimeout(resolve, 20))
    }

    throw new Error(`timed out waiting for terminal status: ${sessionId}`)
  }

  beforeEach(() => {
    jest.resetAllMocks()
    mockRepo.tryMarkGenerating.mockResolvedValue(true)
    mockRepo.tryRequeueFromProcessing.mockResolvedValue(false)
    mockRepo.findSessionStrategyInstanceId.mockResolvedValue(null)
    mockRepo.bindStrategyInstanceIfEmpty.mockResolvedValue(true)
    mockRepo.createVersion.mockResolvedValue({ id: 'version-1' })
    mockRepo.create.mockResolvedValue({
      id: 'snapshot-1',
      consistencyReport: {},
    })
    mockRepo.findLatestBySessionId.mockResolvedValue(null)
    mockRepo.createDraftStrategyInstanceFromPublishedSession.mockResolvedValue({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    })
    mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession.mockResolvedValue({
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
    })
    mockConversationsRepo.listByUser.mockResolvedValue([])
    mockConversationsRepo.listKnownSessionIdsByUser.mockResolvedValue([])
    mockConversationsRepo.findByCodegenSessionId.mockResolvedValue(null)
    mockConversationsRepo.upsertConversationSnapshot.mockResolvedValue(undefined)
    mockConversationsRepo.archiveByIdAndUser.mockResolvedValue(undefined)
    setProcessEnvValue('LLM_CODEGEN_STRICT_ENABLED', 'false')
    setProcessEnvValue('LLM_CODEGEN_STRICT_FALLBACK', 'true')
    service = new (CodegenConversationService as unknown as new (...args: any[]) => CodegenConversationService)(
      mockAi as unknown as AiService,
      mockRepo as unknown as CodegenSessionsRepository,
      mockRepo as unknown as PublishedStrategySnapshotsRepository,
      mockConversationsRepo,
      new StaticGuardrailService(),
      new RuntimeGuardrailService(),
      specDescBuilder,
      canonicalSpecBuilder,
      new StrategyCompileabilityDecisionService(),
      new StrategyClarificationRulesService(),
      new StrategyClarificationQuestionService(),
      publicationPipeline,
    )

  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(() => {
    restoreProcessEnv(envSnapshot)
  })

  it('does not let entry timeframe bleed into exit extraction', () => {
    const service = Object.create(CodegenConversationService.prototype) as CodegenConversationService

    const checklist = (service as any).inferChecklistFromMessage(
      '在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金',
    )

    expect(checklist.entryRules).toEqual(['3m 内下跌 1% 买入'])
    expect(checklist.exitRules).toEqual(['15m 内上涨 2% 卖出'])
    expect(checklist.timeframes).toEqual(['3m', '15m'])
    expect(checklist.entryRuleDrafts?.[0]).toMatchObject({ timeframe: '3m' })
    expect(checklist.exitRuleDrafts?.[0]).toMatchObject({ timeframe: '15m' })
  })

  it('does not let entry clause bleed into exit extraction when phrased as 入场/出场', () => {
    const service = Object.create(CodegenConversationService.prototype) as CodegenConversationService

    const checklist = (service as any).inferChecklistFromMessage(
      '在okx交易所 我想买btc 3分钟之内跌百分1入场 15分钟之内涨百分2出场 单笔用百分10资金',
    )

    expect(checklist.entryRules).toEqual(['3m 内下跌 1% 买入'])
    expect(checklist.exitRules).toEqual(['15m 内上涨 2% 卖出'])
    expect(checklist.entryRuleDrafts?.[0]).toMatchObject({ timeframe: '3m' })
    expect(checklist.exitRuleDrafts?.[0]).toMatchObject({ timeframe: '15m' })
    expect(checklist.market).toMatchObject({ exchange: 'okx', defaultTimeframe: '3m' })
  })

  it('builds clarification summary from rule-level timeframes instead of checklist.timeframes[0]', () => {
    const service = Object.create(CodegenConversationService.prototype) as CodegenConversationService

    const summary = (service as any).buildClarificationSummary({
      symbols: ['BTCUSDT'],
      timeframes: ['3m', '15m'],
      entryRules: ['3m 内下跌 1% 买入'],
      exitRules: ['15m 内上涨 2% 卖出'],
      entryRuleDrafts: [{ id: 'entry-1', phase: 'entry', text: '3m 内下跌 1% 买入', timeframe: '3m' }],
      exitRuleDrafts: [{ id: 'exit-1', phase: 'exit', text: '15m 内上涨 2% 卖出', timeframe: '15m' }],
      riskRules: { exchange: 'okx', marketType: 'spot', positionPct: 10 },
    })

    expect(summary).toContain('入场：3m 内下跌 1% 买入')
    expect(summary).toContain('出场：15m 内上涨 2% 卖出')
    expect(summary).not.toContain('出场：3m 内上涨 2% 卖出')
  })

  it('seeds checklist.grid for vague grid prompts even before numeric params are known', () => {
    const service = Object.create(CodegenConversationService.prototype) as CodegenConversationService

    const checklist = (service as any).inferChecklistFromMessage(
      '在okx交易所合约市场的BTCUSDT 15m上，帮我做一个网格策略，在一个区间里挂单，行情突破区间就停掉',
    )

    expect(checklist.grid).toEqual(expect.objectContaining({
      sideMode: 'bidirectional',
    }))
  })

  it('extracts short grid wording, 每一格 percent syntax, and breakout pause semantics from freeform input', () => {
    const service = Object.create(CodegenConversationService.prototype) as CodegenConversationService

    const checklist = (service as any).inferChecklistFromMessage(
      '在okx交易所合约市场的BTCUSDT 15m上，做空网格，区间 60000-80000，每一格 1%，行情突破区间就停掉',
    )

    expect(checklist.grid).toEqual(expect.objectContaining({
      lower: 60000,
      upper: 80000,
      stepPct: 1,
      sideMode: 'short_only',
      breakoutAction: 'pause',
    }))
  })

  it('does not let stop-loss and take-profit percentages bleed into each other when parsed from one sentence', () => {
    const service = Object.create(CodegenConversationService.prototype) as CodegenConversationService

    const checklist = (service as any).inferChecklistFromMessage(
      '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈',
    )

    expect(checklist.riskRules).toEqual(expect.objectContaining({
      stopLossPct: 5,
      takeProfitPct: 10,
    }))
  })

  it('keeps risk clause percentages stable when stop-loss and take-profit share a natural language fragment', () => {
    const service = Object.create(CodegenConversationService.prototype) as CodegenConversationService

    const checklist = (service as any).inferChecklistFromMessage(
      'OKX 永续合约 BTCUSDT 15m；入场后按入场均价亏损 5% 强制止损，盈利 10% 止盈，单笔仓位 10%',
    )

    expect(checklist.riskRules).toEqual(expect.objectContaining({
      stopLossPct: 5,
      takeProfitPct: 10,
      positionPct: 10,
    }))
  })

  it('does not let take-profit inherit the stop-loss percentage when both are written inline without punctuation', () => {
    const service = Object.create(CodegenConversationService.prototype) as CodegenConversationService

    const checklist = (service as any).inferChecklistFromMessage(
      '在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金 止损5% 止盈10%',
    )

    expect(checklist.riskRules).toEqual(expect.objectContaining({
      stopLossPct: 5,
      takeProfitPct: 10,
    }))
  })

  it('starts in drafting and asks next key question from llm planner', async () => {
    const dto: StartCodegenSessionDto = {
      userId: 'u1',
      initialMessage: '帮我做一个均线策略',
    }
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '先确认入场条件：例如 5/20 金叉。',
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's1' })

    const result = await service.startSession(dto)

    expect(result.status).toBe('DRAFTING')
    expect(result.missingFields).toEqual([])
    expect(result.assistantPrompt).toContain('请确认交易所')
    expect(result.assistantPrompt).toContain('请确认交易所')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      status: 'DRAFTING',
    }))
  })

  it('creates a drafting session without persisting or reading checklist payloads', async () => {
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '先确认布林带参数。',
        semanticPatch: {
          families: ['single-leg'],
          triggers: [
            {
              phase: 'entry',
              key: 'bollinger.touch_upper',
              sideScope: 'short',
              params: {
                indicator: 'bollinger',
                period: 20,
                stdDev: 2,
                confirmationMode: 'touch',
              },
            },
            {
              phase: 'exit',
              key: 'bollinger.touch_middle',
              sideScope: 'short',
              params: {
                indicator: 'bollinger',
                period: 20,
                stdDev: 2,
                confirmationMode: 'touch',
              },
            },
          ],
          actions: [
            { key: 'open_short' },
            { key: 'close_short' },
          ],
          position: {
            mode: 'fixed_ratio',
            value: 0.1,
            positionMode: 'short_only',
          },
          context: {
            exchange: 'okx',
            marketType: 'perp',
            symbol: 'BTCUSDT',
            timeframe: '15m',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-semantic-only-start' })

    await service.startSession({
      userId: 'u1',
      initialMessage: '在 OKX 合约 BTCUSDT 15m，触及布林带上轨做空，回到中轨平空，仓位 10%',
    })

    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, unknown>

    expect(createPayload.semanticState).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({ key: 'bollinger.touch_upper', sideScope: 'short' }),
        expect.objectContaining({ key: 'bollinger.touch_middle', sideScope: 'short', phase: 'exit' }),
      ]),
    }))
    expect(createPayload).not.toHaveProperty('checklist')
  })

  it('persists a dedicated conversation aggregate when starting a session', async () => {
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '先确认入场条件：例如 5/20 金叉。',
      }),
    })
    mockRepo.createSession.mockResolvedValue({
      id: 's-conversation-projection',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {},
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: { conversationHistory: ['U: 帮我做一个均线策略', 'A: 先确认入场条件：例如 5/20 金叉。'] },
      latestDraftCode: null,
      latestSpecDesc: null,
      rejectReason: null,
      createdAt: new Date('2026-04-10T20:00:00.000Z'),
      updatedAt: new Date('2026-04-10T20:00:00.000Z'),
      strategyInstanceId: null,
    })
    mockRepo.findById.mockResolvedValue({
      id: 's-conversation-projection',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {},
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: { conversationHistory: ['U: 帮我做一个均线策略', 'A: 先确认入场条件：例如 5/20 金叉。'] },
      latestDraftCode: null,
      latestSpecDesc: null,
      rejectReason: null,
      createdAt: new Date('2026-04-10T20:00:00.000Z'),
      updatedAt: new Date('2026-04-10T20:00:00.000Z'),
      strategyInstanceId: null,
    })

    await service.startSession({
      userId: 'u1',
      initialMessage: '帮我做一个均线策略',
    })

    expect(mockConversationsRepo.upsertConversationSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      codegenSessionId: 's-conversation-projection',
      title: '帮我做一个均线策略',
      messages: [
        { role: 'user', content: '帮我做一个均线策略' },
        { role: 'assistant', content: '先确认入场条件：例如 5/20 金叉。' },
      ],
    }))
  })

  it('lists conversations from the dedicated conversation aggregate instead of raw session rows', async () => {
    mockConversationsRepo.listByUser.mockResolvedValue([
      {
        id: 'conv-1',
        userId: 'u1',
        title: '服务器会话',
        codegenSessionId: 'session-1',
        createdAt: new Date('2026-04-10T20:00:00.000Z'),
        updatedAt: new Date('2026-04-10T20:01:00.000Z'),
        messages: [
          { role: 'user', content: '来自会话聚合的用户消息' },
          { role: 'assistant', content: '来自会话聚合的助手消息' },
        ],
      },
    ])
    mockConversationsRepo.listKnownSessionIdsByUser.mockResolvedValue(['session-1'])
    mockRepo.listByUser.mockResolvedValue([])
    mockRepo.findById.mockResolvedValue({
      id: 'session-1',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {},
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: { conversationHistory: ['U: 原始 session 消息'] },
      latestDraftCode: null,
      latestSpecDesc: null,
      rejectReason: null,
      createdAt: new Date('2026-04-10T20:00:00.000Z'),
      updatedAt: new Date('2026-04-10T20:01:00.000Z'),
      strategyInstanceId: null,
    })

    const result = await service.listConversations('u1')

    expect(mockConversationsRepo.listByUser).toHaveBeenCalledWith('u1')
    expect(mockRepo.listByUser).toHaveBeenCalledWith('u1')
    expect(result).toEqual([
      expect.objectContaining({
        id: 'conv-1',
        activeCodegenSessionId: 'session-1',
        conversationTitle: '服务器会话',
        conversationMessages: [
          { role: 'user', content: '来自会话聚合的用户消息' },
          { role: 'assistant', content: '来自会话聚合的助手消息' },
        ],
        status: 'CHECKLIST_GATE',
      }),
    ])
  })

  it('includes snapshot-bound param values when listing published conversations', async () => {
    mockConversationsRepo.listByUser.mockResolvedValue([
      {
        id: 'conv-published',
        userId: 'u1',
        title: '已发布会话',
        codegenSessionId: 'session-published',
        createdAt: new Date('2026-04-10T20:00:00.000Z'),
        updatedAt: new Date('2026-04-10T20:01:00.000Z'),
        messages: [
          { role: 'assistant', content: '来自会话聚合的助手消息' },
        ],
      },
    ])
    mockConversationsRepo.listKnownSessionIdsByUser.mockResolvedValue(['session-published'])
    mockRepo.listByUser.mockResolvedValue([])
    mockRepo.findById.mockResolvedValue({
      id: 'session-published',
      userId: 'u1',
      status: 'PUBLISHED',
      checklist: {},
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: { conversationHistory: ['U: 原始 session 消息'] },
      latestDraftCode: 'export default function strategy() { return true }',
      latestSpecDesc: null,
      rejectReason: null,
      createdAt: new Date('2026-04-10T20:00:00.000Z'),
      updatedAt: new Date('2026-04-10T20:01:00.000Z'),
      strategyInstanceId: 'instance-1',
    })
    mockRepo.findLatestBySessionId.mockResolvedValue({
      id: 'snapshot-1',
      consistencyReport: { status: 'PASSED' },
      paramsSnapshot: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        timeframe: '1h',
      },
      lockedParams: {
        positionPct: 25,
      },
      strategyConfig: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        baseTimeframe: '1h',
        positionPct: 25,
      },
      backtestConfigDefaults: {
        initialCash: 10000,
        leverage: 1,
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
        allowPartial: false,
      },
      deploymentExecutionDefaults: {
        leverage: 1,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'gtc',
      },
      deploymentExecutionConstraints: {
        supportedPriceSources: ['close'],
        supportedOrderTypes: ['market'],
        supportedTimeInForce: ['gtc'],
        defaultLeverage: 1,
      },
      executionPolicy: {
        allowPartialFill: false,
      },
    })

    const result = await service.listConversations('u1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'conv-published',
      publishedSnapshotId: 'snapshot-1',
      publishedSnapshotParamValues: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        timeframe: '1h',
        baseTimeframe: '1h',
        positionPct: 25,
        backtestAllowPartial: false,
      },
      publishedSnapshotStrategyConfig: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        baseTimeframe: '1h',
        positionPct: 25,
      },
      publishedSnapshotBacktestConfigDefaults: {
        initialCash: 10000,
        leverage: 1,
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
        allowPartial: false,
      },
      publishedSnapshotDeploymentExecutionDefaults: {
        leverage: 1,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'gtc',
      },
      publishedSnapshotDeploymentExecutionConstraints: {
        supportedPriceSources: ['close'],
        supportedOrderTypes: ['market'],
        supportedTimeInForce: ['gtc'],
        defaultLeverage: 1,
      },
      publishedSnapshotCompatibilityMetadata: {
        isLegacySnapshot: false,
        missingBacktestConfigDefaults: false,
        missingDeploymentExecutionDefaults: false,
        missingDeploymentExecutionConstraints: false,
        requiresRepublishForBacktest: false,
        requiresRepublishForDeploy: false,
      },
    })
  })

  it('keeps published snapshot params faithful to snapshot sources without injecting default execution values', () => {
    const result = (
      service as unknown as {
        buildPublishedSnapshotParamValues: (snapshot: {
          paramsSnapshot?: unknown
          lockedParams?: unknown
          executionPolicy?: unknown
        }) => Record<string, unknown> | null
      }
    ).buildPublishedSnapshotParamValues({
      paramsSnapshot: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
      },
      lockedParams: {
        symbol: 'ETHUSDT',
        leverage: 3,
        backtestAllowPartial: true,
      },
      executionPolicy: {
        allowPartialFill: false,
      },
    })

    expect(result).toEqual({
      exchange: 'okx',
      symbol: 'ETHUSDT',
      timeframe: '15m',
      baseTimeframe: '15m',
      positionPct: 10,
      leverage: 3,
      backtestAllowPartial: false,
    })
    expect(result).not.toHaveProperty('backtestInitialCash')
    expect(result).not.toHaveProperty('backtestLeverage')
    expect(result).not.toHaveProperty('backtestSlippageBps')
    expect(result).not.toHaveProperty('backtestFeeBps')
    expect(result).not.toHaveProperty('backtestPriceSource')
  })

  it('keeps incomplete published snapshots incomplete instead of fabricating execution defaults', () => {
    const result = (
      service as unknown as {
        buildPublishedSnapshotParamValues: (snapshot: {
          paramsSnapshot?: unknown
          lockedParams?: unknown
          executionPolicy?: unknown
        }) => Record<string, unknown> | null
      }
    ).buildPublishedSnapshotParamValues({
      paramsSnapshot: null,
      lockedParams: null,
      executionPolicy: null,
    })

    expect(result).toBeNull()
  })

  it('backfills only missing session projections and does not resurrect archived conversations', async () => {
    mockConversationsRepo.listByUser
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    mockConversationsRepo.listKnownSessionIdsByUser.mockResolvedValue(['session-archived'])
    mockRepo.listByUser.mockResolvedValue([
      {
        id: 'session-archived',
        userId: 'u1',
      },
      {
        id: 'session-missing',
        userId: 'u1',
      },
    ])
    mockRepo.findById.mockImplementation(async (id: string) => ({
      id,
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {},
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: { conversationHistory: ['U: hi', 'A: hello'] },
      latestDraftCode: null,
      latestSpecDesc: null,
      rejectReason: null,
      createdAt: new Date('2026-04-10T20:00:00.000Z'),
      updatedAt: new Date('2026-04-10T20:01:00.000Z'),
      strategyInstanceId: null,
    }))

    await service.listConversations('u1')

    expect(mockConversationsRepo.upsertConversationSnapshot).toHaveBeenCalledTimes(1)
    expect(mockConversationsRepo.upsertConversationSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      codegenSessionId: 'session-missing',
    }))
  })

  it('archives a conversation through the dedicated conversation repository', async () => {
    await service.deleteConversation('conv-1', 'u1')

    expect(mockConversationsRepo.archiveByIdAndUser).toHaveBeenCalledWith('conv-1', 'u1')
  })

  it('sends the non-contradictory planner prompt to ai service', async () => {
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '请补充退出条件。',
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-planner-prompt' })

    await service.startSession({
      userId: 'u1',
      initialMessage: '帮我做一个布林带策略',
    })

    expect(mockAi.chat).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('不得跳过必答市场、周期、仓位或关键风控字段'),
        }),
      ]),
    }))

    const chatCall = mockAi.chat.mock.calls[0]?.[0] as { messages?: Array<{ role?: string; content?: string }> }
    const systemPrompt = chatCall.messages?.find(message => message.role === 'system')?.content ?? ''

    expect(systemPrompt).toContain('semanticPatch 只表达当前消息涉及的增量语义')
    expect(systemPrompt).toContain('不得臆造新的核心交易规则')
    expect(systemPrompt).not.toContain('必须直接给出完整入场+出场规则草案')
  })

  it('preserves untouched exit sibling when planner emits a single exit-rule patch', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-merge-rules',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({
        entryRules: ['K线收盘后确认突破布林带上轨时做空', 'K线收盘后确认突破布林带下轨时做多'],
        exitRules: ['价格回到布林带中轨(MA20)时平仓', '价格连续3根K线在轨外时直接减仓'],
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '我已按你的澄清更新规则。',
        logic: {
          exitRules: ['价格连续3根K线在轨外时直接平仓'],
        },
      }),
    })

    await service.continueSession('s-merge-rules', {
      userId: 'u1',
      message: '轨外 3 根不是减仓，是直接平仓',
    })

    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(updatePayload.status).toBe('DRAFTING')
    const projectedChecklist = (service as any).projectLegacyChecklistFromSemanticState(
      updatePayload.semanticState,
      completeChecklist({
        entryRules: ['K线收盘后确认突破布林带上轨时做空', 'K线收盘后确认突破布林带下轨时做多'],
        exitRules: ['价格回到布林带中轨(MA20)时平仓', '价格连续3根K线在轨外时直接减仓'],
      }),
    )
    expect(projectedChecklist.exitRules).toEqual(expect.arrayContaining([
      '价格回到布林带中轨(MA20)时平仓',
      '价格连续3根K线在轨外时直接减仓',
    ]))
    expect(projectedChecklist.exitRules?.filter((rule: string) => rule === '价格回到布林带中轨(MA20)时平仓')).toHaveLength(1)
  })

  it('preserves distinct stop-loss siblings when planner emits a stop-loss patch', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-stoploss-siblings',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({
        entryRules: ['K线收盘后确认突破布林带上轨时做空'],
        exitRules: ['多单亏损达到5%时平仓', '空单亏损达到8%时平仓'],
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '我已按你的澄清补充规则。',
        logic: {
          exitRules: ['多单亏损达到6%时平仓'],
        },
      }),
    })

    await service.continueSession('s-stoploss-siblings', {
      userId: 'u1',
      message: '把多单止损改成 6%',
    })

    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(updatePayload.status).toBe('DRAFTING')
    const projectedChecklist = (service as any).projectLegacyChecklistFromSemanticState(
      updatePayload.semanticState,
      completeChecklist({
        entryRules: ['K线收盘后确认突破布林带上轨时做空'],
        exitRules: ['多单亏损达到5%时平仓', '空单亏损达到8%时平仓'],
      }),
    )
    expect(projectedChecklist.exitRules).toEqual(expect.arrayContaining([
      '多单亏损达到5%时平仓',
      '空单亏损达到8%时平仓',
    ]))
    expect(projectedChecklist.exitRules?.filter((rule: string) => rule === '空单亏损达到8%时平仓')).toHaveLength(1)
  })

  it('passes exact strong-rule semantics into the script generation call', async () => {
    mockAi.chat.mockResolvedValue({
      content: 'const strategy: StrategyAdapterV1 = { protocolVersion: "v1", onBar() { return { action: "NOOP" } } }\nstrategy',
    })

    await (service as any).generateScript(completeChecklist({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['K线收盘后确认突破布林带上轨时做空', 'K线收盘后确认突破布林带下轨时做多'],
      exitRules: ['价格回到布林带中轨(MA20)时平仓', '价格连续3根K线在轨外时直接平仓'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
        stopLossPct: 5,
      },
    }), '确认并生成', {
      providerCode: 'strategy-codegen',
      model: 'gpt-4',
    })

    const chatCall = mockAi.chat.mock.calls[0]?.[0] as {
      messages?: Array<{ role?: string; content?: string }>
    }
    const systemPrompt = chatCall.messages?.find(message => message.role === 'system')?.content ?? ''
    const userPrompt = chatCall.messages?.find(message => message.role === 'user')?.content ?? ''

    expect(systemPrompt).toContain('semanticState 派生约束')
    expect(systemPrompt).toContain('risk / sizing / context')
    expect(systemPrompt).toContain('不要为了“覆盖”而伪造无意义的运行时代码分支')
    expect(userPrompt).toContain('价格连续3根K线在轨外时直接平仓')
    expect(userPrompt).not.toContain('价格连续3根K线在轨外时直接减仓')
    expect(userPrompt).toContain('"exchange":"okx"')
    expect(userPrompt).toContain('"marketType":"perp"')
  })

  it('stays in DRAFTING when an entry rule can resolve to both OPEN_LONG and OPEN_SHORT', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-clarify-1' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 15分钟图上，突破布林带上轨交易，仓位10%',
      exitRules: ['价格回到布林带中轨(MA20)时平仓'],
      riskRules: completeRiskRules(),
    } as any)

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('请补充')
    expect(result.assistantPrompt).toContain('入场')
    expect(result.assistantPrompt).toContain('出场')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({
            key: 'bollinger.touch_upper',
            sideScope: 'short',
          }),
        ]),
      }),
    }))
  })

  it('asks for missing exchange from execution-context diagnostics before checklist fallback gaps', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-execution-context-clarify' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在合约市场的 BTCUSDT 15分钟图上，3分钟内跌 1% 做多，5分钟内涨 2% 平仓，单笔 10% 仓位',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('缺少唯一交易所')
    expect(result.assistantPrompt).toContain('请确认交易所')
    expect(result.assistantPrompt).not.toContain('请确认止损规则')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      clarificationState: expect.objectContaining({
        status: 'NEEDS_CLARIFICATION',
        items: expect.arrayContaining([
          expect.objectContaining({
            key: 'executionContext.exchange',
            reason: 'missing_exchange',
            field: 'exchange',
          }),
        ]),
      }),
    }))
  })

  it('keeps clarification gate ordering aligned with the semantic question selected for assistantPrompt', () => {
    const result = (service as any).finalizeSessionResponse({
      id: 's-clarification-order-alignment',
      status: 'DRAFTING',
      missingFields: [],
      assistantPrompt: [
        '我当前理解的策略是：BTCUSDT 15m；入场：价格突破长期均线时买入；出场：跌破短期均线时卖出。',
        '现在还缺一个会影响脚本生成一致性的条件：核心信号未闭合',
        '请确认：长期均线是多少？',
      ].join('\n'),
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'executionContext.exchange',
            reason: 'missing_exchange',
            field: 'exchange',
            blocking: true,
            question: '请确认交易所（binance / okx / hyperliquid）。',
            status: 'pending',
          },
          {
            key: 'semantic.reference.period.entry',
            reason: 'missing_entry_rules',
            field: 'entryRules',
            blocking: true,
            question: '长期均线是多少？',
            status: 'pending',
          },
          {
            key: 'semantic.confirmationMode.entry',
            reason: 'missing_entry_rules',
            field: 'entryRules',
            blocking: true,
            question: '突破按收盘确认还是盘中触发？',
            status: 'pending',
          },
        ],
      },
    })

    expect(result.assistantPrompt).toContain('长期均线是多少')
    expect((result as any).clarificationGate).toEqual(expect.objectContaining({
      blocked: true,
      summary: null,
    }))
    expect((result as any).clarificationGate.items[0]).toEqual(expect.objectContaining({
      key: 'semantic.reference.period.entry',
      question: '长期均线是多少？',
      status: 'pending',
    }))
    expect((result as any).clarificationGate.pendingItems[0]).toEqual(expect.objectContaining({
      key: 'semantic.reference.period.entry',
      question: '长期均线是多少？',
      status: 'pending',
    }))
    expect((result as any).clarificationGate.items.map((item: any) => item.key)).toEqual(expect.arrayContaining([
      'semantic.reference.period.entry',
      'semantic.confirmationMode.entry',
      'executionContext.exchange',
    ]))
    expect((result as any).clarificationGate.pendingItems.map((item: any) => item.key)).toEqual(expect.arrayContaining([
      'semantic.reference.period.entry',
      'semantic.confirmationMode.entry',
      'executionContext.exchange',
    ]))
  })

  it('keeps clarification blockers in semantic-slot language after continueSession', async () => {
    const persistedSemanticState = {
      version: 1,
      families: ['single-leg'],
      triggers: [],
      actions: [],
      risk: [
        {
          id: 'risk-stop-loss',
          key: 'risk.stop_loss',
          params: {
            stopLossPct: 5,
          },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
            {
              slotKey: 'risk.stopLoss.basis',
              fieldPath: 'risk[0].params.stopLossBasis',
              status: 'open',
              priority: 'risk',
              questionHint: '这里的止损按什么基准计算？',
              affectsExecution: true,
            },
          ],
        },
        {
          id: 'risk-take-profit',
          key: 'risk.take_profit',
          params: {
            takeProfitPct: 10,
          },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
            {
              slotKey: 'risk.takeProfit.basis',
              fieldPath: 'risk[1].params.takeProfitBasis',
              status: 'open',
              priority: 'risk',
              questionHint: '这里的止盈按什么基准计算？',
              affectsExecution: true,
            },
          ],
        },
      ],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'short_only',
        status: 'locked',
        source: 'user_explicit',
      },
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认交易所（binance / okx / hyperliquid）。',
          affectsExecution: true,
          value: 'okx',
        },
        symbol: {
          slotKey: 'symbol',
          fieldPath: 'contextSlots.symbol',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认策略交易标的（例如 BTCUSDT）。',
          affectsExecution: true,
          value: 'BTCUSDT',
        },
        marketType: {
          slotKey: 'marketType',
          fieldPath: 'contextSlots.marketType',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认市场类型（现货或合约/perp）。',
          affectsExecution: true,
          value: 'perp',
        },
        timeframe: {
          slotKey: 'timeframe',
          fieldPath: 'contextSlots.timeframe',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认策略主周期（例如 15m 或 1h）。',
          affectsExecution: true,
          value: '15m',
        },
      },
      normalizationNotes: [],
      updatedAt: '2026-04-19T08:00:00.000Z',
    }
    const persistedClarificationState = {
      status: 'NEEDS_CLARIFICATION',
      items: [
        {
          key: 'semantic.risk.stopLoss.basis',
          reason: 'ambiguous_condition_basis',
          field: 'risk.stopLoss.basis',
          blocking: true,
          question: '这里的止损按什么基准计算？',
          status: 'pending',
          slotId: buildSemanticSlotId({
            slotKey: 'risk.stopLoss.basis',
            fieldPath: 'risk[0].params.stopLossBasis',
          }),
          slotKey: 'risk.stopLoss.basis',
          fieldPath: 'risk[0].params.stopLossBasis',
        },
        {
          key: 'semantic.risk.takeProfit.basis',
          reason: 'ambiguous_condition_basis',
          field: 'risk.takeProfit.basis',
          blocking: true,
          question: '这里的止盈按什么基准计算？',
          status: 'pending',
          slotId: buildSemanticSlotId({
            slotKey: 'risk.takeProfit.basis',
            fieldPath: 'risk[1].params.takeProfitBasis',
          }),
          slotKey: 'risk.takeProfit.basis',
          fieldPath: 'risk[1].params.takeProfitBasis',
        },
      ],
      summary: '已识别止损与止盈阈值，但基准尚未确认。',
    }

    mockRepo.findById.mockResolvedValue(buildPersistedSessionSnapshot(
      's-semantic-only-continue',
      {
        status: 'DRAFTING',
        checklist: {},
        semanticState: persistedSemanticState,
        clarificationState: persistedClarificationState,
        constraintPack: {},
      },
    ))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-semantic-only-continue', {
      userId: 'u1',
      message: '这里的止损按入场均价',
      clarificationAnswers: {
        'semantic.risk.stopLoss.basis': 'entry_avg_price',
      },
    })

    expect(result.clarificationState?.items.every(item => item.key.startsWith('semantic.'))).toBe(true)
    expect(result.clarificationState?.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'entry.rules' }),
      expect.objectContaining({ key: 'exit.rules' }),
    ]))
    expect(result.assistantPrompt).not.toContain('请补充至少一条明确的入场规则')
    expect(result.assistantPrompt).not.toContain('请补充至少一条明确的出场规则')
  })

  it('preserves explicit direction in bollinger fallback inference and does not ask direction clarification', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-clarify-2' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 15分钟图上，突破布林带上轨做空，仓位10%',
      exitRules: ['价格回到布林带中轨(MA20)时平仓'],
      riskRules: completeRiskRules(),
    } as any)

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('请补充')
    expect(result.assistantPrompt).toContain('入场')
    expect(result.assistantPrompt).toContain('出场')
    expect(result.assistantPrompt).not.toContain('只做空，还是也允许做多')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({
            key: 'bollinger.touch_upper',
            sideScope: 'short',
          }),
        ]),
      }),
    }))
  })

  it('asks for Bollinger confirmation semantics before checklist fallback questions', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-semantic-fork-clarify' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 15分钟图上，触及布林带上轨后收盘确认做空，价格回到布林带中轨(MA20)时平仓，亏损5%止损，盈利10%止盈，仓位10%',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('存在触碰即触发与收盘确认触发两种合法解释')
    expect(result.assistantPrompt).toContain('触碰即触发')
    expect(result.assistantPrompt).toContain('收盘确认后触发')
    expect(result.assistantPrompt).not.toContain('缺少方向约束')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      clarificationState: expect.objectContaining({
        status: 'NEEDS_CLARIFICATION',
        items: expect.arrayContaining([
          expect.objectContaining({
            reason: 'atomic_semantic_fork',
            field: 'trigger.confirmation',
            allowedAnswers: ['touch', 'close_confirm'],
          }),
        ]),
      }),
    }))
  })

  it('accepts planner semanticPatch output and projects it into checklist-compatible state', async () => {
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        semanticPatch: {
          triggers: [
            {
              key: 'indicator.above',
              phase: 'entry',
              params: {
                indicator: 'ma',
                referenceRole: 'long_term',
                'reference.period': 50,
                confirmationMode: 'close_confirm',
              },
            },
            {
              key: 'indicator.below',
              phase: 'exit',
              params: {
                indicator: 'ma',
                referenceRole: 'short_term',
                'reference.period': 10,
                confirmationMode: 'close_confirm',
              },
            },
          ],
          actions: [
            { key: 'open_long' },
            { key: 'close_long' },
          ],
          risk: [
            { key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
            { key: 'risk.take_profit_pct', params: { valuePct: 10, basis: 'entry_avg_price' } },
          ],
          position: {
            mode: 'fixed_ratio',
            value: 0.1,
            positionMode: 'long_only',
          },
          contextSlots: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'spot',
            timeframe: '15m',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-semantic-updates' })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '帮我做一个 MA50 上破买入、MA10 下破卖出的 OKX 现货 BTCUSDT 15m 策略',
    })

    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.canonicalDigest).toMatch(/^sha256:/)
    expect(createPayload).not.toHaveProperty('checklist')
    expect(createPayload.semanticState).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.above',
          phase: 'entry',
          params: expect.objectContaining({
            indicator: 'ma',
            'reference.period': 50,
            confirmationMode: 'close_confirm',
          }),
        }),
        expect.objectContaining({
          key: 'indicator.below',
          phase: 'exit',
          params: expect.objectContaining({
            indicator: 'ma',
            'reference.period': 10,
            confirmationMode: 'close_confirm',
          }),
        }),
      ]),
      contextSlots: expect.objectContaining({
        exchange: expect.objectContaining({ value: 'okx' }),
        symbol: expect.objectContaining({ value: 'BTCUSDT' }),
        marketType: expect.objectContaining({ value: 'spot' }),
        timeframe: expect.objectContaining({ value: '15m' }),
      }),
    }))
  })

  it('does not persist an incomplete semanticPatch as an empty semanticState when planner logic is already complete', async () => {
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '策略逻辑已完整，请确认逻辑图。',
        semanticPatch: {
          contextSlots: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'spot',
            timeframe: '3m',
          },
          risk: [
            { key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
            { key: 'risk.take_profit_pct', params: { valuePct: 10, basis: 'entry_avg_price' } },
          ],
          position: {
            mode: 'fixed_ratio',
            value: 0.1,
            positionMode: 'long_only',
          },
        },
        logic: {
          symbols: ['BTCUSDT'],
          timeframes: ['3m', '15m'],
          entryRules: ['3m 内下跌 1% 买入'],
          exitRules: ['15m 内上涨 2% 卖出'],
          entryRuleBases: { 'entry-1': 'prev_close' },
          exitRuleBases: { 'exit-1': 'entry_avg_price' },
          riskRules: {
            exchange: 'okx',
            marketType: 'spot',
            positionPct: 10,
            stopLossPct: 5,
            stopLossBasis: 'entry_avg_price',
            takeProfitPct: 10,
            takeProfitBasis: 'entry_avg_price',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-semantic-partial-patch' })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '在 okx 现货 BTCUSDT 上，3 分钟内跌 1% 买入，15 分钟内相对入场价涨 2% 卖出，止损 5%，止盈 10%，单笔 10%。',
    })

    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    expect(result.status).toBe('CHECKLIST_GATE')
    expect(createPayload.semanticState).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'price.percent_change',
          phase: 'entry',
        }),
        expect.objectContaining({
          key: 'price.percent_change',
          phase: 'exit',
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({ key: 'open_long' }),
        expect.objectContaining({ key: 'close_long' }),
      ]),
    }))
  })

  it('still accepts legacy semanticUpdates output with old nested planner keys during the semanticPatch transition', async () => {
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        semanticUpdates: {
          triggerUpdates: [
            {
              key: 'indicator.above',
              phase: 'entry',
              params: {
                indicator: 'ma',
                referenceRole: 'long_term',
                'reference.period': 50,
                confirmationMode: 'close_confirm',
              },
            },
            {
              key: 'indicator.below',
              phase: 'exit',
              params: {
                indicator: 'ma',
                referenceRole: 'short_term',
                'reference.period': 10,
                confirmationMode: 'close_confirm',
              },
            },
          ],
          actionUpdates: [
            { key: 'open_long' },
            { key: 'close_long' },
          ],
          riskUpdates: [
            { key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
            { key: 'risk.take_profit_pct', params: { valuePct: 10, basis: 'entry_avg_price' } },
          ],
          positionUpdate: {
            mode: 'fixed_ratio',
            value: 0.1,
            positionMode: 'long_only',
          },
          contextUpdates: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'spot',
            timeframe: '15m',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-semantic-updates-legacy' })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '帮我做一个 MA50 上破买入、MA10 下破卖出的 OKX 现货 BTCUSDT 15m 策略',
    })

    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.canonicalDigest).toMatch(/^sha256:/)
    expect(createPayload).not.toHaveProperty('checklist')
    expect(createPayload.semanticState).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.above',
          phase: 'entry',
          params: expect.objectContaining({
            indicator: 'ma',
            'reference.period': 50,
            confirmationMode: 'close_confirm',
          }),
        }),
        expect.objectContaining({
          key: 'indicator.below',
          phase: 'exit',
          params: expect.objectContaining({
            indicator: 'ma',
            'reference.period': 10,
            confirmationMode: 'close_confirm',
          }),
        }),
      ]),
      contextSlots: expect.objectContaining({
        exchange: expect.objectContaining({ value: 'okx' }),
        symbol: expect.objectContaining({ value: 'BTCUSDT' }),
        marketType: expect.objectContaining({ value: 'spot' }),
        timeframe: expect.objectContaining({ value: '15m' }),
      }),
    }))
  })

  it('continues from semanticState when persisted checklist payload is absent', async () => {
    const persistedSemanticState = buildLockedMaSemanticState({
      triggers: [
        {
          id: 'entry-ma',
          key: 'indicator.above',
          phase: 'entry',
          params: {
            indicator: 'ma',
            referenceRole: 'long_term',
            'reference.period': 50,
            confirmationMode: 'close_confirm',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [
        { id: 'action-1', key: 'open_long', status: 'locked', source: 'user_explicit' },
      ],
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认交易所（binance / okx / hyperliquid）。',
          affectsExecution: true,
          value: 'okx',
        },
        symbol: {
          slotKey: 'symbol',
          fieldPath: 'contextSlots.symbol',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认策略交易标的（例如 BTCUSDT）。',
          affectsExecution: true,
          value: 'BTCUSDT',
        },
        marketType: {
          slotKey: 'marketType',
          fieldPath: 'contextSlots.marketType',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认市场类型（现货或合约/perp）。',
          affectsExecution: true,
          value: 'spot',
        },
        timeframe: {
          slotKey: 'timeframe',
          fieldPath: 'contextSlots.timeframe',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认策略主周期（例如 15m 或 1h）。',
          affectsExecution: true,
          value: '15m',
        },
      },
    })

    mockRepo.findById.mockResolvedValue({
      id: 's-semantic-first-continue',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: null,
      semanticState: persistedSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        semanticPatch: {
          triggers: [
            {
              key: 'indicator.below',
              phase: 'exit',
              params: {
                indicator: 'ma',
                referenceRole: 'short_term',
                'reference.period': 10,
                confirmationMode: 'close_confirm',
              },
            },
          ],
          actions: [
            { key: 'close_long' },
          ],
        },
      }),
    })

    const result = await service.continueSession('s-semantic-first-continue', {
      userId: 'u1',
      message: '出场改成 MA10 下破卖出',
    })

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-semantic-first-continue', expect.objectContaining({
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({ key: 'indicator.above', phase: 'entry' }),
          expect.objectContaining({
            key: 'indicator.below',
            phase: 'exit',
            params: expect.objectContaining({ 'reference.period': 10 }),
          }),
        ]),
      }),
    }))
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, unknown>
    expect(updatePayload).toHaveProperty('semanticState')
  })

  it('confirms generation from semanticState when persisted checklist payload is absent', async () => {
    const persistedSemanticState = buildLockedMaSemanticState({
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认交易所（binance / okx / hyperliquid）。',
          affectsExecution: true,
          value: 'okx',
        },
        symbol: {
          slotKey: 'symbol',
          fieldPath: 'contextSlots.symbol',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认策略交易标的（例如 BTCUSDT）。',
          affectsExecution: true,
          value: 'BTCUSDT',
        },
        marketType: {
          slotKey: 'marketType',
          fieldPath: 'contextSlots.marketType',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认市场类型（现货或合约/perp）。',
          affectsExecution: true,
          value: 'spot',
        },
        timeframe: {
          slotKey: 'timeframe',
          fieldPath: 'contextSlots.timeframe',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认策略主周期（例如 15m 或 1h）。',
          affectsExecution: true,
          value: '15m',
        },
      },
    })
    const projectedChecklist = (service as any).projectLegacyChecklistFromSemanticState(persistedSemanticState, {})

    mockRepo.findById.mockResolvedValue({
      id: 's-semantic-first-confirm',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: null,
      semanticState: persistedSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      strategyInstanceId: null,
    })

    const result = await service.continueSession('s-semantic-first-confirm', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(projectedChecklist, persistedSemanticState),
    })

    expect(result.status).toBe('GENERATING')
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith('s-semantic-first-confirm', expect.objectContaining({
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({ key: 'indicator.above', phase: 'entry' }),
          expect.objectContaining({ key: 'indicator.below', phase: 'exit' }),
        ]),
      }),
    }))
    const generatingPayload = mockRepo.tryMarkGenerating.mock.calls.at(-1)?.[1] as Record<string, any>
    const generatedChecklist = (service as any).projectLegacyChecklistFromSemanticState(generatingPayload.semanticState, {})
    expect(generatedChecklist).toEqual(expect.objectContaining({
      entryRules: expect.arrayContaining(['收盘确认价格突破长期均线（50）时买入']),
      exitRules: expect.arrayContaining(['收盘确认价格跌破短期均线（20）时卖出']),
    }))
  })

  it('does not fall back to checklist completeness in continueWithStructuredClarificationAnswers when semantic slots are closed', async () => {
    const missingFieldsSpy = jest.spyOn(service as any, 'resolveChecklistMissingFields').mockReturnValue(['entryRules', 'exitRules'])
    const persistedSemanticState = buildLockedMaSemanticState({
      risk: [
        {
          id: 'risk-stop-loss',
          key: 'risk.stop_loss',
          params: {
            stopLossPct: 5,
          },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
            {
              slotKey: 'risk.stopLoss.basis',
              fieldPath: 'risk[0].params.stopLossBasis',
              status: 'open',
              priority: 'risk',
              questionHint: '这里的止损按什么基准计算？',
              affectsExecution: true,
            },
          ],
        },
      ],
    })

    mockRepo.findById.mockResolvedValue({
      id: 's-structured-semantic-no-checklist-gate',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: null,
      semanticState: persistedSemanticState,
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'semantic.risk.stopLoss.basis',
            reason: 'ambiguous_condition_basis',
            field: 'risk.stopLoss.basis',
            blocking: true,
            question: '这里的止损按什么基准计算？',
            status: 'pending',
            slotId: buildSemanticSlotId({
              slotKey: 'risk.stopLoss.basis',
              fieldPath: 'risk[0].params.stopLossBasis',
            }),
            slotKey: 'risk.stopLoss.basis',
            fieldPath: 'risk[0].params.stopLossBasis',
          },
        ],
      },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-structured-semantic-no-checklist-gate', {
      userId: 'u1',
      message: '按入场均价',
      clarificationAnswers: {
        'semantic.risk.stopLoss.basis': 'entry_avg_price',
      },
    })

    expect(missingFieldsSpy).not.toHaveBeenCalled()
    expect(result.status).toBe('DRAFTING')
    expect(result.missingFields).toEqual([])
    expect(result.assistantPrompt).not.toContain('请先补全入场和出场规则，再确认生成代码。')
  })

  it('does not fall back to checklist completeness in continueConfirmedSession when semantic state is ready', async () => {
    const activeGateSpy = jest.spyOn(service as any, 'resolveActiveGateMissingFields').mockReturnValue(['entryRules', 'exitRules'])
    const persistedSemanticState = buildLockedMaSemanticState({
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认交易所（binance / okx / hyperliquid）。',
          affectsExecution: true,
          value: 'okx',
        },
        symbol: {
          slotKey: 'symbol',
          fieldPath: 'contextSlots.symbol',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认策略交易标的（例如 BTCUSDT）。',
          affectsExecution: true,
          value: 'BTCUSDT',
        },
        marketType: {
          slotKey: 'marketType',
          fieldPath: 'contextSlots.marketType',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认市场类型（现货或合约/perp）。',
          affectsExecution: true,
          value: 'spot',
        },
        timeframe: {
          slotKey: 'timeframe',
          fieldPath: 'contextSlots.timeframe',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认策略主周期（例如 15m 或 1h）。',
          affectsExecution: true,
          value: '15m',
        },
      },
    })
    const projectedChecklist = (service as any).projectLegacyChecklistFromSemanticState(persistedSemanticState, {})

    mockRepo.findById.mockResolvedValue({
      id: 's-confirm-semantic-no-checklist-gate',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: null,
      semanticState: persistedSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      strategyInstanceId: null,
    })

    const result = await service.continueSession('s-confirm-semantic-no-checklist-gate', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(projectedChecklist, persistedSemanticState),
    })

    expect(activeGateSpy).not.toHaveBeenCalled()
    expect(result.status).toBe('GENERATING')
  })

  it('keeps confirmGenerate blocked when legacy clarification blockers remain after semantic slots are closed', async () => {
    const activeGateSpy = jest.spyOn(service as any, 'resolveActiveGateMissingFields').mockReturnValue(['entryRules'])
    const persistedSemanticState = buildLockedMaSemanticState({
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认交易所（binance / okx / hyperliquid）。',
          affectsExecution: true,
          value: 'okx',
        },
        symbol: {
          slotKey: 'symbol',
          fieldPath: 'contextSlots.symbol',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认策略交易标的（例如 BTCUSDT）。',
          affectsExecution: true,
          value: 'BTCUSDT',
        },
        marketType: {
          slotKey: 'marketType',
          fieldPath: 'contextSlots.marketType',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认市场类型（现货或合约/perp）。',
          affectsExecution: true,
          value: 'spot',
        },
        timeframe: {
          slotKey: 'timeframe',
          fieldPath: 'contextSlots.timeframe',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认策略主周期（例如 15m 或 1h）。',
          affectsExecution: true,
          value: '15m',
        },
      },
    })
    const projectedChecklist = (service as any).projectLegacyChecklistFromSemanticState(persistedSemanticState, {})

    mockRepo.findById.mockResolvedValue({
      id: 's-confirm-semantic-legacy-blocker',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: null,
      semanticState: persistedSemanticState,
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'market.scope',
            field: 'marketType',
            reason: 'conflicting_market_scope',
            question: '你要做现货还是合约？现货不能做空。',
            blocking: true,
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
      strategyInstanceId: null,
    })

    const result = await service.continueSession('s-confirm-semantic-legacy-blocker', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(projectedChecklist, persistedSemanticState),
    })

    expect(activeGateSpy).not.toHaveBeenCalled()
    expect(mockRepo.tryMarkGenerating).not.toHaveBeenCalled()
    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('现货')
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'NEEDS_CLARIFICATION',
      items: expect.arrayContaining([
        expect.objectContaining({
          reason: 'conflicting_market_scope',
          status: 'pending',
          blocking: true,
        }),
      ]),
    }))
  })

  it('captures exchange and risk clauses from natural language without bypassing clarification flow', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-real-pipeline-1' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage:
        '在okx交易所合约市场，交易对BTCUSDT 15分钟图上，突破布林带上轨做空、突破下轨做多，仓位10%；出场条件为价格回到布林带中轨（MA20）平仓、亏损≥5%强制止损、盈利≥10%止盈，以及价格连续3根K线在轨外时提前止损或减仓。',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).not.toContain('请确认交易所')
    expect(result.assistantPrompt).not.toContain('请确认止损规则')
    expect(result.assistantPrompt).not.toContain('请确认止盈规则')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      semanticState: expect.objectContaining({
        contextSlots: expect.objectContaining({
          exchange: expect.objectContaining({ value: 'okx' }),
          symbol: expect.objectContaining({ value: 'BTCUSDT' }),
          timeframe: expect.objectContaining({ value: '15m' }),
        }),
        risk: expect.arrayContaining([
          expect.objectContaining({ key: 'risk.stop_loss_pct' }),
          expect.objectContaining({ key: 'risk.take_profit_pct' }),
        ]),
      }),
      clarificationState: expect.objectContaining({
        status: 'CLEAR',
      }),
    }))
  })

  it('keeps direction ambiguous when only exit wording includes sell action', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-clarify-3' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 15分钟图上，突破布林带上轨交易，回到中轨卖出，仓位10%',
      riskRules: completeRiskRules(),
    } as any)

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('请补充')
    expect(result.assistantPrompt).toContain('入场')
    expect(result.assistantPrompt).toContain('出场')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({
            key: 'bollinger.touch_upper',
            sideScope: 'short',
          }),
        ]),
      }),
    }))
  })

  it('keeps direction ambiguous for same-sentence no-comma exit wording after upper-band trigger', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-clarify-4' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 15分钟图上，突破布林带上轨交易后回到中轨卖出，仓位10%',
      riskRules: completeRiskRules(),
    } as any)

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('请补充')
    expect(result.assistantPrompt).toContain('入场')
    expect(result.assistantPrompt).toContain('出场')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({
            key: 'bollinger.touch_upper',
            sideScope: 'short',
          }),
        ]),
      }),
    }))
  })

  it('keeps closed-loop grid wording out of template exit and risk clarification prompts', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-grid-clarify-1' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在okx交易所合约市场的BTCUSDT上，做一个 60000 到 80000 的网格策略，每格千分之5，不断低买高卖，单笔10%资金',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).not.toContain('请补充至少一条明确的出场规则')
    expect(result.assistantPrompt).not.toContain('请确认止损规则')
    expect(result.assistantPrompt).not.toContain('请确认止盈规则')
  })

  it('asks for missing grid slots instead of generic entry rules when the user only gave vague grid semantics', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-grid-vague-start' })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        logic: {},
        assistantPrompt: '逻辑图仍未完整，请继续补充。',
      }),
    })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 15m上，帮我做一个网格策略，在一个区间内自动买卖，行情突破区间就停掉',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('请确认网格区间下界')
    expect(result.assistantPrompt).not.toContain('请确认交易所')
    expect(result.clarificationState?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'grid_params_missing',
        key: 'grid.stepPct',
      }),
      expect.objectContaining({
        reason: 'grid_params_missing',
        key: 'grid.range.lower',
        status: 'pending',
      }),
    ]))
  })

  it('writes grid clarification answers back into checklist.grid on the fallback checklist path', () => {
    const nextChecklist = (service as any).applyClarificationAnswers(
      {
        grid: {
          upper: 80000,
          stepPct: 0.5,
          sideMode: 'bidirectional',
        },
      },
      {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'grid.range.lower',
            reason: 'grid_params_missing',
            field: 'grid.lower',
            blocking: true,
            question: '请确认网格区间下界。',
            status: 'pending',
          },
        ],
      },
      {
        'grid.range.lower': '60000',
      },
    )

    expect(nextChecklist).toEqual(expect.objectContaining({
      grid: {
        lower: 60000,
        upper: 80000,
        stepPct: 0.5,
        sideMode: 'bidirectional',
      },
    }))
  })

  it('writes legacy grid.lower answers back into checklist.grid on the fallback checklist path', () => {
    const nextChecklist = (service as any).applyClarificationAnswers(
      {
        grid: {
          upper: 80000,
          stepPct: 0.5,
          sideMode: 'bidirectional',
        },
      },
      {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'grid.lower',
            reason: 'grid_params_missing',
            field: 'grid.lower',
            blocking: true,
            question: '请确认网格区间下界。',
            status: 'pending',
          },
        ],
      },
      {
        'grid.lower': '60000',
      },
    )

    expect(nextChecklist).toEqual(expect.objectContaining({
      grid: {
        lower: 60000,
        upper: 80000,
        stepPct: 0.5,
        sideMode: 'bidirectional',
      },
    }))
  })

  it('applies legacy grid.lower answers into the semantic snapshot path', () => {
    const nextSemanticState = (service as any).applySemanticClarificationAnswers(
      {
        version: 1,
        families: ['grid.range_rebalance'],
        triggers: [
          {
            id: 'grid-entry',
            key: 'grid.range_rebalance',
            phase: 'entry',
            params: {
              sideMode: 'bidirectional',
            },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'grid.lower',
                fieldPath: 'triggers[0].params.rangeLower',
                status: 'open',
                priority: 'core',
                questionHint: '请确认网格区间下界。',
                affectsExecution: true,
              },
            ],
          },
        ],
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'grid.lower',
            reason: 'grid_params_missing',
            field: 'grid.lower',
            blocking: true,
            question: '请确认网格区间下界。',
            status: 'pending',
            slotId: buildSemanticSlotId({
              slotKey: 'grid.lower',
              fieldPath: 'triggers[0].params.rangeLower',
            }),
            slotKey: 'grid.lower',
            fieldPath: 'triggers[0].params.rangeLower',
          },
        ],
        summary: '已识别网格策略，但还缺少区间下界。',
      },
      {
        'grid.lower': '60000',
      },
    )

    expect(nextSemanticState).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          params: expect.objectContaining({
            rangeLower: 60000,
          }),
          openSlots: expect.arrayContaining([
            expect.objectContaining({
              slotKey: 'grid.lower',
              status: 'locked',
              value: 60000,
            }),
          ]),
        }),
      ]),
    }))
  })

  it('keeps persisted grid clarification items valid when they use canonical grid.range field names', () => {
    const clarificationState = (service as any).readClarificationState({
      status: 'NEEDS_CLARIFICATION',
      items: [
        {
          key: 'grid.range.lower',
          reason: 'grid_params_missing',
          field: 'grid.range.lower',
          blocking: true,
          question: '请确认网格区间下界。',
          status: 'pending',
          slotKey: 'grid.range.lower',
          fieldPath: 'triggers[0].params.rangeLower',
        },
        {
          key: 'grid.range.upper',
          reason: 'grid_params_missing',
          field: 'grid.range.upper',
          blocking: true,
          question: '请确认网格区间上界。',
          status: 'pending',
          slotKey: 'grid.range.upper',
          fieldPath: 'triggers[0].params.rangeUpper',
        },
      ],
      summary: '已识别网格策略，但还缺少区间上下界。',
    })

    expect(clarificationState).toEqual(expect.objectContaining({
      status: 'NEEDS_CLARIFICATION',
      summary: '已识别网格策略，但还缺少区间上下界。',
      items: [
        expect.objectContaining({
          key: 'grid.range.lower',
          field: 'grid.range.lower',
          slotKey: 'grid.range.lower',
        }),
        expect.objectContaining({
          key: 'grid.range.upper',
          field: 'grid.range.upper',
          slotKey: 'grid.range.upper',
        }),
      ],
    }))
  })

  it('accepts canonical grid sideMode clarification answers on the fallback checklist path', () => {
    const nextChecklist = (service as any).applyClarificationAnswers(
      {
        grid: {
          lower: 60000,
          upper: 80000,
          stepPct: 0.5,
        },
      },
      {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'grid.sideMode',
            reason: 'missing_side_scope',
            field: 'grid.sideMode',
            blocking: true,
            question: '请确认网格方向（双向 / 只做多 / 只做空）。',
            status: 'pending',
            allowedAnswers: ['bidirectional', 'long_only', 'short_only'],
          },
        ],
      },
      {
        'grid.sideMode': 'bidirectional',
      },
    )

    expect(nextChecklist).toEqual(expect.objectContaining({
      grid: {
        lower: 60000,
        upper: 80000,
        stepPct: 0.5,
        sideMode: 'bidirectional',
      },
    }))
  })

  it('accepts natural short-grid sideMode clarification answers on the fallback checklist path', () => {
    const nextChecklist = (service as any).applyClarificationAnswers(
      {
        grid: {
          lower: 60000,
          upper: 80000,
          stepPct: 0.5,
        },
      },
      {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'grid.sideMode',
            reason: 'grid_params_missing',
            field: 'grid.sideMode',
            blocking: true,
            question: '请确认网格方向（双向 / 只做多 / 只做空）。',
            status: 'pending',
          },
        ],
      },
      {
        'grid.sideMode': '空头网格',
      },
    )

    expect(nextChecklist).toEqual(expect.objectContaining({
      grid: expect.objectContaining({
        sideMode: 'short_only',
      }),
    }))
  })

  it('accepts canonical grid sideMode clarification answers on the semantic snapshot path', () => {
    const nextSemanticState = (service as any).applySemanticClarificationAnswers(
      {
        version: 1,
        families: ['grid.range_rebalance'],
        triggers: [
          {
            id: 'grid-entry',
            key: 'grid.range_rebalance',
            phase: 'entry',
            params: {
              rangeLower: 60000,
              rangeUpper: 80000,
              stepPct: 0.5,
            },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'grid.sideMode',
                fieldPath: 'triggers[0].params.sideMode',
                status: 'open',
                priority: 'core',
                questionHint: '请确认网格方向（双向 / 只做多 / 只做空）。',
                affectsExecution: true,
              },
            ],
          },
        ],
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'grid.sideMode',
            reason: 'grid_params_missing',
            field: 'grid.sideMode',
            blocking: true,
            question: '请确认网格方向（双向 / 只做多 / 只做空）。',
            status: 'pending',
            slotId: buildSemanticSlotId({
              slotKey: 'grid.sideMode',
              fieldPath: 'triggers[0].params.sideMode',
            }),
            slotKey: 'grid.sideMode',
            fieldPath: 'triggers[0].params.sideMode',
          },
        ],
        summary: '已识别网格策略，但还缺少方向。',
      },
      {
        'grid.sideMode': 'bidirectional',
      },
    )

    expect(nextSemanticState).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          params: expect.objectContaining({
            sideMode: 'bidirectional',
          }),
          openSlots: expect.arrayContaining([
            expect.objectContaining({
              slotKey: 'grid.sideMode',
              status: 'locked',
              value: 'bidirectional',
            }),
          ]),
        }),
      ]),
    }))
  })

  it('surfaces inferred default risk bases for confirmation before compile', async () => {
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已完整，请确认逻辑图。',
        logic: {
          entryRules: ['价格突破阻力位入场'],
          exitRules: ['跌破支撑位出场'],
          symbols: ['BTCUSDT'],
          timeframes: ['1h'],
          riskRules: {
            exchange: 'okx',
            marketType: 'spot',
            positionPct: 10,
            stopLossPct: 5,
            takeProfitPct: 10,
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-inferred-risk-basis' })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '价格突破阻力位入场，跌破支撑位出场，止损5%，止盈10%',
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['价格突破阻力位入场'],
      exitRules: ['跌破支撑位出场'],
      riskRules: {
        exchange: 'okx',
        marketType: 'spot',
        positionPct: 10,
        stopLossPct: 5,
        takeProfitPct: 10,
      },
    } as any)

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('以下内容是系统推断')
    expect(result.assistantPrompt).toContain('risk.stopLossBasis')
    expect(result.assistantPrompt).toContain('risk.takeProfitBasis')
  })

  it('starts in checklist gate when llm says logic is ready', async () => {
    const dto: StartCodegenSessionDto = {
      userId: 'u1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 3分钟图上，3分钟跌1%做多，5分钟涨2%平多',
    }
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '策略逻辑已完整，请确认逻辑图。',
        logic: {
          entryRules: ['3m 内下跌 1% 做多'],
          exitRules: ['5m 内上涨 2% 平多'],
          entryRuleBases: { 'entry-1': 'prev_close' },
          exitRuleBases: { 'exit-1': 'prev_close' },
          riskRules: {
            exchange: 'okx',
            marketType: 'perp',
            positionPct: 10,
            stopLossPct: 5,
            stopLossBasis: 'entry_avg_price',
            takeProfitPct: 10,
            takeProfitBasis: 'entry_avg_price',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's2' })

    const result = await service.startSession(dto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.specDesc).toBeTruthy()
    expect(result.canonicalDigest).toMatch(/^sha256:/)
    expect(result.specDesc).toEqual(expect.objectContaining({
      viewType: 'canonical-semantic-view.v1',
      canonicalDigest: result.canonicalDigest,
      confirmation: expect.objectContaining({
        required: true,
        digest: result.canonicalDigest,
      }),
    }))
    expect(result.assistantPrompt).toContain('确认逻辑图')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      semanticState: expect.objectContaining({
        version: 1,
        triggers: expect.arrayContaining([
          expect.objectContaining({
            key: 'price.percent_change',
            phase: 'entry',
          }),
          expect.objectContaining({
            key: 'price.percent_change',
            phase: 'exit',
          }),
        ]),
        contextSlots: expect.objectContaining({
          exchange: expect.objectContaining({
            value: 'okx',
            status: 'locked',
          }),
          symbol: expect.objectContaining({
            value: 'BTCUSDT',
            status: 'locked',
          }),
          marketType: expect.objectContaining({
            value: 'perp',
            status: 'locked',
          }),
        }),
      }),
    }))
  })

  it('starts in checklist gate for the exact raw price-change path without falling back to legacy entry and exit missing reasons', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's2-raw-price-change-exact' })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '策略逻辑已完整，请确认逻辑图。',
        logic: {
          entryRules: ['3分钟之内跌百分1买入'],
          exitRules: ['15分钟之内涨百分2卖出'],
          riskRules: { exchange: 'okx', marketType: 'perp', positionPct: 10 },
        },
      }),
    })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金',
    })

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.specDesc).toBeTruthy()
    expect(result.canonicalDigest).toMatch(/^sha256:/)
    expect(result.specDesc).toEqual(expect.objectContaining({
      confirmation: expect.objectContaining({
        required: true,
      }),
    }))
    expect(result.clarificationState?.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'missing_entry_rules' }),
      expect.objectContaining({ reason: 'missing_exit_rules' }),
    ]))
  })

  it('starts in checklist gate for the exact Bollinger path without falling back to legacy entry and exit missing reasons', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's2-bollinger-exact' })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '策略逻辑已完整，请确认逻辑图。',
        logic: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
          entryRules: ['K线收盘后确认突破布林带(30,2.5)上轨时做空'],
          exitRules: ['价格回到布林带中轨(MA30)时平空'],
          riskRules: {
            exchange: 'okx',
            marketType: 'perp',
            positionPct: 10,
          },
        },
      }),
    })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '在ok交易所 我想在btc-usdt-swap 15分钟布林带 上轨做空 下轨做多 单笔百分10资金',
    })

    expect(result.clarificationState?.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'missing_entry_rules' }),
      expect.objectContaining({ reason: 'missing_exit_rules' }),
    ]))
    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.assistantPrompt).toContain('确认逻辑图')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({
            key: 'bollinger.touch_upper',
            phase: 'entry',
            sideScope: 'short',
          }),
          expect.objectContaining({
            key: 'bollinger.touch_middle',
            phase: 'exit',
            sideScope: 'short',
          }),
        ]),
      }),
      clarificationState: expect.objectContaining({
        status: 'CLEAR',
      }),
    }))
  })

  it('does not reopen execution-context prompts once the staging price-change transcript has locked runtime context', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-staging-price-change-repro' })
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '策略逻辑已完整，请确认逻辑图。',
        logic: {
          entryRules: ['3分钟之内跌1%买入'],
          exitRules: ['15分钟之内涨2%卖出'],
          riskRules: {
            exchange: 'okx',
            marketType: 'spot',
            positionPct: 10,
            stopLossPct: 5,
            takeProfitPct: 10,
          },
        },
      }),
    })

    const started = await service.startSession({
      userId: 'u1',
      initialMessage: '在 OKX 现货市场里，3 分钟内跌 1% 买入，15 分钟内涨 2% 卖出，止损 5%，止盈 10%，单笔使用 10% 资金。',
    })

    expect(started.status).toBe('DRAFTING')
    expect(started.assistantPrompt).toContain('请确认策略交易标的')

    const createdSession = buildPersistedSessionSnapshot(
      's-staging-price-change-repro',
      mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, unknown>,
      {
        clarificationState: started.clarificationState,
        latestSpecDesc: started.specDesc ?? null,
        semanticState: (mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, unknown>).semanticState,
      },
    )

    mockRepo.findById.mockResolvedValueOnce({
      ...createdSession,
      updatedAt: '2026-04-17T10:00:00.000Z',
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
      }),
    })

    const afterSymbol = await service.continueSession('s-staging-price-change-repro', {
      userId: 'u1',
      message: 'BTCUSDT',
      clarificationAnswers: {
        'executionContext.symbol': 'BTCUSDT',
      },
    } as ContinueCodegenSessionDto)

    expect(afterSymbol.status).toBe('CHECKLIST_GATE')
    expect(afterSymbol.canonicalDigest).toMatch(/^sha256:/)
    expect(afterSymbol.assistantPrompt).not.toContain('请确认策略交易标的')
    expect(afterSymbol.assistantPrompt).not.toContain('请确认策略主周期')
    expect(afterSymbol.clarificationState?.items).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
        key: 'executionContext.symbol',
        status: 'pending',
      }),
    ]))
    expect(afterSymbol.clarificationState?.items).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
        key: 'executionContext.symbol',
        status: 'pending',
      }),
      expect.objectContaining({
        key: 'executionContext.timeframe',
        status: 'pending',
      }),
    ]))
  })

  it('does not regress the staging dual-side Bollinger prompt into a compileability blocker', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-staging-bollinger-repro' })
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        logic: completeChecklist({
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
          entryRules: ['K线收盘后确认突破布林带(20,2)上轨时做空', 'K线收盘后确认突破布林带(20,2)下轨时做多'],
          exitRules: ['价格回到布林带中轨(MA20)时平仓'],
          riskRules: {
            exchange: 'okx',
            marketType: 'perp',
            positionPct: 10,
          },
        }),
      }),
    })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: 'OKX 合约 BTCUSDT 15m，价格触及/突破布林带(20,2)上轨时做空，触及/突破下轨时做多；多单在价格回到布林带中轨(MA20)时平仓，空单在价格跌破布林带中轨(MA20)时平仓；单笔仓位 10%。',
    })

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.assistantPrompt).toContain('请确认是否按此逻辑生成')
    expect(result.assistantPrompt).not.toContain('请补充入场和出场条件')
    expect(result.assistantPrompt).not.toContain('当前规则还不能稳定生成脚本')
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'CLEAR',
    }))
  })

  it('does not regress the staging bidirectional grid prompt into a checklist-era compileability blocker', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-staging-grid-repro' })
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        logic: completeChecklist({
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
          grid: {
            lower: 60000,
            upper: 80000,
            stepPct: 0.5,
            sideMode: 'bidirectional',
          },
          riskRules: {
            exchange: 'okx',
            marketType: 'perp',
            positionPct: 10,
            stopLossPct: 5,
            stopLossBasis: 'entry_avg_price',
            takeProfitPct: 10,
            takeProfitBasis: 'entry_avg_price',
          },
        }),
      }),
    })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈。',
    })

    expect(result.status === 'CHECKLIST_GATE' || result.status === 'DRAFTING').toBe(true)
    expect(result.assistantPrompt).not.toContain('未识别可编译入场规则')
    expect(result.assistantPrompt).not.toContain('请补充能明确落成主链规则的入场/出场条件')
    expect(result.clarificationState?.items).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ reason: 'missing_entry_rules' }),
      expect.objectContaining({ reason: 'missing_exit_rules' }),
    ]))
  })

  it('uses server-side semantic summary instead of planner free text when grid clarification closes into checklist gate', async () => {
    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-grid-confirmation-copy',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        grid: {
          lower: 60000,
          upper: 80000,
          sideMode: 'bidirectional',
        },
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'grid.stepPct',
            reason: 'grid_params_missing',
            field: 'grid.stepPct',
            blocking: true,
            question: '请确认网格步长（例如每格 0.5%）。',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    }))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '我当前理解的策略是：在 OKX 交易 BTCUSDT 永续合约，15m 周期，采用 60000-80000 的双向网格，步长 0.5%，单笔使用 10% 资金，仅做多，按入场均价亏损 5% 止损、盈利 10% 止盈；请确认以上理解是否正确。',
      }),
    })

    const result = await service.continueSession('s-grid-confirmation-copy', {
      userId: 'u1',
      message: '0.5%',
      clarificationAnswers: {
        'grid.stepPct': '0.5%',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.assistantPrompt).toContain('双向网格')
    expect(result.assistantPrompt).not.toContain('仅做多')
    expect(result.assistantPrompt).toContain('请确认是否按此逻辑生成')
  })

  it('keeps MA golden case stable across conversation artifacts', async () => {
    const started = await startGoldenCase({
      sessionId: 's-golden-ma',
      message: maGoldenCase.message,
      plannerLogic: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['收盘确认价格突破长期均线（50）时买入'],
        exitRules: ['收盘确认价格跌破短期均线（10）时卖出'],
        riskRules: {
          exchange: 'okx',
          marketType: 'spot',
          positionPct: 10,
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
        },
      }),
    })

    const createdSession = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any> | undefined
    const createdChecklist = createdSession ? readPersistedChecklist(createdSession) : {}

    expect(started.status).toBe('CHECKLIST_GATE')
    expect(started.assistantPrompt).not.toContain('存在暂不支持的规则片段')
    expect(createdChecklist.entryRules).toContain('收盘确认价格突破长期均线（50）时买入')
    expect(createdChecklist.exitRules).toContain('收盘确认价格跌破短期均线（10）时卖出')
    expect(createdChecklist.entryRules).not.toContain('满足入场条件后开仓')
    expect(createdChecklist.exitRules).not.toContain('满足出场条件后平仓')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({
            key: 'indicator.above',
            params: expect.objectContaining({
              'reference.period': 50,
            }),
          }),
          expect.objectContaining({
            key: 'indicator.below',
            params: expect.objectContaining({
              'reference.period': 10,
            }),
          }),
        ]),
      }),
    }))
  })

  it('keeps Bollinger golden case stable across conversation artifacts', async () => {
    await startGoldenCase({
      sessionId: 's-golden-bollinger',
      message: bollingerGoldenCase.message,
      plannerLogic: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['收盘价突破上轨时做空'],
        exitRules: ['价格回到中轨（30日均线）时平空'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
        },
      }),
    })

    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      latestSpecDesc: expect.objectContaining({
        canonicalDigest: expect.stringMatching(bollingerGoldenCase.expectedDigestPattern),
        rules: expect.arrayContaining([
          expect.objectContaining({
            condition: expect.objectContaining({ key: 'bollinger.upper_break' }),
          }),
          expect.objectContaining({
            condition: expect.objectContaining({ key: 'bollinger.middle_revert' }),
          }),
        ]),
      }),
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({ key: 'bollinger.touch_middle', phase: 'exit' }),
        ]),
      }),
    }))
  })

  it('projects short-side MA semantic triggers back into checklist rules without rewriting them into long actions', () => {
    const projected = (service as any).projectLegacyChecklistFromSemanticState({
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry-short-ma',
          key: 'indicator.below',
          phase: 'entry',
          params: {
            indicator: 'ma',
            referenceRole: 'short_term',
            'reference.period': 20,
            confirmationMode: 'close_confirm',
          },
          sideScope: 'short',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'exit-short-ma',
          key: 'indicator.above',
          phase: 'exit',
          params: {
            indicator: 'ma',
            referenceRole: 'long_term',
            'reference.period': 50,
            confirmationMode: 'close_confirm',
          },
          sideScope: 'short',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [
        { id: 'action-open-short', key: 'open_short', status: 'locked', source: 'user_explicit' },
        { id: 'action-close-short', key: 'close_short', status: 'locked', source: 'user_explicit' },
      ],
      risk: [],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-15T10:00:00.000Z',
    }, {
      entryRules: ['短均线下穿长均线（死叉）时做空'],
      exitRules: ['短均线上穿长均线（金叉）时平空'],
    })

    expect(projected.entryRules).toEqual(['收盘确认价格跌破短期均线（20）时做空'])
    expect(projected.exitRules).toEqual(['收盘确认价格突破长期均线（50）时平空'])
  })

  it('keeps semantic MA rules when projectLegacyChecklistFromSemanticState projects over generic checklist placeholders', () => {
    const projected = (service as any).projectLegacyChecklistFromSemanticState({
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry-ma',
          key: 'indicator.above',
          phase: 'entry',
          params: {
            indicator: 'ma',
            referenceRole: 'long_term',
            'reference.period': 50,
          },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
            {
              slotKey: 'confirmationMode.entry',
              fieldPath: 'triggers[0].params.confirmationMode',
              status: 'open',
              priority: 'core',
              questionHint: '突破按收盘确认还是盘中触发？',
              affectsExecution: true,
            },
          ],
        },
      ],
      actions: [],
      risk: [],
      position: null,
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-04-16T10:00:00.000Z',
    }, {
      entryRules: ['满足入场条件后开仓'],
      exitRules: ['满足出场条件后平仓'],
    })

    expect(projected.entryRules).toEqual(expect.arrayContaining([
      expect.stringContaining('长期均线'),
    ]))
    expect(projected.entryRules).not.toEqual(expect.arrayContaining([
      '满足入场条件后开仓',
    ]))
  })

  it('does not let a context clarification item overtake the active semantic slot in mergeSemanticClarificationState', () => {
    const result = (service as any).mergeSemanticClarificationState({
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry-ma',
          key: 'indicator.above',
          phase: 'entry',
          params: {
            indicator: 'ma',
            referenceRole: 'long_term',
            'reference.period': 50,
          },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
            {
              slotKey: 'confirmationMode.entry',
              fieldPath: 'triggers[0].params.confirmationMode',
              status: 'open',
              priority: 'core',
              questionHint: '突破按收盘确认还是盘中触发？',
              affectsExecution: true,
            },
          ],
        },
      ],
      actions: [],
      risk: [],
      position: null,
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          status: 'open',
          priority: 'context',
          questionHint: '请确认交易所（binance / okx / hyperliquid）。',
          affectsExecution: true,
        },
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-16T10:00:00.000Z',
    }, {
      status: 'NEEDS_CLARIFICATION',
      items: [
        {
          key: 'executionContext.exchange',
          reason: 'missing_exchange',
          field: 'exchange',
          blocking: true,
          question: '请确认交易所（binance / okx / hyperliquid）。',
          status: 'pending',
        },
      ],
      summary: '已识别部分条件，但仍未完整。',
    })

    expect(result.items[0]).toEqual(expect.objectContaining({
      key: 'semantic.confirmationMode.entry',
      question: '突破按收盘确认还是盘中触发？',
    }))
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'executionContext.exchange',
        question: '请确认交易所（binance / okx / hyperliquid）。',
        status: 'pending',
      }),
    ]))
  })

  it('suppresses legacy grid fallback items when equivalent semantic grid slots are active', () => {
    const result = (service as any).mergeSemanticClarificationState({
      version: 1,
      families: ['grid.range_rebalance'],
      triggers: [
        {
          id: 'grid-entry',
          key: 'grid.range_rebalance',
          phase: 'entry',
          params: {
            sideMode: 'bidirectional',
            breakoutAction: 'pause',
          },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
            {
              slotKey: 'grid.range.lower',
              fieldPath: 'triggers[0].params.rangeLower',
              status: 'open',
              priority: 'core',
              questionHint: '请确认网格区间下界。',
              affectsExecution: true,
            },
            {
              slotKey: 'grid.stepPct',
              fieldPath: 'triggers[0].params.stepPct',
              status: 'open',
              priority: 'core',
              questionHint: '请确认每格步长（例如 0.5%）。',
              affectsExecution: true,
            },
          ],
        },
      ],
      actions: [],
      risk: [],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-16T10:00:00.000Z',
    }, {
      status: 'NEEDS_CLARIFICATION',
      items: [
        {
          key: 'grid.lower',
          reason: 'grid_params_missing',
          field: 'grid.lower',
          blocking: true,
          question: '请确认网格区间下界。',
          status: 'pending',
        },
        {
          key: 'grid.stepPct',
          reason: 'grid_params_missing',
          field: 'grid.stepPct',
          blocking: true,
          question: '请确认每格步长（例如 0.5%）。',
          status: 'pending',
        },
      ],
      summary: '已识别网格策略，但还缺少参数。',
    })

    expect(result.items).toEqual([
      expect.objectContaining({
        key: 'grid.range.lower',
        question: '请确认网格区间下界。',
      }),
      expect.objectContaining({
        key: 'grid.stepPct',
        question: '请确认每格步长（例如 0.5%）。',
      }),
    ])
  })

  it('keeps newly added semantic triggers when a persisted semanticState session gains another rule', () => {
    const currentSemanticState = buildLockedMaSemanticState({
      triggers: [
        {
          id: 'entry-ma-50',
          key: 'indicator.above',
          phase: 'entry',
          params: {
            indicator: 'ma',
            referenceRole: 'long_term',
            'reference.period': 50,
            confirmationMode: 'close_confirm',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [
        { id: 'action-open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
      ],
      position: null,
    })

    const checklist = {
      entryRules: [
        '收盘确认价格突破长期均线（50）时买入',
        '收盘确认价格突破长期均线（200）时买入',
      ],
      exitRules: ['收盘确认价格跌破短期均线（10）时卖出'],
    }
    const mergedSemanticState = (service as any).mergeChecklistIntoSemanticState(currentSemanticState, checklist)
    const projectedChecklist = (service as any).projectLegacyChecklistFromSemanticState(mergedSemanticState, checklist)

    expect(mergedSemanticState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        params: expect.objectContaining({ 'reference.period': 50 }),
      }),
      expect.objectContaining({
        phase: 'entry',
        params: expect.objectContaining({ 'reference.period': 200 }),
      }),
      expect.objectContaining({
        phase: 'exit',
        params: expect.objectContaining({ 'reference.period': 10 }),
      }),
    ]))
    expect(projectedChecklist.entryRules).toEqual(expect.arrayContaining([
      '收盘确认价格突破长期均线（50）时买入',
      '收盘确认价格突破长期均线（200）时买入',
    ]))
    expect(projectedChecklist.exitRules).toEqual([
      '收盘确认价格跌破短期均线（10）时卖出',
    ])
  })

  it('preserves the correct open MA trigger identity when multiple same-phase same-key triggers survive merge', () => {
    const currentSemanticState = buildLockedMaSemanticState({
      triggers: [
        {
          id: 'entry-ma-long',
          key: 'indicator.above',
          phase: 'entry',
          params: {
            indicator: 'ma',
            referenceRole: 'long_term',
            'reference.period': 50,
          },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
            {
              slotKey: 'confirmationMode.entry.long',
              fieldPath: 'triggers[0].params.confirmationMode',
              status: 'open',
              priority: 'core',
              questionHint: '长期均线突破按收盘确认还是盘中触发？',
              affectsExecution: true,
            },
          ],
        },
        {
          id: 'entry-ma-short',
          key: 'indicator.above',
          phase: 'entry',
          params: {
            indicator: 'ma',
            referenceRole: 'short_term',
            'reference.period': 20,
          },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
            {
              slotKey: 'confirmationMode.entry.short',
              fieldPath: 'triggers[1].params.confirmationMode',
              status: 'open',
              priority: 'core',
              questionHint: '短期均线突破按收盘确认还是盘中触发？',
              affectsExecution: true,
            },
          ],
        },
      ],
      actions: [
        { id: 'action-open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
      ],
      position: null,
    })

    const mergedSemanticState = (service as any).mergeChecklistIntoSemanticState(currentSemanticState, {
      entryRules: [
        '价格突破长期均线（50）时买入',
        '价格突破短期均线（20）时买入',
      ],
      exitRules: ['收盘确认价格跌破短期均线（10）时卖出'],
    })

    expect(mergedSemanticState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-ma-long',
        phase: 'entry',
        key: 'indicator.above',
        params: expect.objectContaining({
          referenceRole: 'long_term',
          'reference.period': 50,
        }),
        openSlots: expect.arrayContaining([
          expect.objectContaining({
            slotKey: 'confirmationMode.entry.long',
            fieldPath: 'triggers[0].params.confirmationMode',
          }),
        ]),
      }),
      expect.objectContaining({
        id: 'entry-ma-short',
        phase: 'entry',
        key: 'indicator.above',
        params: expect.objectContaining({
          referenceRole: 'short_term',
          'reference.period': 20,
        }),
        openSlots: expect.arrayContaining([
          expect.objectContaining({
            slotKey: 'confirmationMode.entry.short',
            fieldPath: 'triggers[1].params.confirmationMode',
          }),
        ]),
      }),
    ]))
  })

  it('does not reuse one persisted open trigger across multiple newly derived siblings', () => {
    const currentSemanticState = buildLockedMaSemanticState({
      triggers: [
        {
          id: 'entry-ma-generic',
          key: 'indicator.above',
          phase: 'entry',
          params: {
            indicator: 'ma',
          },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
            {
              slotKey: 'reference.period.entry',
              fieldPath: 'triggers[0].params.reference.period',
              status: 'open',
              priority: 'core',
              questionHint: '长期均线是多少？',
              affectsExecution: true,
            },
          ],
        },
      ],
      actions: [
        { id: 'action-open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
      ],
      position: null,
    })

    const mergedSemanticState = (service as any).mergeChecklistIntoSemanticState(currentSemanticState, {
      entryRules: [
        '价格突破长期均线（50）时买入',
        '价格突破短期均线（20）时买入',
      ],
      exitRules: ['收盘确认价格跌破短期均线（10）时卖出'],
    })

    const reusedIds = mergedSemanticState.triggers
      .filter((trigger: any) => trigger.phase === 'entry' && trigger.key === 'indicator.above')
      .map((trigger: any) => trigger.id)
      .filter((id: string) => id === 'entry-ma-generic')

    expect(reusedIds).toHaveLength(1)
  })

  it('rebuilds semantic state from updated checklist without retaining stale locked state-gate triggers', () => {
    const currentSemanticState = buildLockedBollingerSemanticState({
      families: ['single-leg', 'state-gated'],
      triggers: [
        {
          id: 'entry-bollinger-upper',
          key: 'bollinger.touch_upper',
          phase: 'entry',
          params: {
            indicator: 'bollinger',
            period: 20,
            stdDev: 2,
            confirmationMode: 'close_confirm',
          },
          sideScope: 'short',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'regime-gate-range',
          key: 'market.regime',
          phase: 'gate',
          params: {
            value: 'range',
            mode: 'hard_gate',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
    })

    const checklist = completeChecklist({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['K线收盘后确认突破布林带(20,2)上轨时做空'],
      exitRules: ['价格回到布林带中轨(MA20)时平空'],
      stateGates: {
        marketRegime: 'trend',
      },
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    })

    const mergedSemanticState = (service as any).mergeChecklistIntoSemanticState(currentSemanticState, checklist)

    expect(mergedSemanticState.triggers.filter((trigger: any) => trigger.phase === 'gate')).toEqual([
      expect.objectContaining({
        key: 'market.regime',
        params: expect.objectContaining({ value: 'trend' }),
      }),
    ])
    expect(mergedSemanticState.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'market.regime',
        params: expect.objectContaining({ value: 'range' }),
      }),
    ]))
  })

  it('stays in drafting when planner says logicReady is false even with a detailed message', async () => {
    const dto: StartCodegenSessionDto = {
      userId: 'u1',
      initialMessage: [
        '平台：OKX',
        '类型：现货',
        '交易对：SOL/USDT',
        '账户余额：1000 USDT',
        '开仓：市价买入 100 USDT',
        '交易周期：5 分钟',
        '止盈：涨幅达到 2% 市价卖出',
        '止损：最大亏损 10% 市价卖出',
      ].join('\n'),
    }
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '为了完善策略，请补充短均线和长均线周期。',
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-execution-template' })

    const result = await service.startSession(dto)

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('请确认策略交易标的')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      status: 'DRAFTING',
      semanticState: expect.objectContaining({
        contextSlots: expect.objectContaining({
          exchange: expect.objectContaining({ value: 'okx' }),
          marketType: expect.objectContaining({ value: 'spot' }),
          timeframe: expect.objectContaining({ value: '5m' }),
        }),
      }),
    }))
  })

  it('does not infer ma rules from pure price-action message in a new session', async () => {
    const dto: StartCodegenSessionDto = {
      userId: 'u1',
      initialMessage: '在BTCUSDT的3m和15m周期，价格收盘高于关键阻力位入场，跌破最近支撑位出场',
    }
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '继续补充风险参数。',
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-price-action' })

    await service.startSession(dto)

    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({ key: 'price.breakout_up', phase: 'entry' }),
          expect.objectContaining({ key: 'price.breakout_down', phase: 'exit' }),
        ]),
      }),
      clarificationState: expect.objectContaining({
        status: 'NEEDS_CLARIFICATION',
        items: expect.arrayContaining([
          expect.objectContaining({ key: 'executionContext.exchange' }),
        ]),
      }),
    }))
  })

  it('keeps asking for a complete trading pair when planner only returns a base asset symbol', async () => {
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '策略逻辑已完整，请确认逻辑图。',
        logic: {
          symbols: ['BTC'],
          timeframes: ['3m', '15m'],
          entryRules: ['3分钟之内跌1%买入'],
          exitRules: ['15分钟之内涨2%卖出'],
          riskRules: {
            exchange: 'okx',
            marketType: 'spot',
            positionPct: 10,
            stopLossPct: 5,
            takeProfitPct: 10,
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-base-asset-only' })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金 止损5% 止盈10%',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('请确认策略交易标的')
    expect(result.assistantPrompt).not.toContain('请确认是否按此逻辑生成')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      semanticState: expect.objectContaining({
        contextSlots: expect.objectContaining({
          symbol: expect.objectContaining({
            status: 'open',
          }),
        }),
      }),
    }))
  })

  it('extracts generic moving-average breakout rules for the historical MA baseline sentence', () => {
    const inferred = (service as any).inferChecklistFromMessage(
      '当价格突破一条长期均线时买入，跌破短期均线时卖出',
    )

    expect(inferred.entryRules).toEqual(['价格突破长期均线时买入'])
    expect(inferred.exitRules).toEqual(['价格跌破短期均线时卖出'])
  })

  it('returns strategyInstanceId in session snapshot response', async () => {
    mockRepo.findLatestBySessionId.mockResolvedValue({
      id: 'snapshot-session-1',
      consistencyReport: {
        status: 'PASSED',
      },
      paramsSnapshot: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
      },
      lockedParams: {
        positionPct: 10,
      },
      strategyConfig: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      backtestConfigDefaults: {
        initialCash: 10000,
        leverage: 1,
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
        allowPartial: false,
      },
      deploymentExecutionDefaults: {
        leverage: 1,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'gtc',
      },
      deploymentExecutionConstraints: {
        supportedPriceSources: ['close'],
        supportedOrderTypes: ['market'],
        supportedTimeInForce: ['gtc'],
        defaultLeverage: 1,
      },
      executionPolicy: {
        allowPartialFill: false,
      },
    })
    mockRepo.findById.mockResolvedValue({
      id: 's-snapshot',
      userId: 'u1',
      status: 'PUBLISHED',
      checklist: {},
      constraintPack: {},
      latestDraftCode: 'return null',
      latestSpecDesc: {
        publishedSnapshotId: 'snapshot-session-old',
        consistencyReport: { status: 'FAILED' },
      },
      strategyInstanceId: 'instance-snapshot-1',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'rule.entry.upper_band.side_scope',
            reason: 'direction_ambiguous',
            field: 'positionMode',
            blocking: true,
            question: '突破上轨时是只做空还是也允许做多？',
            status: 'pending',
          },
          {
            key: 'riskRules.earlyStop.action',
            reason: 'ambiguous_risk_effect',
            field: 'riskRules.earlyStop.action',
            blocking: true,
            allowedAnswers: ['reduce', 'close'],
            question: '轨外连续3根K线时，应执行减仓还是直接平仓？',
            status: 'pending',
          },
        ],
      },
      rejectReason: 'strategy detail reject reason',
    })

    const result = await service.getSession('s-snapshot', 'u1')

    expect(result.status).toBe('PUBLISHED')
    expect(result.strategyInstanceId).toBe('instance-snapshot-1')
    expect(result.clarificationState).toEqual({
      status: 'NEEDS_CLARIFICATION',
      items: [
        expect.objectContaining({
          key: 'rule.entry.upper_band.side_scope',
          field: 'positionMode',
          blocking: true,
          status: 'pending',
        }),
        expect.objectContaining({
          key: 'riskRules.earlyStop.action',
          field: 'riskRules.earlyStop.action',
          blocking: true,
          allowedAnswers: ['reduce', 'close'],
        }),
      ],
    })
    expect(result.publishedSnapshotId).toBe('snapshot-session-1')
    expect(result.rejectReason).toBe('strategy detail reject reason')
    expect(result.publishedSnapshotParamValues).toEqual({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      baseTimeframe: '15m',
      positionPct: 10,
      backtestAllowPartial: false,
    })
    expect(result.publishedSnapshotStrategyConfig).toEqual({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      baseTimeframe: '15m',
      positionPct: 10,
    })
    expect(result.publishedSnapshotBacktestConfigDefaults).toEqual({
      initialCash: 10000,
      leverage: 1,
      slippageBps: 10,
      feeBps: 5,
      priceSource: 'close',
      allowPartial: false,
    })
    expect(result.publishedSnapshotDeploymentExecutionDefaults).toEqual({
      leverage: 1,
      priceSource: 'close',
      orderType: 'market',
      timeInForce: 'gtc',
    })
    expect(result.publishedSnapshotDeploymentExecutionConstraints).toEqual({
      supportedPriceSources: ['close'],
      supportedOrderTypes: ['market'],
      supportedTimeInForce: ['gtc'],
      defaultLeverage: 1,
    })
    expect(result.publishedSnapshotCompatibilityMetadata).toEqual({
      isLegacySnapshot: false,
      missingBacktestConfigDefaults: false,
      missingDeploymentExecutionDefaults: false,
      missingDeploymentExecutionConstraints: false,
      requiresRepublishForBacktest: false,
      requiresRepublishForDeploy: false,
    })
    expect(result.consistencyReport).toEqual({ status: 'PASSED' })
  })

  it('marks published sessions as republish-required when formal snapshot projection is incomplete', async () => {
    mockRepo.findLatestBySessionId.mockResolvedValue({
      id: 'snapshot-legacy-1',
      consistencyReport: { status: 'PASSED' },
      paramsSnapshot: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        timeframe: '15m',
      },
      lockedParams: {
        positionPct: 10,
      },
      strategyConfig: null,
      backtestConfigDefaults: null,
      deploymentExecutionDefaults: null,
      deploymentExecutionConstraints: null,
      executionPolicy: {
        allowPartialFill: false,
      },
    })
    mockRepo.findById.mockResolvedValue({
      id: 's-legacy-snapshot',
      userId: 'u1',
      status: 'PUBLISHED',
      checklist: {},
      constraintPack: {},
      latestDraftCode: 'return null',
      latestSpecDesc: null,
      strategyInstanceId: 'instance-legacy-1',
      clarificationState: null,
      rejectReason: null,
    })

    const result = await service.getSession('s-legacy-snapshot', 'u1')

    expect(result.publishedSnapshotId).toBe('snapshot-legacy-1')
    expect(result.publishedSnapshotStrategyConfig).toBeNull()
    expect(result.publishedSnapshotBacktestConfigDefaults).toBeNull()
    expect(result.publishedSnapshotDeploymentExecutionDefaults).toBeNull()
    expect(result.publishedSnapshotDeploymentExecutionConstraints).toBeNull()
    expect(result.publishedSnapshotCompatibilityMetadata).toEqual({
      isLegacySnapshot: true,
      missingBacktestConfigDefaults: true,
      missingDeploymentExecutionDefaults: true,
      missingDeploymentExecutionConstraints: true,
      requiresRepublishForBacktest: true,
      requiresRepublishForDeploy: true,
    })
  })

  it('keeps legacy clarification items without field/blocking via backward-compatible normalization', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-invalid-clarification',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {},
      constraintPack: {},
      latestDraftCode: null,
      latestSpecDesc: null,
      strategyInstanceId: null,
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'entry.side.1',
            reason: 'missing_side_scope',
            question: '突破上轨时是只做空，还是也允许做多？',
            allowedAnswers: ['long', 'short'],
            status: 'pending',
          },
          {
            key: 'riskRules.earlyStop.action',
            reason: 'ambiguous_risk_effect',
            question: '轨外连续3根K线时，应执行减仓还是直接平仓？',
            status: 'pending',
          },
        ],
      },
      rejectReason: null,
    })

    const result = await service.getSession('s-invalid-clarification', 'u1')

    expect(result.clarificationState).toEqual({
      status: 'NEEDS_CLARIFICATION',
      items: [
        expect.objectContaining({
          key: 'entry.side.1',
          reason: 'missing_side_scope',
          field: 'positionMode',
          blocking: true,
          allowedAnswers: ['long', 'short'],
          status: 'pending',
        }),
        expect.objectContaining({
          key: 'riskRules.earlyStop.action',
          reason: 'ambiguous_risk_effect',
          field: 'riskRules.earlyStop.action',
          blocking: true,
          allowedAnswers: ['reduce', 'close'],
          status: 'pending',
        }),
      ],
    })
  })

  it('hides semantic confirmation fields when blocking clarification items remain in snapshot', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-blocked-clarification',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        entryRules: ['突破布林带上轨交易'],
        exitRules: ['价格回到布林带中轨(MA20)时平仓'],
      },
      constraintPack: {},
      latestDraftCode: null,
      latestSpecDesc: {
        viewType: 'canonical-semantic-view.v1',
        canonicalDigest: 'sha256:blocked',
        confirmation: {
          required: true,
          digest: 'sha256:blocked',
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'entry.side.1',
            reason: 'missing_side_scope',
            field: 'positionMode',
            blocking: true,
            question: '突破上轨时是只做空，还是也允许做多？',
            allowedAnswers: ['long', 'short'],
            status: 'pending',
          },
        ],
      },
      strategyInstanceId: null,
      rejectReason: null,
    })

    const result = await service.getSession('s-blocked-clarification', 'u1')

    expect((result as any).clarificationGate).toEqual({
      blocked: true,
      summary: null,
      items: [
        expect.objectContaining({
          key: 'entry.side.1',
          status: 'pending',
          blocking: true,
        }),
      ],
      pendingItems: [
        expect.objectContaining({
          key: 'entry.side.1',
          status: 'pending',
          blocking: true,
        }),
      ],
    })
    expect(result.specDesc).toBeNull()
    expect(result.canonicalDigest).toBeNull()
    expect(result.semanticGraph).toBeNull()
  })

  it('applies clarificationAnswers before semantic readiness evaluation', async () => {
    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-clarification-answers',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
        riskRules: {
          marketType: 'perp',
          positionPct: 10,
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'executionContext.exchange',
            reason: 'missing_exchange',
            field: 'exchange',
            blocking: true,
            question: '请确认交易所（binance / okx / hyperliquid）。',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    }))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      }),
    })

    const result = await service.continueSession('s-clarification-answers', {
      userId: 'u1',
      message: '继续',
      clarificationAnswers: {
        'executionContext.exchange': 'okx',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'CLEAR',
    }))
    expect((result as any).clarificationGate).toEqual(expect.objectContaining({
      blocked: false,
    }))
    expect(result.canonicalDigest).toMatch(/^sha256:/)
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-clarification-answers', expect.objectContaining({
      status: 'CHECKLIST_GATE',
      semanticState: expect.objectContaining({
        contextSlots: expect.objectContaining({
          exchange: expect.objectContaining({
            value: 'okx',
            status: 'locked',
          }),
        }),
      }),
      latestSpecDesc: expect.objectContaining({
        canonicalDigest: expect.stringMatching(/^sha256:/),
      }),
    }))
    expect(result.clarificationState?.items).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
        key: 'executionContext.exchange',
        status: 'pending',
      }),
    ]))
  })

  it('preserves inferred default risk-basis metadata after context clarification so confirmation remains required', async () => {
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-clarification-inferred-defaults',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
        riskRules: {
          marketType: 'perp',
          positionPct: 10,
          stopLossPct: 5,
          takeProfitPct: 10,
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'executionContext.exchange',
            reason: 'missing_exchange',
            field: 'exchange',
            blocking: true,
            question: '请确认交易所（binance / okx / hyperliquid）。',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    })
    expect(sessionFixture.latestSpecDesc).toEqual(expect.objectContaining({
      normalizedIntent: expect.objectContaining({
        risk: expect.arrayContaining([
          expect.objectContaining({
            key: 'risk.stop_loss_pct',
            source: 'system_default',
            params: expect.objectContaining({
              basis: 'entry_avg_price',
              basisSource: 'system_default',
            }),
          }),
          expect.objectContaining({
            key: 'risk.take_profit_pct',
            source: 'system_default',
            params: expect.objectContaining({
              basis: 'entry_avg_price',
              basisSource: 'system_default',
            }),
          }),
        ]),
      }),
    }))
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      }),
    })

    const result = await service.continueSession('s-clarification-inferred-defaults', {
      userId: 'u1',
      message: '继续',
      clarificationAnswers: {
        'executionContext.exchange': 'okx',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.assistantPrompt).not.toContain('请确认交易所')
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-clarification-inferred-defaults', expect.objectContaining({
      status: 'CHECKLIST_GATE',
      semanticState: expect.objectContaining({
        contextSlots: expect.objectContaining({
          exchange: expect.objectContaining({
            value: 'okx',
            status: 'locked',
          }),
        }),
      }),
      latestSpecDesc: expect.objectContaining({
        canonicalDigest: expect.stringMatching(/^sha256:/),
      }),
    }))
    expect(result.specDesc).toEqual(expect.objectContaining({
      confirmation: expect.objectContaining({
        required: true,
      }),
    }))
    expect(sessionFixture.latestSpecDesc).toEqual(expect.objectContaining({
      normalizedIntent: expect.objectContaining({
        risk: expect.arrayContaining([
          expect.objectContaining({
            key: 'risk.stop_loss_pct',
            source: 'system_default',
            params: expect.objectContaining({
              basis: 'entry_avg_price',
              basisSource: 'system_default',
            }),
          }),
          expect.objectContaining({
            key: 'risk.take_profit_pct',
            source: 'system_default',
            params: expect.objectContaining({
              basis: 'entry_avg_price',
              basisSource: 'system_default',
            }),
          }),
        ]),
      }),
    }))
    expect(result.clarificationState?.items).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
        key: 'executionContext.exchange',
        status: 'pending',
      }),
    ]))
  })

  it('keeps previously identified grid semantics when continueSession only adds timeframe', async () => {
    mockRepo.findById.mockResolvedValue(buildPersistedSessionSnapshot(
      's-grid-timeframe-followup',
      {
        checklist: {
          symbols: ['BTCUSDT'],
          riskRules: {
            exchange: 'okx',
            marketType: 'perp',
            positionPct: 10,
          },
          market: {
            exchange: 'okx',
            marketType: 'perp',
          },
        },
        semanticState: {
          version: 1,
          families: ['grid.range_rebalance'],
          triggers: [
            {
              id: 'grid-entry',
              key: 'grid.range_rebalance',
              phase: 'entry',
              sideScope: 'both',
              params: {
                rangeLower: 60000,
                rangeUpper: 80000,
                stepPct: 0.5,
                sideMode: 'bidirectional',
                recycle: true,
                breakoutAction: 'pause',
              },
              status: 'locked',
              source: 'user_explicit',
              openSlots: [],
            },
          ],
          actions: [],
          risk: [],
          position: {
            mode: 'fixed_ratio',
            value: 0.1,
            positionMode: 'long_only',
            status: 'locked',
            source: 'user_explicit',
          },
          contextSlots: {
            exchange: {
              slotKey: 'exchange',
              fieldPath: 'contextSlots.exchange',
              value: 'okx',
              status: 'locked',
              priority: 'context',
              questionHint: '请确认交易所（binance / okx / hyperliquid）。',
              affectsExecution: true,
            },
            symbol: {
              slotKey: 'symbol',
              fieldPath: 'contextSlots.symbol',
              value: 'BTCUSDT',
              status: 'locked',
              priority: 'context',
              questionHint: '请确认策略交易标的（例如 BTCUSDT）。',
              affectsExecution: true,
            },
            marketType: {
              slotKey: 'marketType',
              fieldPath: 'contextSlots.marketType',
              value: 'perp',
              status: 'locked',
              priority: 'context',
              questionHint: '请确认市场类型（现货或合约/perp）。',
              affectsExecution: true,
            },
            timeframe: {
              slotKey: 'timeframe',
              fieldPath: 'contextSlots.timeframe',
              status: 'open',
              priority: 'context',
              questionHint: '请确认策略主周期（例如 15m 或 1h）。',
              affectsExecution: true,
            },
          },
          normalizationNotes: [],
          updatedAt: '2026-04-16T10:00:00.000Z',
        },
        clarificationState: {
          status: 'NEEDS_CLARIFICATION',
          items: [
            {
              key: 'semantic.timeframe',
              reason: 'missing_timeframe',
              field: 'timeframe',
              blocking: true,
              question: '请确认策略主周期（例如 15m 或 1h）。',
              status: 'pending',
              slotId: buildSemanticSlotId({
                slotKey: 'timeframe',
                fieldPath: 'contextSlots.timeframe',
              }),
              slotKey: 'timeframe',
              fieldPath: 'contextSlots.timeframe',
            },
          ],
          summary: '已识别 grid.range_rebalance，但还缺少主周期。',
        },
      },
    ))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        logic: {},
        assistantPrompt: '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
      }),
    })

    const result = await service.continueSession('s-grid-timeframe-followup', {
      userId: 'u1',
      message: '15m',
      clarificationAnswers: {
        'semantic.timeframe': '15m',
      },
    } as any)

    expect(result.assistantPrompt).not.toContain('请补充至少一条明确的入场规则')
    expect(result.assistantPrompt).not.toContain('请确认网格区间下界')
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-grid-timeframe-followup',
      expect.objectContaining({
        semanticState: expect.objectContaining({
          triggers: expect.arrayContaining([
            expect.objectContaining({
              key: 'grid.range_rebalance',
              status: 'locked',
              params: expect.objectContaining({
                rangeLower: 60000,
                rangeUpper: 80000,
                stepPct: 0.5,
                breakoutAction: 'pause',
              }),
            }),
          ]),
          contextSlots: expect.objectContaining({
            timeframe: expect.objectContaining({
              value: '15m',
              status: 'locked',
            }),
          }),
        }),
      }),
    )
    expect(result.clarificationState?.items).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
        reason: 'missing_entry_rules',
      }),
      expect.objectContaining({
        reason: 'grid_params_missing',
      }),
      expect.objectContaining({
        reason: 'missing_timeframe',
        status: 'pending',
      }),
    ]))
  })

  it('does not regress the exact two-turn grid reproduction into missing exit rules after answering 15m', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-grid-exact-repro' })
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        logic: {},
        assistantPrompt: '逻辑图仍未完整，请继续补充。',
      }),
    })

    const startResult = await service.startSession({
      userId: 'u1',
      initialMessage: '在ok交易所 我想弄个网格策略 btc永续合约 在60000-80000的区间 每一格千分之5 不断低买高卖 单笔百分10资金',
    })

    const createdSession = buildPersistedSessionSnapshot(
      's-grid-exact-repro',
      mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, unknown>,
      {
        clarificationState: startResult.clarificationState,
        latestSpecDesc: startResult.specDesc ?? null,
        semanticState: (mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, unknown>).semanticState,
      },
    )

    mockRepo.findById.mockResolvedValue({
      ...createdSession,
      updatedAt: '2026-04-17T10:00:00.000Z',
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        logic: {},
        assistantPrompt: '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
      }),
    })

    const result = await service.continueSession('s-grid-exact-repro', {
      userId: 'u1',
      message: '15m',
      clarificationAnswers: {
        'semantic.timeframe': '15m',
      },
    } as ContinueCodegenSessionDto)

    expect(result.clarificationState?.items).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ reason: 'missing_exit_rules' }),
      expect.objectContaining({ reason: 'missing_entry_rules' }),
    ]))
  })

  it('does not regress the exact two-turn grid reproduction when timeframe is answered through executionContext.timeframe', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-grid-exact-repro-execution-context' })
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        logic: {},
        assistantPrompt: '逻辑图仍未完整，请继续补充。',
      }),
    })

    const startResult = await service.startSession({
      userId: 'u1',
      initialMessage: '在ok交易所 我想弄个网格策略 btc永续合约 在60000-80000的区间 每一格千分之5 不断低买高卖 单笔百分10资金',
    })

    const createdSession = buildPersistedSessionSnapshot(
      's-grid-exact-repro-execution-context',
      mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, unknown>,
      {
        clarificationState: {
          ...(startResult.clarificationState as unknown as Record<string, unknown>),
          items: [
            {
              key: 'executionContext.timeframe',
              reason: 'missing_timeframe',
              field: 'timeframe',
              blocking: true,
              question: '请确认策略主周期（例如 15m 或 1h）。',
              status: 'pending',
            },
          ],
        },
        latestSpecDesc: startResult.specDesc ?? null,
        semanticState: (mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, unknown>).semanticState,
      },
    )

    mockRepo.findById.mockResolvedValue({
      ...createdSession,
      updatedAt: '2026-04-17T10:00:00.000Z',
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        logic: {},
        assistantPrompt: '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
      }),
    })

    const result = await service.continueSession('s-grid-exact-repro-execution-context', {
      userId: 'u1',
      message: '15m',
      clarificationAnswers: {
        'executionContext.timeframe': '15m',
      },
    } as ContinueCodegenSessionDto)

    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-grid-exact-repro-execution-context',
      expect.objectContaining({
        semanticState: expect.objectContaining({
          contextSlots: expect.objectContaining({
            timeframe: expect.objectContaining({
              value: '15m',
              status: 'locked',
            }),
          }),
        }),
      }),
    )
    expect(result.clarificationState?.items).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ reason: 'missing_exit_rules' }),
      expect.objectContaining({ reason: 'missing_entry_rules' }),
    ]))
  })

  it('consumes 低买高卖 as grid side semantics after answering 15m instead of falling back to legacy entry and exit blockers', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-grid-exact-repro-three-turn' })
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        logic: {},
        assistantPrompt: '逻辑图仍未完整，请继续补充。',
      }),
    })

    const startResult = await service.startSession({
      userId: 'u1',
      initialMessage: '在ok交易所 我想弄个网格策略 btc永续合约 在60000-80000的区间 每一格千分之5 不断低买高卖 单笔百分10资金',
    })

    const createdSession = buildPersistedSessionSnapshot(
      's-grid-exact-repro-three-turn',
      mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, unknown>,
      {
        clarificationState: startResult.clarificationState,
        latestSpecDesc: startResult.specDesc ?? null,
        semanticState: (mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, unknown>).semanticState,
      },
    )

    mockRepo.findById.mockResolvedValueOnce({
      ...createdSession,
      updatedAt: '2026-04-17T10:00:00.000Z',
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        logic: {},
        assistantPrompt: '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
      }),
    })

    await service.continueSession('s-grid-exact-repro-three-turn', {
      userId: 'u1',
      message: '15m',
      clarificationAnswers: {
        'semantic.timeframe': '15m',
      },
    } as ContinueCodegenSessionDto)

    const afterTimeframeUpdate = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, unknown>

    mockRepo.findById.mockResolvedValueOnce(buildPersistedSessionSnapshot(
      's-grid-exact-repro-three-turn',
      createdSession,
      {
        ...afterTimeframeUpdate,
        updatedAt: '2026-04-17T10:01:00.000Z',
      },
    ))

    const result = await service.continueSession('s-grid-exact-repro-three-turn', {
      userId: 'u1',
      message: '低买高卖',
    } as ContinueCodegenSessionDto)

    expect(mockRepo.updateSession).toHaveBeenLastCalledWith(
      's-grid-exact-repro-three-turn',
      expect.objectContaining({
        semanticState: expect.objectContaining({
          triggers: expect.arrayContaining([
            expect.objectContaining({
              key: 'grid.range_rebalance',
              params: expect.objectContaining({
                rangeLower: 60000,
                rangeUpper: 80000,
                stepPct: 0.5,
                sideMode: 'bidirectional',
              }),
              openSlots: expect.not.arrayContaining([
                expect.objectContaining({ slotKey: 'grid.sideMode', status: 'open' }),
              ]),
            }),
          ]),
        }),
      }),
    )
    expect(result.clarificationState?.items).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ reason: 'missing_exit_rules' }),
      expect.objectContaining({ reason: 'missing_entry_rules' }),
    ]))
  })

  it('applies grid clarification answers into semantic snapshot and advances to the next grid slot', async () => {
    mockRepo.findById.mockResolvedValue(buildPersistedSessionSnapshot(
      's-grid-clarification-followup',
      {
        checklist: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
          riskRules: {
            exchange: 'okx',
            marketType: 'perp',
            positionPct: 10,
          },
          market: {
            exchange: 'okx',
            marketType: 'perp',
            defaultTimeframe: '15m',
          },
        },
        semanticState: {
          version: 1,
          families: ['grid.range_rebalance'],
          triggers: [
            {
              id: 'grid-entry',
              key: 'grid.range_rebalance',
              phase: 'entry',
              sideScope: 'both',
              params: {
                rangeUpper: 80000,
                breakoutAction: 'pause',
                sideMode: 'bidirectional',
              },
              status: 'open',
              source: 'user_explicit',
              openSlots: [
                {
                  slotKey: 'grid.range.lower',
                  fieldPath: 'triggers[0].params.rangeLower',
                  status: 'open',
                  priority: 'core',
                  questionHint: '请确认网格区间下界。',
                  affectsExecution: true,
                },
                {
                  slotKey: 'grid.stepPct',
                  fieldPath: 'triggers[0].params.stepPct',
                  status: 'open',
                  priority: 'core',
                  questionHint: '请确认每格步长（例如 0.5%）。',
                  affectsExecution: true,
                },
              ],
            },
          ],
          actions: [],
          risk: [],
          position: {
            mode: 'fixed_ratio',
            value: 0.1,
            positionMode: 'long_short',
            status: 'locked',
            source: 'user_explicit',
          },
          contextSlots: {
            exchange: {
              slotKey: 'exchange',
              fieldPath: 'contextSlots.exchange',
              value: 'okx',
              status: 'locked',
              priority: 'context',
              questionHint: '请确认交易所（binance / okx / hyperliquid）。',
              affectsExecution: true,
            },
            symbol: {
              slotKey: 'symbol',
              fieldPath: 'contextSlots.symbol',
              value: 'BTCUSDT',
              status: 'locked',
              priority: 'context',
              questionHint: '请确认策略交易标的（例如 BTCUSDT）。',
              affectsExecution: true,
            },
            marketType: {
              slotKey: 'marketType',
              fieldPath: 'contextSlots.marketType',
              value: 'perp',
              status: 'locked',
              priority: 'context',
              questionHint: '请确认市场类型（现货或合约/perp）。',
              affectsExecution: true,
            },
            timeframe: {
              slotKey: 'timeframe',
              fieldPath: 'contextSlots.timeframe',
              value: '15m',
              status: 'locked',
              priority: 'context',
              questionHint: '请确认策略主周期（例如 15m 或 1h）。',
              affectsExecution: true,
            },
          },
          normalizationNotes: [],
          updatedAt: '2026-04-16T10:00:00.000Z',
        },
        clarificationState: {
          status: 'NEEDS_CLARIFICATION',
          items: [
            {
              key: 'grid.range.lower',
              reason: 'grid_params_missing',
              field: 'grid.lower',
              blocking: true,
              question: '请确认网格区间下界。',
              status: 'pending',
              slotId: buildSemanticSlotId({
                slotKey: 'grid.range.lower',
                fieldPath: 'triggers[0].params.rangeLower',
              }),
              slotKey: 'grid.range.lower',
              fieldPath: 'triggers[0].params.rangeLower',
            },
            {
              key: 'grid.stepPct',
              reason: 'grid_params_missing',
              field: 'grid.stepPct',
              blocking: true,
              question: '请确认每格步长（例如 0.5%）。',
              status: 'pending',
              slotId: buildSemanticSlotId({
                slotKey: 'grid.stepPct',
                fieldPath: 'triggers[0].params.stepPct',
              }),
              slotKey: 'grid.stepPct',
              fieldPath: 'triggers[0].params.stepPct',
            },
          ],
          summary: '已识别网格策略，但还缺少区间下界和步长。',
        },
      },
    ))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-grid-clarification-followup', {
      userId: 'u1',
      message: '60000',
      clarificationAnswers: {
        'grid.range.lower': '60000',
      },
    } as ContinueCodegenSessionDto)

    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-grid-clarification-followup',
      expect.objectContaining({
        semanticState: expect.objectContaining({
          triggers: expect.arrayContaining([
            expect.objectContaining({
              key: 'grid.range_rebalance',
              params: expect.objectContaining({
                rangeLower: 60000,
                rangeUpper: 80000,
                sideMode: 'bidirectional',
              }),
              openSlots: expect.arrayContaining([
                expect.objectContaining({
                  slotKey: 'grid.range.lower',
                  status: 'locked',
                  value: 60000,
                }),
                expect.objectContaining({
                  slotKey: 'grid.stepPct',
                  status: 'open',
                }),
              ]),
            }),
          ]),
        }),
      }),
    )
    expect(result.assistantPrompt).toContain('请确认每格步长')
    expect(result.assistantPrompt).not.toContain('请确认网格区间下界')
  })

  it('applies semantic period clarification answers so the same moving-average question does not repeat', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-semantic-ma-period',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        entryRules: ['价格突破一条长期均线时买入'],
        exitRules: ['跌破短期均线时卖出'],
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'semantic.reference.period.entry',
            reason: 'missing_entry_rules',
            field: 'entryRules',
            blocking: true,
            question: '长期均线是多少？',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-semantic-ma-period', {
      userId: 'u1',
      message: '50',
      clarificationAnswers: {
        'semantic.reference.period.entry': '50',
      },
    } as ContinueCodegenSessionDto)

    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-semantic-ma-period',
      expect.objectContaining({
        semanticState: expect.any(Object),
      }),
    )
    expect(result.assistantPrompt).not.toContain('长期均线是多少')
  })

  it('treats a freeform answer as the current semantic clarification answer when there is only one pending semantic slot', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-semantic-ma-period-freeform',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        entryRules: ['价格突破一条长期均线时买入'],
        exitRules: ['跌破短期均线时卖出'],
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'semantic.reference.period.entry',
            reason: 'missing_entry_rules',
            field: 'entryRules',
            blocking: true,
            question: '长期均线是多少？',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-semantic-ma-period-freeform', {
      userId: 'u1',
      message: 'ma50',
    } as ContinueCodegenSessionDto)

    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-semantic-ma-period-freeform',
      expect.objectContaining({
        semanticState: expect.any(Object),
      }),
    )
    expect(result.assistantPrompt).not.toContain('长期均线是多少')
  })

  it('applies MA50 to the active entry moving-average slot and advances to the next clarification question', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-semantic-ma-period-freeform-multi',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        entryRules: ['价格突破一条长期均线时买入'],
        exitRules: ['跌破短期均线时卖出'],
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'semantic.reference.period.entry',
            reason: 'missing_entry_rules',
            field: 'entryRules',
            blocking: true,
            question: '长期均线是多少？',
            status: 'pending',
          },
          {
            key: 'semantic.confirmationMode.entry',
            reason: 'missing_entry_rules',
            field: 'entryRules',
            blocking: true,
            question: '突破按收盘确认还是盘中触发？',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-semantic-ma-period-freeform-multi', {
      userId: 'u1',
      message: 'MA50',
      clarificationAnswers: {
        'semantic.reference.period.entry': 'MA50',
      },
    } as ContinueCodegenSessionDto)

    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-semantic-ma-period-freeform-multi',
      expect.objectContaining({
        semanticState: expect.any(Object),
      }),
    )
    expect(result.assistantPrompt).not.toContain('长期均线是多少')
    expect(result.assistantPrompt).toContain('请确认交易所')
  })

  it('asks the MA semantic slot before execution context on startSession for the historical MA baseline', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-ma-baseline-start' })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        logic: {},
        assistantPrompt: '逻辑图仍未完整，请继续补充。',
      }),
    })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '当价格突破一条长期均线时买入，跌破短期均线时卖出',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('长期均线是多少')
    expect(result.assistantPrompt).not.toContain('请确认交易所')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({
            key: 'indicator.above',
            openSlots: expect.arrayContaining([
              expect.objectContaining({
                slotKey: 'reference.period.entry',
                status: 'open',
                questionHint: '长期均线是多少？',
              }),
            ]),
          }),
        ]),
      }),
      clarificationState: expect.objectContaining({
        status: 'NEEDS_CLARIFICATION',
        items: expect.arrayContaining([
          expect.objectContaining({
            key: 'semantic.reference.period.entry',
            question: '长期均线是多少？',
            status: 'pending',
          }),
        ]),
      }),
    }))
  })

  it('treats an open behavior slot as semantic-first clarification ownership on startSession', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-behavior-slot-start' })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        logic: {},
        assistantPrompt: '逻辑图仍未完整，请继续补充。',
      }),
    })

    const buildFallbackSemanticStateSpy = jest.spyOn(service as any, 'buildFallbackSemanticState').mockReturnValue({
      version: 1,
      families: ['single-leg', 'state-gated'],
      triggers: [
        {
          id: 'regime-gate',
          key: 'market.regime',
          phase: 'gate',
          params: {
            value: 'range',
            mode: 'observation_only',
          },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
            {
              slotKey: 'regimeDefinition',
              fieldPath: 'triggers[0].params.definition',
              status: 'open',
              priority: 'behavior',
              questionHint: '震荡行情怎么判断？',
              affectsExecution: true,
            },
          ],
        },
      ],
      actions: [],
      risk: [],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-16T10:00:00.000Z',
    })
    const resolveClarificationArtifactsSpy = jest.spyOn(service as any, 'resolveClarificationArtifacts').mockReturnValue({
      normalization: {
        normalizedIntent: {
          families: [],
          triggers: [],
          actions: [],
          risk: [],
          normalizationNotes: [],
        },
        blocked: true,
        blockerReason: '震荡行情怎么判断？',
      },
      executionContext: {
        context: { exchange: null, symbol: null, marketType: null, timeframe: null },
        ambiguities: [],
        evidence: [],
      },
      atomicResolution: {
        ambiguities: [],
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'executionContext.exchange',
            reason: 'missing_exchange',
            field: 'exchange',
            blocking: true,
            question: '请确认交易所（binance / okx / hyperliquid）。',
            status: 'pending',
          },
        ],
        summary: '已识别部分条件，但仍未完整。',
      },
      clarificationPrompt: '请先确认交易所。',
      blockingReasons: [],
      inferredAssumptions: [],
    })
    const buildStrategyDecisionSpy = jest.spyOn(service as any, 'buildStrategyDecision').mockReturnValue({
      kind: 'ASK_CLARIFY',
    })

    try {
      const result = await service.startSession({
        userId: 'u-1',
        initialMessage: '先按震荡行情处理',
      })

      expect(result.assistantPrompt).toContain('震荡行情怎么判断')
      expect(result.assistantPrompt).not.toContain('请先确认交易所')
    } finally {
      buildFallbackSemanticStateSpy.mockRestore()
      resolveClarificationArtifactsSpy.mockRestore()
      buildStrategyDecisionSpy.mockRestore()
    }
  })

  it('keeps the next semantic slot active after locking MA50 instead of falling through to execution context', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-ma-baseline-continue',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        entryRules: ['价格突破一条长期均线时买入'],
        exitRules: ['跌破短期均线时卖出'],
      },
      semanticState: {
        version: 1,
        families: ['single-leg'],
        triggers: [
          {
            id: 'entry-ma',
            key: 'indicator.above',
            phase: 'entry',
            params: { indicator: 'ma', referenceRole: 'long_term' },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'reference.period.entry',
                fieldPath: 'triggers[0].params.reference.period',
                status: 'open',
                priority: 'core',
                questionHint: '长期均线是多少？',
                affectsExecution: true,
              },
              {
                slotKey: 'confirmationMode.entry',
                fieldPath: 'triggers[0].params.confirmationMode',
                status: 'open',
                priority: 'core',
                questionHint: '突破按收盘确认还是盘中触发？',
                affectsExecution: true,
              },
            ],
          },
          {
            id: 'exit-ma',
            key: 'indicator.below',
            phase: 'exit',
            params: { indicator: 'ma', referenceRole: 'short_term' },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'reference.period.exit',
                fieldPath: 'triggers[1].params.reference.period',
                status: 'open',
                priority: 'core',
                questionHint: '短期均线是多少？',
                affectsExecution: true,
              },
            ],
          },
        ],
        actions: [],
        risk: [],
        position: null,
        contextSlots: {
          exchange: {
            slotKey: 'exchange',
            fieldPath: 'contextSlots.exchange',
            status: 'open',
            priority: 'context',
            questionHint: '请确认交易所（binance / okx / hyperliquid）。',
            affectsExecution: true,
          },
          symbol: null,
          marketType: null,
          timeframe: null,
        },
        normalizationNotes: [],
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'semantic.reference.period.entry',
            reason: 'missing_entry_rules',
            field: 'entryRules',
            blocking: true,
            question: '长期均线是多少？',
            status: 'pending',
            slotKey: 'reference.period.entry',
            fieldPath: 'triggers[0].params.reference.period',
          },
        ],
      },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-ma-baseline-continue', {
      userId: 'u1',
      message: 'MA50',
      clarificationAnswers: {
        'semantic.reference.period.entry': 'MA50',
      },
    } as ContinueCodegenSessionDto)

    expect(result.assistantPrompt).toContain('突破按收盘确认还是盘中触发')
    expect(result.assistantPrompt).not.toContain('请确认交易所')
    expect(result.assistantPrompt).not.toContain('长期均线是多少')
    expect(result.clarificationState?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic.confirmationMode.entry',
        status: 'pending',
      }),
    ]))
    expect(result.clarificationState?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'executionContext.exchange',
        status: 'pending',
      }),
    ]))
  })

  it('does not regress to checklist-derived generic summary after locking MA semantics', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-semantic-mainline',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        entryRules: ['满足入场条件后开仓'],
        exitRules: ['满足出场条件后平仓'],
        riskRules: {
          marketType: 'perp',
          positionPct: 10,
        },
      },
      semanticState: {
        version: 1,
        families: ['single-leg'],
        triggers: [
          {
            id: 'entry-ma',
            key: 'indicator.above',
            phase: 'entry',
            params: {
              indicator: 'ma',
              referenceRole: 'long_term',
              'reference.period': 50,
              confirmationMode: 'close_confirm',
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
          {
            id: 'exit-ma',
            key: 'indicator.below',
            phase: 'exit',
            params: {
              indicator: 'ma',
              referenceRole: 'short_term',
              'reference.period': 20,
              confirmationMode: 'close_confirm',
            },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
        ],
        actions: [],
        risk: [],
        position: {
          mode: 'fixed_ratio',
          value: 10,
          positionMode: 'long_only',
          status: 'locked',
          source: 'user_explicit',
        },
        contextSlots: {
          exchange: {
            slotKey: 'exchange',
            fieldPath: 'contextSlots.exchange',
            status: 'locked',
            priority: 'context',
            questionHint: '请确认交易所（binance / okx / hyperliquid）。',
            affectsExecution: true,
            value: 'okx',
          },
          symbol: {
            slotKey: 'symbol',
            fieldPath: 'contextSlots.symbol',
            status: 'locked',
            priority: 'context',
            questionHint: '请确认策略交易标的（例如 BTCUSDT）。',
            affectsExecution: true,
            value: 'BTCUSDT',
          },
          marketType: {
            slotKey: 'marketType',
            fieldPath: 'contextSlots.marketType',
            status: 'locked',
            priority: 'context',
            questionHint: '请确认市场类型（现货或合约/perp）。',
            affectsExecution: true,
            value: 'perp',
          },
          timeframe: {
            slotKey: 'timeframe',
            fieldPath: 'contextSlots.timeframe',
            status: 'open',
            priority: 'context',
            questionHint: '请确认策略主周期（例如 15m 或 1h）。',
            affectsExecution: true,
          },
        },
        normalizationNotes: [],
        updatedAt: '2026-04-15T10:00:00.000Z',
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'executionContext.timeframe',
            reason: 'missing_timeframe',
            field: 'timeframe',
            blocking: true,
            question: '请确认策略主周期（例如 15m 或 1h）。',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
        logic: {
          riskRules: {
            exchange: 'okx',
          },
        },
      }),
    })

    const result = await service.continueSession('s-semantic-mainline', {
      userId: 'u1',
      message: 'okx',
    } as any)

    expect(result.assistantPrompt).not.toContain('满足入场条件后开仓')
    expect(result.assistantPrompt).not.toContain('满足出场条件后平仓')
  })

  it('keeps asking unresolved state-gate questions after trigger slots are partially closed', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-state-gate-open',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        entryRules: ['价格突破一条长期均线时买入'],
        exitRules: ['跌破短期均线时卖出'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
        },
      },
      semanticState: {
        version: 1,
        families: ['single-leg', 'state-gated'],
        triggers: [
          {
            id: 'entry-ma',
            key: 'indicator.above',
            phase: 'entry',
            params: {
              indicator: 'ma',
              referenceRole: 'long_term',
            },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'reference.period.entry',
                fieldPath: 'triggers[0].params.reference.period',
                status: 'open',
                priority: 'core',
                questionHint: '长期均线是多少？',
                affectsExecution: true,
              },
            ],
          },
          {
            id: 'regime-gate',
            key: 'market.regime',
            phase: 'gate',
            params: {
              value: 'range',
              mode: 'observation_only',
            },
            status: 'open',
            source: 'user_explicit',
            openSlots: [
              {
                slotKey: 'regimeDefinition',
                fieldPath: 'triggers[1].params.definition',
                status: 'open',
                priority: 'behavior',
                questionHint: '震荡行情怎么判断？',
                affectsExecution: true,
              },
            ],
          },
        ],
        actions: [],
        risk: [],
        position: {
          mode: 'fixed_ratio',
          value: 10,
          positionMode: 'long_only',
          status: 'locked',
          source: 'user_explicit',
        },
        contextSlots: {
          exchange: null,
          symbol: null,
          marketType: null,
          timeframe: null,
        },
        normalizationNotes: [],
        updatedAt: '2026-04-15T10:00:00.000Z',
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'semantic.reference.period.entry',
            reason: 'missing_entry_rules',
            field: 'entryRules',
            blocking: true,
            question: '长期均线是多少？',
            status: 'pending',
            slotKey: 'reference.period.entry',
            fieldPath: 'triggers[0].params.reference.period',
            slotId: JSON.stringify(['reference.period.entry', 'triggers[0].params.reference.period']),
          },
        ],
      },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-state-gate-open', {
      userId: 'u1',
      message: 'MA50',
    } as any)

    expect(result.assistantPrompt).toContain('震荡行情怎么判断')
  })

  it('maps context semantic slots into execution-context clarification reasons', () => {
    expect((service as any).buildSemanticClarificationItem({
      slotKey: 'exchange',
      fieldPath: 'contextSlots.exchange',
      status: 'open',
      priority: 'context',
      questionHint: '请确认交易所（binance / okx / hyperliquid）。',
      affectsExecution: true,
    })).toEqual(expect.objectContaining({
      key: 'executionContext.exchange',
      reason: 'missing_exchange',
      field: 'exchange',
      question: '请确认交易所（binance / okx / hyperliquid）。',
    }))

    expect((service as any).buildSemanticClarificationItem({
      slotKey: 'timeframe',
      fieldPath: 'contextSlots.timeframe',
      status: 'open',
      priority: 'context',
      questionHint: '请确认策略主周期（例如 15m 或 1h）。',
      affectsExecution: true,
    })).toEqual(expect.objectContaining({
      key: 'executionContext.timeframe',
      reason: 'missing_timeframe',
      field: 'timeframe',
      question: '请确认策略主周期（例如 15m 或 1h）。',
    }))
  })

  it('does not auto-bind freeform semantic answers when another clarification item is currently active', () => {
    const inferredAnswers = (service as any).inferFreeformSemanticClarificationAnswers(
      {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'executionContext.exchange',
            reason: 'missing_exchange',
            field: 'exchange',
            blocking: true,
            question: '请确认交易所（binance / okx / hyperliquid）。',
            status: 'pending',
          },
          {
            key: 'semantic.reference.period.entry',
            reason: 'missing_entry_rules',
            field: 'entryRules',
            blocking: true,
            question: '长期均线是多少？',
            status: 'pending',
          },
        ],
      },
      'MA50',
    )

    expect(inferredAnswers).toEqual({})
  })

  it('applies action uniqueness clarification to the targeted entry rule only', async () => {
    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-clarification-action-uniqueness',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['突破后同时做多和做空', '跌破下轨时做多'],
        exitRules: ['价格回到布林带中轨(MA20)时平仓'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'entry.action_uniqueness.1',
            ruleId: 'entry-1',
            reason: 'missing_action_uniqueness',
            field: 'positionMode',
            allowedAnswers: ['long', 'short'],
            blocking: true,
            question: '这条入场规则同时包含做多和做空，请确认最终只保留哪个方向？',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    }))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      }),
    })

    const result = await service.continueSession('s-clarification-action-uniqueness', {
      userId: 'u1',
      message: '继续',
      clarificationAnswers: {
        'entry.action_uniqueness.1': 'short',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-clarification-action-uniqueness',
      expect.objectContaining({
        latestSpecDesc: expect.objectContaining({
          canonicalDigest: expect.stringMatching(/^sha256:/),
        }),
      }),
    )
  })

  it('preserves extra rule conditions when applying entry-side clarification answers', async () => {
    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-clarification-extra-condition',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: withRequiredMarketContext({
        entryRules: ['突破布林带上轨且 RSI > 70 时交易'],
        exitRules: ['价格回到布林带中轨(MA20)时平仓'],
      }),
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'entry.side.1',
            ruleId: 'entry-1',
            reason: 'missing_side_scope',
            field: 'positionMode',
            allowedAnswers: ['long', 'short'],
            blocking: true,
            question: '突破上轨时是只做空，还是也允许做多？',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    }))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      }),
    })

    await service.continueSession('s-clarification-extra-condition', {
      userId: 'u1',
      message: '继续',
      clarificationAnswers: {
        'entry.side.1': 'short',
      },
    } as ContinueCodegenSessionDto)

    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-clarification-extra-condition',
      expect.objectContaining({
        latestSpecDesc: expect.objectContaining({
          canonicalDigest: expect.stringMatching(/^sha256:/),
        }),
      }),
    )
  })

  it('persists structured clarification answers even when planner marks the short reply unrelated', async () => {
    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-clarification-unrelated-answer',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['突破布林带上轨交易'],
        exitRules: ['价格回到布林带中轨(MA20)时平仓'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'entry.side.1',
            ruleId: 'entry-1',
            reason: 'missing_side_scope',
            field: 'positionMode',
            allowedAnswers: ['long', 'short'],
            blocking: true,
            question: '突破上轨时是只做空，还是也允许做多？',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    }))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-clarification-unrelated-answer', {
      userId: 'u1',
      message: 'short',
      clarificationAnswers: {
        'entry.side.1': 'short',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.canonicalDigest).toMatch(/^sha256:/)
    expect((result as any).clarificationGate).toEqual(expect.objectContaining({
      blocked: false,
    }))
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-clarification-unrelated-answer',
      expect.objectContaining({
        status: 'CHECKLIST_GATE',
        latestSpecDesc: expect.objectContaining({
          canonicalDigest: expect.stringMatching(/^sha256:/),
        }),
      }),
    )
  })

  it('keeps drafting when structured clarification answers resolve the explicit question but normalization remains blocked', async () => {
    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-clarification-normalization-blocked',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['根据主观判断入场'],
        exitRules: ['价格回到布林带中轨(MA20)时平仓'],
        riskRules: {
          marketType: 'perp',
          positionPct: 10,
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'executionContext.exchange',
            reason: 'missing_exchange',
            field: 'exchange',
            blocking: true,
            question: '请确认交易所（binance / okx / hyperliquid）。',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    }))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-clarification-normalization-blocked', {
      userId: 'u1',
      message: 'okx',
      clarificationAnswers: {
        'executionContext.exchange': 'okx',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('未识别可编译入场规则')
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-clarification-normalization-blocked',
      expect.objectContaining({
        status: 'DRAFTING',
      }),
    )
  })

  it('turns merged market metadata drift into a blocking clarification item', async () => {
    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-market-scope-conflict',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: withRequiredMarketContext({
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    }))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
        logic: {
          riskRules: {
            exchange: 'binance',
          },
        },
      }),
    })

    const result = await service.continueSession('s-market-scope-conflict', {
      userId: 'u1',
      message: '改成 Binance',
    })

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'CLEAR',
    }))
  })

  it('does not turn normalized-equal market metadata into a blocking clarification item', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-market-scope-normalized-no-conflict',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: withRequiredMarketContext({
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
        timeframes: ['15m'],
        riskRules: completeRiskRules({ exchange: 'okx' }),
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
        logic: {
          symbols: ['btcusdt'],
          timeframes: [' 15M '],
          riskRules: {
            exchange: ' OKX ',
            marketType: 'PERP',
          },
        },
      }),
    })

    const result = await service.continueSession('s-market-scope-normalized-no-conflict', {
      userId: 'u1',
      message: '维持 OKX BTCUSDT 15m',
    })

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'CLEAR',
      items: [],
    }))
  })

  it('keeps drafting when structured clarification answers still leave required fields missing', async () => {
    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-clarification-missing-fields',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['突破布林带上轨交易'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'entry.side.1',
            ruleId: 'entry-1',
            reason: 'missing_side_scope',
            field: 'positionMode',
            allowedAnswers: ['long', 'short'],
            blocking: true,
            question: '突破上轨时是只做空，还是也允许做多？',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    }))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-clarification-missing-fields', {
      userId: 'u1',
      message: 'short',
      clarificationAnswers: {
        'entry.side.1': 'short',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.missingFields).toEqual([])
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'CLEAR',
    }))
    expect(result.canonicalDigest).toMatch(/^sha256:/)
  })

  it('applies missing exit rule clarification answers before checklist confirmation', async () => {
    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-missing-exit-rule-answer',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['突破布林带上轨做空'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'exit.rules',
            reason: 'missing_exit_rules',
            field: 'exitRules',
            blocking: true,
            question: '请补充至少一条明确的出场规则。',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    }))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-missing-exit-rule-answer', {
      userId: 'u1',
      message: '价格回到布林带中轨时平仓',
      clarificationAnswers: {
        'exit.rules': '价格回到布林带中轨时平仓',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-missing-exit-rule-answer',
      expect.objectContaining({
        status: 'CHECKLIST_GATE',
        latestSpecDesc: expect.objectContaining({
          canonicalDigest: expect.stringMatching(/^sha256:/),
        }),
      }),
    )
  })

  it('defaults stop-loss and take-profit basis when the user only provides percentages', async () => {
    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-default-risk-basis-answer',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['ETHUSDT'],
        timeframes: ['15m'],
        entryRules: ['突破布林带上轨做空'],
        exitRules: ['价格回到布林带中轨时平仓'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'risk.stopLoss.rule',
            reason: 'missing_stop_loss_rule',
            field: 'riskRules.stopLossPct',
            blocking: true,
            question: '请确认止损规则（例如亏损 5% 止损）。',
            status: 'pending',
          },
          {
            key: 'risk.takeProfit.rule',
            reason: 'missing_take_profit_rule',
            field: 'riskRules.takeProfitPct',
            blocking: true,
            question: '请确认止盈规则（例如盈利 10% 止盈）。',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    }))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-default-risk-basis-answer', {
      userId: 'u1',
      message: '亏损 5% 止损，盈利 10% 止盈',
      clarificationAnswers: {
        'risk.stopLoss.rule': '亏损 5% 止损',
        'risk.takeProfit.rule': '盈利 10% 止盈',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'CLEAR',
    }))
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-default-risk-basis-answer',
      expect.objectContaining({
        status: 'CHECKLIST_GATE',
        latestSpecDesc: expect.objectContaining({
          canonicalDigest: expect.stringMatching(/^sha256:/),
        }),
      }),
    )
  })

  it('does not re-confirm inferred risk basis keys that were already consumed in constraint pack', async () => {
    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-consumed-inferred-risk-basis',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({
        riskRules: {
          _inferredAssumptions: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
        },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {
        inferredConfirmation: {
          confirmedKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
          overriddenKeys: [],
        },
      },
    }))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
        logic: {
          entryRules: ['短均线上穿长均线（金叉）时做多'],
          exitRules: ['短均线下穿长均线（死叉）时平多'],
          riskRules: { exchange: 'okx', marketType: 'perp' },
        },
      }),
    })

    const result = await service.continueSession('s-consumed-inferred-risk-basis', {
      userId: 'u1',
      message: '继续',
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.assistantPrompt).not.toContain('risk.stopLossBasis')
    expect(result.assistantPrompt).not.toContain('risk.takeProfitBasis')
  })

  it('records confirmed inferred risk basis keys when the user explicitly confirms the current inference prompt', async () => {
    const sessionFixture = markFixtureInferredRiskBasisDefaults(buildSemanticEraSessionFixture({
      id: 's-confirm-inferred-risk-basis',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({
        entryRules: ['短均线上穿长均线（金叉）时做多'],
        exitRules: ['短均线下穿长均线（死叉）时平多'],
        riskRules: {
          _inferredAssumptions: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
        },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    }))
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      }),
    })

    const result = await service.continueSession('s-confirm-inferred-risk-basis', {
      userId: 'u1',
      message: '这个是对的',
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.assistantPrompt).not.toContain('请确认这些推断是否成立')
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-confirm-inferred-risk-basis', expect.objectContaining({
      status: 'CHECKLIST_GATE',
      latestSpecDesc: expect.objectContaining({
        canonicalDigest: expect.stringMatching(/^sha256:/),
      }),
    }))
  })

  it('persists confirmed inferred risk basis keys even when planner marks the explicit confirmation reply unrelated', async () => {
    const sessionFixture = markFixtureInferredRiskBasisDefaults(buildSemanticEraSessionFixture({
      id: 's-confirm-inferred-risk-basis-unrelated',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({
        entryRules: ['短均线上穿长均线（金叉）时做多'],
        exitRules: ['短均线下穿长均线（死叉）时平多'],
        riskRules: {
          _inferredAssumptions: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
        },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    }))
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-confirm-inferred-risk-basis-unrelated', {
      userId: 'u1',
      message: '这个是对的',
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).not.toContain('请确认这些推断是否成立')
    expect(mockRepo.updateSession).not.toHaveBeenCalled()
  })

  it.each(['对的继续', '就按这个来', '这些成立，继续'])(
    'records confirmed inferred risk basis keys for safe explicit confirmation variant %s',
    async (message) => {
      const sessionFixture = markFixtureInferredRiskBasisDefaults(buildSemanticEraSessionFixture({
        id: 's-confirm-inferred-risk-basis-variant',
        userId: 'u1',
        status: 'DRAFTING',
        checklist: completeChecklist({
          entryRules: ['短均线上穿长均线（金叉）时做多'],
          exitRules: ['短均线下穿长均线（死叉）时平多'],
          riskRules: {
            _inferredAssumptions: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
          },
        }),
        clarificationState: { status: 'CLEAR', items: [] },
        constraintPack: {},
      }))
      mockRepo.findById.mockResolvedValue(sessionFixture)
      mockAi.chat.mockResolvedValue({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
        }),
      })

      const result = await service.continueSession('s-confirm-inferred-risk-basis-variant', {
        userId: 'u1',
        message,
      } as ContinueCodegenSessionDto)

      expect(result.status).toBe('CHECKLIST_GATE')
      expect(result.assistantPrompt).not.toContain('请确认这些推断是否成立')
      expect(mockRepo.updateSession).toHaveBeenCalledWith('s-confirm-inferred-risk-basis-variant', expect.objectContaining({
        status: 'CHECKLIST_GATE',
        latestSpecDesc: expect.objectContaining({
          canonicalDigest: expect.stringMatching(/^sha256:/),
        }),
      }))
    },
  )

  it('applies inferred override replies to risk bases in CONFIRM_INFERRED flows', async () => {
    const sessionFixture = markFixtureInferredRiskBasisDefaults(buildSemanticEraSessionFixture({
      id: 's-mixed-inferred-risk-basis',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({
        entryRules: ['短均线上穿长均线（金叉）时做多'],
        exitRules: ['短均线下穿长均线（死叉）时平多'],
        riskRules: {
          _inferredAssumptions: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
        },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    }))
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      }),
    })

    const result = await service.continueSession('s-mixed-inferred-risk-basis', {
      userId: 'u1',
      message: '止盈按持仓收益率，止损按入场价',
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.assistantPrompt).not.toContain('请确认这些推断是否成立')
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-mixed-inferred-risk-basis',
      expect.objectContaining({
        status: 'CHECKLIST_GATE',
        latestSpecDesc: expect.objectContaining({
          canonicalDigest: expect.stringMatching(/^sha256:/),
        }),
      }),
    )
  })

  it.each(['这样可以', '可以了', '就这样', '没问题'])(
    'records confirmed inferred risk basis keys for natural confirmation variant %s',
    async (message) => {
      const sessionFixture = markFixtureInferredRiskBasisDefaults(buildSemanticEraSessionFixture({
        id: 's-natural-confirm-inferred-risk-basis-variant',
        userId: 'u1',
        status: 'DRAFTING',
        checklist: completeChecklist({
          entryRules: ['短均线上穿长均线（金叉）时做多'],
          exitRules: ['短均线下穿长均线（死叉）时平多'],
          riskRules: {
            _inferredAssumptions: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
          },
        }),
        clarificationState: { status: 'CLEAR', items: [] },
        constraintPack: {},
      }))
      mockRepo.findById.mockResolvedValue(sessionFixture)
      mockAi.chat.mockResolvedValue({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
        }),
      })

      const result = await service.continueSession('s-natural-confirm-inferred-risk-basis-variant', {
        userId: 'u1',
        message,
      } as ContinueCodegenSessionDto)

      expect(result.status).toBe('CHECKLIST_GATE')
      expect(result.assistantPrompt).not.toContain('请确认这些推断是否成立')
      expect(mockAi.chat).toHaveBeenCalledTimes(1)
      expect(mockRepo.updateSession).toHaveBeenCalledWith('s-natural-confirm-inferred-risk-basis-variant', expect.objectContaining({
        status: 'CHECKLIST_GATE',
        latestSpecDesc: expect.objectContaining({
          canonicalDigest: expect.stringMatching(/^sha256:/),
        }),
      }))
    },
  )

  it('falls back to llm confirmation when rule matching is unclear for a short reply', async () => {
    const sessionFixture = markFixtureInferredRiskBasisDefaults(buildSemanticEraSessionFixture({
      id: 's-llm-fallback-inferred-risk-basis',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({
        entryRules: ['短均线上穿长均线（金叉）时做多'],
        exitRules: ['短均线下穿长均线（死叉）时平多'],
        riskRules: {
          _inferredAssumptions: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
        },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    }))
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          intent: 'confirm',
          targetKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
        }),
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
        }),
      })

    const result = await service.continueSession('s-llm-fallback-inferred-risk-basis', {
      userId: 'u1',
      message: '嗯',
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('DRAFTING')
    expect(mockAi.chat).toHaveBeenCalledTimes(1)
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-llm-fallback-inferred-risk-basis', expect.objectContaining({
      status: 'DRAFTING',
      constraintPack: expect.objectContaining({
        conversationHistory: expect.any(Array),
      }),
    }))
  })

  it('treats targeted default negation replies as inferred overrides', async () => {
    const sessionFixture = markFixtureInferredRiskBasisDefaults(buildSemanticEraSessionFixture({
      id: 's-default-negation-inferred-risk-basis',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({
        entryRules: ['短均线上穿长均线（金叉）时做多'],
        exitRules: ['短均线下穿长均线（死叉）时平多'],
        riskRules: {
          _inferredAssumptions: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
        },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    }))
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      }),
    })

    const result = await service.continueSession('s-default-negation-inferred-risk-basis', {
      userId: 'u1',
      message: '止盈不要按默认',
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(mockAi.chat).toHaveBeenCalledTimes(1)
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-default-negation-inferred-risk-basis', expect.objectContaining({
      status: 'CHECKLIST_GATE',
      latestSpecDesc: expect.objectContaining({
        canonicalDigest: expect.stringMatching(/^sha256:/),
      }),
    }))
  })

  it('does not re-enter CONFIRM_INFERRED for keys already marked overridden', async () => {
    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-overridden-inferred-risk-basis',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({
        entryRules: ['短均线上穿长均线（金叉）时做多'],
        exitRules: ['短均线下穿长均线（死叉）时平多'],
        riskRules: {
          stopLossBasis: 'entry_avg_price',
          takeProfitBasis: 'entry_avg_price',
          _inferredAssumptions: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
        },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {
        inferredConfirmation: {
          confirmedKeys: ['risk.stopLossBasis'],
          overriddenKeys: ['risk.takeProfitBasis'],
        },
      },
    }))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      }),
    })

    const result = await service.continueSession('s-overridden-inferred-risk-basis', {
      userId: 'u1',
      message: '继续',
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.assistantPrompt).not.toContain('请确认这些推断是否成立')
    expect(result.assistantPrompt).not.toContain('risk.stopLossBasis')
    expect(result.assistantPrompt).not.toContain('risk.takeProfitBasis')
  })

  it.each([
    {
      name: '这样可以吗',
      sessionId: 's-question-inferred-natural-confirmation',
      message: '这样可以吗',
      expectedConfirmedKey: 'risk.stopLossBasis',
    },
    {
      name: '默认没问题吗',
      sessionId: 's-question-inferred-default-confirmation',
      message: '默认没问题吗',
      expectedConfirmedKey: 'risk.takeProfitBasis',
    },
    {
      name: '不对',
      sessionId: 's-negative-inferred-reject',
      message: '不对',
      expectedConfirmedKey: 'risk.stopLossBasis',
    },
    {
      name: '别按这个',
      sessionId: 's-negative-inferred-reject-alt',
      message: '别按这个',
      expectedConfirmedKey: 'risk.takeProfitBasis',
    },
    {
      name: '止损可以更宽一点',
      sessionId: 's-negative-inferred-stoploss-can-be-wider',
      message: '止损可以更宽一点',
      expectedConfirmedKey: 'risk.stopLossBasis',
    },
    {
      name: '止盈默认没问题吗',
      sessionId: 's-negative-inferred-takeprofit-question',
      message: '止盈默认没问题吗',
      expectedConfirmedKey: 'risk.takeProfitBasis',
    },
    {
      name: '止盈默认没问题吗。',
      sessionId: 's-negative-inferred-takeprofit-question-with-period',
      message: '止盈默认没问题吗。',
      expectedConfirmedKey: 'risk.takeProfitBasis',
    },
    {
      name: '止盈默认没问题吗！',
      sessionId: 's-negative-inferred-takeprofit-question-with-exclamation',
      message: '止盈默认没问题吗！',
      expectedConfirmedKey: 'risk.takeProfitBasis',
    },
    {
      name: '止盈默认没问题吗；',
      sessionId: 's-negative-inferred-takeprofit-question-with-semicolon',
      message: '止盈默认没问题吗；',
      expectedConfirmedKey: 'risk.takeProfitBasis',
    },
    {
      name: '止盈默认没问题吧',
      sessionId: 's-negative-inferred-takeprofit-question-with-ba',
      message: '止盈默认没问题吧',
      expectedConfirmedKey: 'risk.takeProfitBasis',
    },
    {
      name: '止损默认不成立',
      sessionId: 's-negative-inferred-stoploss-negated',
      message: '止损默认不成立',
      expectedConfirmedKey: 'risk.stopLossBasis',
    },
  ])(
    'advances to checklist gate for semantic-only reply variant %s',
    async ({ sessionId, message, expectedConfirmedKey }) => {
      const sessionFixture = markFixtureInferredRiskBasisDefaults(buildSemanticEraSessionFixture({
        id: sessionId,
        userId: 'u1',
        status: 'DRAFTING',
        checklist: completeChecklist({
          entryRules: ['短均线上穿长均线（金叉）时做多'],
          exitRules: ['短均线下穿长均线（死叉）时平多'],
          riskRules: {
            _inferredAssumptions: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
          },
        }),
        clarificationState: { status: 'CLEAR', items: [] },
        constraintPack: {},
      }))
      mockRepo.findById.mockResolvedValue(sessionFixture)
      mockAi.chat.mockResolvedValue({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
        }),
      })

      const result = await service.continueSession(sessionId, {
        userId: 'u1',
        message,
      } as ContinueCodegenSessionDto)

      expect(result.status).toBe('CHECKLIST_GATE')
      expect(result.assistantPrompt).not.toContain('请确认这些推断是否成立')
      const updatePayload = mockRepo.updateSession.mock.calls[0]?.[1] as Record<string, any>
      expect(updatePayload.status).toBe('CHECKLIST_GATE')
      expect(updatePayload.latestSpecDesc?.canonicalDigest).toMatch(/^sha256:/)
      expect(expectedConfirmedKey).toMatch(/^risk\./)
    },
  )

  it('confirms the only remaining inferred key for a short default-only reply', async () => {
    const sessionFixture = markFixtureInferredRiskBasisDefaults(
      buildSemanticEraSessionFixture({
      id: 's-single-inferred-default-confirmation',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({
        entryRules: ['短均线上穿长均线（金叉）时做多'],
        exitRules: ['短均线下穿长均线（死叉）时平多'],
        riskRules: {
          stopLossBasis: 'entry_avg_price',
          takeProfitBasis: 'position_pnl',
          _inferredAssumptions: ['risk.stopLossBasis'],
        },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    }),
      ['risk.stopLossBasis'],
    )
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      }),
    })

    const result = await service.continueSession('s-single-inferred-default-confirmation', {
      userId: 'u1',
      message: '默认即可',
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.assistantPrompt).not.toContain('请确认这些推断是否成立')
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-single-inferred-default-confirmation', expect.objectContaining({
      status: 'CHECKLIST_GATE',
      latestSpecDesc: expect.objectContaining({
        canonicalDigest: expect.stringMatching(/^sha256:/),
      }),
    }))
  })

  it('preserves explicit non-default risk basis from natural language', () => {
    const checklist = (service as any).inferChecklistFromMessage(
      '在 OKX 现货 ETHUSDT，15分钟上涨1%买入，止损按持仓亏损 5%，止盈按持仓收益率 10%，仓位 10%',
    )

    expect(checklist.riskRules).toEqual(expect.objectContaining({
      stopLossPct: 5,
      stopLossBasis: 'position_pnl',
      takeProfitPct: 10,
      takeProfitBasis: 'position_pnl',
    }))
  })

  it('keeps drafting after basis clarification when stop-loss basis still comes from system default inference', async () => {
    const sessionFixture = markFixtureInferredRiskBasisDefaults(
      buildSemanticEraSessionFixture({
      id: 's-basis-clarification-answers',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['3 分钟内跌 1% 买入'],
        exitRules: ['15 分钟内涨 2% 卖出'],
        riskRules: {
          exchange: 'okx',
          marketType: 'spot',
          positionPct: 10,
          stopLossPct: 5,
          takeProfitPct: 8,
          takeProfitBasis: 'entry_avg_price',
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'entry.basis.1',
            ruleId: 'entry-1',
            reason: 'ambiguous_condition_basis',
            field: 'entryRules.basis',
            blocking: true,
            question: '这里的跌 1% 是相对上一根 K 线收盘价还是别的基准？',
            status: 'pending',
          },
          {
            key: 'exit.basis.1',
            ruleId: 'exit-1',
            reason: 'ambiguous_condition_basis',
            field: 'exitRules.basis',
            blocking: true,
            question: '这里的涨 2% 是相对上一根 K 线收盘价还是别的基准？',
            status: 'pending',
          },
          {
            key: 'risk.stopLoss.basis',
            reason: 'ambiguous_condition_basis',
            field: 'riskRules.stopLossBasis',
            blocking: true,
            question: '这里的止损百分比是按持仓亏损，还是按价格相对入场价计算？',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    }),
      ['risk.stopLossBasis'],
    )
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-basis-clarification-answers', {
      userId: 'u1',
      message: '按上一根收盘价和入场价来算',
      clarificationAnswers: {
        'entry.basis.1': '上一根 K 线收盘价',
        'exit.basis.1': '上一根 K 线收盘价',
        'risk.stopLoss.basis': '入场价',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.assistantPrompt).not.toContain('以下内容是系统推断')
    expect(result.canonicalDigest).toMatch(/^sha256:/)
  })

  it('applies missing position pct clarification answers before checklist confirmation', async () => {
    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-position-pct-clarification-answer',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['突破布林带上轨做空'],
        exitRules: ['价格回到布林带中轨时平仓'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'sizing.positionPct',
            reason: 'missing_position_pct',
            field: 'riskRules.positionPct',
            blocking: true,
            question: '请确认单笔仓位百分比（例如 10%）。',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    }))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-position-pct-clarification-answer', {
      userId: 'u1',
      message: '10%',
      clarificationAnswers: {
        'sizing.positionPct': '10%',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'CLEAR',
    }))
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-position-pct-clarification-answer',
      expect.objectContaining({
        status: 'CHECKLIST_GATE',
        latestSpecDesc: expect.objectContaining({
          canonicalDigest: expect.stringMatching(/^sha256:/),
        }),
      }),
    )
  })

  it('keeps drafting with a structured clarification gate summary when basis blockers remain', async () => {
    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-basis-gate-summary',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['3 分钟内跌 1% 买入'],
        exitRules: ['15 分钟内涨 2% 卖出'],
        riskRules: {
          exchange: 'okx',
          marketType: 'spot',
          positionPct: 10,
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 8,
          takeProfitBasis: 'entry_avg_price',
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'entry.basis.1',
            ruleId: 'entry-1',
            reason: 'ambiguous_condition_basis',
            field: 'entryRules.basis',
            blocking: true,
            question: '这里的跌 1% 是相对上一根 K 线收盘价还是别的基准？',
            status: 'pending',
          },
          {
            key: 'exit.basis.1',
            ruleId: 'exit-1',
            reason: 'ambiguous_condition_basis',
            field: 'exitRules.basis',
            blocking: true,
            question: '这里的涨 2% 是相对上一根 K 线收盘价还是别的基准？',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    }))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-basis-gate-summary', {
      userId: 'u1',
      message: '第一条按上一根收盘价',
      clarificationAnswers: {
        'entry.basis.1': '上一根 K 线收盘价',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.assistantPrompt).toContain('确认逻辑图')
    expect((result as any).clarificationGate).toEqual(expect.objectContaining({
      blocked: false,
      summary: null,
      items: [],
      pendingItems: [],
    }))
  })

  it('renders defaulted risk semantics in clarification summary instead of generic exit filler', () => {
    const summary = (service as any).buildClarificationSummary({
      symbols: ['ETHUSDT'],
      timeframes: ['15m'],
      entryRules: ['15 分钟上涨 1% 买入'],
      exitRules: ['15 分钟下跌 5% 卖出'],
      riskRules: {
        exchange: 'okx',
        marketType: 'spot',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
        takeProfitPct: 10,
        takeProfitBasis: 'entry_avg_price',
      },
    })

    expect(summary).toContain('止损：价格相对入场价下跌 5% 强制平仓')
    expect(summary).toContain('止盈：价格相对入场价上涨 10% 平仓')
    expect(summary).toContain('ETHUSDT')
  })

  it('renders explicit non-entry risk bases accurately in clarification summary', () => {
    const summary = (service as any).buildClarificationSummary({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      exitRules: ['浮盈回撤 3% 止损'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        stopLossPct: 3,
        stopLossBasis: 'peak_position_pnl',
        takeProfitPct: 8,
        takeProfitBasis: 'prev_close',
      },
    })

    expect(summary).toContain('止损：持仓浮盈相对峰值回撤达到 3% 强制平仓')
    expect(summary).toContain('止盈：价格相对上一根K线收盘价上涨 8% 平仓')
    expect(summary).not.toContain('价格相对入场价上涨 8% 平仓')
  })

  it('accepts natural short basis phrasing without requiring the full rule text to be repeated', async () => {
    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-basis-natural-short-answer',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['3m', '15m'],
        entryRules: ['3 分钟内跌 1% 买入'],
        exitRules: ['15 分钟内涨 2% 卖出'],
        riskRules: {
          exchange: 'okx',
          marketType: 'spot',
          positionPct: 10,
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 8,
          takeProfitBasis: 'entry_avg_price',
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'entry.basis.1',
            ruleId: 'entry-1',
            reason: 'ambiguous_condition_basis',
            field: 'entryRules.basis',
            blocking: true,
            question: '入场规则“3 分钟内跌 1% 买入”里的百分比条件，是相对上一根 K 线收盘价、开仓均价、持仓收益，还是别的基准？',
            status: 'pending',
          },
          {
            key: 'exit.basis.1',
            ruleId: 'exit-1',
            reason: 'ambiguous_condition_basis',
            field: 'exitRules.basis',
            blocking: true,
            question: '出场规则“15 分钟内涨 2% 卖出”里的百分比条件，是相对上一根 K 线收盘价、开仓均价、持仓收益，还是别的基准？',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    }))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-basis-natural-short-answer', {
      userId: 'u1',
      message: '相对上一根 K 线收盘价',
      clarificationAnswers: {
        'entry.basis.1': '相对上一根 K 线收盘价',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-basis-natural-short-answer',
      expect.objectContaining({
        latestSpecDesc: expect.objectContaining({
          canonicalDigest: expect.stringMatching(/^sha256:/),
        }),
      }),
    )
    expect((result as any).clarificationGate).toEqual(expect.objectContaining({
      blocked: false,
    }))
  })

  it('syncs exit-rule basis answers into risk stop-loss and take-profit basis fields when they describe the same semantics', async () => {
    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-exit-basis-sync',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['突破布林带上轨时做空'],
        exitRules: ['盈利 10% 止盈', '亏损达到 5% 强制止损'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
          stopLossPct: 5,
          takeProfitPct: 10,
        },
      },
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'exit.basis.1',
            ruleId: 'exit-1',
            reason: 'ambiguous_condition_basis',
            field: 'exitRules.basis',
            blocking: true,
            question: '出场规则“盈利 10% 止盈”里的百分比条件，是相对上一根 K 线收盘价、开仓均价、持仓收益，还是别的基准？',
            status: 'pending',
          },
          {
            key: 'exit.basis.2',
            ruleId: 'exit-2',
            reason: 'ambiguous_condition_basis',
            field: 'exitRules.basis',
            blocking: true,
            question: '出场规则“亏损达到 5% 强制止损”里的百分比条件，是相对上一根 K 线收盘价、开仓均价、持仓收益，还是别的基准？',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    }))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s-exit-basis-sync', {
      userId: 'u1',
      message: '相对开仓均价',
      clarificationAnswers: {
        'exit.basis.1': '相对开仓均价',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-exit-basis-sync',
      expect.objectContaining({
        status: 'CHECKLIST_GATE',
        latestSpecDesc: expect.objectContaining({
          canonicalDigest: expect.stringMatching(/^sha256:/),
        }),
      }),
    )
  })

  it('surfaces publicationGate at the top level when stored in latestSpecDesc', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-publication-gate',
      userId: 'u1',
      status: 'REJECTED',
      checklist: {},
      latestSpecDesc: {
        publicationGate: {
          passed: false,
          blockingMismatches: [
            {
              field: 'exchange',
              expected: 'okx',
              actual: 'binance',
              reason: 'confirmed snapshot and compiled artifact exchange mismatch',
            },
          ],
        },
      },
      rejectReason: 'publication gate blocked',
      clarificationState: {
        status: 'CLEAR',
        items: [],
      },
      strategyInstanceId: null,
    })

    const result = await service.getSession('s-publication-gate', 'u1')

    expect((result as any).publicationGate).toEqual({
      passed: false,
      blockingMismatches: [
        expect.objectContaining({
          field: 'exchange',
          expected: 'okx',
          actual: 'binance',
        }),
      ],
    })
  })

  it('keeps drafting and returns unrelated guidance when planner marks message unrelated', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's3',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {},
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'market.marketType',
            reason: 'missing_market_type',
            field: 'marketType',
            blocking: true,
            allowedAnswers: ['spot', 'perp'],
            question: '该策略运行在现货还是合约市场？',
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
      }),
    })

    const result = await service.continueSession('s3', {
      userId: 'u1',
      message: 'hi',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('无关')
    expect((result as any).clarificationGate).toEqual({
      blocked: true,
      summary: null,
      items: [
        expect.objectContaining({
          key: 'market.marketType',
          status: 'pending',
          blocking: true,
        }),
      ],
      pendingItems: [
        expect.objectContaining({
          key: 'market.marketType',
          status: 'pending',
          blocking: true,
        }),
      ],
    })
    expect(result.canonicalDigest).toBeNull()
    expect(mockRepo.updateSession).not.toHaveBeenCalled()
  })

  it('moves to checklist gate when llm planner marks logic ready', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's4',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({}),
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
        logic: {
          entryRules: ['短均线上穿长均线（金叉）时做多'],
          exitRules: ['短均线下穿长均线（死叉）时平多'],
          riskRules: { exchange: 'okx', marketType: 'perp' },
        },
      }),
    })

    const result = await service.continueSession('s4', {
      userId: 'u1',
      message: '入场用金叉，出场用死叉',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('请确认策略交易标的')
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s4', expect.objectContaining({
      status: 'DRAFTING',
      semanticState: expect.any(Object),
    }))
  })

  it('keeps drafting in continueSession when planner returns logic that requires clarification', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's4-clarify',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({}),
      constraintPack: {},
    })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
        logic: {
          entryRules: ['突破布林带上轨交易'],
          exitRules: ['价格回到布林带中轨(MA20)时平仓'],
        },
      }),
    })

    const result = await service.continueSession('s4-clarify', {
      userId: 'u1',
      message: '就按这个逻辑推进',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('请确认交易所')
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s4-clarify', expect.objectContaining({
      status: 'DRAFTING',
      semanticState: expect.any(Object),
    }))
  })

  it('publishes after confirmGenerate without making a second llm codegen call', async () => {
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '已确认逻辑，开始生成。',
          logic: {
            symbols: ['BTCUSDT'],
            timeframes: ['1h'],
            entryRules: ['短均线上穿长均线（金叉）时做多'],
            exitRules: ['短均线下穿长均线（死叉）时平多'],
            riskRules: {
              exchange: 'okx',
              marketType: 'perp',
              positionPct: 10,
              stopLossPct: 5,
              stopLossBasis: 'entry_avg_price',
              takeProfitPct: 10,
              takeProfitBasis: 'entry_avg_price',
            },
          },
        }),
      })
    mockRepo.createSession.mockResolvedValue({ id: 's5' })
    mockRepo.createVersion.mockResolvedValue({ id: 'v1' })

    const started = await service.startSession({
      userId: 'u1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 1小时图上，短均线上穿长均线（金叉）时做多，短均线下穿长均线（死叉）时平多',
    })

    expect(started.status).toBe('CHECKLIST_GATE')
    expect(started.canonicalDigest).toMatch(/^sha256:/)
    const createdSession = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    const createdChecklist = readPersistedChecklist(createdSession)

    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's5',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: createdChecklist,
      semanticState: createdSession.semanticState,
      clarificationState: createdSession.clarificationState,
      constraintPack: createdSession.constraintPack,
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)

    const dto: ContinueCodegenSessionDto = {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    }
    const result = await service.continueSession('s5', dto)

    expect(result.status).toBe('GENERATING')
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith('s5', expect.objectContaining({
      status: 'GENERATING',
      latestSpecDesc: expect.objectContaining({
        viewType: 'canonical-semantic-view.v1',
      }),
    }))
    await waitForTerminalStatus('s5')

    expect(mockRepo.createVersion).toHaveBeenCalled()
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s5', expect.objectContaining({
      status: 'PUBLISHED',
    }))
    expect(mockAi.chat).toHaveBeenCalledTimes(1)
  })

  it('persists existing semanticState when confirmGenerate moves a checklist-gate session into GENERATING', async () => {
    const persistedChecklist = completeChecklist({
      entryRules: ['价格突破长期均线（50）时买入'],
      exitRules: ['价格跌破短期均线（20）时卖出'],
    })
    const persistedSemanticState = buildLockedMaSemanticState()
    const buildFromNormalizedIntentSpy = jest.spyOn(canonicalSpecBuilder, 'buildFromNormalizedIntent')
    const publicationPipelineRunSpy = jest.spyOn(publicationPipeline, 'run').mockResolvedValue(undefined)
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's5-semantic-generate',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: persistedChecklist,
      semanticState: persistedSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    const result = await service.continueSession('s5-semantic-generate', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildSemanticOnlyCanonicalDigest(persistedSemanticState),
    })

    expect(result.status).toBe('GENERATING')
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith('s5-semantic-generate', expect.objectContaining({
      status: 'GENERATING',
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({
            params: expect.objectContaining({
              'reference.period': 50,
              confirmationMode: 'close_confirm',
            }),
          }),
        ]),
      }),
    }))
    expect(buildFromNormalizedIntentSpy).toHaveBeenCalledWith(
      {
        market: {
          exchange: 'okx',
          marketType: 'perp',
          defaultTimeframe: '1h',
        },
        symbols: ['BTCUSDT'],
        timeframes: ['1h'],
      },
      expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({ key: 'indicator.above', phase: 'entry' }),
          expect.objectContaining({ key: 'indicator.below', phase: 'exit' }),
        ]),
      }),
    )
    expect(publicationPipelineRunSpy).toHaveBeenCalledWith(expect.objectContaining({
      checklist: {},
      canonicalSpecOverride: expect.objectContaining({
        version: 2,
      }),
      semanticState: expect.objectContaining({
        triggers: expect.any(Array),
      }),
    }))
  })

  it('publishes canonical snapshot, semantic view, and compiled artifacts after confirmGenerate', async () => {
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '已确认逻辑，开始生成。',
          logic: {
            symbols: ['BTCUSDT'],
            timeframes: ['1h'],
            entryRules: ['短均线上穿长均线（金叉）时做多'],
            exitRules: ['短均线下穿长均线（死叉）时平多'],
            riskRules: {
              exchange: 'okx',
              marketType: 'perp',
              positionPct: 10,
              stopLossPct: 5,
              stopLossBasis: 'entry_avg_price',
              takeProfitPct: 10,
              takeProfitBasis: 'entry_avg_price',
            },
          },
        }),
      })
    mockRepo.createSession.mockResolvedValue({ id: 's5-compiled' })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-compiled' })

    const started = await service.startSession({
      userId: 'u1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 1小时图上，短均线上穿长均线（金叉）时做多，短均线下穿长均线（死叉）时平多',
    })
    const createdSession = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    const createdChecklist = readPersistedChecklist(createdSession)

    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's5-compiled',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: createdChecklist,
      semanticState: createdSession.semanticState,
      clarificationState: createdSession.clarificationState,
      constraintPack: createdSession.constraintPack,
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)

    await service.continueSession('s5-compiled', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    })

    await waitForTerminalStatus('s5-compiled')

    const publishedSnapshot = mockRepo.create.mock.calls.at(-1)?.[0]
    expect(publishedSnapshot).toEqual(expect.objectContaining({
      semanticGraph: expect.objectContaining({
        viewType: 'canonical-semantic-view.v1',
        canonicalDigest: started.canonicalDigest,
      }),
      irSnapshot: expect.objectContaining({
        irVersion: 'csi.v1',
      }),
      astSnapshot: expect.objectContaining({
        astVersion: 'csa.v1',
      }),
      executionEnvelope: expect.objectContaining({
        positionMode: 'long_only',
      }),
      scriptSnapshot: expect.stringContaining('COMPILED_MANIFEST'),
      consistencyReport: expect.objectContaining({
        semanticConsistency: expect.any(Object),
        compilerConsistency: expect.any(Object),
      }),
      snapshotVersion: 3,
    }))
    expect(publishedSnapshot?.specSnapshot).toEqual(expect.objectContaining({
      version: 2,
      indicators: [expect.objectContaining({ kind: 'sma', params: { period: 20 } })],
      rules: expect.arrayContaining([
        expect.objectContaining({
          phase: 'entry',
          sideScope: 'long',
          condition: expect.objectContaining({
            key: 'ma.golden_cross',
            op: 'CROSS_OVER',
          }),
        }),
        expect.objectContaining({
          phase: 'exit',
          sideScope: 'long',
          condition: expect.objectContaining({
            key: 'ma.death_cross',
            op: 'CROSS_UNDER',
          }),
        }),
      ]),
    }))
    expect(publishedSnapshot?.compiledIr).toEqual(expect.objectContaining({
      irVersion: 'csi.v1',
      source: expect.objectContaining({
        specHash: expect.stringMatching(/^sha256:/),
      }),
      signalCatalog: expect.objectContaining({
        series: expect.arrayContaining([
          expect.objectContaining({ kind: 'SMA', params: { period: 7 } }),
          expect.objectContaining({ kind: 'SMA', params: { period: 20 } }),
        ]),
        predicates: expect.arrayContaining([
          expect.objectContaining({ kind: 'CROSS_OVER' }),
          expect.objectContaining({ kind: 'CROSS_UNDER' }),
        ]),
      }),
    }))
    expect(mockAi.chat).toHaveBeenCalledTimes(1)
  })

  it('covers the MA golden case through the first startSession -> confirmGenerate path', async () => {
    await startGoldenCase({
      sessionId: 's-golden-ma-publish',
      message: maGoldenCase.message,
      plannerLogic: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['收盘确认价格突破长期均线（50）时买入'],
        exitRules: ['收盘确认价格跌破短期均线（10）时卖出'],
        riskRules: {
          exchange: 'okx',
          marketType: 'spot',
          positionPct: 10,
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
        },
      }),
    })

    const createdSession = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    const createdChecklist = readPersistedChecklist(createdSession)
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-golden-ma-publish',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: createdChecklist,
      semanticState: createdSession.semanticState,
      clarificationState: createdSession.clarificationState,
      constraintPack: createdSession.constraintPack,
      strategyInstanceId: null,
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)

    const result = await service.continueSession('s-golden-ma-publish', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    })

    expect(result.status).toBe('GENERATING')
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith('s-golden-ma-publish', expect.objectContaining({
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({
            key: 'indicator.above',
            phase: 'entry',
            params: expect.objectContaining({ 'reference.period': 50 }),
          }),
          expect.objectContaining({
            key: 'indicator.below',
            phase: 'exit',
            params: expect.objectContaining({ 'reference.period': 10 }),
          }),
        ]),
      }),
    }))

    await waitForTerminalStatus('s-golden-ma-publish')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-golden-ma-publish', expect.objectContaining({
      status: 'PUBLISHED',
    }))
    expect(mockRepo.createVersion).toHaveBeenCalledTimes(1)
    const publishedSnapshot = mockRepo.create.mock.calls.at(-1)?.[0]
    expect(publishedSnapshot?.specSnapshot?.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        condition: expect.objectContaining({ key: 'ma.golden_cross' }),
      }),
      expect.objectContaining({
        phase: 'exit',
        condition: expect.objectContaining({ key: 'ma.death_cross' }),
      }),
    ]))
  })

  it('keeps semanticState and canonical digest aligned when a persisted MA trigger is replaced', async () => {
    const currentSemanticState = buildLockedMaSemanticState({
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认交易所（binance / okx / hyperliquid）。',
          affectsExecution: true,
          value: 'okx',
        },
        symbol: {
          slotKey: 'symbol',
          fieldPath: 'contextSlots.symbol',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认策略交易标的（例如 BTCUSDT）。',
          affectsExecution: true,
          value: 'BTCUSDT',
        },
        marketType: {
          slotKey: 'marketType',
          fieldPath: 'contextSlots.marketType',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认市场类型（现货或合约/perp）。',
          affectsExecution: true,
          value: 'spot',
        },
        timeframe: {
          slotKey: 'timeframe',
          fieldPath: 'contextSlots.timeframe',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认策略主周期（例如 15m 或 1h）。',
          affectsExecution: true,
          value: '15m',
        },
      },
    })
    const persistedChecklist = completeChecklist({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['收盘确认价格突破长期均线（50）时买入'],
      exitRules: ['收盘确认价格跌破短期均线（20）时卖出'],
      riskRules: {
        exchange: 'okx',
        marketType: 'spot',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
        takeProfitPct: 10,
        takeProfitBasis: 'entry_avg_price',
      },
    })

    mockRepo.findById.mockResolvedValueOnce({
      id: 's-semantic-ma-replace',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: persistedChecklist,
      semanticState: currentSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      strategyInstanceId: null,
    })
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '已更新为 MA200，请确认逻辑图。',
        logic: completeChecklist({
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
          entryRules: ['收盘确认价格突破长期均线（200）时买入'],
          exitRules: ['收盘确认价格跌破短期均线（20）时卖出'],
          riskRules: {
            exchange: 'okx',
            marketType: 'spot',
            positionPct: 10,
            stopLossPct: 5,
            stopLossBasis: 'entry_avg_price',
            takeProfitPct: 10,
            takeProfitBasis: 'entry_avg_price',
          },
        }),
      }),
    })

    const updated = await service.continueSession('s-semantic-ma-replace', {
      userId: 'u1',
      message: '把长期均线改成 MA200',
    })

    const checklistGateUpdate = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    const projectedChecklist = checklistGateUpdate.checklist
      ?? (service as any).projectLegacyChecklistFromSemanticState(checklistGateUpdate.semanticState, persistedChecklist)
    expect(updated.status).toBe('CHECKLIST_GATE')
    expect(checklistGateUpdate.status).toBe('CHECKLIST_GATE')
    expect(projectedChecklist).toEqual(expect.objectContaining({
      entryRules: expect.arrayContaining(['收盘确认价格突破长期均线（200）时买入']),
      exitRules: expect.arrayContaining([expect.stringContaining('短期均线（20）')]),
    }))
    expect(checklistGateUpdate.semanticState).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.above',
          phase: 'entry',
          params: expect.objectContaining({
            'reference.period': 200,
          }),
        }),
      ]),
    }))
    expect(checklistGateUpdate.semanticState.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        phase: 'entry',
        params: expect.objectContaining({
          'reference.period': 50,
        }),
      }),
    ]))
    expect(updated.canonicalDigest).toEqual(checklistGateUpdate.latestSpecDesc?.canonicalDigest)
    expect(updated.canonicalDigest).toMatch(/^sha256:/)
  })

  it('covers the Bollinger golden case through the first startSession -> confirmGenerate path', async () => {
    mockRepo.createVersion.mockResolvedValue({ id: 'v-golden-bollinger' })

    const started = await startGoldenCase({
      sessionId: 's-golden-bollinger-publish',
      message: bollingerGoldenCase.message,
      plannerLogic: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['K线收盘后确认突破布林带(30,2.5)上轨时做空'],
        exitRules: ['价格回到布林带中轨(MA30)时平空'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
        },
      }),
    })

    const createdSession = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    const createdChecklist = readPersistedChecklist(createdSession)
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-golden-bollinger-publish',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: createdChecklist,
      semanticState: createdSession.semanticState,
      clarificationState: createdSession.clarificationState,
      constraintPack: createdSession.constraintPack,
      strategyInstanceId: null,
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)

    const result = await service.continueSession('s-golden-bollinger-publish', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    })

    expect(result.status).toBe('GENERATING')
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith('s-golden-bollinger-publish', expect.objectContaining({
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({
            phase: 'entry',
          }),
          expect.objectContaining({
            key: 'bollinger.touch_middle',
            phase: 'exit',
          }),
        ]),
      }),
      latestSpecDesc: expect.objectContaining({
        rules: expect.arrayContaining([
          expect.objectContaining({
            phase: 'entry',
          }),
          expect.objectContaining({
            phase: 'exit',
            condition: expect.objectContaining({ key: 'bollinger.middle_revert' }),
          }),
        ]),
      }),
    }))

    await waitForTerminalStatus('s-golden-bollinger-publish')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-golden-bollinger-publish', expect.objectContaining({
      status: 'PUBLISHED',
    }))
    const publishedSnapshot = mockRepo.create.mock.calls.at(-1)?.[0]
    expect(publishedSnapshot).toEqual(expect.objectContaining({
      specSnapshot: expect.objectContaining({
        indicators: expect.arrayContaining([
          expect.objectContaining({ kind: 'bollingerBands' }),
        ]),
        rules: expect.arrayContaining([
          expect.objectContaining({
            phase: 'entry',
            condition: expect.objectContaining({ key: 'bollinger.upper_break' }),
          }),
          expect.objectContaining({
            phase: 'exit',
            condition: expect.objectContaining({ key: 'bollinger.middle_revert' }),
          }),
        ]),
      }),
    }))
    expect(publishedSnapshot?.compiledIr?.portfolio?.positionMode).toBe('short_only')
  })

  it('keeps updated Bollinger trigger semantics aligned through checklist gate and publication', async () => {
    const persistedChecklist = completeChecklist({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['K线收盘后确认突破布林带(20,2)上轨时做空'],
      exitRules: ['价格回到布林带中轨(MA20)时平空'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    })

    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-semantic-bollinger-replace',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: persistedChecklist,
      semanticState: buildLockedBollingerSemanticState(),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      strategyInstanceId: null,
    })
    mockRepo.findById.mockResolvedValueOnce(sessionFixture)
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '已更新为布林带(30,2.5)，请确认逻辑图。',
        logic: completeChecklist({
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
          entryRules: ['K线收盘后确认突破布林带(30,2.5)上轨时做空'],
          exitRules: ['价格回到布林带中轨(MA30)时平空'],
          riskRules: {
            exchange: 'okx',
            marketType: 'perp',
            positionPct: 10,
          },
        }),
      }),
    })

    const updated = await service.continueSession('s-semantic-bollinger-replace', {
      userId: 'u1',
      message: '把布林带改成 30 周期 2.5 倍标准差',
    })

    expect(updated.status).toBe('CHECKLIST_GATE')
    const checklistGateUpdate = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    const projectedChecklist = checklistGateUpdate.checklist
      ?? (service as any).projectLegacyChecklistFromSemanticState(checklistGateUpdate.semanticState, persistedChecklist)
    expect(updated.canonicalDigest).toEqual(
      buildConfirmedCanonicalDigest(projectedChecklist, checklistGateUpdate.semanticState),
    )
    expect(projectedChecklist).toEqual(expect.objectContaining({
      entryRules: expect.arrayContaining(['K线收盘后确认突破布林带(30,2.5)上轨时做空']),
      exitRules: expect.arrayContaining([expect.stringContaining('布林带中轨(MA30)')]),
    }))
    expect(checklistGateUpdate.semanticState).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'bollinger.touch_upper',
          phase: 'entry',
          params: expect.objectContaining({
            period: 30,
            stdDev: 2.5,
          }),
        }),
        expect.objectContaining({
          key: 'bollinger.touch_middle',
          phase: 'exit',
          params: expect.objectContaining({
            period: 30,
            stdDev: 2.5,
          }),
        }),
      ]),
    }))
    expect(checklistGateUpdate.semanticState.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'bollinger.touch_upper',
        phase: 'entry',
        params: expect.objectContaining({
          period: 20,
          stdDev: 2,
        }),
      }),
      expect.objectContaining({
        key: 'bollinger.touch_middle',
        phase: 'exit',
        params: expect.objectContaining({
          period: 20,
          stdDev: 2,
        }),
      }),
    ]))

    mockRepo.findById.mockResolvedValueOnce({
      id: 's-semantic-bollinger-replace',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: checklistGateUpdate.checklist,
      semanticState: checklistGateUpdate.semanticState,
      clarificationState: checklistGateUpdate.clarificationState,
      constraintPack: checklistGateUpdate.constraintPack,
      strategyInstanceId: null,
    })

    const confirmed = await service.continueSession('s-semantic-bollinger-replace', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildSemanticOnlyCanonicalDigest(checklistGateUpdate.semanticState),
    })

    expect(confirmed.status).toBe('GENERATING')
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith('s-semantic-bollinger-replace', expect.objectContaining({
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({
            key: 'bollinger.touch_upper',
            params: expect.objectContaining({
              period: 30,
              stdDev: 2.5,
            }),
          }),
        ]),
      }),
    }))
    const semanticGeneratingUpdate = mockRepo.tryMarkGenerating.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(buildConfirmedCanonicalDigest(
      semanticGeneratingUpdate.checklist,
      semanticGeneratingUpdate.semanticState,
    )).toBe(updated.canonicalDigest)

    await waitForTerminalStatus('s-semantic-bollinger-replace')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-semantic-bollinger-replace', expect.objectContaining({
      status: 'PUBLISHED',
    }))
    const publishedSnapshot = mockRepo.create.mock.calls.at(-1)?.[0]
    expect(publishedSnapshot?.specSnapshot?.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        condition: expect.objectContaining({ key: 'bollinger.upper_break' }),
      }),
      expect.objectContaining({
        phase: 'exit',
        condition: expect.objectContaining({ key: 'bollinger.middle_revert' }),
      }),
    ]))
    expect(publishedSnapshot?.compiledIr?.signalCatalog?.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'UPPER_BAND', params: { period: 30, stdDev: 2.5 } }),
      expect.objectContaining({ kind: 'MID_BAND', params: { period: 30, stdDev: 2.5 } }),
    ]))
  })

  it('keeps structured clarification semantic digests aligned from checklist gate through publication', async () => {
    const persistedChecklist = completeChecklist({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['满足入场条件后开仓'],
      exitRules: ['满足出场条件后平仓'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    })
    const semanticState = buildLockedBollingerSemanticState({
      families: ['single-leg', 'state-gated'],
      triggers: [
        {
          id: 'entry-bollinger-upper',
          key: 'bollinger.touch_upper',
          phase: 'entry',
          params: {
            indicator: 'bollinger',
            period: 20,
            stdDev: 2,
            confirmationMode: 'close_confirm',
          },
          sideScope: 'short',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'exit-bollinger-middle',
          key: 'bollinger.touch_middle',
          phase: 'exit',
          params: {
            indicator: 'bollinger',
            period: 20,
            stdDev: 2,
            confirmationMode: 'close_confirm',
          },
          sideScope: 'short',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'regime-gate',
          key: 'market.regime',
          phase: 'gate',
          params: {
            value: 'range',
            mode: 'hard_gate',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
    })

    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-state-gate-publish',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: persistedChecklist,
      semanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      strategyInstanceId: null,
    }))

    const result = await service.continueSession('s-state-gate-publish', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildSemanticOnlyCanonicalDigest(semanticState),
    })

    expect(result.status).toBe('GENERATING')
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith('s-state-gate-publish', expect.objectContaining({
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({ key: 'bollinger.touch_upper', phase: 'entry' }),
          expect.objectContaining({ key: 'bollinger.touch_middle', phase: 'exit' }),
          expect.objectContaining({ key: 'market.regime', phase: 'gate' }),
        ]),
      }),
    }))

    await waitForTerminalStatus('s-state-gate-publish')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-state-gate-publish', expect.objectContaining({
      status: 'PUBLISHED',
    }))
    const publishedSnapshot = mockRepo.create.mock.calls.at(-1)?.[0]
    expect(publishedSnapshot?.specSnapshot?.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        condition: expect.objectContaining({
          kind: 'AND',
          children: expect.arrayContaining([
            expect.objectContaining({ key: 'bollinger.upper_break' }),
            expect.objectContaining({ key: 'market.regime', value: 'range' }),
          ]),
        }),
        metadata: expect.objectContaining({
          normalized: expect.objectContaining({
            gateKeys: expect.arrayContaining(['market.regime']),
          }),
        }),
      }),
    ]))
    expect(publishedSnapshot?.compiledIr?.signalCatalog?.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'UPPER_BAND', params: { period: 20, stdDev: 2 } }),
      expect.objectContaining({ kind: 'MID_BAND', params: { period: 20, stdDev: 2 } }),
    ]))
    expect(publishedSnapshot?.compiledIr?.portfolio?.positionMode).toBe('short_only')
  })

  it('covers the grid golden case through confirmGenerate with atomic grid rules intact', async () => {
    mockRepo.createVersion.mockResolvedValue({ id: 'v-golden-grid' })

    const started = await startGoldenCase({
      sessionId: 's-golden-grid-publish',
      message: '在okx交易所合约市场的BTCUSDT 15m上，做一个60000到80000的网格策略，每格0.5%，突破区间就停掉，单笔10%资金。',
      plannerLogic: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        grid: {
          lower: 60000,
          upper: 80000,
          stepPct: 0.5,
          sideMode: 'bidirectional',
          breakoutAction: 'pause',
        },
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
        },
      }),
    })
    expect(started.status).toBe('CHECKLIST_GATE')
    expect(started.canonicalDigest).toMatch(/^sha256:/)

    const createdSession = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    const createdChecklist = readPersistedChecklist(createdSession)
    expect(createdChecklist.grid).toEqual({
      lower: 60000,
      upper: 80000,
      stepPct: 0.5,
      sideMode: 'bidirectional',
      breakoutAction: 'pause',
    })
    expect(buildConfirmedCanonicalDigest(createdChecklist, createdSession.semanticState)).toBe(started.canonicalDigest)
    mockRepo.findById.mockResolvedValue({
      id: 's-golden-grid-publish',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: createdChecklist,
      semanticState: createdSession.semanticState,
      clarificationState: createdSession.clarificationState,
      constraintPack: createdSession.constraintPack,
      strategyInstanceId: null,
    })

    const result = await service.continueSession('s-golden-grid-publish', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(createdChecklist, createdSession.semanticState),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-golden-grid-publish')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-golden-grid-publish', expect.objectContaining({
      status: 'PUBLISHED',
    }))
    const publishedSnapshot = mockRepo.create.mock.calls.at(-1)?.[0]
    expect(publishedSnapshot?.specSnapshot?.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        condition: expect.objectContaining({ key: 'grid.range_rebalance' }),
        sideScope: 'long',
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        condition: expect.objectContaining({ key: 'grid.range_rebalance' }),
        sideScope: 'short',
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        condition: expect.objectContaining({ key: 'grid.range_rebalance' }),
        sideScope: 'long',
        phase: 'exit',
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
      expect.objectContaining({
        condition: expect.objectContaining({ key: 'grid.range_rebalance' }),
        sideScope: 'short',
        phase: 'exit',
        actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })],
      }),
    ]))
    expect(publishedSnapshot?.compiledIr?.signalCatalog?.levelSets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'ARITHMETIC_LEVEL_SET',
        spacing: expect.objectContaining({ mode: 'pct', value: 0.5 }),
      }),
    ]))
    expect(publishedSnapshot?.compiledIr?.signalCatalog?.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'TOUCH_LEVEL_DOWN' }),
      expect.objectContaining({ kind: 'TOUCH_LEVEL_UP' }),
    ]))
    expect(publishedSnapshot?.compiledIr?.portfolio?.positionMode).toBe('long_short')
    expect(publishedSnapshot).toEqual(expect.objectContaining({
      strategyConfig: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        baseTimeframe: '15m',
        stateTimeframes: [],
        positionPct: 10,
        strategyDeclaredLeverageRange: null,
      },
      backtestConfigDefaults: expect.objectContaining({
        initialCash: 10000,
        leverage: 1,
        priceSource: 'close',
        allowPartial: false,
      }),
      deploymentExecutionDefaults: expect.objectContaining({
        leverage: 1,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'gtc',
      }),
      deploymentExecutionConstraints: expect.objectContaining({
        defaultLeverage: 1,
        supportedOrderTypes: ['market'],
        supportedTimeInForce: ['gtc'],
      }),
    }))
  })

  it('publishes bollinger strategy after confirmGenerate without reintroducing sma semantics', async () => {
    const checklist = completeChecklist({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['K线收盘后确认突破布林带上轨时做空', 'K线收盘后确认突破布林带下轨时做多'],
      exitRules: ['价格回到布林带中轨(MA20)时平仓'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
        takeProfitPct: 10,
        takeProfitBasis: 'entry_avg_price',
      },
    })
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-bollinger-publish',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: null,
      checklist,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)

    const result = await service.continueSession('s-bollinger-publish', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-bollinger-publish')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-bollinger-publish', expect.objectContaining({
      status: 'PUBLISHED',
    }))
    const publishedSnapshot = mockRepo.create.mock.calls.at(-1)?.[0]
    expect(publishedSnapshot).toEqual(expect.objectContaining({
      specSnapshot: expect.objectContaining({
        indicators: expect.arrayContaining([
          expect.objectContaining({ kind: 'bollingerBands', params: { period: 20, stdDev: 2 } }),
        ]),
        rules: expect.arrayContaining([
          expect.objectContaining({
            phase: 'entry',
            condition: expect.objectContaining({ key: 'bollinger.upper_break' }),
          }),
          expect.objectContaining({
            phase: 'entry',
            condition: expect.objectContaining({ key: 'bollinger.lower_break' }),
          }),
          expect.objectContaining({
            phase: 'exit',
            condition: expect.objectContaining({ key: 'bollinger.middle_revert' }),
          }),
        ]),
      }),
      compiledIr: expect.objectContaining({
        signalCatalog: expect.objectContaining({
          series: expect.arrayContaining([
            expect.objectContaining({ kind: 'UPPER_BAND', params: { period: 20, stdDev: 2 } }),
            expect.objectContaining({ kind: 'LOWER_BAND', params: { period: 20, stdDev: 2 } }),
            expect.objectContaining({ kind: 'MID_BAND', params: { period: 20, stdDev: 2 } }),
          ]),
        }),
      }),
    }))
    expect(publishedSnapshot?.specSnapshot?.indicators).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'sma' }),
    ]))
    expect(publishedSnapshot).toEqual(expect.objectContaining({
      strategyConfig: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        baseTimeframe: '15m',
        stateTimeframes: [],
        positionPct: 10,
        strategyDeclaredLeverageRange: null,
      },
      backtestConfigDefaults: expect.objectContaining({
        initialCash: 10000,
        leverage: 1,
        priceSource: 'close',
        allowPartial: false,
      }),
      deploymentExecutionDefaults: expect.objectContaining({
        leverage: 1,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'gtc',
      }),
      deploymentExecutionConstraints: expect.objectContaining({
        defaultLeverage: 1,
        supportedOrderTypes: ['market'],
        supportedTimeInForce: ['gtc'],
      }),
    }))
  })

  it('publishes price-change strategy after confirmGenerate through the canonical mainline', async () => {
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-price-change-publish',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: null,
      checklist: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['3m', '15m'],
        entryRules: ['3m 内下跌 1% 买入'],
        exitRules: ['15m 内上涨 2% 卖出'],
        entryRuleBases: { 'entry-1': 'prev_close' },
        exitRuleBases: { 'exit-1': 'prev_close' },
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
        },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)

    const result = await service.continueSession('s-price-change-publish', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-price-change-publish')

    const publishedUpdate = mockRepo.updateSession.mock.calls.find(call =>
      call[0] === 's-price-change-publish' && (call[1] as { status?: string }).status === 'PUBLISHED',
    )?.[1] as Record<string, any> | undefined
    expect(publishedUpdate).toEqual(expect.objectContaining({
      status: 'PUBLISHED',
      latestSpecDesc: expect.objectContaining({
        canonicalSpec: expect.objectContaining({
          rules: expect.arrayContaining([
            expect.objectContaining({
              phase: 'entry',
              sideScope: 'long',
              condition: expect.objectContaining({ key: 'price.change_pct', value: -0.01 }),
            }),
            expect.objectContaining({
              phase: 'exit',
              sideScope: 'long',
              condition: expect.objectContaining({ key: 'price.change_pct', value: 0.02 }),
            }),
          ]),
        }),
      }),
    }))
    const publishedSnapshot = mockRepo.create.mock.calls.at(-1)?.[0]
    expect(publishedSnapshot).toEqual(expect.objectContaining({
      strategyConfig: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        baseTimeframe: '3m',
        stateTimeframes: ['15m'],
        positionPct: 10,
        strategyDeclaredLeverageRange: null,
      },
      backtestConfigDefaults: expect.objectContaining({
        initialCash: 10000,
        leverage: 1,
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
        allowPartial: false,
      }),
      deploymentExecutionDefaults: expect.objectContaining({
        leverage: 1,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'gtc',
      }),
      deploymentExecutionConstraints: expect.objectContaining({
        defaultLeverage: 1,
        supportedPriceSources: ['close'],
        supportedOrderTypes: ['market'],
        supportedTimeInForce: ['gtc'],
      }),
    }))
  })

  it('preserves explicit Bollinger exit and risk rules when a follow-up message completes a compileability-blocked conversation with only a partial semanticPatch', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-bollinger-exit-followup' })
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '当前规则还不能稳定生成脚本：未识别可编译出场规则。请补充能明确落成主链规则的入场/出场条件后再确认逻辑图。',
        logic: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
          entryRules: ['K线收盘后确认突破布林带(20,2)上轨时做空', 'K线收盘后确认突破布林带(20,2)下轨时做多'],
          riskRules: {
            exchange: 'okx',
            marketType: 'perp',
            positionPct: 10,
          },
        },
      }),
    })

    const started = await service.startSession({
      userId: 'u1',
      initialMessage: 'OKX 合约 BTCUSDT 15m，价格触及/突破布林带(20,2)上轨时做空，触及/突破下轨时做多；多单在价格回到布林带中轨(MA20)时平仓，空单在价格跌破布林带中轨(MA20)时平仓；单笔仓位 10%。',
    })

    expect(started.status).toBe('DRAFTING')
    const createdSession = buildPersistedSessionSnapshot(
      's-bollinger-exit-followup',
      mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, unknown>,
      {
        clarificationState: started.clarificationState,
        latestSpecDesc: started.specDesc ?? null,
        semanticState: (mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, unknown>).semanticState,
      },
    )

    mockRepo.findById.mockResolvedValueOnce({
      ...createdSession,
      updatedAt: '2026-04-19T20:00:00.000Z',
    })
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '当前已理解为：在 OKX 永续 BTCUSDT 15m 上，价格触及/突破布林带(20,2)上轨做空，价格触及/突破下轨做多；多单在价格回到布林带中轨(MA20)时平仓，空单在价格跌破布林带中轨(MA20)时平仓；单笔仓位 10%。请确认该策略逻辑是否正确。',
        semanticPatch: {
          triggers: [
            {
              key: 'bollinger.touch_upper',
              phase: 'entry',
              sideScope: 'short',
              params: { indicator: 'bollinger', period: 20, stdDev: 2, confirmationMode: 'close_confirm' },
            },
            {
              key: 'bollinger.touch_lower',
              phase: 'entry',
              sideScope: 'long',
              params: { indicator: 'bollinger', period: 20, stdDev: 2, confirmationMode: 'close_confirm' },
            },
          ],
          actions: [
            { key: 'open_short' },
            { key: 'open_long' },
          ],
          contextSlots: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'perp',
            timeframe: '15m',
          },
          position: {
            mode: 'fixed_ratio',
            value: 0.1,
            positionMode: 'long_short',
          },
        },
        logic: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
          entryRules: ['K线收盘后确认突破布林带(20,2)上轨时做空', 'K线收盘后确认突破布林带(20,2)下轨时做多'],
          exitRules: ['多单在价格回到布林带中轨(MA20)时平仓', '空单在价格跌破布林带中轨(MA20)时平仓'],
          riskRules: {
            exchange: 'okx',
            marketType: 'perp',
            positionPct: 10,
            stopLossPct: 5,
            stopLossBasis: 'entry_avg_price',
            takeProfitPct: 10,
            takeProfitBasis: 'entry_avg_price',
          },
        },
      }),
    })

    const updated = await service.continueSession('s-bollinger-exit-followup', {
      userId: 'u1',
      message: '出场：多单在价格回到布林带中轨(MA20)时平仓，空单在价格跌破布林带中轨(MA20)时平仓',
    })

    expect(updated.status).toBe('CHECKLIST_GATE')
    const checklistGateUpdate = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(checklistGateUpdate.semanticState).toEqual(expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({ key: 'bollinger.touch_upper', phase: 'entry' }),
        expect.objectContaining({ key: 'bollinger.touch_lower', phase: 'entry' }),
        expect.objectContaining({ key: 'bollinger.touch_middle', phase: 'exit' }),
      ]),
      risk: expect.arrayContaining([
        expect.objectContaining({ key: 'risk.stop_loss_pct' }),
        expect.objectContaining({ key: 'risk.take_profit_pct' }),
      ]),
    }))
    expect(updated.assistantPrompt).toContain('请确认是否按此逻辑生成')

    mockRepo.findById.mockResolvedValueOnce(buildSemanticEraSessionFixture({
      id: 's-bollinger-exit-followup',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      semanticState: checklistGateUpdate.semanticState,
      clarificationState: checklistGateUpdate.clarificationState,
      constraintPack: checklistGateUpdate.constraintPack,
      latestSpecDesc: checklistGateUpdate.latestSpecDesc,
      strategyInstanceId: null,
    }))

    const result = await service.continueSession('s-bollinger-exit-followup', {
      userId: 'u1',
      message: 'Confirm code generation',
      confirmGenerate: true,
      confirmedCanonicalDigest: updated.canonicalDigest ?? readCanonicalDigestFromSpecDesc(checklistGateUpdate.latestSpecDesc),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-bollinger-exit-followup')

    const publishedSnapshot = mockRepo.create.mock.calls.at(-1)?.[0]
    expect(publishedSnapshot?.specSnapshot?.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        condition: expect.objectContaining({ key: 'bollinger.upper_break' }),
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({ key: 'bollinger.lower_break' }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        actions: expect.arrayContaining([expect.objectContaining({ type: 'CLOSE_LONG' })]),
      }),
      expect.objectContaining({
        id: 'risk-stop-loss',
        phase: 'risk',
      }),
      expect.objectContaining({
        id: 'risk-take-profit',
        phase: 'risk',
      }),
    ]))
  })

  it('rejects compiler-first publish when compiled script fails structural validation', async () => {
    const emitSpy = jest
      .spyOn(CompiledScriptEmitterService.prototype, 'emit')
      .mockReturnValue('broken compiled script')

    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-runtime-invalid',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: null,
      checklist: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['EMA7 上穿 EMA21 做多'],
        exitRules: ['EMA7 下穿 EMA21 平多'],
        riskRules: { positionPct: 10 },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)

    const result = await service.continueSession('s-runtime-invalid', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-runtime-invalid')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-runtime-invalid', expect.objectContaining({
      status: 'REJECTED',
      rejectReason: expect.stringContaining('编译脚本结构校验失败'),
    }))
    expect(mockRepo.createVersion).not.toHaveBeenCalled()
    expect(mockRepo.create).not.toHaveBeenCalled()
    expect(emitSpy).toHaveBeenCalledTimes(1)
  })

  it('marks session as consistency failed when compiled publication gate reports failed compiler consistency', async () => {
    jest
      .spyOn(StrategyConsistencyService.prototype, 'evaluate')
      .mockReturnValue({
        status: 'PASSED',
        checks: [],
        summary: {
          criticalFailed: 0,
          warningFailed: 0,
          unprovable: 0,
        },
        specProfile: {
          actions: [],
          fallbackDetected: false,
          indicators: [],
          requiredParams: [],
          ruleMappings: [],
          rules: [],
        },
        scriptProfile: {
          actions: [],
          fallbackDetected: false,
          indicators: [],
          requiredParams: [],
          ruleMappings: [],
          rules: [],
        },
      } as never)
    const publishSpy = jest
      .spyOn(CompiledPublicationGateService.prototype, 'publish')
      .mockResolvedValue({
        snapshotId: 'snapshot-compiler-failed',
        snapshotHash: 'snapshot-hash-compiler-failed',
        consistencyReport: {
          status: 'FAILED',
          semanticConsistency: { status: 'PASSED', checks: [] },
          compilerConsistency: {
            status: 'FAILED',
            graphVsIr: { passed: false },
          },
        },
      })

    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-compiler-consistency-failed',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: null,
      checklist: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['EMA7 上穿 EMA21 做多'],
        exitRules: ['EMA7 下穿 EMA21 平多'],
        riskRules: { positionPct: 10 },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)

    const result = await service.continueSession('s-compiler-consistency-failed', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-compiler-consistency-failed')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-compiler-consistency-failed', expect.objectContaining({
      status: 'CONSISTENCY_FAILED',
      rejectReason: expect.stringContaining('编译发布一致性校验失败'),
      latestSpecDesc: expect.objectContaining({
        consistencyReport: expect.objectContaining({
          status: 'FAILED',
        }),
      }),
    }))

    const hasPublished = mockRepo.updateSession.mock.calls.some(call =>
      call[0] === 's-compiler-consistency-failed' && (call[1] as { status?: string }).status === 'PUBLISHED',
    )
    expect(hasPublished).toBe(false)
    expect(publishSpy).toHaveBeenCalledTimes(1)
  })

  it('rejects confirmGenerate when confirmedCanonicalDigest does not match the current semantic view', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'session-1',
      userId: 'u-1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['EMA7 上穿 EMA21 做多'],
        exitRules: ['EMA7 下穿 EMA21 平多'],
        riskRules: { positionPct: 10 },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      latestDraftCode: null,
      latestSpecDesc: null,
      rejectReason: null,
      strategyInstanceId: null,
    })

    await expect(service.continueSession('session-1', {
      userId: 'u-1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: 'sha256:stale',
    })).rejects.toThrow('codegen.confirmation_digest_mismatch')
  })

  it('rejects processing-session requeue when confirmedCanonicalDigest mismatches current semantic view', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'session-processing-1',
      userId: 'u-1',
      status: 'VALIDATING_RUNTIME',
      checklist: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['EMA7 上穿 EMA21 做多'],
        exitRules: ['EMA7 下穿 EMA21 平多'],
        riskRules: { positionPct: 10 },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      latestDraftCode: 'const strategy = {}',
      latestSpecDesc: null,
      rejectReason: null,
      strategyInstanceId: null,
    })

    await expect(service.continueSession('session-processing-1', {
      userId: 'u-1',
      message: '确认并继续',
      confirmGenerate: true,
      confirmedCanonicalDigest: 'sha256:stale',
    })).rejects.toThrow('codegen.confirmation_digest_mismatch')

    expect(mockRepo.tryRequeueFromProcessing).not.toHaveBeenCalled()
  })

  it('publishes through the compiler-first mainline even when legacy model output would violate the signal payload schema', async () => {
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's6',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        entryRules: ['RSI 14 低于 30 时做多'],
        exitRules: ['收益率达到 5% 止盈'],
      }),
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '可以生成',
        }),
      })
      .mockResolvedValueOnce({ content: 'return "BUY"' })
      .mockResolvedValueOnce({ content: 'return "BUY"' })
      .mockResolvedValueOnce({ content: 'return "BUY"' })
    mockRepo.createVersion.mockResolvedValue({ id: 'v2' })

    const result = await service.continueSession('s6', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s6')

    const hasPublished = mockRepo.updateSession.mock.calls.some(call =>
      call[0] === 's6' && (call[1] as { status?: string }).status === 'PUBLISHED',
    )
    expect(hasPublished).toBe(true)
  })
  it('generates directly when confirmGenerate is true and checklist is complete even if session is drafting', async () => {
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's7',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      }),
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "阻力位突破", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v3' })

    const result = await service.continueSession('s7', {
      userId: 'u1',
      message: '确认，直接生成代码',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s7')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s7', expect.objectContaining({
      status: 'PUBLISHED',
    }))
  })

  it('does not block confirmGenerate with the legacy entry and exit completion prompt when the semantic snapshot is complete and the canonical spec can compile', async () => {
    const semanticCompleteChecklist = completeChecklist({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['收盘确认价格突破长期均线（50）时买入'],
      exitRules: ['收盘确认价格跌破短期均线（20）时卖出'],
      riskRules: {
        exchange: 'okx',
        marketType: 'spot',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
        takeProfitPct: 10,
        takeProfitBasis: 'entry_avg_price',
      },
    })
    const persistedSemanticState = (service as any).buildFallbackSemanticState(semanticCompleteChecklist)
    mockRepo.findById.mockResolvedValue({
      id: 's7-semantic-complete',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: semanticCompleteChecklist,
      semanticState: persistedSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    const missingFieldsSpy = jest
      .spyOn(CodegenConversationService.prototype as any, 'resolveChecklistMissingFields')
      .mockReturnValue(['entryRules', 'exitRules'])
    const confirmedCanonicalDigest = buildConfirmedCanonicalDigest(semanticCompleteChecklist, persistedSemanticState)
    const readCanonicalDigestSpy = jest
      .spyOn(CodegenConversationService.prototype as any, 'readCanonicalDigest')
      .mockReturnValue(confirmedCanonicalDigest)

    try {
      const result = await service.continueSession('s7-semantic-complete', {
        userId: 'u1',
        message: '确认逻辑图',
        confirmGenerate: true,
        confirmedCanonicalDigest,
      })

      expect(result.status).toBe('GENERATING')
    } finally {
      readCanonicalDigestSpy.mockRestore()
      missingFieldsSpy.mockRestore()
    }
  })

  it('persists updated semanticState when confirmGenerate closes a semantic slot before GENERATING', async () => {
    const persistedChecklist = completeChecklist({
      entryRules: ['价格突破长期均线时买入'],
      exitRules: ['价格跌破短期均线（20）时卖出'],
    })
    const persistedSemanticState = buildLockedMaSemanticState({
      triggers: [
        {
          id: 'entry-ma',
          key: 'indicator.above',
          phase: 'entry',
          params: {
            indicator: 'ma',
            referenceRole: 'long_term',
            confirmationMode: 'close_confirm',
          },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
            {
              slotKey: 'reference.period.entry',
              fieldPath: 'triggers[0].params.reference.period',
              status: 'open',
              priority: 'core',
              questionHint: '长期均线是多少？',
              affectsExecution: true,
            },
          ],
        },
        {
          id: 'exit-ma',
          key: 'indicator.below',
          phase: 'exit',
          params: {
            indicator: 'ma',
            referenceRole: 'short_term',
            'reference.period': 20,
            confirmationMode: 'close_confirm',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
    })
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's7-semantic-confirm-answer',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: persistedChecklist,
      semanticState: persistedSemanticState,
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'semantic.reference.period.entry',
            reason: 'missing_entry_rules',
            field: 'entryRules',
            blocking: true,
            question: '长期均线是多少？',
            status: 'pending',
            slotId: JSON.stringify(['reference.period.entry', 'triggers[0].params.reference.period']),
            slotKey: 'reference.period.entry',
            fieldPath: 'triggers[0].params.reference.period',
          },
        ],
      },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValueOnce({
      content: 'return "BUY"',
    })
    const answeredSemanticState = (service as any).applySemanticClarificationAnswers(
      persistedSemanticState,
      {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'semantic.reference.period.entry',
            reason: 'missing_entry_rules',
            field: 'entryRules',
            blocking: true,
            question: '长期均线是多少？',
            status: 'pending',
            slotId: JSON.stringify(['reference.period.entry', 'triggers[0].params.reference.period']),
            slotKey: 'reference.period.entry',
            fieldPath: 'triggers[0].params.reference.period',
          },
        ],
      },
      {
        'semantic.reference.period.entry': 'MA50',
      },
    )
    const answeredFixture = buildSemanticEraSessionFixture({
      ...sessionFixture,
      semanticState: answeredSemanticState,
      clarificationState: {
        status: 'CLEAR',
        items: [],
      },
    })
    const result = await service.continueSession('s7-semantic-confirm-answer', {
      userId: 'u1',
      message: '确认，直接生成代码',
      clarificationAnswers: {
        'semantic.reference.period.entry': 'MA50',
      },
      confirmGenerate: true,
      confirmedCanonicalDigest: buildSemanticOnlyCanonicalDigest(answeredSemanticState),
    })

    expect(result.status).toBe('GENERATING')
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith('s7-semantic-confirm-answer', expect.objectContaining({
      status: 'GENERATING',
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({
            status: 'locked',
            params: expect.objectContaining({
              'reference.period': 50,
              confirmationMode: 'close_confirm',
            }),
          }),
        ]),
      }),
    }))
  })

  it('returns rejected payload instead of throwing 500 when compiler-first publication setup throws', async () => {
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's8',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      }),
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockRepo.createVersion.mockRejectedValueOnce(new Error('version write failed'))

    const result = await service.continueSession('s8', {
      userId: 'u1',
      message: '确认，直接生成代码',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s8')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s8', expect.objectContaining({
      status: 'REJECTED',
      rejectReason: expect.stringContaining('version write failed'),
    }))
  })

  it('marks session rejected instead of published when publish step fails after code generation', async () => {
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's8-publish-fail',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      }),
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'const strategy: StrategyAdapterV1 = { protocolVersion: "v1", onBar(): StrategyDecisionV1 { return { action: "NOOP" } } }\nstrategy',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-publish-fail' })
    mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession.mockRejectedValue(
      new Error('Transaction API error: Unable to start a transaction in the given time.'),
    )

    const result = await service.continueSession('s8-publish-fail', {
      userId: 'u1',
      message: '确认，直接生成代码',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s8-publish-fail')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s8-publish-fail', expect.objectContaining({
      status: 'REJECTED',
      latestDraftCode: expect.any(String),
      latestSpecDesc: expect.any(Object),
      rejectReason: expect.stringContaining('Unable to start a transaction'),
      strategyInstanceId: null,
    }))
  })

  it('persists publicationGate in session payload when compiled publication gate blocks publish', async () => {
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's8-publication-blocked',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['1h'],
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
        },
      },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    jest.spyOn(CompiledPublicationGateService.prototype, 'publish').mockRejectedValue(
      Object.assign(new Error('publication gate blocked: confirmed exchange=okx，but IR=binance、script=binance'), {
        publicationGate: {
          status: 'FAILED',
          checks: [
            {
              key: 'market.exchange',
              blocking: true,
              status: 'failed',
              expected: 'okx',
              actual: {
                ir: 'binance',
                script: 'binance',
              },
              message: 'confirmed exchange=okx，but IR=binance、script=binance',
            },
          ],
        },
      }),
    )

    const result = await service.continueSession('s8-publication-blocked', {
      userId: 'u1',
      message: '确认，直接生成代码',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s8-publication-blocked')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s8-publication-blocked', expect.objectContaining({
      status: 'REJECTED',
      latestSpecDesc: expect.objectContaining({
        publicationGate: {
          passed: false,
          blockingMismatches: [
            expect.objectContaining({
              field: 'exchange',
              expected: 'okx',
              actual: 'binance',
            }),
          ],
        },
      }),
      rejectReason: expect.stringContaining('publication gate blocked'),
    }))
  })

  it('publishes without calling ai codegen even when strict mode flags are enabled', async () => {
    setProcessEnvValue('LLM_CODEGEN_STRICT_ENABLED', 'true')
    setProcessEnvValue('LLM_CODEGEN_STRICT_FALLBACK', 'false')

    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's9',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      }),
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)

    const result = await service.continueSession('s9', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
      providerCode: 'uniapi',
      model: 'gpt-4',
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s9')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s9', expect.objectContaining({
      status: 'PUBLISHED',
    }))
    expect(mockAi.chat).not.toHaveBeenCalled()
  })

  it('marks session as consistency failed when validated script does not match checklist semantics', async () => {
    jest.spyOn(StrategyConsistencyService.prototype, 'evaluate').mockReturnValue({
      status: 'FAILED',
      checks: [
        {
          key: 'entry',
          level: 'critical',
          status: 'failed',
          expected: '布林带上轨做空 / 下轨做多',
          actual: '双均线趋势跟随',
          message: '策略语义与确认逻辑图不一致',
        },
      ],
      summary: { criticalFailed: 1, warningFailed: 0, unprovable: 0 },
      specProfile: {
        indicators: [],
        actions: [],
        ruleMappings: [],
        rules: [],
        sizing: null,
        requiredParams: [],
        fallbackDetected: false,
      },
      scriptProfile: {
        indicators: [],
        actions: [],
        ruleMappings: [],
        rules: [],
        sizing: null,
        requiredParams: [],
        fallbackDetected: false,
      },
    } as never)
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-consistency',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['K线收盘后确认突破布林带上轨时做空', 'K线收盘后确认突破布林带下轨时做多'],
        exitRules: ['价格回到布林带中轨(MA20)时平仓'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
          earlyStop: '价格连续3根K线在轨外时直接减仓',
        },
      },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockRepo.createVersion.mockResolvedValue({ id: 'v-consistency' })

    const result = await service.continueSession('s-consistency', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-consistency')

    const hasRejectedOrConsistencyFailed = mockRepo.updateSession.mock.calls.some(call =>
      call[0] === 's-consistency' && (call[1] as { status?: string }).status === 'CONSISTENCY_FAILED',
    )
    const hasPublished = mockRepo.updateSession.mock.calls.some(call =>
      call[0] === 's-consistency' && (call[1] as { status?: string }).status === 'PUBLISHED',
    )
    expect(hasRejectedOrConsistencyFailed).toBe(true)
    expect(hasPublished).toBe(false)
    expect(mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession).not.toHaveBeenCalled()
  }, 15_000)

  it('allows confirmGenerate to proceed even when builder is forced to canonical spec v1', async () => {
    const buildSpy = jest.spyOn(canonicalSpecBuilder, 'build').mockReturnValue({
      version: 1,
      market: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        timeframe: '15m',
      },
      indicators: [],
      entries: [],
      exits: [],
      riskRules: [],
      sizing: {
        mode: 'RATIO',
        value: 0.1,
      },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {},
    } as never)

    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-v1',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['突破布林带上轨时做空'],
        exitRules: ['价格回到布林带中轨时平仓'],
        riskRules: {
          exchange: 'binance',
          marketType: 'perp',
          positionPct: 10,
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
        },
      },
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          code: 'const strategy: StrategyAdapterV1 = { protocolVersion: "v1", onBar(): StrategyDecisionV1 { return { action: "NOOP" } } }\nstrategy',
        }),
      })

    const result = await service.continueSession('s-v1', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
      providerCode: 'uniapi',
      model: 'gpt-4',
    })

    expect(result.status).toBe('GENERATING')

    buildSpy.mockRestore()
  })

  it('creates strategy instance on publish and returns it in published snapshot', async () => {
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-new-instance',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: null,
      checklist: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['5m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      }),
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "breakout", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-instance-1' })
    mockRepo.updateSession.mockResolvedValue({ id: 's-new-instance' })

    const result = await service.continueSession('s-new-instance', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-new-instance')

    expect(mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession).toHaveBeenCalledTimes(1)
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 's-new-instance',
      strategyInstanceId: 'instance-1',
      scriptSnapshot: expect.any(String),
    }))
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-new-instance', expect.objectContaining({
      status: 'PUBLISHED',
      strategyInstanceId: 'instance-1',
    }))
  })

  it('propagates requested exchange and perp marketType into published artifacts', async () => {
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-perp-publish',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: null,
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
        },
      },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "grid", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-perp-1' })
    mockRepo.updateSession.mockResolvedValue({ id: 's-perp-publish' })

    const result = await service.continueSession('s-perp-publish', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-perp-publish')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-perp-publish', expect.objectContaining({
      status: 'PUBLISHED',
      latestSpecDesc: expect.objectContaining({
        lockedParams: expect.objectContaining({
          exchange: 'okx',
          marketType: 'perp',
        }),
        canonicalSpec: expect.objectContaining({
          market: expect.objectContaining({
            exchange: 'okx',
            marketType: 'perp',
          }),
        }),
      }),
    }))
  })

  it('does not recreate strategy instance when session already bound', async () => {
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-existing-instance',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: 'instance-existing',
      checklist: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      }),
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "breakout", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-instance-2' })
    mockRepo.updateSession.mockResolvedValue({ id: 's-existing-instance' })

    const result = await service.continueSession('s-existing-instance', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-existing-instance')

    expect(mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession).not.toHaveBeenCalled()
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-existing-instance', expect.objectContaining({
      status: 'PUBLISHED',
      strategyInstanceId: 'instance-existing',
    }))
  })

  it('rejects publish when strategy instance binding fails before snapshot creation', async () => {
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-instance-failed',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: null,
      checklist: completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['5m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      }),
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat
      .mockResolvedValueOnce({
        content: JSON.stringify({
          related: true,
          logicReady: true,
          assistantPrompt: '逻辑已确认，可以生成。',
        }),
      })
      .mockResolvedValueOnce({
        content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "breakout", positionSizeRatio: 0.1 }',
      })
    mockRepo.createVersion.mockResolvedValue({ id: 'v-instance-3' })
    mockRepo.ensureDraftStrategyInstanceBoundForPublishedSession.mockRejectedValueOnce(new Error('create instance failed'))
    mockRepo.updateSession.mockResolvedValue({ id: 's-instance-failed' })

    const result = await service.continueSession('s-instance-failed', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-instance-failed')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-instance-failed', expect.objectContaining({
      status: 'REJECTED',
      latestDraftCode: expect.any(String),
      latestSpecDesc: expect.any(Object),
      strategyInstanceId: null,
      rejectReason: 'create instance failed',
    }))
    expect(mockRepo.create).not.toHaveBeenCalled()
  })

  it('keeps drafting when planner logic text cannot compile into canonical entry and exit rules', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-uncompilable-logic' })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '策略逻辑已完整，请确认逻辑图。',
        logic: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
          entryRules: ['基于盘口情绪择机入场'],
          exitRules: ['根据主观判断离场'],
          riskRules: {
            exchange: 'okx',
            marketType: 'perp',
            positionPct: 10,
          },
        },
      }),
    })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: 'okx交易所 BTC 15分钟图，基于盘口情绪择机入场，根据主观判断离场，单笔用百分10资金',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('未识别可编译入场规则')
  })

  it('projects generic execution intent into semantic entry rules and keeps confirmation summary complete', async () => {
    const localChecklist = (service as any).inferChecklistFromMessage('立即开始时市价买入一次')
    expect(localChecklist.entryRules).toEqual(['立即开始时市价买入一次'])
    const localProjectedChecklist = (service as any).projectLegacyChecklistFromSemanticState(
      (service as any).buildFallbackSemanticState(localChecklist),
      localChecklist,
    )
    expect(localProjectedChecklist.entryRules).toEqual(['立即开始时市价买入一次'])

    mockRepo.findById.mockResolvedValue(buildSemanticEraSessionFixture({
      id: 's-immediate-entry-placeholder',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        symbols: ['ORDIUSDT'],
        timeframes: ['1h'],
        exitRules: ['当前K线收盘价相对于上一根K线收盘价上涨≥1%时卖出平仓'],
        exitRuleBases: { 'exit-1': 'prev_close' },
        riskRules: {
          exchange: 'okx',
          marketType: 'spot',
          positionPct: 10,
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
        },
      },
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    }))
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
        logic: {
          symbols: ['ORDIUSDT'],
          timeframes: ['1h'],
          entryRules: ['满足入场条件后开仓'],
          exitRules: ['当前K线收盘价相对于上一根K线收盘价上涨≥1%时卖出平仓'],
          entryRuleBases: {},
          exitRuleBases: { 'exit-1': 'prev_close' },
          riskRules: {
            exchange: 'okx',
            marketType: 'spot',
            positionPct: 10,
            stopLossPct: 5,
            stopLossBasis: 'entry_avg_price',
            takeProfitPct: 10,
            takeProfitBasis: 'entry_avg_price',
          },
        },
      }),
    })

    const result = await service.continueSession('s-immediate-entry-placeholder', {
      userId: 'u1',
      message: '立即开始时市价买入一次',
    })

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.assistantPrompt).toContain('入场：1h 立即开始时市价买入一次')
    expect(result.assistantPrompt).toContain('出场：1h 当前K线收盘价相对于上一根K线收盘价上涨≥1%时卖出平仓')
    expect(result.assistantPrompt).toContain('请确认是否按此逻辑生成')
  })
})
