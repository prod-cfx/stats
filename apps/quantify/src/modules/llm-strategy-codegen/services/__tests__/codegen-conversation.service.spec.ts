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
    checklist: Record<string, unknown>,
    semanticState?: Record<string, unknown>,
  ): string => {
    const clarification = (service as any).resolveClarificationArtifacts(checklist)
    const normalization = semanticState
      ? (service as any).buildNormalizationFromSemanticState(semanticState)
      : clarification.normalization
    const canonicalSpec = (service as any).buildCanonicalSpecForConversation(checklist, normalization)
    return canonicalDigestService.hash(canonicalSpec)
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
    expect(result.assistantPrompt).toContain('我当前理解的策略是')
    expect(result.assistantPrompt).toContain('缺少唯一交易所')
    expect(result.assistantPrompt).toContain('请确认交易所')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      status: 'DRAFTING',
    }))
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

    expect(systemPrompt).toContain('semanticUpdates 只表达当前消息涉及的增量语义')
    expect(systemPrompt).toContain('不得臆造新的核心交易规则')
    expect(systemPrompt).not.toContain('必须直接给出完整入场+出场规则草案')
  })

  it('preserves untouched sibling rules when planner updates one exit rule', async () => {
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

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-merge-rules', expect.objectContaining({
      checklist: expect.objectContaining({
        exitRules: ['价格回到布林带中轨(MA20)时平仓', '价格连续3根K线在轨外时直接平仓'],
      }),
    }))
  })

  it('does not overwrite distinct stop-loss siblings when a new stop-loss rule is added', async () => {
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

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-stoploss-siblings', expect.objectContaining({
      checklist: expect.objectContaining({
        exitRules: ['多单亏损达到5%时平仓', '空单亏损达到8%时平仓', '多单亏损达到6%时平仓'],
      }),
    }))
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
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('请补充至少一条明确的出场规则')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      clarificationState: expect.objectContaining({
        status: 'NEEDS_CLARIFICATION',
        items: expect.arrayContaining([
          expect.objectContaining({
            reason: 'missing_side_scope',
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

  it('preserves explicit direction in bollinger fallback inference and does not ask direction clarification', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-clarify-2' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 15分钟图上，突破布林带上轨做空，仓位10%',
      exitRules: ['价格回到布林带中轨(MA20)时平仓'],
      riskRules: completeRiskRules(),
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).not.toContain('缺少方向约束')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      checklist: expect.objectContaining({
        entryRules: ['K线收盘后确认突破布林带上轨时做空'],
      }),
      clarificationState: expect.objectContaining({
        items: expect.not.arrayContaining([
          expect.objectContaining({ reason: 'missing_side_scope' }),
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

  it('accepts planner semanticUpdates output and projects it into checklist-compatible state', async () => {
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
    mockRepo.createSession.mockResolvedValue({ id: 's-semantic-updates' })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '帮我做一个 MA50 上破买入、MA10 下破卖出的 OKX 现货 BTCUSDT 15m 策略',
    })

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.canonicalDigest).toMatch(/^sha256:/)
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      checklist: expect.objectContaining({
        entryRules: expect.arrayContaining(['收盘确认价格突破长期均线（50）时买入']),
        exitRules: expect.arrayContaining(['收盘确认价格跌破短期均线（10）时卖出']),
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        riskRules: expect.objectContaining({
          exchange: 'okx',
          marketType: 'spot',
          positionPct: 10,
          stopLossPct: 5,
          takeProfitPct: 10,
        }),
      }),
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
    expect(result.assistantPrompt).toContain('缺少方向约束')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      checklist: expect.objectContaining({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        riskRules: expect.objectContaining({
          exchange: 'okx',
          positionPct: 10,
          stopLossPct: expect.any(Number),
          earlyStop: expect.stringContaining('连续3根K线'),
        }),
      }),
      clarificationState: expect.objectContaining({
        status: 'NEEDS_CLARIFICATION',
        items: expect.arrayContaining([
          expect.objectContaining({
            reason: 'missing_side_scope',
          }),
        ]),
      }),
    }))
  })

  it('keeps direction ambiguous when only exit wording includes sell action', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-clarify-3' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 15分钟图上，突破布林带上轨交易，回到中轨卖出，仓位10%',
      riskRules: completeRiskRules(),
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('请确认止损规则')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      checklist: expect.objectContaining({
        entryRules: ['突破布林带上轨交易'],
      }),
      clarificationState: expect.objectContaining({
        status: 'NEEDS_CLARIFICATION',
        items: expect.arrayContaining([
          expect.objectContaining({
            reason: 'missing_side_scope',
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
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('请确认止损规则')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      checklist: expect.objectContaining({
        entryRules: ['突破布林带上轨交易'],
      }),
      clarificationState: expect.objectContaining({
        status: 'NEEDS_CLARIFICATION',
        items: expect.arrayContaining([
          expect.objectContaining({
            reason: 'missing_side_scope',
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
    })

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

  it('starts in checklist gate for raw Chinese price-change wording with percent-style sizing', async () => {
    const dto: StartCodegenSessionDto = {
      userId: 'u1',
      initialMessage: 'okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金',
    }
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
    mockRepo.createSession.mockResolvedValue({ id: 's2-raw-price-change' })

    const result = await service.startSession(dto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.canonicalDigest).toMatch(/^sha256:/)
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'CLEAR',
      items: [],
    }))
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

    expect(started.status).toBe('CHECKLIST_GATE')
    expect(started.assistantPrompt).not.toContain('存在暂不支持的规则片段')
    expect(createdSession?.checklist?.entryRules).toContain('收盘确认价格突破长期均线（50）时买入')
    expect(createdSession?.checklist?.exitRules).toContain('收盘确认价格跌破短期均线（10）时卖出')
    expect(createdSession?.checklist?.entryRules).not.toContain('满足入场条件后开仓')
    expect(createdSession?.checklist?.exitRules).not.toContain('满足出场条件后平仓')
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
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      status: 'DRAFTING',
      checklist: expect.objectContaining({
        timeframes: ['5m'],
        entryRules: expect.arrayContaining([expect.any(String)]),
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
      checklist: expect.objectContaining({
        symbols: ['BTCUSDT'],
        timeframes: ['3m', '15m'],
        entryRules: ['价格收盘确认突破关键阻力位入场'],
        exitRules: ['价格跌破关键支撑位出场'],
      }),
    }))
    const payload = mockRepo.createSession.mock.calls[0]?.[0] as { checklist?: { entryRules?: string[]; exitRules?: string[] } }
    expect(payload.checklist?.entryRules?.join(' ')).not.toContain('均线')
    expect(payload.checklist?.exitRules?.join(' ')).not.toContain('均线')
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
    mockRepo.findById.mockResolvedValue({
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
            key: 'market.exchange',
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
        'market.exchange': 'okx',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'CLEAR',
    }))
    expect((result as any).clarificationGate).toEqual({
      blocked: false,
      summary: null,
      items: [],
      pendingItems: [],
    })
    expect(result.specDesc).toBeTruthy()
    expect(result.canonicalDigest).toMatch(/^sha256:/)
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-clarification-answers', expect.objectContaining({
      status: 'CHECKLIST_GATE',
      checklist: expect.objectContaining({
        entryRules: ['价格突破阻力位入场'],
        riskRules: expect.objectContaining({
          exchange: 'okx',
        }),
      }),
    }))
  })

  it('keeps structured clarification flow in DRAFTING when real defaulted risk bases still need confirmation', async () => {
    mockRepo.findById.mockResolvedValue({
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
            key: 'market.exchange',
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
        'market.exchange': 'okx',
      },
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('以下内容是系统推断')
    expect(result.assistantPrompt).toContain('risk.stopLossBasis')
    expect(result.assistantPrompt).toContain('risk.takeProfitBasis')
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
        checklist: expect.objectContaining({
          grid: expect.objectContaining({
            lower: 60000,
            upper: 80000,
            stepPct: 0.5,
            sideMode: 'bidirectional',
            breakoutAction: 'pause',
          }),
          timeframes: ['15m'],
        }),
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

    expect(result.assistantPrompt).not.toContain('请补充至少一条明确的出场规则')
    expect(result.assistantPrompt).not.toContain('请补充至少一条明确的入场规则')
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

    expect(result.assistantPrompt).not.toContain('请补充至少一条明确的出场规则')
    expect(result.assistantPrompt).not.toContain('请补充至少一条明确的入场规则')
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
        checklist: expect.objectContaining({
          grid: expect.objectContaining({
            lower: 60000,
            upper: 80000,
            sideMode: 'bidirectional',
          }),
        }),
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
        checklist: expect.objectContaining({
          entryRules: expect.arrayContaining([expect.stringContaining('长期均线（50）')]),
        }),
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
        checklist: expect.objectContaining({
          entryRules: expect.arrayContaining([expect.stringContaining('长期均线（50）')]),
        }),
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
        checklist: expect.objectContaining({
          entryRules: expect.arrayContaining([expect.stringContaining('长期均线（50）')]),
        }),
      }),
    )
    expect(result.assistantPrompt).not.toContain('长期均线是多少')
    expect(result.assistantPrompt).toContain('突破按收盘确认还是盘中触发')
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
      key: 'semantic.exchange',
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
      key: 'semantic.timeframe',
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
    mockRepo.findById.mockResolvedValue({
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
    })
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
        checklist: expect.objectContaining({
          entryRules: expect.arrayContaining([
            expect.stringContaining('做空'),
            '跌破下轨时做多',
          ]),
        }),
      }),
    )
  })

  it('preserves extra rule conditions when applying entry-side clarification answers', async () => {
    mockRepo.findById.mockResolvedValue({
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
    })
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
        checklist: expect.objectContaining({
          entryRules: expect.arrayContaining([
            expect.stringContaining('RSI > 70'),
            expect.stringContaining('做空'),
          ]),
        }),
      }),
    )
  })

  it('persists structured clarification answers even when planner marks the short reply unrelated', async () => {
    mockRepo.findById.mockResolvedValue({
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
    })
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
    expect((result as any).clarificationGate).toEqual({
      blocked: false,
      summary: null,
      items: [],
      pendingItems: [],
    })
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-clarification-unrelated-answer',
      expect.objectContaining({
        status: 'CHECKLIST_GATE',
        checklist: expect.objectContaining({
          entryRules: expect.arrayContaining([expect.stringContaining('做空')]),
        }),
      }),
    )
  })

  it('keeps drafting when structured clarification answers resolve the explicit question but normalization remains blocked', async () => {
    mockRepo.findById.mockResolvedValue({
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
            key: 'market.exchange',
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
        'market.exchange': 'okx',
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
    mockRepo.findById.mockResolvedValue({
      id: 's-market-scope-conflict',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: withRequiredMarketContext({
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
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

    expect(result.status).toBe('DRAFTING')
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'NEEDS_CLARIFICATION',
      items: expect.arrayContaining([
        expect.objectContaining({
          key: 'market.conflict.exchange',
          reason: 'conflicting_market_scope',
          allowedAnswers: ['okx', 'binance'],
        }),
      ]),
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
    mockRepo.findById.mockResolvedValue({
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
    })
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

    expect(result.status).toBe('DRAFTING')
    expect(result.missingFields).toEqual([])
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'NEEDS_CLARIFICATION',
      items: expect.arrayContaining([
        expect.objectContaining({
          key: 'exit.rules',
          reason: 'missing_exit_rules',
        }),
      ]),
    }))
    expect(result.canonicalDigest ?? null).toBeNull()
  })

  it('applies missing exit rule clarification answers before checklist confirmation', async () => {
    mockRepo.findById.mockResolvedValue({
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
    })
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
        checklist: expect.objectContaining({
          exitRules: ['价格回到布林带中轨时平仓'],
        }),
      }),
    )
  })

  it('defaults stop-loss and take-profit basis when the user only provides percentages', async () => {
    mockRepo.findById.mockResolvedValue({
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
    })
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
        checklist: expect.objectContaining({
          riskRules: expect.objectContaining({
            stopLoss: '亏损 5% 止损',
            stopLossPct: 5,
            stopLossBasis: 'entry_avg_price',
            takeProfit: '盈利 10% 止盈',
            takeProfitPct: 10,
            takeProfitBasis: 'entry_avg_price',
          }),
        }),
      }),
    )
  })

  it('does not re-confirm inferred risk basis keys that were already consumed in constraint pack', async () => {
    mockRepo.findById.mockResolvedValue({
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

    const result = await service.continueSession('s-consumed-inferred-risk-basis', {
      userId: 'u1',
      message: '继续',
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.assistantPrompt).not.toContain('risk.stopLossBasis')
    expect(result.assistantPrompt).not.toContain('risk.takeProfitBasis')
  })

  it('records confirmed inferred risk basis keys when the user explicitly confirms the current inference prompt', async () => {
    mockRepo.findById.mockResolvedValue({
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
    })
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
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-confirm-inferred-risk-basis',
      expect.objectContaining({
        constraintPack: expect.objectContaining({
          inferredConfirmation: expect.objectContaining({
            confirmedKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
          }),
        }),
      }),
    )
  })

  it('persists confirmed inferred risk basis keys even when planner marks the explicit confirmation reply unrelated', async () => {
    mockRepo.findById.mockResolvedValue({
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
    })
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
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-confirm-inferred-risk-basis-unrelated',
      expect.objectContaining({
        constraintPack: expect.objectContaining({
          conversationHistory: expect.arrayContaining([
            'U: 这个是对的',
            'A: 这条消息和策略无关，请继续描述交易逻辑。',
          ]),
          inferredConfirmation: expect.objectContaining({
            confirmedKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
          }),
        }),
      }),
    )
  })

  it.each(['对的继续', '就按这个来', '这些成立，继续'])(
    'records confirmed inferred risk basis keys for safe explicit confirmation variant %s',
    async (message) => {
      mockRepo.findById.mockResolvedValue({
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
      })
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
      expect(mockRepo.updateSession).toHaveBeenCalledWith(
        's-confirm-inferred-risk-basis-variant',
        expect.objectContaining({
          constraintPack: expect.objectContaining({
            inferredConfirmation: expect.objectContaining({
              confirmedKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
            }),
          }),
        }),
      )
    },
  )

  it('applies inferred override replies to risk bases in CONFIRM_INFERRED flows', async () => {
    mockRepo.findById.mockResolvedValue({
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
    })
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
        checklist: expect.objectContaining({
          riskRules: expect.objectContaining({
            stopLossBasis: 'entry_avg_price',
            takeProfitBasis: 'position_pnl',
          }),
        }),
        constraintPack: expect.objectContaining({
          inferredConfirmation: expect.objectContaining({
            confirmedKeys: [],
            overriddenKeys: expect.arrayContaining(['risk.stopLossBasis', 'risk.takeProfitBasis']),
          }),
        }),
      }),
    )
  })

  it.each(['这样可以', '可以了', '就这样', '没问题'])(
    'records confirmed inferred risk basis keys for natural confirmation variant %s',
    async (message) => {
      mockRepo.findById.mockResolvedValue({
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
      })
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
      expect(mockRepo.updateSession).toHaveBeenCalledWith(
        's-natural-confirm-inferred-risk-basis-variant',
        expect.objectContaining({
          constraintPack: expect.objectContaining({
            inferredConfirmation: expect.objectContaining({
              confirmedKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
            }),
          }),
        }),
      )
    },
  )

  it('falls back to llm confirmation when rule matching is unclear for a short reply', async () => {
    mockRepo.findById.mockResolvedValue({
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
    })
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

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(mockAi.chat).toHaveBeenCalledTimes(2)
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-llm-fallback-inferred-risk-basis',
      expect.objectContaining({
        constraintPack: expect.objectContaining({
          inferredConfirmation: expect.objectContaining({
            confirmedKeys: ['risk.stopLossBasis', 'risk.takeProfitBasis'],
          }),
        }),
      }),
    )
  })

  it('treats targeted default negation replies as inferred overrides', async () => {
    mockRepo.findById.mockResolvedValue({
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
    })
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

    expect(result.status).toBe('DRAFTING')
    expect(mockAi.chat).toHaveBeenCalledTimes(1)
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-default-negation-inferred-risk-basis',
      expect.objectContaining({
        status: 'DRAFTING',
        constraintPack: expect.objectContaining({
          inferredConfirmation: expect.objectContaining({
            overriddenKeys: ['risk.takeProfitBasis'],
          }),
        }),
      }),
    )
  })

  it('does not re-enter CONFIRM_INFERRED for keys already marked overridden', async () => {
    mockRepo.findById.mockResolvedValue({
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
    })
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
    'does not misread negative or tentative clause %s as inferred confirmation',
    async ({ sessionId, message, expectedConfirmedKey }) => {
      mockRepo.findById.mockResolvedValue({
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
      })
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

      expect(result.status).toBe('DRAFTING')
      expect(result.assistantPrompt).toContain('请确认这些推断是否成立')

      const updatePayload = mockRepo.updateSession.mock.calls[0]?.[1] as {
        constraintPack?: {
          inferredConfirmation?: {
            confirmedKeys?: string[]
          }
        }
      }
      expect(updatePayload.constraintPack?.inferredConfirmation?.confirmedKeys ?? []).not.toContain(expectedConfirmedKey)
    },
  )

  it('confirms the only remaining inferred key for a short default-only reply', async () => {
    mockRepo.findById.mockResolvedValue({
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
    })
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
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-single-inferred-default-confirmation',
      expect.objectContaining({
        constraintPack: expect.objectContaining({
          inferredConfirmation: expect.objectContaining({
            confirmedKeys: ['risk.stopLossBasis'],
          }),
        }),
      }),
    )
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
    mockRepo.findById.mockResolvedValue({
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
    })
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

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('以下内容是系统推断')
    expect(result.assistantPrompt).toContain('risk.stopLossBasis')
  })

  it('applies missing position pct clarification answers before checklist confirmation', async () => {
    mockRepo.findById.mockResolvedValue({
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
    })
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
        checklist: expect.objectContaining({
          riskRules: expect.objectContaining({
            positionPct: 10,
          }),
        }),
      }),
    )
  })

  it('keeps drafting with a structured clarification gate summary when basis blockers remain', async () => {
    mockRepo.findById.mockResolvedValue({
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
    })
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

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('我当前理解的策略是')
    expect((result as any).clarificationGate).toEqual({
      blocked: true,
      summary: expect.stringContaining('BTCUSDT'),
      items: [
        expect.objectContaining({
          key: 'exit.basis.1',
          reason: 'ambiguous_condition_basis',
          status: 'pending',
        }),
      ],
      pendingItems: [
        expect.objectContaining({
          key: 'exit.basis.1',
          reason: 'ambiguous_condition_basis',
          status: 'pending',
        }),
      ],
    })
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
    mockRepo.findById.mockResolvedValue({
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
    })
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

    expect(result.status).toBe('DRAFTING')
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-basis-natural-short-answer',
      expect.objectContaining({
        checklist: expect.objectContaining({
          entryRuleBases: {
            'entry-1': 'prev_close',
          },
        }),
      }),
    )
    expect((result as any).clarificationGate).toEqual({
      blocked: true,
      summary: expect.stringContaining('BTCUSDT'),
      items: [
        expect.objectContaining({
          key: 'exit.basis.1',
          reason: 'ambiguous_condition_basis',
        }),
      ],
      pendingItems: [
        expect.objectContaining({
          key: 'exit.basis.1',
          reason: 'ambiguous_condition_basis',
        }),
      ],
    })
  })

  it('syncs exit-rule basis answers into risk stop-loss and take-profit basis fields when they describe the same semantics', async () => {
    mockRepo.findById.mockResolvedValue({
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
    })
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
        checklist: expect.objectContaining({
          exitRuleBases: {
            'exit-1': 'entry_avg_price',
          },
          riskRules: expect.objectContaining({
            stopLossBasis: 'entry_avg_price',
            takeProfitBasis: 'entry_avg_price',
          }),
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

    expect(result.status).toBe('CHECKLIST_GATE')
    expect(result.specDesc).toBeTruthy()
    expect(result.assistantPrompt).toContain('确认逻辑图')
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s4', expect.objectContaining({
      status: 'CHECKLIST_GATE',
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
    expect(result.assistantPrompt).toContain('缺少方向约束')
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'NEEDS_CLARIFICATION',
    }))
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s4-clarify', expect.objectContaining({
      status: 'DRAFTING',
      clarificationState: expect.objectContaining({
        status: 'NEEDS_CLARIFICATION',
      }),
    }))
    expect(mockRepo.updateSession).not.toHaveBeenCalledWith('s4-clarify', expect.objectContaining({
      status: 'CHECKLIST_GATE',
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

    mockRepo.findById.mockResolvedValue({
      id: 's5',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        entryRules: ['短均线上穿长均线（金叉）时做多'],
        exitRules: ['短均线下穿长均线（死叉）时平多'],
      }),
      constraintPack: {},
    })

    const dto: ContinueCodegenSessionDto = {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: started.canonicalDigest ?? undefined,
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
    mockRepo.findById.mockResolvedValue({
      id: 's5-semantic-generate',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: persistedChecklist,
      semanticState: persistedSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    const canonicalChecklist = (service as any).projectLegacyChecklistFromSemanticState(
      persistedSemanticState,
      persistedChecklist,
    )
    const reducedSemanticState = (service as any).mergeChecklistIntoSemanticState(
      persistedSemanticState,
      canonicalChecklist,
    )
    const finalChecklist = (service as any).projectLegacyChecklistFromSemanticState(
      reducedSemanticState,
      canonicalChecklist,
    )

    const result = await service.continueSession('s5-semantic-generate', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(finalChecklist, reducedSemanticState),
    })

    expect(result.status).toBe('GENERATING')
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith('s5-semantic-generate', expect.objectContaining({
      status: 'GENERATING',
      checklist: expect.objectContaining({
        entryRules: ['收盘确认价格突破长期均线（50）时买入'],
        exitRules: ['收盘确认价格跌破短期均线（20）时卖出'],
      }),
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

    mockRepo.findById.mockResolvedValue({
      id: 's5-compiled',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        entryRules: ['短均线上穿长均线（金叉）时做多'],
        exitRules: ['短均线下穿长均线（死叉）时平多'],
      }),
      constraintPack: {},
    })

    await service.continueSession('s5-compiled', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        entryRules: ['短均线上穿长均线（金叉）时做多'],
        exitRules: ['短均线下穿长均线（死叉）时平多'],
      })),
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
    mockRepo.findById.mockResolvedValue({
      id: 's-golden-ma-publish',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: createdSession.checklist,
      semanticState: createdSession.semanticState,
      clarificationState: createdSession.clarificationState,
      constraintPack: createdSession.constraintPack,
      strategyInstanceId: null,
    })

    const result = await service.continueSession('s-golden-ma-publish', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(createdSession.checklist, createdSession.semanticState),
    })

    expect(result.status).toBe('GENERATING')
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith('s-golden-ma-publish', expect.objectContaining({
      checklist: expect.objectContaining({
        entryRules: ['收盘确认价格突破长期均线（50）时买入'],
        exitRules: ['收盘确认价格跌破短期均线（10）时卖出'],
      }),
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
      status: 'CONSISTENCY_FAILED',
      rejectReason: expect.stringContaining('脚本缺少关键指标: sma'),
    }))
    expect(mockRepo.createVersion).toHaveBeenCalledTimes(1)
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
    expect(updated.status).toBe('CHECKLIST_GATE')
    expect(checklistGateUpdate).toEqual(expect.objectContaining({
      status: 'CHECKLIST_GATE',
      checklist: expect.objectContaining({
        entryRules: ['收盘确认价格突破长期均线（200）时买入'],
        exitRules: ['收盘确认价格跌破短期均线（20）时卖出'],
      }),
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({
            key: 'indicator.above',
            phase: 'entry',
            params: expect.objectContaining({
              'reference.period': 200,
            }),
          }),
        ]),
      }),
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
    expect(updated.canonicalDigest).toEqual(
      buildConfirmedCanonicalDigest(checklistGateUpdate.checklist, checklistGateUpdate.semanticState),
    )
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
    mockRepo.findById.mockResolvedValue({
      id: 's-golden-bollinger-publish',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: createdSession.checklist,
      semanticState: createdSession.semanticState,
      clarificationState: createdSession.clarificationState,
      constraintPack: createdSession.constraintPack,
      strategyInstanceId: null,
    })

    const result = await service.continueSession('s-golden-bollinger-publish', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: started.canonicalDigest ?? undefined,
    })

    expect(result.status).toBe('GENERATING')
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith('s-golden-bollinger-publish', expect.objectContaining({
      checklist: expect.objectContaining({
        entryRules: expect.any(Array),
        exitRules: expect.any(Array),
      }),
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

    mockRepo.findById.mockResolvedValueOnce({
      id: 's-semantic-bollinger-replace',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: persistedChecklist,
      semanticState: buildLockedBollingerSemanticState(),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      strategyInstanceId: null,
    })
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
    expect(updated.canonicalDigest).toEqual(
      buildConfirmedCanonicalDigest(checklistGateUpdate.checklist, checklistGateUpdate.semanticState),
    )
    expect(checklistGateUpdate).toEqual(expect.objectContaining({
      checklist: expect.objectContaining({
        entryRules: ['K线收盘后确认突破布林带(30,2.5)上轨时做空'],
        exitRules: ['价格回到布林带中轨(MA30)时平空'],
      }),
      semanticState: expect.objectContaining({
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
      }),
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
      confirmedCanonicalDigest: updated.canonicalDigest ?? undefined,
    })

    expect(confirmed.status).toBe('GENERATING')
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith('s-semantic-bollinger-replace', expect.objectContaining({
      checklist: expect.objectContaining({
        entryRules: ['K线收盘后确认突破布林带(30,2.5)上轨时做空'],
        exitRules: ['价格回到布林带中轨(MA30)时平空'],
      }),
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

  it('keeps state-gated semantic conditions aligned from checklist gate through publication', async () => {
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

    mockRepo.findById.mockResolvedValue({
      id: 's-state-gate-publish',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: persistedChecklist,
      semanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      strategyInstanceId: null,
    })

    const projectedChecklist = (service as any).projectLegacyChecklistFromSemanticState(semanticState, persistedChecklist)
    const mergedSemanticState = (service as any).mergeChecklistIntoSemanticState(semanticState, projectedChecklist)
    const canonicalChecklist = (service as any).projectLegacyChecklistFromSemanticState(mergedSemanticState, projectedChecklist)

    const result = await service.continueSession('s-state-gate-publish', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(canonicalChecklist, mergedSemanticState),
    })

    expect(result.status).toBe('GENERATING')
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith('s-state-gate-publish', expect.objectContaining({
      checklist: expect.objectContaining({
        entryRules: ['K线收盘后确认突破布林带(20,2)上轨时做空'],
        exitRules: ['价格回到布林带中轨(MA20)时平空'],
        stateGates: expect.objectContaining({
          marketRegime: 'range',
        }),
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
    mockRepo.findById.mockResolvedValue({
      id: 's-bollinger-publish',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      strategyInstanceId: null,
      checklist,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })

    const result = await service.continueSession('s-bollinger-publish', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(checklist),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-bollinger-publish')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-bollinger-publish', expect.objectContaining({
      status: 'PUBLISHED',
    }))
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      specSnapshot: expect.objectContaining({
        indicators: [expect.objectContaining({ kind: 'bollingerBands', params: { period: 20, stdDev: 2 } })],
        rules: expect.arrayContaining([
          expect.objectContaining({
            phase: 'entry',
            sideScope: 'short',
            condition: expect.objectContaining({
              key: 'bollinger.upper_break',
              op: 'CROSS_OVER',
            }),
            actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
          }),
          expect.objectContaining({
            phase: 'entry',
            sideScope: 'long',
            condition: expect.objectContaining({
              key: 'bollinger.lower_break',
              op: 'CROSS_UNDER',
            }),
            actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
          }),
          expect.objectContaining({
            phase: 'exit',
            sideScope: 'both',
            condition: expect.objectContaining({
              key: 'bollinger.middle_revert',
            }),
            actions: expect.arrayContaining([
              expect.objectContaining({ type: 'CLOSE_LONG' }),
              expect.objectContaining({ type: 'CLOSE_SHORT' }),
            ]),
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

    const publishedSnapshot = mockRepo.create.mock.calls.at(-1)?.[0]
    expect(publishedSnapshot?.specSnapshot?.indicators).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'sma' }),
    ]))
  })

  it('publishes price-change strategy after confirmGenerate through the canonical mainline', async () => {
    mockRepo.findById.mockResolvedValue({
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

    const result = await service.continueSession('s-price-change-publish', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
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
      })),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-price-change-publish')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-price-change-publish', expect.objectContaining({
      status: 'PUBLISHED',
      latestSpecDesc: expect.objectContaining({
        canonicalSpec: expect.objectContaining({
          rules: expect.arrayContaining([
            expect.objectContaining({
              id: 'entry-price-change-1',
              condition: expect.objectContaining({ key: 'price.change_pct', value: -0.01 }),
            }),
            expect.objectContaining({
              id: 'exit-price-change-1',
              condition: expect.objectContaining({ key: 'price.change_pct', value: 0.02 }),
            }),
          ]),
        }),
      }),
    }))
  })

  it('rejects compiler-first publish when compiled script fails structural validation', async () => {
    const emitSpy = jest
      .spyOn(CompiledScriptEmitterService.prototype, 'emit')
      .mockReturnValue('broken compiled script')

    mockRepo.findById.mockResolvedValue({
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

    const result = await service.continueSession('s-runtime-invalid', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['EMA7 上穿 EMA21 做多'],
        exitRules: ['EMA7 下穿 EMA21 平多'],
        riskRules: { positionPct: 10 },
      })),
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

    mockRepo.findById.mockResolvedValue({
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

    const result = await service.continueSession('s-compiler-consistency-failed', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['EMA7 上穿 EMA21 做多'],
        exitRules: ['EMA7 下穿 EMA21 平多'],
        riskRules: { positionPct: 10 },
      })),
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
    mockRepo.findById.mockResolvedValue({
      id: 's6',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        entryRules: ['RSI 14 低于 30 时做多'],
        exitRules: ['收益率达到 5% 止盈'],
      }),
      constraintPack: {},
    })
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
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        entryRules: ['RSI 14 低于 30 时做多'],
        exitRules: ['收益率达到 5% 止盈'],
      })),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s6')

    const hasPublished = mockRepo.updateSession.mock.calls.some(call =>
      call[0] === 's6' && (call[1] as { status?: string }).status === 'PUBLISHED',
    )
    expect(hasPublished).toBe(true)
  })
  it('generates directly when confirmGenerate is true and checklist is complete even if session is drafting', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's7',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      }),
      constraintPack: {},
    })
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
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      })),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s7')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s7', expect.objectContaining({
      status: 'PUBLISHED',
    }))
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
    mockRepo.findById.mockResolvedValue({
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
    const canonicalChecklist = (service as any).projectLegacyChecklistFromSemanticState(
      answeredSemanticState,
      persistedChecklist,
    )
    const reducedSemanticState = (service as any).mergeChecklistIntoSemanticState(
      answeredSemanticState,
      canonicalChecklist,
    )
    const finalChecklist = (service as any).projectLegacyChecklistFromSemanticState(
      reducedSemanticState,
      canonicalChecklist,
    )

    const result = await service.continueSession('s7-semantic-confirm-answer', {
      userId: 'u1',
      message: '确认，直接生成代码',
      clarificationAnswers: {
        'semantic.reference.period.entry': 'MA50',
      },
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(finalChecklist, reducedSemanticState),
    })

    expect(result.status).toBe('GENERATING')
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith('s7-semantic-confirm-answer', expect.objectContaining({
      status: 'GENERATING',
      checklist: expect.objectContaining({
        entryRules: ['收盘确认价格突破长期均线（50）时买入'],
        exitRules: ['收盘确认价格跌破短期均线（20）时卖出'],
      }),
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
    mockRepo.findById.mockResolvedValue({
      id: 's8',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      }),
      constraintPack: {},
    })
    mockRepo.createVersion.mockRejectedValueOnce(new Error('version write failed'))

    const result = await service.continueSession('s8', {
      userId: 'u1',
      message: '确认，直接生成代码',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      })),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s8')

    expect(mockRepo.updateSession).toHaveBeenCalledWith('s8', expect.objectContaining({
      status: 'REJECTED',
      rejectReason: expect.stringContaining('version write failed'),
    }))
  })

  it('marks session rejected instead of published when publish step fails after code generation', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's8-publish-fail',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      }),
      constraintPack: {},
    })
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
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      })),
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
    mockRepo.findById.mockResolvedValue({
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
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
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
      })),
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

    mockRepo.findById.mockResolvedValue({
      id: 's9',
      userId: 'u1',
      status: 'CHECKLIST_GATE',
      checklist: completeChecklist({
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      }),
      constraintPack: {},
    })

    const result = await service.continueSession('s9', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      })),
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
    mockRepo.findById.mockResolvedValue({
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
    mockRepo.createVersion.mockResolvedValue({ id: 'v-consistency' })

    const result = await service.continueSession('s-consistency', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest({
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
      }),
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

  it('rejects continueSession when canonical spec version is not 2', async () => {
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

    mockRepo.findById.mockResolvedValue({
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

    await expect(service.continueSession('s-v1', {
      userId: 'u1',
      message: '确认并生成',
      confirmGenerate: true,
      providerCode: 'uniapi',
      model: 'gpt-4',
    })).rejects.toThrow('canonical_spec_v2_required')

    buildSpy.mockRestore()
  })

  it('creates strategy instance on publish and returns it in published snapshot', async () => {
    mockRepo.findById.mockResolvedValue({
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
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['5m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      })),
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
    mockRepo.findById.mockResolvedValue({
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
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
          positionPct: 10,
        },
      })),
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
    mockRepo.findById.mockResolvedValue({
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
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      })),
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
    mockRepo.findById.mockResolvedValue({
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
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(completeChecklist({
        symbols: ['BTCUSDT'],
        timeframes: ['5m'],
        entryRules: ['价格突破阻力位入场'],
        exitRules: ['跌破支撑位出场'],
      })),
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
    expect(result.assistantPrompt).toContain('请确认止损规则')
  })
})
