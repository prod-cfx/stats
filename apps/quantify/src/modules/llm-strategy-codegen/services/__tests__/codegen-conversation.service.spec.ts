import type { ContinueCodegenSessionDto } from '../../dto/continue-codegen-session.dto'
import type { StartCodegenSessionDto } from '../../dto/start-codegen-session.dto'
import type { CodegenSessionsRepository } from '../../repositories/codegen-sessions.repository'
import type { PublishedStrategySnapshotsRepository } from '../../repositories/published-strategy-snapshots.repository'
import type { RecommendationIndexService } from '../recommendation-index.service'
import type { AiService } from '@/modules/ai/ai.service'
import { restoreProcessEnv, setProcessEnvValue, snapshotProcessEnv } from '@/common/env/env.accessor'
import { Logger } from '@nestjs/common'
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
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
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
    bindPublishedSnapshotToStrategyInstance: jest.fn(),
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
    findActiveDeleteContextByIdAndUser: jest.fn(),
    findByCodegenSessionId: jest.fn(),
    upsertConversationSnapshot: jest.fn(),
    archiveByIdAndUser: jest.fn(),
  }
  const mockAccountStrategyViewService = {
    getStrategyDetail: jest.fn(),
    deleteStrategy: jest.fn(),
  }
  const canonicalSpecBuilder = new CanonicalSpecBuilderService()
  const canonicalDigestService = new CanonicalSpecV2DigestService()
  const specDescBuilder = new SpecDescBuilderService()
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
  const closeOpenExpressionSemanticState = (contextOverrides: Record<string, any> = {}) => ({
    version: 1,
    families: ['single-leg'],
    triggers: [
      {
        id: 'entry-close-gt-open',
        key: 'condition.expression',
        phase: 'entry',
        sideScope: 'long',
        params: {
          expression: {
            kind: 'predicate',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'series', source: 'bar', field: 'open' },
          },
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      {
        id: 'exit-close-lt-open',
        key: 'condition.expression',
        phase: 'exit',
        sideScope: 'long',
        params: {
          expression: {
            kind: 'predicate',
            op: 'LT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'series', source: 'bar', field: 'open' },
          },
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      {
        id: 'gate-no-position',
        key: 'condition.expression',
        phase: 'gate',
        params: {
          expression: {
            kind: 'NOT',
            children: [
              {
                kind: 'predicate',
                op: 'EQ',
                left: { kind: 'position', field: 'has_position', side: 'long' },
                right: { kind: 'constant', value: true },
              },
            ],
          },
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    ],
    actions: [
      { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
      { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
    ],
    risk: [],
    position: {
      mode: 'fixed_quote',
      value: 10,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
    },
    contextSlots: {
      exchange: {
        slotKey: 'exchange',
        fieldPath: 'contextSlots.exchange',
        value: null,
        status: 'open',
        priority: 'context',
        questionHint: '请选择交易所',
        affectsExecution: true,
      },
      symbol: {
        slotKey: 'symbol',
        fieldPath: 'contextSlots.symbol',
        value: 'BTCUSDT',
        status: 'locked',
        priority: 'context',
        questionHint: '请选择交易标的',
        affectsExecution: true,
      },
      marketType: {
        slotKey: 'marketType',
        fieldPath: 'contextSlots.marketType',
        value: null,
        status: 'open',
        priority: 'context',
        questionHint: '请选择市场类型',
        affectsExecution: true,
      },
      timeframe: {
        slotKey: 'timeframe',
        fieldPath: 'contextSlots.timeframe',
        value: '1m',
        status: 'locked',
        priority: 'context',
        questionHint: '请选择周期',
        affectsExecution: true,
      },
      ...contextOverrides,
    },
    normalizationNotes: [],
    updatedAt: '2026-04-28T00:00:00.000Z',
  })

  const buildConfirmedCanonicalDigest = (
    semanticState: Record<string, unknown>,
  ): string => {
    const normalization = (service as any).buildNormalizationFromSemanticState(semanticState)
    const canonicalSpec = (service as any).buildCanonicalSpecForConversation(semanticState, normalization)
    return canonicalDigestService.hash(canonicalSpec)
  }
  const readLegacyChecklistProjectionForTest = (
    session: { checklist?: Record<string, unknown> | null; semanticState?: Record<string, unknown> },
  ): Record<string, unknown> => {
    if (session.checklist) {
      return session.checklist
    }
    if (session.semanticState) {
      return (service as any).buildLegacyLogicSnapshotProjectionForCompatibility(session.semanticState, {})
    }
    return {}
  }
  const maSemanticPatch = (entryPeriod = 50, exitPeriod = 10, context: Record<string, unknown> = {}) => ({
    triggers: [
      {
        key: 'indicator.above',
        phase: 'entry',
        params: {
          indicator: 'ma',
          referenceRole: 'long_term',
          'reference.period': entryPeriod,
          confirmationMode: 'close_confirm',
        },
      },
      {
        key: 'indicator.below',
        phase: 'exit',
        params: {
          indicator: 'ma',
          referenceRole: 'short_term',
          'reference.period': exitPeriod,
          confirmationMode: 'close_confirm',
        },
      },
    ],
    actions: [{ key: 'open_long' }, { key: 'close_long' }],
    risk: [
      { key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
      { key: 'risk.take_profit_pct', params: { valuePct: 10, basis: 'entry_avg_price' } },
    ],
    position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only' },
    contextSlots: {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      timeframe: '15m',
      ...context,
    },
  })
  const rsiSemanticPatch = (context: Record<string, unknown> = {}) => ({
    triggers: [
      {
        key: 'oscillator.rsi_lte',
        phase: 'entry',
        sideScope: 'long',
        params: { indicator: 'rsi', period: 14, value: 30 },
      },
      {
        key: 'oscillator.rsi_gte',
        phase: 'exit',
        sideScope: 'long',
        params: { indicator: 'rsi', period: 14, value: 70 },
      },
    ],
    actions: [{ key: 'open_long' }, { key: 'close_long' }],
    risk: [
      { key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
      { key: 'risk.take_profit_pct', params: { valuePct: 10, basis: 'entry_avg_price' } },
    ],
    position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only' },
    contextSlots: {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '15m',
      ...context,
    },
  })
  const priceChangeSemanticPatch = (context: Record<string, unknown> = {}) => ({
    triggers: [
      { key: 'price.percent_change', phase: 'entry', params: { valuePct: -1, window: '3m', basis: 'prev_close' } },
      { key: 'price.percent_change', phase: 'exit', params: { valuePct: 2, window: '15m', basis: 'prev_close' } },
    ],
    actions: [{ key: 'open_long' }, { key: 'close_long' }],
    risk: [
      { key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
      { key: 'risk.take_profit_pct', params: { valuePct: 10, basis: 'entry_avg_price' } },
    ],
    position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only' },
    contextSlots: {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '3m',
      ...context,
    },
  })
  const bollingerSemanticPatch = (period = 30, stdDev = 2.5, context: Record<string, unknown> = {}) => ({
    triggers: [
      {
        key: 'bollinger.touch_upper',
        phase: 'entry',
        sideScope: 'short',
        params: { band: 'upper', period, stdDev, confirmationMode: 'close_confirm' },
      },
      {
        key: 'bollinger.touch_middle',
        phase: 'exit',
        sideScope: 'short',
        params: { band: 'middle', period, stdDev, confirmationMode: 'close_confirm' },
      },
    ],
    actions: [{ key: 'open_short' }, { key: 'close_short' }],
    risk: [
      { key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
      { key: 'risk.take_profit_pct', params: { valuePct: 10, basis: 'entry_avg_price' } },
    ],
    position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
    contextSlots: {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '15m',
      ...context,
    },
  })

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
  const lockedStopLossRisk = () => ({
    id: 'risk-stop-loss',
    key: 'risk.stop_loss_pct',
    params: {
      valuePct: 5,
      basis: 'entry_avg_price',
    },
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
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
  const buildLockedBidirectionalBollingerSemanticState = (overrides: Record<string, any> = {}) => ({
    ...buildLockedBollingerSemanticState({
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
          id: 'entry-bollinger-lower',
          key: 'bollinger.touch_lower',
          phase: 'entry',
          params: {
            indicator: 'bollinger',
            period: 20,
            stdDev: 2,
            confirmationMode: 'close_confirm',
          },
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'exit-bollinger-middle-short',
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
          id: 'exit-bollinger-middle-long',
          key: 'bollinger.touch_middle',
          phase: 'exit',
          params: {
            indicator: 'bollinger',
            period: 20,
            stdDev: 2,
            confirmationMode: 'close_confirm',
          },
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [
        { id: 'action-open-short', key: 'open_short', status: 'locked', source: 'user_explicit' },
        { id: 'action-open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'action-close-short', key: 'close_short', status: 'locked', source: 'user_explicit' },
        { id: 'action-close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
      ],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_short',
        status: 'locked',
        source: 'user_explicit',
      },
    }),
    ...overrides,
  })
  const buildLockedPriceChangeSemanticState = (overrides: Record<string, any> = {}) => ({
    version: 1,
    families: ['single-leg'],
    triggers: [
      {
        id: 'entry-price-change',
        key: 'price.percent_change',
        phase: 'entry',
        params: {
          valuePct: -1,
          window: '3m',
          basis: 'prev_close',
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      {
        id: 'exit-price-change',
        key: 'price.percent_change',
        phase: 'exit',
        params: {
          valuePct: 2,
          window: '15m',
          basis: 'prev_close',
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    ],
    actions: [
      { id: 'action-open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
      { id: 'action-close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
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
        value: '3m',
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
    checklist: null,
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
    const plannerSemanticPatch = args.message.includes('布林')
      ? bollingerSemanticPatch()
      : maSemanticPatch()
    mockRepo.createSession.mockResolvedValue({ id: args.sessionId })
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        semanticPatch: plannerSemanticPatch,
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
    const semanticState = (service as any).hasPersistedSemanticState(fixture.semanticState)
      ? fixture.semanticState
      : null
    if (!semanticState) {
      throw new Error('buildSemanticEraSessionFixture requires explicit semanticState')
    }

    const clarificationArtifacts = (service as any).resolveSemanticClarificationArtifacts(semanticState)
    const normalization = (service as any).buildNormalizationFromSemanticState(semanticState)
    const canonicalSpec = (service as any).buildCanonicalSpecForConversation(semanticState, normalization)
    const executionContext = clarificationArtifacts.executionContext.context
    const latestSpecDesc = specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '', {
      normalizedIntent: normalization.normalizedIntent,
      executionContext,
    })

    return {
      ...fixture,
      semanticState,
      latestSpecDesc,
    }
  }
  const buildLegacyChecklistBridgeSessionFixture = (overrides: Record<string, any>) => {
    if ((service as any).hasPersistedSemanticState(overrides.semanticState)) {
      return buildSemanticEraSessionFixture(overrides)
    }
    const rawChecklist = overrides.checklist && typeof overrides.checklist === 'object' && !Array.isArray(overrides.checklist)
      ? overrides.checklist as Record<string, any>
      : {}
    const normalizedChecklist = (service as any).normalizeLogicSnapshot(rawChecklist)
    const semanticState = (service as any).mergeLogicSnapshotIntoSemanticStateForLegacyCompatibility(
      (service as any).createEmptySemanticState(),
      normalizedChecklist,
    )
    return buildSemanticEraSessionFixture({
      ...overrides,
      semanticState,
    })
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
    const normalization = (service as any).buildNormalizationFromSemanticState(semanticState)
    const canonicalSpec = (service as any).buildCanonicalSpecForConversation(semanticState, normalization)
    return canonicalDigestService.hash(canonicalSpec)
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
      snapshotHash: 'snapshot-hash-1',
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
    mockRepo.bindPublishedSnapshotToStrategyInstance.mockResolvedValue(undefined)
    mockConversationsRepo.listByUser.mockResolvedValue([])
    mockConversationsRepo.listKnownSessionIdsByUser.mockResolvedValue([])
    mockConversationsRepo.findActiveDeleteContextByIdAndUser.mockResolvedValue(null)
    mockConversationsRepo.findByCodegenSessionId.mockResolvedValue(null)
    mockConversationsRepo.upsertConversationSnapshot.mockResolvedValue(undefined)
    mockConversationsRepo.archiveByIdAndUser.mockResolvedValue(undefined)
    mockAccountStrategyViewService.getStrategyDetail.mockReset()
    mockAccountStrategyViewService.deleteStrategy.mockReset()
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
    ;(service as any).accountStrategyViewService = mockAccountStrategyViewService

  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(() => {
    restoreProcessEnv(envSnapshot)
  })

  it('uses SemanticState expression completeness for new sessions', () => {
    const semanticState = closeOpenExpressionSemanticState()
    const buildFromSemanticStateSpy = jest.spyOn(canonicalSpecBuilder, 'buildFromSemanticState')
    const buildFromNormalizedIntentSpy = jest.spyOn(canonicalSpecBuilder, 'buildFromNormalizedIntent')

    const artifacts = (service as any).resolveSemanticClarificationArtifacts(semanticState)
    const canonicalSpec = (service as any).buildCanonicalSpecForConversation(semanticState, artifacts.normalization)

    expect(artifacts.clarificationPrompt).toContain('请选择交易所')
    expect(artifacts.clarificationPrompt).not.toContain('入场规则')
    expect(artifacts.clarificationPrompt).not.toContain('出场规则')
    expect(artifacts.clarificationState.items[0]).toEqual(expect.objectContaining({
      key: 'executionContext.exchange',
      question: '请选择交易所',
    }))
    expect(buildFromSemanticStateSpy).toHaveBeenCalledWith(semanticState)
    expect(buildFromNormalizedIntentSpy).not.toHaveBeenCalled()
    expect(canonicalSpec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        condition: expect.objectContaining({ kind: 'expression', op: 'GT' }),
      }),
      expect.objectContaining({
        phase: 'exit',
        condition: expect.objectContaining({ kind: 'expression', op: 'LT' }),
      }),
    ]))
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

  it('summarizes every confirmed normalized Bollinger leg instead of only the first trigger', () => {
    const service = Object.create(CodegenConversationService.prototype) as CodegenConversationService

    const summary = (service as any).buildClarificationSummary({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        'K线收盘后确认突破布林带(20,2)上轨时做空',
        'K线收盘后确认突破布林带(20,2)下轨时做多',
      ],
      exitRules: [
        '多单在价格回到布林带中轨(MA20)时平仓',
        '空单在价格跌破布林带中轨(MA20)时平仓',
      ],
      riskRules: { exchange: 'okx', marketType: 'perp', positionPct: 10 },
    }, {
      families: ['single-leg'],
      triggers: [
        {
          key: 'bollinger.touch_upper',
          phase: 'entry',
          sideScope: 'short',
          params: { indicator: 'bollinger', period: 20, stdDev: 2, confirmationMode: 'close_confirm' },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
        {
          key: 'bollinger.touch_lower',
          phase: 'entry',
          sideScope: 'long',
          params: { indicator: 'bollinger', period: 20, stdDev: 2, confirmationMode: 'close_confirm' },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
        {
          key: 'bollinger.touch_middle',
          phase: 'exit',
          sideScope: 'long',
          params: { indicator: 'bollinger', period: 20, stdDev: 2, confirmationMode: 'close_confirm' },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
        {
          key: 'bollinger.touch_middle',
          phase: 'exit',
          sideScope: 'short',
          params: { indicator: 'bollinger', period: 20, stdDev: 2, confirmationMode: 'close_confirm' },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
      ],
      actions: [],
      risk: [],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_short' },
      unresolved: [],
      normalizationNotes: [],
    })

    expect(summary).toContain('入场：15m K线收盘后确认突破布林带(20,2)上轨时做空；15m K线收盘后确认突破布林带(20,2)下轨时做多')
    expect(summary).toContain('出场：15m 价格回到布林带中轨(MA20)时平多；15m 价格回到布林带中轨(MA20)时平空')
  })

  it('treats executable semantics as mainflow evidence but not families or context-only slots', () => {
    const service = Object.create(CodegenConversationService.prototype) as CodegenConversationService
    const emptyState = (service as any).createEmptySemanticState()

    expect((service as any).hasSemanticMainFlowEvidence({
      ...emptyState,
      families: ['single-leg'],
    })).toBe(false)
    expect((service as any).hasSemanticMainFlowEvidence({
      ...emptyState,
      contextSlots: {
        ...emptyState.contextSlots,
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
    })).toBe(false)
    expect((service as any).hasSemanticMainFlowEvidence({
      ...emptyState,
      triggers: [{
        id: 'entry-ma',
        key: 'indicator.above',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
    })).toBe(true)
    expect((service as any).hasSemanticMainFlowEvidence({
      ...emptyState,
      actions: [{ id: 'action-open-long', key: 'open_long', status: 'locked', source: 'user_explicit' }],
    })).toBe(true)
    expect((service as any).hasSemanticMainFlowEvidence({
      ...emptyState,
      risk: [lockedStopLossRisk()],
    })).toBe(true)
    expect((service as any).hasSemanticMainFlowEvidence({
      ...emptyState,
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
      },
    })).toBe(true)
  })

  it('preserves generic close wording from exit evidence instead of forcing side-specific labels', () => {
    const service = Object.create(CodegenConversationService.prototype) as CodegenConversationService

    const summary = (service as any).buildClarificationSummary({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['K线收盘后确认突破布林带(20,2)上轨时做空'],
      exitRules: [
        '多单在价格回到布林带中轨(MA20)时平仓',
        '空单在价格跌破布林带中轨(MA20)时平仓',
      ],
      riskRules: { exchange: 'okx', marketType: 'perp', positionPct: 10 },
    }, {
      families: ['single-leg'],
      triggers: [
        {
          key: 'bollinger.touch_middle',
          phase: 'exit',
          sideScope: 'long',
          params: { indicator: 'bollinger', period: 20, stdDev: 2, confirmationMode: 'close_confirm' },
          closureStatus: 'closed',
          unresolvedSlots: [],
          evidenceText: '多单在价格回到布林带中轨(MA20)时平仓',
        },
        {
          key: 'bollinger.touch_middle',
          phase: 'exit',
          sideScope: 'short',
          params: { indicator: 'bollinger', period: 20, stdDev: 2, confirmationMode: 'close_confirm' },
          closureStatus: 'closed',
          unresolvedSlots: [],
          evidenceText: '空单在价格跌破布林带中轨(MA20)时平仓',
        },
      ],
      actions: [],
      risk: [],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_short' },
      unresolved: [],
      normalizationNotes: [],
    })

    expect(summary).toContain('出场：15m 价格回到布林带中轨(MA20)时平仓')
    expect(summary).not.toContain('平多')
    expect(summary).not.toContain('平空')
  })

  it('falls back to all draft rules when any closed normalized trigger cannot be projected', () => {
    const service = Object.create(CodegenConversationService.prototype) as CodegenConversationService

    const summary = (service as any).buildClarificationSummary({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '价格突破布林带(20,2)下轨时做多',
        'RSI 小于等于 30 时做多',
      ],
      exitRules: ['价格回到布林带中轨(MA20)时平多'],
      riskRules: { exchange: 'okx', marketType: 'perp', positionPct: 10 },
    }, {
      families: ['single-leg'],
      triggers: [
        {
          key: 'bollinger.touch_lower',
          phase: 'entry',
          sideScope: 'long',
          params: { indicator: 'bollinger', period: 20, stdDev: 2, confirmationMode: 'close_confirm' },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
        {
          key: 'oscillator.rsi_lte',
          phase: 'entry',
          sideScope: 'long',
          params: { value: 30 },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
      ],
      actions: [],
      risk: [],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only' },
      unresolved: [],
      normalizationNotes: [],
    })

    expect(summary).toContain('入场：15m 价格突破布林带(20,2)下轨时做多；15m RSI 小于等于 30 时做多')
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

  it('routes recognized unsupported atoms to pending fallback before readiness', async () => {
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        semanticPatch: {
          triggers: [
            {
              key: 'volume.spike',
              phase: 'entry',
              sideScope: 'long',
              params: { multiplier: 2 },
            },
          ],
          actions: [{ key: 'open_long' }],
          risk: [
            {
              key: 'risk.atr_stop',
              params: { atrPeriod: 14, multiplier: 2 },
            },
          ],
          position: {
            mode: 'fixed_ratio',
            value: 0.1,
            positionMode: 'long_only',
          },
          contextSlots: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'perp',
            timeframe: '15m',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-unsupported-fallback-start' })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: 'OKX BTCUSDT 15m 放量突破开多，用 ATR 止损，仓位 10%',
    })
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    const semanticState = createPayload.semanticState as Record<string, any>

    expect(result.status).toBe('DRAFTING')
    expect(result.specDesc).toBeNull()
    expect(result.canonicalDigest).toBeNull()
    expect(result.semanticGraph).toBeNull()
    expect(result.assistantPrompt ?? '').toContain('当前公测暂未支持生成和回测')
    expect(result.assistantPrompt ?? '').toContain('是否改用这个策略继续')
    expect((result as { unsupportedFallback?: unknown }).unsupportedFallback).toEqual(expect.objectContaining({
      status: 'pending',
      recommendedStrategy: expect.objectContaining({
        strategyKey: 'price_breakout_with_fixed_risk',
      }),
    }))
    expect(createPayload).toEqual(expect.objectContaining({
      status: 'DRAFTING',
      latestDraftCode: null,
      latestSpecDesc: null,
    }))
    expect(semanticState.unsupportedFallback).toEqual(expect.objectContaining({
      status: 'pending',
      recommendedStrategy: expect.objectContaining({
        strategyKey: 'price_breakout_with_fixed_risk',
      }),
    }))
    expect(semanticState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'volume.spike',
        openSlots: [],
        support: expect.objectContaining({ supportStatus: 'recognized_unsupported' }),
      }),
    ]))
    expect(semanticState.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.atr_stop',
        openSlots: [],
        support: expect.objectContaining({ supportStatus: 'recognized_unsupported' }),
      }),
    ]))
    expect(mockRepo.tryMarkGenerating).not.toHaveBeenCalled()
  })

  it('does not partially generate when supported atoms are mixed with recognized unsupported atoms', async () => {
    const buildFromSemanticStateSpy = jest.spyOn(canonicalSpecBuilder, 'buildFromSemanticState')
    const buildFromNormalizedIntentSpy = jest.spyOn(canonicalSpecBuilder, 'buildFromNormalizedIntent')
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        semanticPatch: {
          triggers: [
            {
              key: 'indicator.cross_over',
              phase: 'entry',
              sideScope: 'long',
              params: { indicator: 'ma', fastPeriod: 20, slowPeriod: 50 },
            },
            {
              key: 'volume.spike',
              phase: 'entry',
              sideScope: 'long',
              params: { multiplier: 2 },
            },
          ],
          actions: [{ key: 'open_long' }],
          risk: [{
            key: 'risk.stop_loss_pct',
            params: { valuePct: 5 },
          }],
          position: {
            mode: 'fixed_ratio',
            value: 0.1,
            positionMode: 'long_only',
          },
          contextSlots: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'perp',
            timeframe: '15m',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-unsupported-mixed-no-partial-generate' })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: 'OKX BTCUSDT 15m，MA20 上穿 MA50 开多，但必须成交量放大，单笔 10%，止损 5%。',
    })
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    const semanticState = createPayload.semanticState as Record<string, any>

    expect(result.status).toBe('DRAFTING')
    expect(result.scriptCode ?? null).toBeNull()
    expect(result.specDesc ?? null).toBeNull()
    expect(result.canonicalDigest ?? null).toBeNull()
    expect(result.assistantPrompt ?? '').toContain('当前公测暂未支持生成和回测')
    expect(result.assistantPrompt ?? '').toContain('是否改用这个策略继续')
    expect(createPayload).toEqual(expect.objectContaining({
      status: 'DRAFTING',
      latestDraftCode: null,
      latestSpecDesc: null,
    }))
    expect(semanticState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'indicator.cross_over' }),
      expect.objectContaining({
        key: 'volume.spike',
        support: expect.objectContaining({ supportStatus: 'recognized_unsupported' }),
      }),
    ]))
    expect(buildFromSemanticStateSpy).not.toHaveBeenCalled()
    expect(buildFromNormalizedIntentSpy).not.toHaveBeenCalled()
    expect(mockRepo.tryMarkGenerating).not.toHaveBeenCalled()
  })

  it('keeps unsupported fallback start responses out of the ordinary clarification gate', async () => {
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        semanticPatch: {
          triggers: [{
            key: 'volume.spike',
            phase: 'entry',
            sideScope: 'long',
            params: { multiplier: 2 },
          }],
          actions: [{ key: 'open_long' }],
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-unsupported-fallback-start-clear' })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '放量突破就开多',
    })
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(result.assistantPrompt ?? '').toContain('是否改用这个策略继续')
    expect((result as any).clarificationGate).toEqual(expect.objectContaining({
      blocked: false,
      pendingItems: [],
    }))
    expect((result as { unsupportedFallback?: unknown }).unsupportedFallback).toEqual(expect.objectContaining({
      status: 'pending',
    }))
    expect(createPayload.clarificationState).toEqual(expect.objectContaining({
      status: 'CLEAR',
      items: [],
    }))
  })

  it('exposes pending unsupported fallback from persisted session snapshots', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-unsupported-fallback-snapshot',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {},
      constraintPack: {},
      latestDraftCode: null,
      latestSpecDesc: null,
      semanticGraph: null,
      semanticState: {
        version: 1,
        families: [],
        triggers: [],
        actions: [],
        risk: [],
        position: null,
        contextSlots: {},
        normalizationNotes: [],
        updatedAt: '2026-05-01T00:00:00.000Z',
        unsupportedFallback: {
          status: 'pending',
          prompt: '当前公测暂未支持 ATR 止损，是否改用这个策略继续？',
          recommendedStrategy: {
            strategyKey: 'price_breakout_with_fixed_risk',
            description: '价格突破后用固定比例止损止盈',
          },
        },
      },
      clarificationState: {
        status: 'CLEAR',
        items: [],
      },
      rejectReason: null,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    })

    const result = await service.getSession('s-unsupported-fallback-snapshot', 'u1')

    expect((result as { unsupportedFallback?: unknown }).unsupportedFallback).toEqual(expect.objectContaining({
      status: 'pending',
      prompt: expect.stringContaining('ATR'),
      recommendedStrategy: expect.objectContaining({
        strategyKey: 'price_breakout_with_fixed_risk',
      }),
    }))
    expect((result as any).clarificationGate).toEqual(expect.objectContaining({
      blocked: false,
      pendingItems: [],
    }))
  })

  it('keeps unclear and rejected pending fallback replies out of the ordinary clarification gate', async () => {
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        semanticPatch: {
          triggers: [{
            key: 'volume.spike',
            phase: 'entry',
            sideScope: 'long',
            params: { multiplier: 2 },
          }],
          actions: [{ key: 'open_long' }],
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-unsupported-fallback-pending-clear' })
    await service.startSession({
      userId: 'u1',
      initialMessage: '放量突破就开多',
    })
    const created = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    mockRepo.findById.mockResolvedValueOnce(buildPersistedSessionSnapshot(
      's-unsupported-fallback-pending-clear',
      {},
      {
        userId: 'u1',
        status: 'DRAFTING',
        semanticState: created.semanticState,
        clarificationState: created.clarificationState,
        constraintPack: created.constraintPack,
        latestSpecDesc: null,
      },
    ))

    const unclearResult = await service.continueSession('s-unsupported-fallback-pending-clear', {
      userId: 'u1',
      message: '再说一下',
    })
    const unclearPayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>

    expect((unclearResult as any).clarificationGate).toEqual(expect.objectContaining({
      blocked: false,
      pendingItems: [],
    }))
    expect(unclearPayload.clarificationState).toEqual(expect.objectContaining({
      status: 'CLEAR',
      items: [],
    }))

    mockRepo.findById.mockResolvedValueOnce(buildPersistedSessionSnapshot(
      's-unsupported-fallback-pending-clear',
      {},
      {
        userId: 'u1',
        status: 'DRAFTING',
        semanticState: unclearPayload.semanticState,
        clarificationState: unclearPayload.clarificationState,
        constraintPack: unclearPayload.constraintPack,
        latestSpecDesc: null,
      },
    ))

    const rejectedResult = await service.continueSession('s-unsupported-fallback-pending-clear', {
      userId: 'u1',
      message: '不改推荐策略，周期还是 1h',
    })
    const rejectedPayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>

    expect(rejectedResult.assistantPrompt ?? '').toContain('不改用推荐策略')
    expect((rejectedResult as any).clarificationGate).toEqual(expect.objectContaining({
      blocked: false,
      pendingItems: [],
    }))
    expect(rejectedPayload.semanticState.unsupportedFallback).toBeNull()
    expect(rejectedPayload.clarificationState).toEqual(expect.objectContaining({
      status: 'CLEAR',
      items: [],
    }))
  })

  it('accepts pending unsupported fallback wording and re-enters executable main flow', async () => {
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        semanticPatch: {
          risk: [
            {
              key: 'risk.partial_take_profit',
              params: { levels: [{ valuePct: 5, reducePct: 50 }] },
            },
          ],
          contextSlots: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'perp',
            timeframe: '15m',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-unsupported-fallback-accept' })
    await service.startSession({
      userId: 'u1',
      initialMessage: 'OKX BTCUSDT 15m 分批止盈，仓位 10%',
    })
    const created = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    mockRepo.findById.mockResolvedValue(buildPersistedSessionSnapshot(
      's-unsupported-fallback-accept',
      {},
      {
        userId: 'u1',
        status: 'DRAFTING',
        semanticState: created.semanticState,
        clarificationState: created.clarificationState,
        constraintPack: created.constraintPack,
        latestSpecDesc: null,
      },
    ))
    mockAi.chat.mockClear()

    const result = await service.continueSession('s-unsupported-fallback-accept', {
      userId: 'u1',
      message: '确认，可以等等',
    })
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    const nextState = updatePayload.semanticState as Record<string, any>

    expect(result.status).not.toBe('GENERATING')
    expect(result.assistantPrompt ?? '').not.toContain('暂未支持')
    expect(nextState.unsupportedFallback).toBeNull()
    expect(nextState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'indicator.cross_over' }),
      expect.objectContaining({ key: 'indicator.cross_under' }),
    ]))
    expect(nextState.risk).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'risk.partial_take_profit' }),
    ]))
    expect(mockAi.chat).not.toHaveBeenCalled()
    expect(mockRepo.tryMarkGenerating).not.toHaveBeenCalled()
  })

  it('does not treat risk percent changes as fallback position modifications', async () => {
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        semanticPatch: {
          risk: [{ key: 'risk.atr_stop', params: { atrPeriod: 14, multiplier: 2 } }],
          contextSlots: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'perp',
            timeframe: '15m',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-unsupported-fallback-risk-percent' })
    await service.startSession({
      userId: 'u1',
      initialMessage: 'OKX BTCUSDT 15m ATR 动态止损，仓位 10%',
    })
    const created = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    mockRepo.findById.mockResolvedValue(buildPersistedSessionSnapshot(
      's-unsupported-fallback-risk-percent',
      {},
      {
        userId: 'u1',
        status: 'DRAFTING',
        semanticState: created.semanticState,
        clarificationState: created.clarificationState,
        constraintPack: created.constraintPack,
        latestSpecDesc: null,
      },
    ))
    mockAi.chat.mockClear()

    const result = await service.continueSession('s-unsupported-fallback-risk-percent', {
      userId: 'u1',
      message: '可以，但止损改成 3%',
    })
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    const nextState = updatePayload.semanticState as Record<string, any>

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('支持把周期改成')
    expect(nextState.unsupportedFallback).toEqual(expect.objectContaining({ status: 'pending' }))
    expect(nextState.position?.value).not.toBe(0.03)
    expect(mockAi.chat).not.toHaveBeenCalled()
    expect(mockRepo.tryMarkGenerating).not.toHaveBeenCalled()
  })

  it('applies Chinese timeframe fallback modifications', async () => {
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        semanticPatch: {
          risk: [{ key: 'risk.atr_stop', params: { atrPeriod: 14, multiplier: 2 } }],
          contextSlots: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'perp',
            timeframe: '1h',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-unsupported-fallback-chinese-timeframe' })
    await service.startSession({
      userId: 'u1',
      initialMessage: 'OKX BTCUSDT 1h ATR 动态止损，仓位 10%',
    })
    const created = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    mockRepo.findById.mockResolvedValue(buildPersistedSessionSnapshot(
      's-unsupported-fallback-chinese-timeframe',
      {},
      {
        userId: 'u1',
        status: 'DRAFTING',
        semanticState: created.semanticState,
        clarificationState: created.clarificationState,
        constraintPack: created.constraintPack,
        latestSpecDesc: null,
      },
    ))
    mockAi.chat.mockClear()

    const result = await service.continueSession('s-unsupported-fallback-chinese-timeframe', {
      userId: 'u1',
      message: '可以，周期改成 15分钟',
    })
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    const nextState = updatePayload.semanticState as Record<string, any>

    expect(result.assistantPrompt).toContain('周期为 15m')
    expect(nextState.unsupportedFallback).toBeNull()
    expect(nextState.contextSlots.timeframe).toEqual(expect.objectContaining({
      status: 'locked',
      value: '15m',
    }))
    expect(mockAi.chat).not.toHaveBeenCalled()
  })

  it('does not route back to the same unsupported fallback after rejecting it and describing a supported strategy', async () => {
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        semanticPatch: {
          triggers: [
            {
              key: 'volume.spike',
              phase: 'entry',
              sideScope: 'long',
              params: { multiplier: 2 },
            },
          ],
          actions: [{ key: 'open_long' }],
          risk: [
            {
              key: 'risk.atr_stop',
              params: { atrPeriod: 14, multiplier: 2 },
            },
          ],
          position: {
            mode: 'fixed_ratio',
            value: 0.1,
            positionMode: 'long_only',
          },
          contextSlots: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'perp',
            timeframe: '15m',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-unsupported-fallback-reject' })
    await service.startSession({
      userId: 'u1',
      initialMessage: 'OKX BTCUSDT 15m 放量突破开多，用 ATR 止损，仓位 10%',
    })
    const created = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    mockRepo.findById.mockResolvedValueOnce(buildPersistedSessionSnapshot(
      's-unsupported-fallback-reject',
      {},
      {
        userId: 'u1',
        status: 'DRAFTING',
        semanticState: created.semanticState,
        clarificationState: created.clarificationState,
        constraintPack: created.constraintPack,
        latestSpecDesc: null,
      },
    ))

    await service.continueSession('s-unsupported-fallback-reject', {
      userId: 'u1',
      message: '不改用推荐策略',
    })
    const rejectedPayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>

    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        semanticPatch: rsiSemanticPatch(),
      }),
    })
    mockRepo.findById.mockResolvedValueOnce(buildPersistedSessionSnapshot(
      's-unsupported-fallback-reject',
      {},
      {
        userId: 'u1',
        status: 'DRAFTING',
        semanticState: rejectedPayload.semanticState,
        clarificationState: rejectedPayload.clarificationState,
        constraintPack: rejectedPayload.constraintPack,
        latestSpecDesc: null,
      },
    ))

    const result = await service.continueSession('s-unsupported-fallback-reject', {
      userId: 'u1',
      message: '改成 RSI 低于 30 开多，高于 70 平仓，止损 5%，止盈 10%，仓位 10%',
    })
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    const nextState = updatePayload.semanticState as Record<string, any>

    expect(result.assistantPrompt ?? '').not.toContain('当前公测暂未支持生成和回测')
    expect(nextState.unsupportedFallback ?? null).toBeNull()
    expect(nextState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'oscillator.rsi_lte' }),
      expect.objectContaining({ key: 'oscillator.rsi_gte' }),
    ]))
    expect(nextState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'volume.spike', status: 'superseded' }),
    ]))
    expect(nextState.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'risk.atr_stop', status: 'superseded' }),
    ]))
  })

  it('lets a pending unsupported fallback reply describe a new supported strategy without explicit rejection', async () => {
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        semanticPatch: {
          triggers: [
            {
              key: 'volume.spike',
              phase: 'entry',
              sideScope: 'long',
              params: { multiplier: 2 },
            },
          ],
          actions: [{ key: 'open_long' }],
          risk: [
            {
              key: 'risk.atr_stop',
              params: { atrPeriod: 14, multiplier: 2 },
            },
          ],
          position: {
            mode: 'fixed_ratio',
            value: 0.1,
            positionMode: 'long_only',
          },
          contextSlots: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'perp',
            timeframe: '15m',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-unsupported-fallback-new-seed' })
    await service.startSession({
      userId: 'u1',
      initialMessage: 'OKX BTCUSDT 15m 放量突破开多，用 ATR 止损，仓位 10%',
    })
    const created = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    mockRepo.findById.mockResolvedValueOnce(buildPersistedSessionSnapshot(
      's-unsupported-fallback-new-seed',
      {},
      {
        userId: 'u1',
        status: 'DRAFTING',
        semanticState: created.semanticState,
        clarificationState: created.clarificationState,
        constraintPack: created.constraintPack,
        latestSpecDesc: null,
      },
    ))
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。请确认逻辑图。',
        semanticPatch: rsiSemanticPatch(),
      }),
    })

    const result = await service.continueSession('s-unsupported-fallback-new-seed', {
      userId: 'u1',
      message: '那改成 RSI 低于 30 开多，高于 70 平仓，止损 5%，止盈 10%，仓位 10%',
    })
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    const nextState = updatePayload.semanticState as Record<string, any>

    expect(result.assistantPrompt ?? '').not.toContain('是否改用这个策略继续')
    expect(nextState.unsupportedFallback ?? null).toBeNull()
    expect(nextState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'oscillator.rsi_lte' }),
      expect.objectContaining({ key: 'oscillator.rsi_gte' }),
    ]))
  })

  it('rejects engine tests when semantic input is missing', async () => {
    await expect(service.testEngine({
      userId: 'u1',
      message: '测试',
    } as any)).rejects.toMatchObject({
      args: { missingFields: ['semanticState'] },
    })
  })

  it('rejects engine tests that only send legacy checklist fields', async () => {
    await expect(service.testEngine({
      userId: 'u1',
      message: '测试',
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['RSI 14 低于 30 时做多'],
      exitRules: ['收益率达到 5% 止盈'],
      riskRules: { positionPct: 10 },
    } as any)).rejects.toMatchObject({
      args: { missingFields: ['semanticState'] },
    })
  })

  it('tests engine generation from semanticState through canonical spec constraints', async () => {
    mockAi.chat.mockResolvedValueOnce({
      content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "semantic", positionSizeRatio: 0.1 }',
    })

    const result = await service.testEngine({
      userId: 'u1',
      message: '请测试语义态生成策略脚本',
      semanticState: buildLockedMaSemanticState(),
    } as any)

    expect(result.staticPassed).toBe(true)
    expect(result.runtimePassed).toBe(true)
    expect(result.outputPassed).toBe(true)
    const prompt = mockAi.chat.mock.calls[0]?.[0]?.messages?.[1]?.content as string
    expect(prompt).toContain('"version":2')
    expect(prompt).not.toContain('entryRules')
  })

  it('rejects malformed engine semanticState without throwing internal errors', async () => {
    await expect(service.testEngine({
      userId: 'u1',
      message: '请测试语义态生成策略脚本',
      semanticState: {
        version: 1,
        triggers: [],
        actions: [],
        risk: [],
      },
    } as any)).rejects.toMatchObject({
      message: 'codegen.invalid_semantic_input',
      args: { field: 'semanticState' },
    })
  })

  it('rejects engine semanticState trigger objects that cannot be safely traversed', async () => {
    await expect(service.testEngine({
      userId: 'u1',
      message: '请测试语义态生成策略脚本',
      semanticState: {
        ...buildLockedMaSemanticState(),
        triggers: [
          {
            id: 'bad-trigger',
            key: 'indicator.above',
            phase: 'entry',
            params: {},
            status: 'locked',
            source: 'user_explicit',
          },
        ],
      },
    } as any)).rejects.toMatchObject({
      message: 'codegen.invalid_semantic_input',
      args: { field: 'semanticState' },
    })
  })

  it('rejects engine semanticState trigger objects without params', async () => {
    await expect(service.testEngine({
      userId: 'u1',
      message: '请测试语义态生成策略脚本',
      semanticState: {
        ...buildLockedMaSemanticState(),
        triggers: [
          {
            id: 'bad-trigger',
            key: 'indicator.above',
            phase: 'entry',
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          },
        ],
      },
    } as any)).rejects.toMatchObject({
      message: 'codegen.invalid_semantic_input',
      args: { field: 'semanticState' },
    })
  })

  it('rejects engine semanticState with malformed nested open slots', async () => {
    await expect(service.testEngine({
      userId: 'u1',
      message: '请测试语义态生成策略脚本',
      semanticState: {
        ...buildLockedMaSemanticState(),
        triggers: [
          {
            ...buildLockedMaSemanticState().triggers[0],
            openSlots: [null],
          },
        ],
      },
    } as any)).rejects.toMatchObject({
      message: 'codegen.invalid_semantic_input',
      args: { field: 'semanticState' },
    })
  })

  it('rejects engine semanticState without families array', async () => {
    const { families: _families, ...semanticStateWithoutFamilies } = buildLockedMaSemanticState()

    await expect(service.testEngine({
      userId: 'u1',
      message: '请测试语义态生成策略脚本',
      semanticState: semanticStateWithoutFamilies,
    } as any)).rejects.toMatchObject({
      message: 'codegen.invalid_semantic_input',
      args: { field: 'semanticState' },
    })
  })

  it('tests engine generation from a provided canonicalSpec without checklist fallback', async () => {
    const semanticState = buildLockedMaSemanticState()
    const normalization = (service as any).buildNormalizationFromSemanticState(semanticState)
    const canonicalSpec = (service as any).buildCanonicalSpecForConversation(semanticState, normalization)
    mockAi.chat.mockResolvedValueOnce({
      content: 'return { direction: "BUY", signalType: "ENTRY", confidence: 75, entryPrice: 62000, stopLoss: 61000, takeProfit: 64000, reasoning: "canonical", positionSizeRatio: 0.1 }',
    })

    const result = await service.testEngine({
      userId: 'u1',
      message: '请测试 canonical spec 生成策略脚本',
      canonicalSpec,
    } as any)

    expect(result.staticPassed).toBe(true)
    expect(result.runtimePassed).toBe(true)
    expect(result.outputPassed).toBe(true)
    const prompt = mockAi.chat.mock.calls[0]?.[0]?.messages?.[1]?.content as string
    expect(prompt).toContain('"version":2')
    expect(prompt).not.toContain('entryRules')
  })

  it('rejects malformed engine canonicalSpec input', async () => {
    await expect(service.testEngine({
      userId: 'u1',
      message: '请测试 canonical spec 生成策略脚本',
      canonicalSpec: {},
    } as any)).rejects.toMatchObject({
      message: 'codegen.invalid_semantic_input',
      args: { field: 'canonicalSpec' },
    })
  })

  it('rejects structurally unusable engine canonicalSpec v2 input', async () => {
    await expect(service.testEngine({
      userId: 'u1',
      message: '请测试 canonical spec 生成策略脚本',
      canonicalSpec: {
        version: 2,
        market: {},
        dataRequirements: {},
        rules: [],
      },
    } as any)).rejects.toMatchObject({
      message: 'codegen.invalid_semantic_input',
      args: { field: 'canonicalSpec' },
    })
  })

  it('rejects canonicalSpec rules without canonical condition or actions', async () => {
    const semanticState = buildLockedMaSemanticState()
    const normalization = (service as any).buildNormalizationFromSemanticState(semanticState)
    const canonicalSpec = (service as any).buildCanonicalSpecForConversation(semanticState, normalization)

    await expect(service.testEngine({
      userId: 'u1',
      message: '请测试 canonical spec 生成策略脚本',
      canonicalSpec: {
        ...canonicalSpec,
        rules: [
          {
            id: 'bad-rule',
            phase: 'entry',
            priority: 100,
            condition: {},
            actions: [],
          },
        ],
      },
    } as any)).rejects.toMatchObject({
      message: 'codegen.invalid_semantic_input',
      args: { field: 'canonicalSpec' },
    })
  })

  it('rejects canonicalSpec rules with unusable condition or action shapes', async () => {
    const semanticState = buildLockedMaSemanticState()
    const normalization = (service as any).buildNormalizationFromSemanticState(semanticState)
    const canonicalSpec = (service as any).buildCanonicalSpecForConversation(semanticState, normalization)

    await expect(service.testEngine({
      userId: 'u1',
      message: '请测试 canonical spec 生成策略脚本',
      canonicalSpec: {
        ...canonicalSpec,
        rules: [
          {
            id: 'bad-rule',
            phase: 'entry',
            priority: 100,
            condition: { kind: 'atom' },
            actions: [{ type: '' }],
          },
        ],
      },
    } as any)).rejects.toMatchObject({
      message: 'codegen.invalid_semantic_input',
      args: { field: 'canonicalSpec' },
    })
  })

  it('fills deterministic context before required semantic open slots when semanticPatch omits context', async () => {
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '请补充仓位和止损规则。',
        semanticPatch: {
          triggers: [
            {
              key: 'price.percent_change',
              phase: 'entry',
              params: {
                direction: 'down',
                valuePct: 1,
                window: '3m',
              },
            },
            {
              key: 'price.percent_change',
              phase: 'exit',
              params: {
                direction: 'up',
                valuePct: 2,
                window: '15m',
              },
            },
          ],
          actions: [
            { key: 'open_long' },
            { key: 'close_long' },
          ],
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-semantic-patch-deterministic-context' })

    await service.startSession({
      userId: 'u1',
      initialMessage: '在 OKX 合约 BTCUSDT 15m，3分钟跌1%买入，15分钟涨2%卖出',
    })
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(createPayload.semanticState.contextSlots).toEqual(expect.objectContaining({
      exchange: expect.objectContaining({ status: 'locked', value: 'okx' }),
      symbol: expect.objectContaining({ status: 'locked', value: 'BTCUSDT' }),
      marketType: expect.objectContaining({ status: 'locked', value: 'perp' }),
      timeframe: expect.objectContaining({ status: 'locked', value: '15m' }),
    }))
    expect(createPayload.semanticState.triggers).toHaveLength(2)
    expect(createPayload.semanticState.actions).toHaveLength(2)
    expect(createPayload.semanticState.position.openSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slotKey: 'position.sizing',
        status: 'open',
      }),
    ]))
    expect(createPayload.semanticState.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.protective_exit',
        status: 'open',
        openSlots: expect.arrayContaining([
          expect.objectContaining({
            slotKey: 'risk.protective_exit',
            status: 'open',
          }),
        ]),
      }),
    ]))
    expect(createPayload.clarificationState.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slotKey: 'position.sizing',
        reason: 'missing_semantic_position_sizing',
      }),
      expect.objectContaining({
        slotKey: 'risk.protective_exit',
        reason: 'missing_semantic_risk',
      }),
    ]))
    expect(createPayload.clarificationState.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'missing_take_profit_rule',
      }),
    ]))
  })


  it('clears stale open position sizing slots when locked position sizing is already valid', () => {
    const currentState = {
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry',
          key: 'price.percent_change',
          phase: 'entry',
          params: { valuePct: 1 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit' }],
      risk: [{ id: 'risk', key: 'risk.stop_loss_pct', params: { valuePct: 5 }, status: 'locked', source: 'user_explicit', openSlots: [] }],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [
          {
            slotKey: 'position.sizing',
            fieldPath: 'position.sizing',
            status: 'open',
            priority: 'risk',
            questionHint: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
            affectsExecution: true,
          },
        ],
      },
      contextSlots: {
        exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', priority: 'context', questionHint: '请确认交易所（binance / okx / hyperliquid）。', affectsExecution: true },
        symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'BTCUSDT', status: 'locked', priority: 'context', questionHint: '请确认策略交易标的（例如 BTCUSDT）。', affectsExecution: true },
        marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'spot', status: 'locked', priority: 'context', questionHint: '请确认市场类型（现货或合约/perp）。', affectsExecution: true },
        timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '3m', status: 'locked', priority: 'context', questionHint: '请确认策略主周期（例如 15m 或 1h）。', affectsExecution: true },
      },
      normalizationNotes: [],
      updatedAt: '2026-04-21T10:00:00.000Z',
    }

    const result = (service as any).applyConversationPlanToSemanticState({
      currentState,
      plan: { related: true, logicReady: false, assistantPrompt: '继续' },
    })

    expect(result.position.openSlots).toEqual([])
    expect((service as any).findNextOpenSemanticSlot(result)).toBeNull()
  })

  it('ignores legacy-only planner logic when updating semantic triggers and actions', () => {
    const currentState = (service as any).createEmptySemanticState()

    const result = (service as any).applyConversationPlanToSemanticState({
      currentState,
      plan: {
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑图已更新。',
        ['lo' + 'gic']: completeChecklist({
          entryRules: ['短均线上穿长均线（金叉）时做多'],
          exitRules: ['短均线下穿长均线（死叉）时平多'],
        }),
      },
    })

    expect(result.triggers).toEqual([])
    expect(result.actions).toEqual([])
  })

  it('opens position sizing when semanticPatch carries a zero fixed-ratio position', async () => {
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '逻辑图仍未完整，请继续补充。',
        semanticPatch: {
          families: ['single-leg'],
          triggers: [
            {
              phase: 'entry',
              key: 'indicator.above',
              params: {
                indicator: 'ma',
                referenceRole: 'long_term',
                'reference.period': 50,
                confirmationMode: 'close_confirm',
              },
            },
            {
              phase: 'exit',
              key: 'indicator.below',
              params: {
                indicator: 'ma',
                referenceRole: 'short_term',
                'reference.period': 20,
                confirmationMode: 'close_confirm',
              },
            },
          ],
          actions: [
            { key: 'open_long' },
            { key: 'close_long' },
          ],
          position: {
            mode: 'fixed_ratio',
            value: 0,
            positionMode: 'long_only',
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
    mockRepo.createSession.mockResolvedValue({ id: 's-semantic-patch-zero-position' })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '在 OKX 合约 BTCUSDT 15m，MA50 上破做多，MA20 下破平仓',
    })
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(result.status).toBe('DRAFTING')
    expect(createPayload.semanticState.position).toEqual(expect.objectContaining({
      mode: 'fixed_ratio',
      value: 0,
      positionMode: 'long_only',
      status: 'open',
      source: 'derived',
      openSlots: expect.arrayContaining([
        expect.objectContaining({
          slotKey: 'position.sizing',
          fieldPath: 'position.sizing',
          status: 'open',
        }),
      ]),
    }))
    expect(createPayload.semanticState.position).not.toEqual(expect.objectContaining({
      status: 'locked',
      openSlots: [],
    }))
    expect(createPayload.clarificationState.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slotKey: 'position.sizing',
        reason: 'missing_semantic_position_sizing',
      }),
    ]))
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
      status: 'CONFIRM_GATE',
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
        status: 'CONFIRM_GATE',
      }),
    ])
  })

  it('does not list strategy plaza run sessions as AI Quant conversations', async () => {
    mockConversationsRepo.listByUser.mockResolvedValue([
      {
        id: 'conv-visible',
        userId: 'u1',
        title: '编辑会话',
        codegenSessionId: 'session-visible',
        createdAt: new Date('2026-04-10T20:00:00.000Z'),
        updatedAt: new Date('2026-04-10T20:01:00.000Z'),
        messages: [{ role: 'user', content: '从编辑进入' }],
      },
      {
        id: 'conv-plaza-run',
        userId: 'u1',
        title: 'MA 均线交叉 官方模板',
        codegenSessionId: 'strategy-plaza:official:ma-cross:user:hash:source:hash',
        createdAt: new Date('2026-04-10T20:00:00.000Z'),
        updatedAt: new Date('2026-04-10T20:02:00.000Z'),
        messages: [{ role: 'assistant', content: '策略代码已生成，现在可以开始回测。' }],
      },
    ])
    mockConversationsRepo.listKnownSessionIdsByUser.mockResolvedValue([
      'session-visible',
      'strategy-plaza:official:ma-cross:user:hash:source:hash',
    ])
    mockRepo.listByUser.mockResolvedValue([
      { id: 'strategy-plaza:official:grid:user:hash:source:hash', userId: 'u1' },
    ])
    mockRepo.findById.mockResolvedValue({
      id: 'session-visible',
      userId: 'u1',
      status: 'CONFIRM_GATE',
      checklist: {},
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: { conversationHistory: ['U: 从编辑进入'] },
      latestDraftCode: null,
      latestSpecDesc: null,
      rejectReason: null,
      createdAt: new Date('2026-04-10T20:00:00.000Z'),
      updatedAt: new Date('2026-04-10T20:01:00.000Z'),
      strategyInstanceId: null,
    })

    const result = await service.listConversations('u1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'conv-visible',
      activeCodegenSessionId: 'session-visible',
      conversationTitle: '编辑会话',
    })
    expect(mockConversationsRepo.upsertConversationSnapshot).not.toHaveBeenCalled()
    expect(mockRepo.findById).not.toHaveBeenCalledWith('strategy-plaza:official:ma-cross:user:hash:source:hash')
    expect(mockRepo.findById).not.toHaveBeenCalledWith('strategy-plaza:official:grid:user:hash:source:hash')
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

  it('restores published script code from the latest snapshot when listing conversations', async () => {
    mockConversationsRepo.listByUser.mockResolvedValue([
      {
        id: 'conv-published-script',
        userId: 'u1',
        title: '已发布脚本会话',
        codegenSessionId: 'session-published-script',
        createdAt: new Date('2026-04-10T20:00:00.000Z'),
        updatedAt: new Date('2026-04-10T20:01:00.000Z'),
        backtestDraftConfig: null,
        lastBacktestRef: null,
        messages: [{ role: 'assistant', content: '策略代码已生成，现在可以开始回测。' }],
      },
    ])
    mockConversationsRepo.listKnownSessionIdsByUser.mockResolvedValue(['session-published-script'])
    mockRepo.listByUser.mockResolvedValue([])
    mockRepo.findById.mockResolvedValue({
      id: 'session-published-script',
      userId: 'u1',
      status: 'PUBLISHED',
      checklist: {},
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      latestDraftCode: null,
      latestSpecDesc: {
        publishedSnapshotId: 'snapshot-script-1',
      },
      rejectReason: null,
      createdAt: new Date('2026-04-10T20:00:00.000Z'),
      updatedAt: new Date('2026-04-10T20:01:00.000Z'),
      strategyInstanceId: 'instance-1',
    })
    mockRepo.findLatestBySessionId.mockResolvedValue({
      id: 'snapshot-script-1',
      scriptSnapshot: 'export default function strategy() { return { action: "NOOP" } }',
      specSnapshot: {},
      semanticGraph: null,
      consistencyReport: { status: 'PASSED' },
    })

    const result = await service.listConversations('u1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'conv-published-script',
      status: 'PUBLISHED',
      publishedSnapshotId: 'snapshot-script-1',
      scriptCode: 'export default function strategy() { return { action: "NOOP" } }',
    })
  })

  it('does not fabricate script code when a published session has no draft code or snapshot script', async () => {
    mockConversationsRepo.listByUser.mockResolvedValue([
      {
        id: 'conv-published-missing-script',
        userId: 'u1',
        title: '缺少脚本的已发布会话',
        codegenSessionId: 'session-published-missing-script',
        createdAt: new Date('2026-04-10T20:00:00.000Z'),
        updatedAt: new Date('2026-04-10T20:01:00.000Z'),
        backtestDraftConfig: null,
        lastBacktestRef: null,
        messages: [{ role: 'assistant', content: '策略代码已生成，现在可以开始回测。' }],
      },
    ])
    mockConversationsRepo.listKnownSessionIdsByUser.mockResolvedValue(['session-published-missing-script'])
    mockRepo.listByUser.mockResolvedValue([])
    mockRepo.findById.mockResolvedValue({
      id: 'session-published-missing-script',
      userId: 'u1',
      status: 'PUBLISHED',
      checklist: {},
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      latestDraftCode: null,
      latestSpecDesc: {
        publishedSnapshotId: 'snapshot-missing-script',
      },
      rejectReason: null,
      createdAt: new Date('2026-04-10T20:00:00.000Z'),
      updatedAt: new Date('2026-04-10T20:01:00.000Z'),
      strategyInstanceId: 'instance-1',
    })
    mockRepo.findLatestBySessionId.mockResolvedValue({
      id: 'snapshot-missing-script',
      scriptSnapshot: '',
      specSnapshot: {},
      semanticGraph: null,
      consistencyReport: { status: 'PASSED' },
    })

    const result = await service.listConversations('u1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'conv-published-missing-script',
      status: 'PUBLISHED',
      publishedSnapshotId: 'snapshot-missing-script',
      scriptCode: null,
    })
  })

  it('preserves older conversation messages when persisting a truncated planner window', async () => {
    const oldMessages = Array.from({ length: 14 }, (_, index) => ({
      role: (index % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `old-${index + 1}`,
    }))
    const projectedMessages = [
      ...oldMessages.slice(-10),
      { role: 'user' as const, content: 'new user' },
      { role: 'assistant' as const, content: 'new assistant' },
    ]
    mockRepo.findById.mockResolvedValue({
      id: 'session-full-history',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {},
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {
        conversationHistory: projectedMessages.map(message =>
          `${message.role === 'user' ? 'U' : 'A'}: ${message.content}`,
        ),
      },
      latestDraftCode: null,
      latestSpecDesc: null,
      rejectReason: null,
      createdAt: new Date('2026-04-10T20:00:00.000Z'),
      updatedAt: new Date('2026-04-10T20:01:00.000Z'),
      strategyInstanceId: null,
    })
    mockConversationsRepo.findByCodegenSessionId.mockResolvedValue({
      id: 'conv-full-history',
      userId: 'u1',
      title: '完整历史',
      codegenSessionId: 'session-full-history',
      archivedAt: null,
      createdAt: new Date('2026-04-10T20:00:00.000Z'),
      updatedAt: new Date('2026-04-10T20:01:00.000Z'),
      backtestDraftConfig: null,
      lastBacktestRef: null,
      messages: oldMessages,
    })

    await (service as any).persistConversationProjectionForSessionId('session-full-history', 'u1')

    expect(mockConversationsRepo.upsertConversationSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      codegenSessionId: 'session-full-history',
      messages: [
        ...oldMessages,
        { role: 'user', content: 'new user' },
        { role: 'assistant', content: 'new assistant' },
      ],
    }))
  })

  it('includes lastBacktestRef when it matches the current published snapshot', async () => {
    mockConversationsRepo.listByUser.mockResolvedValue([
      {
        id: 'conv-1',
        userId: 'user-1',
        codegenSessionId: 'session-1',
        title: 'conv',
        archivedAt: null,
        createdAt: new Date('2026-04-23T00:00:00.000Z'),
        updatedAt: new Date('2026-04-23T00:05:00.000Z'),
        lastBacktestRef: {
          jobId: 'btjob-1',
          publishedSnapshotId: 'snapshot-1',
          config: {
            range: {
              preset: '30D',
            },
            execution: {
              initialCash: 10000,
              leverage: 1,
              slippageBps: 10,
              feeBps: 5,
              priceSource: 'close',
              allowPartial: true,
            },
          },
          summary: {
            maxDrawdownPct: 8,
            totalReturnPct: 12,
            winRatePct: 60,
            tradeCount: 5,
            marketType: 'spot',
          },
          completedAt: new Date('2026-04-23T00:04:00.000Z'),
        },
        messages: [],
      },
    ])
    mockConversationsRepo.listKnownSessionIdsByUser.mockResolvedValue(['session-1'])
    mockRepo.listByUser.mockResolvedValue([])
    mockRepo.findById.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      status: 'PUBLISHED',
      checklist: {},
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: { conversationHistory: ['U: 原始 session 消息'] },
      latestDraftCode: 'export default function strategy() { return true }',
      latestSpecDesc: null,
      rejectReason: null,
      createdAt: new Date('2026-04-23T00:00:00.000Z'),
      updatedAt: new Date('2026-04-23T00:05:00.000Z'),
      strategyInstanceId: 'instance-1',
    })
    mockRepo.findLatestBySessionId.mockResolvedValue({
      id: 'snapshot-1',
      consistencyReport: { status: 'PASSED' },
    })

    const result = await service.listConversations('user-1')

    expect(result[0]).toMatchObject({
      id: 'conv-1',
      lastBacktestRef: {
        jobId: 'btjob-1',
        publishedSnapshotId: 'snapshot-1',
        config: {
          range: {
            preset: '30D',
          },
          execution: {
            initialCash: 10000,
            leverage: 1,
            slippageBps: 10,
            feeBps: 5,
            priceSource: 'close',
            allowPartial: true,
          },
        },
        summary: expect.objectContaining({
          maxDrawdownPct: 8,
          totalReturnPct: 12,
          winRatePct: 60,
          tradeCount: 5,
        }),
        completedAt: '2026-04-23T00:04:00.000Z',
      },
    })
  })

  it('hides lastBacktestRef when it no longer matches the current published snapshot', async () => {
    mockConversationsRepo.listByUser.mockResolvedValue([
      {
        id: 'conv-1',
        userId: 'user-1',
        codegenSessionId: 'session-1',
        title: 'conv',
        archivedAt: null,
        createdAt: new Date('2026-04-23T00:00:00.000Z'),
        updatedAt: new Date('2026-04-23T00:05:00.000Z'),
        lastBacktestRef: {
          jobId: 'btjob-1',
          publishedSnapshotId: 'snapshot-1',
          config: {
            range: {
              preset: '30D',
            },
            execution: {
              initialCash: 10000,
              leverage: 1,
              slippageBps: 10,
              feeBps: 5,
              priceSource: 'close',
              allowPartial: true,
            },
          },
          summary: {
            maxDrawdownPct: 8,
            totalReturnPct: 12,
            winRatePct: 60,
            tradeCount: 5,
            marketType: 'spot',
          },
          completedAt: new Date('2026-04-23T00:04:00.000Z'),
        },
        messages: [],
      },
    ])
    mockConversationsRepo.listKnownSessionIdsByUser.mockResolvedValue(['session-1'])
    mockRepo.listByUser.mockResolvedValue([])
    mockRepo.findById.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      status: 'PUBLISHED',
      checklist: {},
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: { conversationHistory: ['U: 原始 session 消息'] },
      latestDraftCode: 'export default function strategy() { return true }',
      latestSpecDesc: null,
      rejectReason: null,
      createdAt: new Date('2026-04-23T00:00:00.000Z'),
      updatedAt: new Date('2026-04-23T00:05:00.000Z'),
      strategyInstanceId: 'instance-1',
    })
    mockRepo.findLatestBySessionId.mockResolvedValue({
      id: 'snapshot-2',
      consistencyReport: { status: 'PASSED' },
    })

    const result = await service.listConversations('user-1')

    expect(result[0]?.lastBacktestRef).toBeNull()
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

  it('rejects deleting a conversation while its linked strategy is running', async () => {
    mockConversationsRepo.findActiveDeleteContextByIdAndUser.mockResolvedValue({
      id: 'conv-1',
      userId: 'u1',
      codegenSessionId: 'session-1',
    })
    mockRepo.findById.mockResolvedValue({
      id: 'session-1',
      userId: 'u1',
      status: 'PUBLISHED',
      strategyInstanceId: 'inst-running',
      latestSpecDesc: null,
      constraintPack: null,
      latestDraftCode: null,
      rejectReason: null,
      createdAt: new Date('2026-04-10T20:00:00.000Z'),
      updatedAt: new Date('2026-04-10T20:01:00.000Z'),
    })
    mockAccountStrategyViewService.getStrategyDetail.mockResolvedValue({
      id: 'inst-running',
      status: 'running',
    })

    await expect(service.deleteConversation('conv-1', 'u1')).rejects.toThrow('ai_quant.conversation_delete_running_strategy')

    expect(mockConversationsRepo.archiveByIdAndUser).not.toHaveBeenCalled()
    expect(mockAccountStrategyViewService.deleteStrategy).not.toHaveBeenCalled()
  })

  it('archives a conversation when its linked strategy record no longer exists', async () => {
    mockConversationsRepo.findActiveDeleteContextByIdAndUser.mockResolvedValue({
      id: 'conv-1',
      userId: 'u1',
      codegenSessionId: 'session-1',
    })
    mockRepo.findById.mockResolvedValue({
      id: 'session-1',
      userId: 'u1',
      status: 'PUBLISHED',
      strategyInstanceId: 'inst-missing',
      latestSpecDesc: null,
      constraintPack: null,
      latestDraftCode: null,
      rejectReason: null,
      createdAt: new Date('2026-04-10T20:00:00.000Z'),
      updatedAt: new Date('2026-04-10T20:01:00.000Z'),
    })
    mockAccountStrategyViewService.getStrategyDetail.mockRejectedValue(Object.assign(new Error('account_strategy.not_found'), {
      code: 'ACCOUNT_STRATEGY_NOT_FOUND',
      status: 404,
    }))

    await service.deleteConversation('conv-1', 'u1')

    expect(mockAccountStrategyViewService.deleteStrategy).not.toHaveBeenCalled()
    expect(mockConversationsRepo.archiveByIdAndUser).toHaveBeenCalledWith('conv-1', 'u1')
  })

  it('deletes the linked stopped strategy before archiving when requested', async () => {
    mockConversationsRepo.findActiveDeleteContextByIdAndUser.mockResolvedValue({
      id: 'conv-1',
      userId: 'u1',
      codegenSessionId: 'session-1',
    })
    mockRepo.findById.mockResolvedValue({
      id: 'session-1',
      userId: 'u1',
      status: 'PUBLISHED',
      strategyInstanceId: 'inst-stopped',
      latestSpecDesc: null,
      constraintPack: null,
      latestDraftCode: null,
      rejectReason: null,
      createdAt: new Date('2026-04-10T20:00:00.000Z'),
      updatedAt: new Date('2026-04-10T20:01:00.000Z'),
    })
    mockAccountStrategyViewService.getStrategyDetail.mockResolvedValue({
      id: 'inst-stopped',
      status: 'stopped',
    })

    await (service as any).deleteConversation('conv-1', 'u1', { deleteStoppedStrategy: true })

    expect(mockAccountStrategyViewService.deleteStrategy).toHaveBeenCalledWith('u1', 'inst-stopped')
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
          content: expect.stringContaining('服务端 semanticState / clarificationState / compilation gate 是唯一权威'),
        }),
      ]),
    }))

    const chatCall = mockAi.chat.mock.calls[0]?.[0] as { messages?: Array<{ role?: string; content?: string }> }
    const systemPrompt = chatCall.messages?.find(message => message.role === 'system')?.content ?? ''

    expect(systemPrompt).toContain('logicReady 只是建议性自评')
    expect(systemPrompt).toContain('semanticPatch 只表达当前消息涉及的增量语义')
    expect(systemPrompt).toContain('已有 active semantic state 时，默认按增量修改处理')
    expect(systemPrompt).toContain('输出原子语义 patch')
    expect(systemPrompt).toContain('context、trigger、action、risk、position')
    expect(systemPrompt).toContain('不要输出 checklist')
    expect(systemPrompt).toContain('用户明确要求替换整个策略')
    expect(systemPrompt).toContain('否则不得重置已有语义')
    expect(systemPrompt).toContain('若编辑意图不完整，只追问缺失的 semantic slot')
    expect(systemPrompt).toContain('不得臆造新的核心交易规则')
    expect(systemPrompt).not.toContain('必须直接给出完整入场+出场规则草案')
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
    expect(systemPrompt).toContain('不要从脚本文本反推策略语义')
    expect(systemPrompt).toContain('逻辑图和脚本必须从更新后的 SemanticState 与 canonical spec 派生')
    expect(systemPrompt).toContain('不要为了“覆盖”而伪造无意义的运行时代码分支')
    expect(userPrompt).toContain('价格连续3根K线在轨外时直接平仓')
    expect(userPrompt).not.toContain('价格连续3根K线在轨外时直接减仓')
    expect(userPrompt).toContain('"exchange":"okx"')
    expect(userPrompt).toContain('"marketType":"perp"')
  })


  it('asks for missing exchange from execution-context diagnostics before checklist fallback gaps', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-execution-context-clarify' })

    const result = await service.startSession({
      userId: 'u-1',
      initialMessage: '在合约市场的 BTCUSDT 15分钟图上，3分钟内跌 1% 做多，5分钟内涨 2% 平仓，单笔 10% 仓位',
    })

    expect(result.status).toBe('DRAFTING')
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



  it('accepts planner semanticPatch output and projects it into logic snapshot state', async () => {
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
    expect(result.status).toBe('CONFIRM_GATE')
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

  it('keeps the protective exit slot open when planner stop-loss patch omits a threshold', async () => {
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
            { key: 'risk.stop_loss_pct', params: {} },
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
    mockRepo.createSession.mockResolvedValue({ id: 's-semantic-risk-threshold' })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '帮我做一个 MA50 上破买入、MA10 下破卖出的 OKX 现货 BTCUSDT 15m 策略，止损规则先按规划补上。',
    })

    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(result.status).toBe('DRAFTING')
    expect(createPayload.semanticState.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.protective_exit',
        status: 'open',
        openSlots: expect.arrayContaining([
          expect.objectContaining({
            slotKey: 'risk.protective_exit',
            status: 'open',
          }),
        ]),
      }),
    ]))
    expect(createPayload.clarificationState.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'missing_semantic_risk',
        slotKey: 'risk.protective_exit',
      }),
    ]))
    expect(createPayload.clarificationState.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'missing_take_profit_rule',
      }),
    ]))
  })

  it('treats locked max drawdown as protective risk without asking for stop loss', async () => {
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
            {
              key: 'risk.condition_expression',
              params: {
                condition: {
                  kind: 'predicate',
                  op: 'LTE',
                  left: { kind: 'position', field: 'pnl_pct' },
                  right: { kind: 'constant', value: -12, unit: 'percent' },
                },
                effect: { type: 'pause_strategy' },
                scope: 'strategy',
                capabilityStatus: 'recognized_unsupported',
                unsupportedReason: 'risk_expression_compiler_not_available',
              },
            },
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
    mockRepo.createSession.mockResolvedValue({ id: 's-semantic-risk-max-drawdown' })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '帮我做一个 MA50 上破买入、MA10 下破卖出的 OKX 现货 BTCUSDT 15m 策略，最大回撤 12%。',
    })

    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(result.status).toBe('CONFIRM_GATE')
    expect(createPayload.semanticState.risk).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.protective_exit',
      }),
    ]))
    expect(createPayload.clarificationState.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'missing_stop_loss_rule',
      }),
    ]))
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
          risk: [
            { key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
          ],
        },
      }),
    })

    const result = await service.continueSession('s-semantic-first-continue', {
      userId: 'u1',
      message: '出场改成 MA10 下破卖出',
    })

    expect(result.status).toBe('CONFIRM_GATE')
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
      risk: [lockedStopLossRisk()],
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
      id: 's-semantic-first-confirm',
      userId: 'u1',
      status: 'CONFIRM_GATE',
      checklist: null,
      semanticState: persistedSemanticState,
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'entry.rules',
            field: 'entryRules',
            reason: 'missing_entry_rules',
            question: '请补充至少一条明确的入场规则。',
            blocking: true,
            status: 'pending',
          },
          {
            key: 'exit.rules',
            field: 'exitRules',
            reason: 'missing_exit_rules',
            question: '请补充至少一条明确的出场规则。',
            blocking: true,
            status: 'pending',
          },
        ],
      },
      constraintPack: {},
      strategyInstanceId: null,
    })

    const result = await service.continueSession('s-semantic-first-confirm', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(persistedSemanticState),
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
    const generatedChecklist = (service as any).buildLegacyLogicSnapshotProjectionForCompatibility(generatingPayload.semanticState, {})
    expect(generatedChecklist).toEqual(expect.objectContaining({
      entryRules: expect.arrayContaining(['收盘确认价格突破长期均线（50）时买入']),
      exitRules: expect.arrayContaining(['收盘确认价格跌破短期均线（20）时卖出']),
    }))
  })

  it('does not fall back to checklist completeness in continueWithStructuredClarificationAnswers when semantic slots are closed', async () => {
    const missingFieldsSpy = jest.spyOn(service as any, 'resolveLogicSnapshotMissingFields').mockReturnValue(['entryRules', 'exitRules'])
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
    expect(result.assistantPrompt).toContain('我当前理解的策略是：')
    expect(result.assistantPrompt).not.toContain('请先补全入场和出场规则，再确认生成代码。')
  })

  it('does not fall back to checklist completeness in continueConfirmedSession when semantic state is ready', async () => {
    const activeGateSpy = jest.spyOn(service as any, 'resolveActiveGateMissingFields').mockReturnValue(['entryRules', 'exitRules'])
    const persistedSemanticState = buildLockedMaSemanticState({
      risk: [lockedStopLossRisk()],
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
      id: 's-confirm-semantic-no-checklist-gate',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(persistedSemanticState),
    })

    expect(activeGateSpy).not.toHaveBeenCalled()
    expect(result.status).toBe('GENERATING')
  })

  it('keeps confirmGenerate drafting with protective risk slot when context and position answers complete prerequisites', async () => {
    const activeGateSpy = jest.spyOn(service as any, 'resolveActiveGateMissingFields').mockReturnValue([])
    const persistedSemanticState = buildLockedMaSemanticState({
      risk: [],
      position: {
        mode: 'fixed_ratio',
        value: 0,
        positionMode: 'long_only',
        status: 'open',
        source: 'derived',
        openSlots: [
          {
            slotKey: 'position.sizing',
            fieldPath: 'position.sizing',
            status: 'open',
            priority: 'risk',
            questionHint: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
            affectsExecution: true,
          },
        ],
      },
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          status: 'open',
          priority: 'context',
          questionHint: '请确认交易所（binance / okx / hyperliquid）。',
          affectsExecution: true,
        },
        symbol: {
          slotKey: 'symbol',
          fieldPath: 'contextSlots.symbol',
          status: 'open',
          priority: 'context',
          questionHint: '请确认策略交易标的（例如 BTCUSDT）。',
          affectsExecution: true,
        },
        marketType: {
          slotKey: 'marketType',
          fieldPath: 'contextSlots.marketType',
          status: 'open',
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
    })
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-confirm-required-protective-risk',
      userId: 'u1',
      status: 'CONFIRM_GATE',
      checklist: null,
      semanticState: persistedSemanticState,
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'semantic.position.sizing',
            reason: 'missing_position_pct',
            field: 'riskRules.positionPct',
            blocking: true,
            question: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
            status: 'answered',
            slotId: buildSemanticSlotId({
              slotKey: 'position.sizing',
              fieldPath: 'position.sizing',
            }),
            slotKey: 'position.sizing',
            fieldPath: 'position.sizing',
          },
          {
            key: 'executionContext.exchange',
            reason: 'missing_exchange',
            field: 'exchange',
            blocking: true,
            question: '请确认交易所（binance / okx / hyperliquid）。',
            status: 'answered',
            slotKey: 'exchange',
            fieldPath: 'contextSlots.exchange',
          },
          {
            key: 'executionContext.symbol',
            reason: 'missing_symbol',
            field: 'symbol',
            blocking: true,
            question: '请确认策略交易标的（例如 BTCUSDT）。',
            status: 'answered',
            slotKey: 'symbol',
            fieldPath: 'contextSlots.symbol',
          },
          {
            key: 'executionContext.marketType',
            reason: 'missing_market_type',
            field: 'marketType',
            blocking: true,
            question: '请确认市场类型（现货或合约/perp）。',
            status: 'answered',
            slotKey: 'marketType',
            fieldPath: 'contextSlots.marketType',
          },
          {
            key: 'executionContext.timeframe',
            reason: 'missing_timeframe',
            field: 'timeframe',
            blocking: true,
            question: '请确认策略主周期（例如 15m 或 1h）。',
            status: 'answered',
            slotKey: 'timeframe',
            fieldPath: 'contextSlots.timeframe',
          },
        ],
      },
      constraintPack: {},
    })
    const confirmedDigest = 'sha256:confirm-required-protective-risk'
    const readCanonicalDigestSpy = jest
      .spyOn(service as any, 'readCanonicalDigest')
      .mockReturnValue(confirmedDigest)
    mockRepo.findById.mockResolvedValue(sessionFixture)

    try {
      const result = await service.continueSession('s-confirm-required-protective-risk', {
        userId: 'u1',
        message: 'OKX BTCUSDT 合约 15m，仓位 10%，确认生成',
        confirmGenerate: true,
        confirmedCanonicalDigest: confirmedDigest,
        clarificationAnswers: {
          'semantic.position.sizing': '10%',
          'executionContext.exchange': 'okx',
          'executionContext.symbol': 'BTCUSDT',
          'executionContext.marketType': 'perp',
          'executionContext.timeframe': '15m',
        },
      })

      expect(activeGateSpy).not.toHaveBeenCalled()
      expect(mockRepo.tryMarkGenerating).not.toHaveBeenCalled()
      expect(result.status).toBe('DRAFTING')
      expect(result.clarificationState).toEqual(expect.objectContaining({
        status: 'NEEDS_CLARIFICATION',
        items: expect.arrayContaining([
          expect.objectContaining({
            reason: 'missing_semantic_risk',
            slotKey: 'risk.protective_exit',
            fieldPath: 'risk[protective].params',
          }),
        ]),
      }))
      expect(mockRepo.updateSession).toHaveBeenCalledWith(
        's-confirm-required-protective-risk',
        expect.objectContaining({
          status: 'DRAFTING',
          semanticState: expect.objectContaining({
            position: expect.objectContaining({
              status: 'locked',
              value: 0.1,
            }),
            risk: expect.arrayContaining([
              expect.objectContaining({
                key: 'risk.protective_exit',
                status: 'open',
                openSlots: expect.arrayContaining([
                  expect.objectContaining({
                    slotKey: 'risk.protective_exit',
                    status: 'open',
                  }),
                ]),
              }),
            ]),
          }),
        }),
      )
    } finally {
      readCanonicalDigestSpy.mockRestore()
    }
  })

  it('does not let legacy clarification blockers keep confirmGenerate blocked after semantic slots are closed', async () => {
    const activeGateSpy = jest.spyOn(service as any, 'resolveActiveGateMissingFields').mockReturnValue(['entryRules'])
    const persistedSemanticState = buildLockedMaSemanticState({
      risk: [lockedStopLossRisk()],
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
      id: 's-confirm-semantic-legacy-blocker',
      userId: 'u1',
      status: 'CONFIRM_GATE',
      checklist: null,
      semanticState: persistedSemanticState,
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'legacy.exitRules',
            field: 'exitRules',
            reason: 'missing_exit_rules',
            question: '请补充出场规则。',
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
      confirmedCanonicalDigest: buildConfirmedCanonicalDigest(persistedSemanticState),
    })

    expect(activeGateSpy).not.toHaveBeenCalled()
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith(
      's-confirm-semantic-legacy-blocker',
      expect.objectContaining({
        status: 'GENERATING',
        clarificationState: expect.objectContaining({
          status: 'CLEAR',
          items: [],
        }),
      }),
    )
    expect(result.status).toBe('GENERATING')
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'CLEAR',
      items: [],
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

  it('preserves atom-native semantic clarification fields when reading persisted state', () => {
    const clarificationState = (service as any).readClarificationState({
      status: 'NEEDS_CLARIFICATION',
      items: [
        {
          key: 'semantic.position.sizing',
          reason: 'missing_semantic_position_sizing',
          field: 'position.sizing',
          blocking: true,
          question: '请确认仓位 sizing。',
          status: 'pending',
          slotKey: 'position.sizing',
        },
        {
          key: 'semantic.trigger.entry',
          reason: 'missing_semantic_trigger',
          field: 'triggers',
          blocking: true,
          question: '请确认入场触发条件。',
          status: 'pending',
          slotKey: 'trigger.entry',
        },
        {
          key: 'semantic.contract.requirement.price.define.level_set',
          reason: 'missing_semantic_contract_requirement',
          field: 'actions[action-grid-ladder].contracts[action-contract-grid-ladder].requires.price.define.level_set',
          blocking: true,
          question: '请补充 price define level_set 执行合约。',
          status: 'pending',
          slotKey: 'contract.requirement.price.define.level_set',
          fieldPath: 'actions[action-grid-ladder].contracts[action-contract-grid-ladder].requires.price.define.level_set',
        },
      ],
    })

    expect(clarificationState).toEqual(expect.objectContaining({
      status: 'NEEDS_CLARIFICATION',
      items: [
        expect.objectContaining({
          key: 'semantic.position.sizing',
          field: 'position.sizing',
          slotKey: 'position.sizing',
        }),
        expect.objectContaining({
          key: 'semantic.trigger.entry',
          field: 'triggers',
          slotKey: 'trigger.entry',
        }),
        expect.objectContaining({
          key: 'semantic.contract.requirement.price.define.level_set',
          field: 'actions[action-grid-ladder].contracts[action-contract-grid-ladder].requires.price.define.level_set',
          slotKey: 'contract.requirement.price.define.level_set',
        }),
      ],
    }))
  })

  it('does not preserve atom-native fields for legacy clarification reasons on readback', () => {
    const clarificationState = (service as any).readClarificationState({
      status: 'NEEDS_CLARIFICATION',
      items: [
        {
          key: 'executionContext.marketType',
          reason: 'missing_market_type',
          field: 'actions',
          blocking: true,
          question: '请确认市场类型（现货或合约/perp）。',
          status: 'pending',
        },
      ],
    })

    expect(clarificationState).toEqual(expect.objectContaining({
      items: [
        expect.objectContaining({
          key: 'executionContext.marketType',
          reason: 'missing_market_type',
          field: 'marketType',
        }),
      ],
    }))
  })

  it('uses semantic clarification priorities when building blocking reasons', () => {
    const blockingReasons = (service as any).buildEffectiveBlockingReasonsFromClarificationState({
      status: 'NEEDS_CLARIFICATION',
      items: [
        {
          key: 'semantic.trigger.entry',
          reason: 'missing_semantic_trigger',
          field: 'triggers',
          blocking: true,
          question: '请补充入场触发条件。',
          status: 'pending',
        },
        {
          key: 'semantic.contract.requirement.price.define.level_set',
          reason: 'missing_semantic_contract_requirement',
          field: 'actions[action-grid-ladder].contracts[action-contract-grid-ladder].requires.price.define.level_set',
          blocking: true,
          question: '请补充 price define level_set 执行合约。',
          status: 'pending',
        },
        {
          key: 'semantic.position.sizing',
          reason: 'missing_semantic_position_sizing',
          field: 'position.sizing',
          blocking: true,
          question: '请确认仓位 sizing。',
          status: 'pending',
        },
        {
          key: 'semantic.risk.protective_exit',
          reason: 'missing_semantic_risk',
          field: 'risk',
          blocking: true,
          question: '请确认止损类保护规则。',
          status: 'pending',
        },
      ],
    })

    expect(blockingReasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'semantic.trigger.entry', priority: 90 }),
      expect.objectContaining({ key: 'semantic.contract.requirement.price.define.level_set', priority: 90 }),
      expect.objectContaining({ key: 'semantic.position.sizing', priority: 70 }),
      expect.objectContaining({ key: 'semantic.risk.protective_exit', priority: 70 }),
    ]))
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


  it('starts in confirm gate when server-side semantic state is already complete and planner also marks logic ready', async () => {
    const dto: StartCodegenSessionDto = {
      userId: 'u1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 3分钟图上，3分钟跌1%做多，5分钟涨2%平多',
    }
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '策略逻辑已完整，请确认逻辑图。',
        semanticPatch: priceChangeSemanticPatch({ marketType: 'perp' }),
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's2' })

    const result = await service.startSession(dto)

    expect(result.status).toBe('CONFIRM_GATE')
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
    expect(result.assistantPrompt).toContain('请确认是否按这个逻辑生成脚本')
    expect(result.assistantPrompt).toContain('价格相对前收盘')
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

  it('returns semantic display logic graph for completed previous candle breakout strategy', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-previous-candle-breakout-display-graph' })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '策略逻辑已完整，请确认逻辑图。',
        semanticPatch: {
          triggers: [
            {
              key: 'condition.expression',
              phase: 'entry',
              sideScope: 'long',
              params: {
                expression: {
                  kind: 'predicate',
                  op: 'GT',
                  left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
                  right: { kind: 'series', source: 'bar', field: 'high', offsetBars: 1 },
                },
              },
            },
            {
              key: 'condition.expression',
              phase: 'exit',
              sideScope: 'long',
              params: {
                expression: {
                  kind: 'predicate',
                  op: 'LT',
                  left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
                  right: { kind: 'series', source: 'bar', field: 'low', offsetBars: 1 },
                },
              },
            },
          ],
          actions: [{ key: 'open_long' }, { key: 'close_long' }],
          risk: [
            { key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
            { key: 'risk.take_profit_pct', params: { valuePct: 10, basis: 'entry_avg_price' } },
          ],
          position: { mode: 'fixed_ratio', value: 0.03, positionMode: 'long_only' },
          contextSlots: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'perp',
            timeframe: '1m',
          },
        },
      }),
    })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '在 OKX 合约 BTCUSDT 1m，收盘价高于前一根最高价开多 3%，收盘价低于前一根最低价平多。',
    })
    const specDesc = result.specDesc

    expect(result.status).toBe('CONFIRM_GATE')
    expect(specDesc).toEqual(expect.objectContaining({
      displayLogicGraph: expect.objectContaining({
        blocks: expect.arrayContaining([
          expect.objectContaining({ type: 'IF' }),
          expect.objectContaining({ type: 'EXECUTE' }),
        ]),
      }),
    }))
    expect(JSON.stringify(specDesc?.displayLogicGraph)).toContain('收盘价高于前 1 根最高价')
    expect(JSON.stringify(specDesc?.displayLogicGraph)).not.toContain('不支持的条件')
  })

  it('starts in checklist gate for the exact raw price-change path without falling back to legacy entry and exit missing reasons', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's2-raw-price-change-exact' })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '策略逻辑已完整，请确认逻辑图。',
        semanticPatch: priceChangeSemanticPatch(),
      }),
    })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金',
    })

    expect(result.status).toBe('CONFIRM_GATE')
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
        semanticPatch: bollingerSemanticPatch(),
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
    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('触碰即触发，还是收盘确认')
    expect(result.assistantPrompt).toContain('布林带')
    expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
      semanticState: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({
            key: 'bollinger.touch_upper',
            phase: 'entry',
            sideScope: 'short',
          }),
          expect.objectContaining({
            key: 'price.detect.indicator_boundary',
            phase: 'entry',
            sideScope: 'short',
            openSlots: expect.arrayContaining([
              expect.objectContaining({ slotKey: 'confirmationMode.entry' }),
            ]),
          }),
        ]),
      }),
      clarificationState: expect.objectContaining({
        status: 'NEEDS_CLARIFICATION',
      }),
    }))
  })

  it('closes Bollinger confirmation slots from natural touch clarification without repeating the same prompt', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-bollinger-touch-clarification' })
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '请确认触发语义。',
      }),
    })

    const started = await service.startSession({
      userId: 'u1',
      initialMessage: '15min 布林带下轨买入 上轨卖出',
    })
    const createdSession = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(started.status).toBe('DRAFTING')
    expect(started.assistantPrompt).toContain('触碰即触发，还是收盘确认')

    mockRepo.findById.mockResolvedValueOnce(buildPersistedSessionSnapshot(
      's-bollinger-touch-clarification',
      createdSession,
    ))
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '继续完善策略。',
      }),
    })

    const result = await service.continueSession('s-bollinger-touch-clarification', {
      userId: 'u1',
      message: '触碰即触发',
    } as ContinueCodegenSessionDto)
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>

    expect(updatePayload.semanticState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'price.detect.indicator_boundary',
        params: expect.objectContaining({ confirmationMode: 'touch' }),
        openSlots: expect.not.arrayContaining([
          expect.objectContaining({
            slotKey: expect.stringContaining('confirmationMode'),
            status: 'open',
          }),
        ]),
      }),
    ]))
    expect(result.assistantPrompt).not.toContain('触碰即触发，还是收盘确认')
  })

  it('keeps Bollinger boundary atoms readable and preserves stop-loss risk through full clarification', async () => {
    mockRepo.createSession.mockResolvedValue({ id: 's-bollinger-boundary-full-clarification' })
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '继续完善策略。',
      }),
    })

    await service.startSession({
      userId: 'u1',
      initialMessage: '15min 布林带下轨买入 上轨卖出',
    })

    let sessionPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    const continueWith = async (message: string) => {
      mockRepo.findById.mockResolvedValueOnce(buildPersistedSessionSnapshot(
        's-bollinger-boundary-full-clarification',
        sessionPayload,
      ))
      const result = await service.continueSession('s-bollinger-boundary-full-clarification', {
        userId: 'u1',
        message,
      } as ContinueCodegenSessionDto)
      sessionPayload = {
        ...sessionPayload,
        ...(mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any> | undefined ?? {}),
      }
      return result
    }

    await continueWith('触碰即触发')
    await continueWith('10%')
    await continueWith('okx')
    await continueWith('BTCUSDT')
    await continueWith('合约')
    await continueWith('15m')
    const result = await continueWith('5%止损')

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.assistantPrompt).toContain('入场：触及布林带')
    expect(result.assistantPrompt).toContain('下轨时做多')
    expect(result.assistantPrompt).toContain('出场：触及布林带')
    expect(result.assistantPrompt).toContain('上轨时平多')
    expect(result.assistantPrompt).toContain('止损：价格相对入场均价下跌5% 强制平仓')
    expect(result.assistantPrompt).toContain('仓位：10%')
    expect(result.assistantPrompt).not.toContain('price.detect.indicator_boundary')
    expect(result.assistantPrompt).not.toContain('突破上下边界时执行风控')
    expect(sessionPayload.semanticState.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long', status: 'locked' }),
      expect.objectContaining({ key: 'close_long', status: 'locked' }),
    ]))
    expect(sessionPayload.semanticState.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.stop_loss_pct',
        params: expect.objectContaining({ valuePct: 5 }),
        status: 'locked',
      }),
    ]))
    expect(sessionPayload.semanticState.risk).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'risk.boundary_guard' }),
    ]))
  })










  it('uses server-side semantic summary instead of planner free text when grid clarification closes into checklist gate', async () => {
    mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
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

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.assistantPrompt).toContain('我整理出的策略逻辑如下：')
    expect(result.assistantPrompt).toContain('入场：区间网格')
    expect(result.assistantPrompt).not.toContain('仅做多')
    expect(result.assistantPrompt).toContain('请确认是否按这个逻辑生成脚本')
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
    const createdChecklist = createdSession ? readLegacyChecklistProjectionForTest(createdSession) : {}

    expect(started.status).toBe('CONFIRM_GATE')
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
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
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
    const projected = (service as any).buildLegacyLogicSnapshotProjectionForCompatibility({
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

  it('keeps semantic MA rules when buildLegacyLogicSnapshotProjectionForCompatibility projects over generic checklist placeholders', () => {
    const projected = (service as any).buildLegacyLogicSnapshotProjectionForCompatibility({
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

  it('does not let legacy fallback clarification decide semantic main-flow readiness', () => {
    const semanticState = {
      version: 1,
      families: ['grid.range_rebalance'],
      triggers: [
        {
          id: 'grid-entry',
          key: 'grid.range_rebalance',
          phase: 'entry',
          sideScope: 'both',
          params: {
            sideMode: 'bidirectional',
            recycle: true,
            breakoutAction: 'pause',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          contracts: [
            {
              id: 'contract-grid-levels',
              kind: 'trigger',
              capabilities: [
                {
                  domain: 'price',
                  verb: 'define',
                  object: 'level_set',
                  shape: {
                    mode: 'static_range',
                    lower: 78800,
                    upper: 81400,
                    gridIntervals: 10,
                    gridCount: 11,
                    absoluteSpacing: 260,
                    spacingMode: 'arithmetic',
                  },
                },
              ],
              requires: [],
              params: {},
            },
          ],
        },
      ],
      actions: [
        { id: 'grid-orders', key: 'place_limit_grid', status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
      risk: [],
      position: {
        mode: 'fixed_quote',
        value: 500,
        positionMode: 'bidirectional',
        sizing: { kind: 'quote', value: 500, asset: 'USDT' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
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
      updatedAt: '2026-04-16T10:00:00.000Z',
    }

    const result = (service as any).buildClarificationFromSemanticState(semanticState, {
      entryRules: ['在合适的趋势里开启网格'],
      exitRules: [],
      riskRules: {},
    }, { preserveLegacyFallback: false })

    expect(result).toEqual(expect.objectContaining({
      status: 'CLEAR',
      items: [],
    }))
  })

  it('keeps semantic trigger blockers when semantic evidence is risk-only', () => {
    const semanticState = {
      version: 1,
      families: [],
      triggers: [],
      actions: [],
      risk: [lockedStopLossRisk()],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-16T10:00:00.000Z',
    }

    const result = (service as any).buildClarificationFromSemanticState(semanticState, {
      entryRules: [],
      exitRules: [],
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        stopLossPct: 5,
      },
    }, { preserveLegacyFallback: false })

    expect(result.status).toBe('NEEDS_CLARIFICATION')
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'missing_semantic_trigger', slotKey: 'trigger.entry' }),
      expect.objectContaining({ reason: 'missing_semantic_trigger', slotKey: 'trigger.exit' }),
    ]))
  })

  it('keeps missing executable atoms as semantic slots across partial semantic turns', () => {
    const stateWithRiskOnly = (service as any).withRequiredSemanticOpenSlots({
      version: 1,
      families: [],
      triggers: [],
      actions: [],
      risk: [lockedStopLossRisk()],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-16T10:00:00.000Z',
    }, {})

    expect(stateWithRiskOnly.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic.missing_entry_atom',
        phase: 'entry',
        openSlots: expect.arrayContaining([
          expect.objectContaining({ slotKey: 'trigger.entry', status: 'open' }),
        ]),
      }),
      expect.objectContaining({
        key: 'semantic.missing_exit_atom',
        phase: 'exit',
        openSlots: expect.arrayContaining([
          expect.objectContaining({ slotKey: 'trigger.exit', status: 'open' }),
        ]),
      }),
    ]))

    const stateAfterEntryOnly = (service as any).withRequiredSemanticOpenSlots({
      ...stateWithRiskOnly,
      triggers: [
        ...stateWithRiskOnly.triggers,
        {
          id: 'entry-ma',
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ma', referenceRole: 'short_term' },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
    }, {})
    const clarification = (service as any).buildClarificationFromSemanticState(stateAfterEntryOnly, {
      entryRules: ['价格突破均线时买入'],
      exitRules: [],
      riskRules: { stopLossPct: 5 },
    }, { preserveLegacyFallback: false })

    expect(stateAfterEntryOnly.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'semantic.missing_entry_atom' }),
    ]))
    expect(stateAfterEntryOnly.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'semantic.missing_exit_atom' }),
    ]))
    expect(clarification).toEqual(expect.objectContaining({
      status: 'NEEDS_CLARIFICATION',
      items: expect.arrayContaining([
        expect.objectContaining({
          key: 'semantic.trigger.exit',
          reason: 'missing_semantic_trigger',
          slotKey: 'trigger.exit',
        }),
      ]),
    }))
    expect(clarification.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'semantic.trigger.entry' }),
    ]))
  })

  it('prunes missing exit placeholders when a later turn supplies complete order-program contracts', () => {
    const stateWithRiskOnly = (service as any).withRequiredSemanticOpenSlots({
      version: 1,
      families: [],
      triggers: [],
      actions: [],
      risk: [lockedStopLossRisk()],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-16T10:00:00.000Z',
    }, {})

    const stateAfterGrid = (service as any).withRequiredSemanticOpenSlots({
      ...stateWithRiskOnly,
      families: ['grid.range_rebalance'],
      triggers: [
        ...stateWithRiskOnly.triggers,
        {
          id: 'grid-range',
          key: 'grid.range_rebalance',
          phase: 'entry',
          sideScope: 'both',
          params: {
            sideMode: 'bidirectional',
            recycle: true,
            breakoutAction: 'pause',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          contracts: [{
            id: 'contract-grid-levels',
            kind: 'trigger',
            capabilities: [{
              domain: 'price',
              verb: 'define',
              object: 'level_set',
              shape: {
                mode: 'fixed_range',
                lower: 78800,
                upper: 81400,
                gridIntervals: 10,
                gridCount: 11,
                absoluteSpacing: 260,
                spacingMode: 'arithmetic',
              },
            }],
            requires: [],
            params: {},
          }],
        },
      ],
      actions: [{
        id: 'grid-orders',
        key: 'place_limit_grid',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        contracts: [{
          id: 'contract-grid-ladder',
          kind: 'action',
          capabilities: [
            {
              domain: 'order_program',
              verb: 'maintain',
              object: 'limit_ladder',
              shape: {
                orderType: 'limit',
                recycleOnFill: true,
                pairingPolicy: 'adjacent_level',
              },
            },
            {
              domain: 'capital',
              verb: 'allocate',
              object: 'per_order_budget',
              shape: {
                value: 500,
                asset: 'USDT',
              },
            },
          ],
          requires: [],
          params: {},
        }],
      }],
      position: {
        mode: 'fixed_quote',
        value: 500,
        positionMode: 'bidirectional',
        sizing: { kind: 'quote', value: 500, asset: 'USDT' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
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
    }, {})

    expect(stateAfterGrid.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'semantic.missing_entry_atom' }),
      expect.objectContaining({ key: 'semantic.missing_exit_atom' }),
    ]))
    expect((service as any).findNextOpenSemanticSlot(stateAfterGrid)).toBeNull()
  })

  it('does not resolve spot-short blockers just because marketType context is locked', () => {
    const semanticState = buildLockedMaSemanticState({
      contextSlots: {
        ...buildLockedMaSemanticState().contextSlots,
        marketType: {
          ...buildLockedMaSemanticState().contextSlots.marketType,
          value: 'spot',
        },
      },
    })

    expect((service as any).isResolvedBySemanticState({
      key: 'market.marketType',
      reason: 'invalid_spot_short_combo',
      field: 'marketType',
      blocking: true,
      question: '现货不能做空，请确认市场类型。',
      status: 'pending',
    }, semanticState)).toBe(false)
  })

  it('keeps spot-short safety blockers when semantic main-flow evidence exists', () => {
    const semanticState = buildLockedMaSemanticState({
      actions: [
        { id: 'action-open-short', key: 'open_short', status: 'locked', source: 'user_explicit' },
      ],
      contextSlots: {
        ...buildLockedMaSemanticState().contextSlots,
        marketType: {
          ...buildLockedMaSemanticState().contextSlots.marketType,
          value: 'spot',
        },
      },
    })

    const result = (service as any).buildClarificationFromSemanticState(semanticState, {
      entryRules: ['做空 BTCUSDT'],
      exitRules: ['平仓'],
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      riskRules: {
        exchange: 'okx',
        marketType: 'spot',
      },
    }, { preserveLegacyFallback: false })

    expect(result.status).toBe('NEEDS_CLARIFICATION')
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'invalid_spot_short_combo', blocking: true }),
    ]))
  })

  it('keeps action-only semantic patches blocked by missing executable trigger atoms', () => {
    const result = (service as any).withRequiredSemanticOpenSlots({
      version: 1,
      families: ['single-leg'],
      triggers: [],
      actions: [{
        id: 'action-open-long',
        key: 'open_long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      risk: [lockedStopLossRisk()],
      position: null,
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-16T10:00:00.000Z',
    }, {})

    expect(result.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'semantic.missing_entry_atom' }),
      expect.objectContaining({ key: 'semantic.missing_exit_atom' }),
    ]))
  })

  it('deduplicates fallback execution-context items when semantic context slots are already present', () => {
    const result = (service as any).mergeSemanticClarificationState({
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry-ma',
          key: 'indicator.above',
          phase: 'entry',
          params: {},
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

    const exchangeItems = result.items.filter(item => item.key === 'executionContext.exchange')
    expect(exchangeItems).toHaveLength(1)
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
    const mergedSemanticState = (service as any).mergeLogicSnapshotIntoSemanticStateForLegacyCompatibility(currentSemanticState, checklist)
    const projectedChecklist = (service as any).buildLegacyLogicSnapshotProjectionForCompatibility(mergedSemanticState, checklist)

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

    const mergedSemanticState = (service as any).mergeLogicSnapshotIntoSemanticStateForLegacyCompatibility(currentSemanticState, {
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

    const mergedSemanticState = (service as any).mergeLogicSnapshotIntoSemanticStateForLegacyCompatibility(currentSemanticState, {
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

    const mergedSemanticState = (service as any).mergeLogicSnapshotIntoSemanticStateForLegacyCompatibility(currentSemanticState, checklist)

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




  it('regression: normalized BTCUSDT semanticPatch keeps the percent-change startSession in DRAFTING without defaulting 10% position or requiring take profit', async () => {
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '请补充仓位和止损规则。',
        semanticPatch: {
          triggers: [
            {
              key: 'price.percent_change',
              phase: 'entry',
              params: {
                direction: 'down',
                valuePct: 1,
                window: '3m',
              },
            },
            {
              key: 'price.percent_change',
              phase: 'exit',
              params: {
                direction: 'up',
                valuePct: 2,
                window: '15m',
              },
            },
          ],
          actions: [
            { key: 'open_long' },
            { key: 'close_long' },
          ],
          contextSlots: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'spot',
            timeframe: '3m',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-percent-change-regression' })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出',
    })
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(result.status).toBe('DRAFTING')
    expect(createPayload.semanticState.position).toEqual(expect.objectContaining({
      mode: 'fixed_ratio',
      value: 0,
      positionMode: 'long_only',
      status: 'open',
      source: 'derived',
      openSlots: expect.arrayContaining([
        expect.objectContaining({
          slotKey: 'position.sizing',
          status: 'open',
        }),
      ]),
    }))
    expect(createPayload.semanticState.position).not.toEqual(expect.objectContaining({
      status: 'locked',
      value: 0.1,
    }))
    expect(createPayload.semanticState.contextSlots).toEqual(expect.objectContaining({
      exchange: expect.objectContaining({
        status: 'locked',
        value: 'okx',
      }),
      symbol: expect.objectContaining({
        status: 'locked',
        value: 'BTCUSDT',
      }),
      marketType: expect.objectContaining({
        status: 'locked',
        value: 'spot',
      }),
      timeframe: expect.objectContaining({
        status: 'locked',
        value: '3m',
      }),
    }))
    expect(createPayload.semanticState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'price.percent_change',
        phase: 'entry',
        params: expect.objectContaining({
          direction: 'down',
          valuePct: -1,
          window: '3m',
        }),
      }),
      expect.objectContaining({
        key: 'price.percent_change',
        phase: 'exit',
        params: expect.objectContaining({
          direction: 'up',
          valuePct: 2,
          window: '15m',
        }),
      }),
    ]))
    expect(createPayload.semanticState.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.protective_exit',
        status: 'open',
        source: 'derived',
        openSlots: expect.arrayContaining([
          expect.objectContaining({
            slotKey: 'risk.protective_exit',
            status: 'open',
          }),
        ]),
      }),
    ]))
    expect(createPayload.clarificationState.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slotKey: 'position.sizing',
        reason: 'missing_semantic_position_sizing',
      }),
      expect.objectContaining({
        slotKey: 'risk.protective_exit',
        reason: 'missing_semantic_risk',
      }),
    ]))
    expect(createPayload.clarificationState.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'missing_take_profit_rule',
      }),
    ]))
  })

  it('regression: semanticPatch trigger/action semantics keep explicit deterministic position sizing', async () => {
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '请补充止损规则。',
        semanticPatch: {
          triggers: [
            {
              key: 'price.percent_change',
              phase: 'entry',
              params: {
                direction: 'down',
                valuePct: 1,
                window: '3m',
              },
            },
            {
              key: 'price.percent_change',
              phase: 'exit',
              params: {
                direction: 'up',
                valuePct: 2,
                window: '15m',
              },
            },
          ],
          actions: [
            { key: 'open_long' },
            { key: 'close_long' },
          ],
          contextSlots: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'spot',
            timeframe: '3m',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-semantic-explicit-position' })

    await service.startSession({
      userId: 'u1',
      initialMessage: '在okx现货 BTCUSDT 3m，3分钟跌1%买入，15分钟涨2%卖出，仓位 10%',
    })
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(createPayload.semanticState.position).toEqual(expect.objectContaining({
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }))
    expect(createPayload.semanticState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'price.percent_change',
        phase: 'entry',
      }),
      expect.objectContaining({
        key: 'price.percent_change',
        phase: 'exit',
      }),
    ]))
    expect(createPayload.clarificationState.items).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
        slotKey: 'position.sizing',
        reason: 'missing_position_pct',
      }),
    ]))
  })

  it('does not ask for entry or exit rules after previous bar high-low seed semantics are complete', async () => {
    const initialMessage = '用 BTCUSDT 1m K 线。如果最新收盘价突破上一根 K 线最高价，且当前没有持仓，则开多，使用可用余额的 3%。如果最新收盘价跌破上一根 K 线最低价，则平多。'
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '请确认交易所。',
        semanticPatch: new SemanticSeedExtractorService().extract(initialMessage),
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-previous-bar-high-low-regression' })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage,
    } as StartCodegenSessionDto)
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(result.assistantPrompt).toContain('请确认交易所')
    expect(result.assistantPrompt).not.toContain('未识别可编译入场规则')
    expect(result.assistantPrompt).not.toContain('未识别可编译出场规则')
    expect(createPayload.semanticState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'condition.expression', phase: 'entry', sideScope: 'long' }),
      expect.objectContaining({ key: 'condition.expression', phase: 'exit', sideScope: 'long' }),
    ]))
  })

  it('position contract regression: fixed quote sizing from the user is not replaced by a percent clarification slot', async () => {
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '请确认交易所。',
        semanticPatch: {
          triggers: [
            {
              key: 'condition.expression',
              phase: 'entry',
              sideScope: 'long',
              params: {
                expression: {
                  kind: 'predicate',
                  op: 'GT',
                  left: { kind: 'series', source: 'bar', field: 'close' },
                  right: { kind: 'series', source: 'bar', field: 'open' },
                },
              },
            },
            {
              key: 'condition.expression',
              phase: 'exit',
              sideScope: 'long',
              params: {
                expression: {
                  kind: 'predicate',
                  op: 'LT',
                  left: { kind: 'series', source: 'bar', field: 'close' },
                  right: { kind: 'series', source: 'bar', field: 'open' },
                },
              },
            },
            {
              key: 'condition.expression',
              phase: 'gate',
              params: {
                expression: {
                  kind: 'NOT',
                  children: [
                    {
                      kind: 'predicate',
                      op: 'EQ',
                      left: { kind: 'position', field: 'has_position', side: 'long' },
                      right: { kind: 'constant', value: true },
                    },
                  ],
                },
              },
            },
          ],
          actions: [
            { key: 'open_long' },
            { key: 'close_long' },
          ],
          contextSlots: {
            symbol: 'BTCUSDT',
            timeframe: '1m',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-semantic-fixed-quote-position' })

    await service.startSession({
      userId: 'u1',
      initialMessage: '用 BTCUSDT 1m K 线。每次最新 K 线收盘价高于开盘价时尝试开多，固定使用 10 USDT。如果已有持仓则不再开仓。收盘价低于开盘价时平多。',
    })
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(createPayload.semanticState.position).toEqual(expect.objectContaining({
      sizing: { kind: 'quote', value: 10, asset: 'USDT' },
      mode: 'fixed_quote',
      value: 10,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }))
    expect(createPayload.clarificationState.items).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
        slotKey: 'position.sizing',
        reason: 'missing_position_pct',
      }),
    ]))
  })

  it('position contract regression: fixed base sizing from the user is not replaced by a percent clarification slot', async () => {
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '请确认交易所。',
        semanticPatch: {
          triggers: [
            {
              key: 'condition.expression',
              phase: 'entry',
              sideScope: 'long',
              params: {
                expression: {
                  kind: 'predicate',
                  op: 'GT',
                  left: { kind: 'series', source: 'bar', field: 'close' },
                  right: { kind: 'series', source: 'bar', field: 'open' },
                },
              },
            },
            {
              key: 'condition.expression',
              phase: 'exit',
              sideScope: 'long',
              params: {
                expression: {
                  kind: 'predicate',
                  op: 'LT',
                  left: { kind: 'series', source: 'bar', field: 'close' },
                  right: { kind: 'series', source: 'bar', field: 'open' },
                },
              },
            },
          ],
          actions: [
            { key: 'open_long' },
            { key: 'close_long' },
          ],
          contextSlots: {
            symbol: 'BTCUSDT',
            timeframe: '1m',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-semantic-fixed-base-position' })

    await service.startSession({
      userId: 'u1',
      initialMessage: '用 BTCUSDT 1m K 线。每次买 0.001 BTC，收盘价高于开盘价时尝试开多，收盘价低于开盘价时平多。',
    })
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(createPayload.semanticState.position).toEqual(expect.objectContaining({
      sizing: { kind: 'base', value: 0.001, asset: 'BTC' },
      mode: 'fixed_qty',
      value: 0.001,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }))
    expect(createPayload.clarificationState.items).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
        slotKey: 'position.sizing',
      }),
    ]))
  })

  it('position contract regression: missing sizing asks a generic amount question', async () => {
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '请补充仓位。',
        semanticPatch: {
          triggers: [
            {
              key: 'condition.expression',
              phase: 'entry',
              sideScope: 'long',
              params: {
                expression: {
                  kind: 'predicate',
                  op: 'GT',
                  left: { kind: 'series', source: 'bar', field: 'close' },
                  right: { kind: 'series', source: 'bar', field: 'open' },
                },
              },
            },
          ],
          actions: [
            { key: 'open_long' },
          ],
          contextSlots: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'spot',
            timeframe: '1m',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-semantic-missing-position-contract' })

    await service.startSession({
      userId: 'u1',
      initialMessage: '用 OKX 现货 BTCUSDT 1m K 线。收盘价高于开盘价时尝试开多。',
    })
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(createPayload.semanticState.position).toEqual(expect.objectContaining({
      sizing: null,
      status: 'open',
      openSlots: expect.arrayContaining([
        expect.objectContaining({
          slotKey: 'position.sizing',
          fieldPath: 'position.sizing',
          questionHint: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
        }),
      ]),
    }))
    expect(createPayload.clarificationState.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slotKey: 'position.sizing',
        fieldPath: 'position.sizing',
        question: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
      }),
    ]))
  })

  it('regression: semanticPatch position keeps explicit deterministic stop loss risk', async () => {
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '逻辑图已更新。',
        semanticPatch: {
          triggers: [
            {
              key: 'price.percent_change',
              phase: 'entry',
              params: {
                direction: 'down',
                valuePct: 1,
                window: '3m',
              },
            },
            {
              key: 'price.percent_change',
              phase: 'exit',
              params: {
                direction: 'up',
                valuePct: 2,
                window: '15m',
              },
            },
          ],
          actions: [
            { key: 'open_long' },
            { key: 'close_long' },
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
            timeframe: '3m',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-semantic-explicit-risk' })

    await service.startSession({
      userId: 'u1',
      initialMessage: '在okx现货 BTCUSDT 3m，3分钟跌1%买入，15分钟涨2%卖出，仓位 10%，亏损 5% 止损',
    })
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(createPayload.semanticState.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.stop_loss_pct',
        params: expect.objectContaining({
          valuePct: 5,
          basis: 'entry_avg_price',
        }),
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }),
    ]))
    expect(createPayload.semanticState.risk).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
        key: 'risk.protective_exit',
      }),
    ]))
    expect(createPayload.clarificationState.items).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
        slotKey: 'risk.protective_exit',
        reason: 'missing_stop_loss_rule',
      }),
    ]))
  })

  it('does not ask for stop loss basis after plain stop loss is understood', async () => {
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '请补充入场和仓位。',
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 'risk-default-basis-regression' })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '做多，亏损 5% 止损',
    })
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(JSON.stringify(createPayload.semanticState?.risk ?? [])).toContain('entry_avg_price')
    expect(result.assistantPrompt).not.toContain('entry_avg_price')
    expect(result.assistantPrompt).not.toContain('basis')
    expect(result.assistantPrompt).not.toContain('计算基准')
    expect(result.assistantPrompt).not.toContain('risk.stopLossBasis')
  })

  it('regression: deterministic stop loss is added even when semanticPatch has max drawdown risk', async () => {
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '逻辑图已更新。',
        semanticPatch: {
          triggers: [
            {
              key: 'price.percent_change',
              phase: 'entry',
              params: {
                direction: 'down',
                valuePct: 1,
                window: '3m',
              },
            },
            {
              key: 'price.percent_change',
              phase: 'exit',
              params: {
                direction: 'up',
                valuePct: 2,
                window: '15m',
              },
            },
          ],
          actions: [
            { key: 'open_long' },
            { key: 'close_long' },
          ],
          position: {
            mode: 'fixed_ratio',
            value: 0.1,
            positionMode: 'long_only',
          },
          risk: [
            { key: 'risk.max_drawdown_pct', params: { valuePct: 12 } },
          ],
          contextSlots: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'spot',
            timeframe: '3m',
          },
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-semantic-explicit-stop-loss-with-max-drawdown' })

    await service.startSession({
      userId: 'u1',
      initialMessage: '在okx现货 BTCUSDT 3m，3分钟跌1%买入，15分钟涨2%卖出，仓位 10%，亏损 5% 止损，最大回撤 12%',
    })
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(createPayload.semanticState.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.max_drawdown_pct',
        params: expect.objectContaining({ valuePct: 12 }),
        status: 'locked',
      }),
      expect.objectContaining({
        key: 'risk.stop_loss_pct',
        params: expect.objectContaining({
          valuePct: 5,
        }),
        status: 'locked',
      }),
    ]))
    expect(createPayload.semanticState.risk).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ key: 'risk.protective_exit' }),
    ]))
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

  it('uses the published snapshot spec for published session responses', async () => {
    mockRepo.findLatestBySessionId.mockResolvedValue({
      id: 'snapshot-bound-spec',
      specSnapshot: {
        market: {
          exchange: 'okx',
          symbol: 'DOGEUSDT',
          marketType: 'spot',
          defaultTimeframe: '3m',
        },
        rules: [
          {
            id: 'snapshot-rule',
            phase: 'entry',
            condition: { key: 'execution.on_start' },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      },
      consistencyReport: { status: 'PASSED' },
      paramsSnapshot: {
        exchange: 'okx',
        symbol: 'DOGEUSDT',
        timeframe: '3m',
      },
      lockedParams: {
        exchange: 'okx',
        symbol: 'DOGEUSDT',
        timeframe: '3m',
      },
      strategyConfig: {
        exchange: 'okx',
        symbol: 'DOGEUSDT',
        baseTimeframe: '3m',
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
    })
    mockRepo.findById.mockResolvedValue({
      id: 's-drifted-published',
      userId: 'u1',
      status: 'PUBLISHED',
      checklist: {},
      constraintPack: {},
      latestDraftCode: 'return null',
      latestSpecDesc: {
        canonicalDigest: 'sha256:session-digest',
        publicationGate: {
          passed: true,
          blockingMismatches: [],
        },
        lockedParams: {
          exchange: 'binance',
          symbol: 'ETHUSDT',
          timeframe: '1h',
        },
        canonicalSpec: {
          market: {
            exchange: 'binance',
            symbol: 'ETHUSDT',
            marketType: 'perp',
            defaultTimeframe: '1h',
          },
        },
        rules: [
          {
            id: 'session-drift-rule',
            phase: 'entry',
            condition: { key: 'price.change_pct', value: -0.01 },
            actions: [{ type: 'OPEN_SHORT' }],
          },
        ],
      },
      strategyInstanceId: 'instance-1',
      clarificationState: null,
      rejectReason: null,
    })

    const result = await service.getSession('s-drifted-published', 'u1')

    expect(result.publishedSnapshotId).toBe('snapshot-bound-spec')
    expect(result.canonicalDigest).toBe('sha256:session-digest')
    expect(result.publicationGate).toEqual({
      passed: true,
      blockingMismatches: [],
    })
    expect(result.specDesc).toEqual(expect.objectContaining({
      canonicalDigest: 'sha256:session-digest',
      publicationGate: {
        passed: true,
        blockingMismatches: [],
      },
      lockedParams: {
        exchange: 'okx',
        symbol: 'DOGEUSDT',
        timeframe: '3m',
      },
      market: {
        exchange: 'okx',
        symbol: 'DOGEUSDT',
        marketType: 'spot',
        defaultTimeframe: '3m',
      },
      rules: [
        expect.objectContaining({
          id: 'snapshot-rule',
        }),
      ],
    }))
    expect(JSON.stringify(result.specDesc)).not.toContain('session-drift-rule')
    expect(JSON.stringify(result.specDesc)).not.toContain('ETHUSDT')
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

  it('hides semantic confirmation fields when blocking clarification items remain in snapshot', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-blocked-clarification',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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
    expect(result.specDesc ?? null).toBeNull()
    expect(result.canonicalDigest ?? null).toBeNull()
    expect(result.semanticGraph).toBeNull()
  })

  it('applies clarificationAnswers before semantic readiness evaluation', async () => {
    mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
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

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'CLEAR',
    }))
    expect((result as any).clarificationGate).toEqual(expect.objectContaining({
      blocked: false,
    }))
    expect(result.canonicalDigest).toMatch(/^sha256:/)
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-clarification-answers', expect.objectContaining({
      status: 'CONFIRM_GATE',
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

  it('auto-binds parseable freeform execution-context answers to the active context slot', () => {
    const inferredAnswers = (service as any).inferFreeformSemanticClarificationAnswers(
      {
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
      '1m',
    )

    expect(inferredAnswers).toEqual({
      'executionContext.timeframe': '1m',
    })
  })

  it('locks an active timeframe slot from a freeform 1m reply before readiness evaluation', async () => {
    const semanticState = buildLockedMaSemanticState({
      contextSlots: {
        ...buildLockedMaSemanticState().contextSlots,
        timeframe: {
          slotKey: 'timeframe',
          fieldPath: 'contextSlots.timeframe',
          status: 'open',
          priority: 'context',
          questionHint: '请确认策略主周期（例如 15m 或 1h）。',
          affectsExecution: true,
        },
      },
    })
    mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
      id: 's-freeform-timeframe-clarification',
      userId: 'u1',
      status: 'DRAFTING',
      semanticState,
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [{
          key: 'executionContext.timeframe',
          reason: 'missing_timeframe',
          field: 'timeframe',
          blocking: true,
          question: '请确认策略主周期（例如 15m 或 1h）。',
          status: 'pending',
          slotKey: 'timeframe',
          fieldPath: 'contextSlots.timeframe',
          slotId: JSON.stringify(['timeframe', 'contextSlots.timeframe']),
        }],
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

    const result = await service.continueSession('s-freeform-timeframe-clarification', {
      userId: 'u1',
      message: '1m',
    } as ContinueCodegenSessionDto)
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>

    expect(updatePayload.semanticState.contextSlots.timeframe).toEqual(expect.objectContaining({
      status: 'locked',
      value: '1m',
    }))
    expect(result.assistantPrompt).not.toContain('主周期')
    expect(result.clarificationState?.items).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
        key: 'executionContext.timeframe',
        status: 'pending',
      }),
    ]))
  })

  it('does not auto-bind unparseable freeform answers to execution-context slots', () => {
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
        ],
      },
      'MA50',
    )

    expect(inferredAnswers).toEqual({})
  })

  it('applies action uniqueness clarification to the targeted entry rule only', async () => {
    mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
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

    expect(result.status).toBe('CONFIRM_GATE')
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
    mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
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
    mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
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

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.canonicalDigest).toMatch(/^sha256:/)
    expect((result as any).clarificationGate).toEqual(expect.objectContaining({
      blocked: false,
    }))
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-clarification-unrelated-answer',
      expect.objectContaining({
        status: 'CONFIRM_GATE',
        latestSpecDesc: expect.objectContaining({
          canonicalDigest: expect.stringMatching(/^sha256:/),
        }),
      }),
    )
  })

  it('does not return legacy compileability blockers after structured clarification answers resolve the explicit question', async () => {
    mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
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

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.assistantPrompt).not.toContain('未识别可编译入场规则')
    expect(result.assistantPrompt).not.toContain('未识别可编译出场规则')
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(mockRepo.updateSession.mock.calls.at(-1)?.[0]).toBe('s-clarification-normalization-blocked')
    expect(updatePayload.status).toBe('CONFIRM_GATE')
  })



  it('keeps drafting when structured clarification answers still leave required fields missing', async () => {
    mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
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

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.missingFields).toEqual([])
    expect(result.clarificationState).toEqual(expect.objectContaining({
      status: 'CLEAR',
    }))
    expect(result.canonicalDigest).toMatch(/^sha256:/)
  })

  it('applies missing exit rule clarification answers before checklist confirmation', async () => {
    mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
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

    expect(result.status).toBe('CONFIRM_GATE')
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-missing-exit-rule-answer',
      expect.objectContaining({
        status: 'CONFIRM_GATE',
        latestSpecDesc: expect.objectContaining({
          canonicalDigest: expect.stringMatching(/^sha256:/),
        }),
      }),
    )
  })


  it('does not re-confirm inferred risk basis keys that were already consumed in constraint pack', async () => {
    mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
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
        semanticPatch: maSemanticPatch(50, 10, { marketType: 'perp' }),
      }),
    })

    const result = await service.continueSession('s-consumed-inferred-risk-basis', {
      userId: 'u1',
      message: '继续',
    } as ContinueCodegenSessionDto)

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.assistantPrompt).not.toContain('risk.stopLossBasis')
    expect(result.assistantPrompt).not.toContain('risk.takeProfitBasis')
  })

  it('records confirmed inferred risk basis keys when the user explicitly confirms the current inference prompt', async () => {
    const sessionFixture = markFixtureInferredRiskBasisDefaults(buildLegacyChecklistBridgeSessionFixture({
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

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.assistantPrompt).not.toContain('请确认这些推断是否成立')
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-confirm-inferred-risk-basis', expect.objectContaining({
      status: 'CONFIRM_GATE',
      latestSpecDesc: expect.objectContaining({
        canonicalDigest: expect.stringMatching(/^sha256:/),
      }),
    }))
  })

  it('persists confirmed inferred risk basis keys even when planner marks the explicit confirmation reply unrelated and still advances to confirm gate', async () => {
    const sessionFixture = markFixtureInferredRiskBasisDefaults(buildLegacyChecklistBridgeSessionFixture({
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

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.assistantPrompt).not.toContain('请确认这些推断是否成立')
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-confirm-inferred-risk-basis-unrelated', expect.objectContaining({
      status: 'CONFIRM_GATE',
      latestSpecDesc: expect.objectContaining({
        canonicalDigest: expect.stringMatching(/^sha256:/),
      }),
    }))
  })

  it.each(['对的继续', '就按这个来', '这些成立，继续'])(
    'records confirmed inferred risk basis keys for safe explicit confirmation variant %s',
    async (message) => {
      const sessionFixture = markFixtureInferredRiskBasisDefaults(buildLegacyChecklistBridgeSessionFixture({
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

      expect(result.status).toBe('CONFIRM_GATE')
      expect(result.assistantPrompt).not.toContain('请确认这些推断是否成立')
      expect(mockRepo.updateSession).toHaveBeenCalledWith('s-confirm-inferred-risk-basis-variant', expect.objectContaining({
        status: 'CONFIRM_GATE',
        latestSpecDesc: expect.objectContaining({
          canonicalDigest: expect.stringMatching(/^sha256:/),
        }),
      }))
    },
  )

  it('applies inferred override replies to risk bases in CONFIRM_INFERRED flows', async () => {
    const sessionFixture = markFixtureInferredRiskBasisDefaults(buildLegacyChecklistBridgeSessionFixture({
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

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.assistantPrompt).not.toContain('请确认这些推断是否成立')
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-mixed-inferred-risk-basis',
      expect.objectContaining({
        status: 'CONFIRM_GATE',
        latestSpecDesc: expect.objectContaining({
          canonicalDigest: expect.stringMatching(/^sha256:/),
        }),
      }),
    )
  })

  it('applies hidden default risk basis override replies without re-prompting for basis confirmation', async () => {
    const sessionFixture = markFixtureInferredRiskBasisDefaults(buildLegacyChecklistBridgeSessionFixture({
      id: 's-hidden-default-risk-basis-override',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({
        entryRules: ['短均线上穿长均线（金叉）时做多'],
        exitRules: ['短均线下穿长均线（死叉）时平多'],
        riskRules: {
          _inferredAssumptions: ['risk.takeProfitBasis'],
        },
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    }), ['risk.takeProfitBasis'])
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      }),
    })

    const result = await service.continueSession('s-hidden-default-risk-basis-override', {
      userId: 'u1',
      message: '止盈按持仓收益率',
    } as ContinueCodegenSessionDto)
    const updatePayload = mockRepo.updateSession.mock.calls
      .map(call => call[1] as Record<string, any>)
      .reverse()
      .find(payload => Array.isArray(payload.semanticState?.risk)) as Record<string, any>
    const takeProfitRisk = updatePayload.semanticState.risk.find((risk: Record<string, any>) =>
      risk.key === 'risk.take_profit_pct',
    )

    expect(takeProfitRisk).toEqual(expect.objectContaining({
      params: expect.objectContaining({
        basis: 'position_pnl',
        basisSource: 'user_explicit',
      }),
    }))
    expect(result.assistantPrompt).not.toContain('entry_avg_price')
    expect(result.assistantPrompt).not.toContain('risk.takeProfitBasis')
    expect(result.assistantPrompt).not.toContain('请确认这些推断是否成立')
  })

  it.each(['这样可以', '可以了', '就这样', '没问题'])(
    'records confirmed inferred risk basis keys for natural confirmation variant %s',
    async (message) => {
      const sessionFixture = markFixtureInferredRiskBasisDefaults(buildLegacyChecklistBridgeSessionFixture({
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

      expect(result.status).toBe('CONFIRM_GATE')
      expect(result.assistantPrompt).not.toContain('请确认这些推断是否成立')
      expect(mockAi.chat).toHaveBeenCalledTimes(1)
      expect(mockRepo.updateSession).toHaveBeenCalledWith('s-natural-confirm-inferred-risk-basis-variant', expect.objectContaining({
        status: 'CONFIRM_GATE',
        latestSpecDesc: expect.objectContaining({
          canonicalDigest: expect.stringMatching(/^sha256:/),
        }),
      }))
    },
  )



  it('does not re-enter CONFIRM_INFERRED for keys already marked overridden', async () => {
    mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
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

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.assistantPrompt).not.toContain('请确认这些推断是否成立')
    expect(result.assistantPrompt).not.toContain('risk.stopLossBasis')
    expect(result.assistantPrompt).not.toContain('risk.takeProfitBasis')
  })

  it('confirms the only remaining inferred key for a short default-only reply', async () => {
    const sessionFixture = markFixtureInferredRiskBasisDefaults(
      buildLegacyChecklistBridgeSessionFixture({
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

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.assistantPrompt).not.toContain('请确认这些推断是否成立')
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s-single-inferred-default-confirmation', expect.objectContaining({
      status: 'CONFIRM_GATE',
      latestSpecDesc: expect.objectContaining({
        canonicalDigest: expect.stringMatching(/^sha256:/),
      }),
    }))
  })


  it('keeps drafting after basis clarification when stop-loss basis still comes from system default inference', async () => {
    const sessionFixture = markFixtureInferredRiskBasisDefaults(
      buildLegacyChecklistBridgeSessionFixture({
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

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.assistantPrompt).not.toContain('以下内容是系统推断')
    expect(result.canonicalDigest).toMatch(/^sha256:/)
  })

  it('applies missing position pct clarification answers before checklist confirmation', async () => {
    mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
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
            question: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
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

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.clarificationState?.items ?? []).toEqual(expect.not.arrayContaining([
      expect.objectContaining({
        slotKey: 'position.sizing',
        reason: 'missing_position_pct',
      }),
    ]))
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-position-pct-clarification-answer',
      expect.objectContaining({
        status: 'CONFIRM_GATE',
        semanticState: expect.objectContaining({
          position: expect.objectContaining({
            value: 0.1,
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          }),
        }),
      }),
    )
  })

  it('does not re-add persisted position and protective risk blockers after confirmGenerate answers lock them', async () => {
    const persistedSemanticState = buildLockedMaSemanticState({
      risk: [
        {
          id: 'risk-protective-exit',
          key: 'risk.protective_exit',
          params: {},
          status: 'open',
          source: 'derived',
          openSlots: [
            {
              slotKey: 'risk.protective_exit',
              fieldPath: 'risk[protective].params',
              status: 'open',
              priority: 'risk',
              questionHint: '请确认止损类保护规则（例如亏损 5% 止损）。',
              affectsExecution: true,
            },
          ],
        },
      ],
      position: {
        mode: 'fixed_ratio',
        value: 0,
        positionMode: 'long_only',
        status: 'open',
        source: 'derived',
        openSlots: [
          {
            slotKey: 'position.sizing',
            fieldPath: 'position.sizing',
            status: 'open',
            priority: 'risk',
            questionHint: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
            affectsExecution: true,
          },
        ],
      },
    })
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-position-risk-blockers-resolved',
      userId: 'u1',
      status: 'CONFIRM_GATE',
      checklist: null,
      semanticState: persistedSemanticState,
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        items: [
          {
            key: 'sizing.positionPct',
            reason: 'missing_position_pct',
            field: 'riskRules.positionPct',
            blocking: true,
            question: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
            status: 'pending',
            slotId: buildSemanticSlotId({
              slotKey: 'position.sizing',
              fieldPath: 'position.sizing',
            }),
            slotKey: 'position.sizing',
            fieldPath: 'position.sizing',
          },
          {
            key: 'semantic.risk.protective_exit',
            reason: 'missing_stop_loss_rule',
            field: 'riskRules.stopLossPct',
            blocking: true,
            question: '请确认止损类保护规则（例如亏损 5% 止损）。',
            status: 'pending',
            slotId: buildSemanticSlotId({
              slotKey: 'risk.protective_exit',
              fieldPath: 'risk[protective].params',
            }),
            slotKey: 'risk.protective_exit',
            fieldPath: 'risk[protective].params',
          },
        ],
      },
      constraintPack: {},
    })
    const confirmedDigest = 'sha256:position-risk-blockers-resolved'
    const readCanonicalDigestSpy = jest
      .spyOn(service as any, 'readCanonicalDigest')
      .mockReturnValue(confirmedDigest)
    mockRepo.findById.mockResolvedValue(sessionFixture)

    try {
      const result = await service.continueSession('s-position-risk-blockers-resolved', {
        userId: 'u1',
        message: '仓位 10%，亏损 5% 止损，确认生成',
        confirmGenerate: true,
        confirmedCanonicalDigest: confirmedDigest,
        clarificationAnswers: {
          'sizing.positionPct': '10%',
          'semantic.risk.protective_exit': '亏损 5% 止损',
        },
      } as ContinueCodegenSessionDto)

      expect(result.status).toBe('GENERATING')
      expect(result.clarificationState?.items ?? []).toEqual(expect.not.arrayContaining([
        expect.objectContaining({
          reason: 'missing_position_pct',
        }),
        expect.objectContaining({
          reason: 'missing_stop_loss_rule',
        }),
      ]))
      expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith(
        's-position-risk-blockers-resolved',
        expect.objectContaining({
          status: 'GENERATING',
          semanticState: expect.objectContaining({
            position: expect.objectContaining({
              value: 0.1,
              status: 'locked',
            }),
            risk: expect.arrayContaining([
              expect.objectContaining({
                key: 'risk.stop_loss_pct',
                status: 'locked',
                params: expect.objectContaining({
                  valuePct: 5,
                }),
              }),
            ]),
          }),
        }),
      )
    } finally {
      readCanonicalDigestSpy.mockRestore()
    }
  })

  it('keeps drafting with a structured clarification gate summary when basis blockers remain', async () => {
    mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
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

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.assistantPrompt).toContain('请确认是否按这个逻辑生成脚本')
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
    mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
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

    expect(result.status).toBe('CONFIRM_GATE')
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
    mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
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

    expect(result.status).toBe('CONFIRM_GATE')
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-exit-basis-sync',
      expect.objectContaining({
        status: 'CONFIRM_GATE',
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


  it('enters confirm gate when planner semanticPatch and server-side semantics are already sufficient', async () => {
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
            marketType: 'perp',
            timeframe: '15m',
          },
        },
      }),
    })

    const result = await service.continueSession('s4', {
      userId: 'u1',
      message: '入场用金叉，出场用死叉',
    })

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.canonicalDigest).toMatch(/^sha256:/)
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s4', expect.objectContaining({
      status: 'CONFIRM_GATE',
      semanticState: expect.any(Object),
    }))
  })

  it('enters confirm gate in continueSession when planner returns logic that the deterministic server-side semantics can compile', async () => {
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
        semanticPatch: bollingerSemanticPatch(20, 2),
      }),
    })

    const result = await service.continueSession('s4-clarify', {
      userId: 'u1',
      message: '就按这个逻辑推进',
    })

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.canonicalDigest).toMatch(/^sha256:/)
    expect(mockRepo.updateSession).toHaveBeenCalledWith('s4-clarify', expect.objectContaining({
      status: 'CONFIRM_GATE',
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
          semanticPatch: bollingerSemanticPatch(20, 2, { marketType: 'perp', timeframe: '1h' }),
        }),
      })
    mockRepo.createSession.mockResolvedValue({ id: 's5' })
    mockRepo.createVersion.mockResolvedValue({ id: 'v1' })

    const started = await service.startSession({
      userId: 'u1',
      initialMessage: '在okx交易所合约市场的BTCUSDT 1小时图上，K线收盘突破布林带上轨时做空，回到布林带中轨时平空',
    })

    expect(started.status).toBe('CONFIRM_GATE')
    expect(started.canonicalDigest).toMatch(/^sha256:/)
    const createdSession = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    const createdChecklist = readLegacyChecklistProjectionForTest(createdSession)

    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's5',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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
    const persistedSemanticState = buildLockedMaSemanticState({
      risk: [lockedStopLossRisk()],
    })
    const buildFromNormalizedIntentSpy = jest.spyOn(canonicalSpecBuilder, 'buildFromNormalizedIntent')
    const buildFromSemanticStateSpy = jest.spyOn(canonicalSpecBuilder, 'buildFromSemanticState')
    const publicationPipelineRunSpy = jest.spyOn(publicationPipeline, 'run').mockResolvedValue(undefined)
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's5-semantic-generate',
      userId: 'u1',
      status: 'CONFIRM_GATE',
      checklist: persistedChecklist,
      semanticState: persistedSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    const buildChecklistSpy = jest.spyOn(canonicalSpecBuilder, 'build')
    mockRepo.findById.mockResolvedValue(sessionFixture)
    const result = await service.continueSession('s5-semantic-generate', {
      userId: 'u1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: readFixtureCanonicalDigest(sessionFixture),
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
    expect(buildFromSemanticStateSpy).toHaveBeenCalledWith(persistedSemanticState)
    expect(buildFromNormalizedIntentSpy).not.toHaveBeenCalled()
    expect(buildChecklistSpy).not.toHaveBeenCalled()
    expect(publicationPipelineRunSpy).toHaveBeenCalledWith(expect.objectContaining({
      canonicalSpecOverride: expect.objectContaining({
        version: 2,
      }),
      semanticState: expect.objectContaining({
        triggers: expect.any(Array),
      }),
    }))
    expect(publicationPipelineRunSpy.mock.calls[0][0]).not.toHaveProperty('checklist')
  })


  it('rejects the MA golden case after confirmGenerate instead of publishing through checklist fallback', async () => {
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
    const createdChecklist = readLegacyChecklistProjectionForTest(createdSession)
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-golden-ma-publish',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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
      status: 'REJECTED',
      rejectReason: expect.stringContaining('codegen.canonical_spec_v2_condition_unsupported:indicator.above'),
    }))
    expect(mockRepo.createVersion).not.toHaveBeenCalled()
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
          stopLossPct: 5,
          stopLossBasis: 'entry_avg_price',
          takeProfitPct: 10,
          takeProfitBasis: 'entry_avg_price',
        },
      }),
    })

    const createdSession = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
    const createdChecklist = readLegacyChecklistProjectionForTest(createdSession)
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-golden-bollinger-publish',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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
      risk: [lockedStopLossRisk()],
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

    mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
      id: 's-state-gate-publish',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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
      }),
    ]))
    expect(JSON.stringify(publishedSnapshot?.specSnapshot?.rules)).not.toContain('"normalized"')
    expect(publishedSnapshot?.compiledIr?.signalCatalog?.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'UPPER_BAND', params: { period: 20, stdDev: 2 } }),
      expect.objectContaining({ kind: 'MID_BAND', params: { period: 20, stdDev: 2 } }),
    ]))
    expect(publishedSnapshot?.compiledIr?.portfolio?.positionMode).toBe('short_only')
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
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-bollinger-publish',
      userId: 'u1',
      status: 'CONFIRM_GATE',
      strategyInstanceId: null,
      semanticState: buildLockedBidirectionalBollingerSemanticState({
        risk: [lockedStopLossRisk()],
      }),
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
      strategyConfig: expect.objectContaining({
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        baseTimeframe: '15m',
        stateTimeframes: [],
        positionPct: 10,
        strategyDeclaredLeverageRange: null,
      }),
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

  it('publishes only the confirmed semantic Bollinger side when legacy checklist still has both sides', async () => {
    const persistedChecklist = completeChecklist({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        'K线收盘后确认突破布林带(20,2)上轨时做空',
        'K线收盘后确认突破布林带(20,2)下轨时做多',
      ],
      exitRules: [
        '价格回到布林带中轨(MA20)时平仓',
      ],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    })
    const confirmedLongOnlySemanticState = buildLockedBollingerSemanticState({
      risk: [lockedStopLossRisk()],
      triggers: [
        {
          id: 'entry-bollinger-lower',
          key: 'bollinger.touch_lower',
          phase: 'entry',
          params: {
            indicator: 'bollinger',
            period: 20,
            stdDev: 2,
            confirmationMode: 'close_confirm',
          },
          sideScope: 'long',
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
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [
        { id: 'action-open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'action-close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
      ],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
      },
    })
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-bollinger-confirmed-long-only',
      userId: 'u1',
      status: 'CONFIRM_GATE',
      checklist: persistedChecklist,
      semanticState: confirmedLongOnlySemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      strategyInstanceId: null,
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)

    const result = await service.continueSession('s-bollinger-confirmed-long-only', {
      userId: 'u1',
      message: 'Confirm code generation',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildSemanticOnlyCanonicalDigest(confirmedLongOnlySemanticState),
    })

    expect(result.status).toBe('GENERATING')
    await waitForTerminalStatus('s-bollinger-confirmed-long-only')

    const publishedSnapshot = mockRepo.create.mock.calls.at(-1)?.[0]
    expect(publishedSnapshot?.specSnapshot?.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({ key: 'bollinger.lower_break' }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({ key: 'bollinger.middle_revert' }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
    ]))
    const publishedActionTypes = publishedSnapshot?.specSnapshot?.rules
      ?.flatMap((rule: { actions?: Array<{ type?: string }> }) => rule.actions ?? [])
      .map((action: { type?: string }) => action.type) ?? []
    expect(publishedActionTypes).not.toContain('OPEN_SHORT')
    expect(publishedActionTypes).not.toContain('CLOSE_SHORT')
    expect(publishedSnapshot?.compiledIr?.portfolio?.positionMode).toBe('long_only')
  })

  it('publishes price-change strategy after confirmGenerate through the canonical mainline', async () => {
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-price-change-publish',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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
      strategyConfig: expect.objectContaining({
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        baseTimeframe: '3m',
        stateTimeframes: ['15m'],
        positionPct: 10,
        strategyDeclaredLeverageRange: null,
      }),
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


  it('returns a real semantic clarification prompt when planner marks an unrelated reply and required slots are still missing', async () => {
    mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
      id: 's-unrelated-missing-symbol',
      userId: 'u1',
      status: 'DRAFTING',
      checklist: {
        timeframes: ['15m'],
        entryRules: ['3m 内跌 1% 买入'],
        exitRules: ['15m 内涨 2% 卖出'],
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
            key: 'executionContext.symbol',
            reason: 'missing_symbol',
            field: 'symbol',
            blocking: true,
            question: '请确认策略交易标的（例如 BTCUSDT）。',
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
        assistantPrompt: '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
      }),
    })

    const result = await service.continueSession('s-unrelated-missing-symbol', {
      userId: 'u1',
      message: '继续',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('请确认策略交易标的')
    expect(result.assistantPrompt).not.toContain('这条消息看起来和策略无关')
  })

  it('applies natural-language symbol edits before planner fallback can mark them unrelated', async () => {
    const currentSemanticState = buildLockedMaSemanticState({
      contextSlots: {
        ...buildLockedMaSemanticState().contextSlots,
        symbol: {
          ...buildLockedMaSemanticState().contextSlots.symbol,
          value: 'ETHUSDT',
        },
      },
    })
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-semantic-symbol-edit-unrelated',
      userId: 'u1',
      status: 'DRAFTING',
      semanticState: currentSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
      }),
    })

    const result = await service.continueSession('s-semantic-symbol-edit-unrelated', {
      userId: 'u1',
      message: '我要把交易标的改为BTCUSDT',
    })

    expect(mockAi.chat).not.toHaveBeenCalled()
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-semantic-symbol-edit-unrelated',
      expect.objectContaining({
        semanticState: expect.objectContaining({
          contextSlots: expect.objectContaining({
            symbol: expect.objectContaining({
              value: 'BTCUSDT',
            }),
          }),
        }),
      }),
    )
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(updatePayload.semanticState.contextSlots.symbol.value).toBe('BTCUSDT')
    expect(updatePayload.semanticGraph).toEqual(expect.objectContaining({
      market: expect.objectContaining({
        symbol: 'BTCUSDT',
      }),
    }))
    expect(updatePayload.validationReport).toBeNull()
    expect(result.assistantPrompt).toContain('BTCUSDT')
    expect(result.assistantPrompt).not.toContain('未识别可编译入场规则')
  })

  it('applies natural-language position edits in ordinary conversations before planner fallback', async () => {
    const currentSemanticState = buildLockedMaSemanticState({
      position: {
        ...buildLockedMaSemanticState().position,
        value: 0.35,
      },
    })
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-semantic-position-edit-unrelated',
      userId: 'u1',
      status: 'DRAFTING',
      semanticState: currentSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
      }),
    })

    const result = await service.continueSession('s-semantic-position-edit-unrelated', {
      userId: 'u1',
      message: '仓位35%换成20%',
    })

    expect(mockAi.chat).not.toHaveBeenCalled()
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(updatePayload.semanticState.position.value).toBe(0.2)
    expect(result.assistantPrompt).toContain('仓位：20%')
    expect(result.assistantPrompt).not.toContain('仓位：35%')
  })

  it('applies natural-language moving-average period edits to returned specDesc before planner fallback', async () => {
    const currentSemanticState = buildLockedMaSemanticState({
      triggers: [
        {
          id: 'entry-ma-cross',
          key: 'indicator.cross_over',
          phase: 'entry',
          params: { indicator: 'ma', fastPeriod: 6, slowPeriod: 48 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'exit-ma-cross',
          key: 'indicator.cross_under',
          phase: 'exit',
          params: { indicator: 'ma', fastPeriod: 6, slowPeriod: 48 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      position: {
        ...buildLockedMaSemanticState().position,
        value: 0.35,
      },
    })
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-semantic-ma-period-edit',
      userId: 'u1',
      status: 'DRAFTING',
      semanticState: currentSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
      }),
    })

    const result = await service.continueSession('s-semantic-ma-period-edit', {
      userId: 'u1',
      message: '把MA6换成MA10',
    })

    expect(mockAi.chat).not.toHaveBeenCalled()
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(updatePayload.semanticState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-ma-cross',
        params: expect.objectContaining({ fastPeriod: 10, slowPeriod: 48 }),
      }),
      expect.objectContaining({
        id: 'exit-ma-cross',
        params: expect.objectContaining({ fastPeriod: 10, slowPeriod: 48 }),
      }),
    ]))
    expect(result.assistantPrompt).toContain('MA10 上穿 MA48')
    expect(result.assistantPrompt).not.toContain('MA6 上穿 MA48')
    expect(result.specDesc?.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        condition: expect.objectContaining({
          key: 'ma.golden_cross',
          params: expect.objectContaining({ fastPeriod: 10, slowPeriod: 48 }),
        }),
      }),
      expect.objectContaining({
        condition: expect.objectContaining({
          key: 'ma.death_cross',
          params: expect.objectContaining({ fastPeriod: 10, slowPeriod: 48 }),
        }),
      }),
    ]))
  })

  it('edits published session semantic state without overwriting the published snapshot', async () => {
    const currentSemanticState = buildLockedMaSemanticState({
      contextSlots: {
        ...buildLockedMaSemanticState().contextSlots,
        symbol: {
          ...buildLockedMaSemanticState().contextSlots.symbol,
          value: 'ETHUSDT',
        },
      },
    })
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-published-symbol-edit',
      userId: 'u1',
      status: 'PUBLISHED',
      semanticState: currentSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      publishedSnapshotId: 'snapshot-published-eth',
      latestDraftCode: 'const publishedEthStrategy = {}',
    })
    const oldLatestSnapshot = {
      id: 'snapshot-published-eth',
      consistencyReport: { status: 'PASSED' },
      paramsSnapshot: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        timeframe: '1h',
      },
      lockedParams: {
        symbol: 'ETHUSDT',
        positionPct: 10,
      },
      specSnapshot: {
        canonicalDigest: 'sha256:published-eth',
        normalizedIntent: {
          context: {
            symbol: 'ETHUSDT',
          },
        },
      },
    }
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockRepo.findLatestBySessionId.mockResolvedValue(oldLatestSnapshot)

    const result = await service.continueSession('s-published-symbol-edit', {
      userId: 'u1',
      message: '把交易标的改成 BTCUSDT',
    })

    expect(result.status === 'CONFIRM_GATE' || result.status === 'DRAFTING').toBe(true)
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's-published-symbol-edit',
      expect.objectContaining({
        semanticState: expect.objectContaining({
          contextSlots: expect.objectContaining({
            symbol: expect.objectContaining({
              value: 'BTCUSDT',
            }),
          }),
        }),
      }),
    )
    expect(mockRepo.create).not.toHaveBeenCalled()
    expect(mockRepo.createVersion).not.toHaveBeenCalled()
    expect(oldLatestSnapshot.paramsSnapshot.symbol).toBe('ETHUSDT')
    expect(oldLatestSnapshot.lockedParams.symbol).toBe('ETHUSDT')
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(updatePayload.latestDraftCode).toBeNull()
  })

  it('edits published session context parameters beyond symbol', async () => {
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-published-timeframe-edit',
      userId: 'u1',
      status: 'PUBLISHED',
      semanticState: buildLockedMaSemanticState(),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      publishedSnapshotId: 'snapshot-published-timeframe',
      latestDraftCode: 'const publishedStrategy = {}',
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockRepo.findLatestBySessionId.mockResolvedValue({
      id: 'snapshot-published-timeframe',
      paramsSnapshot: { timeframe: '15m' },
      lockedParams: { timeframe: '15m' },
      specSnapshot: {},
    })

    await service.continueSession('s-published-timeframe-edit', {
      userId: 'u1',
      message: '把主周期改成 1h',
    })

    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(updatePayload.semanticState.contextSlots.timeframe.value).toBe('1h')
    expect(updatePayload.latestDraftCode).toBeNull()
  })

  it('routes published semantic edits through the general planner instead of unsupported guidance', async () => {
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-published-risk-edit',
      userId: 'u1',
      status: 'PUBLISHED',
      semanticState: buildLockedMaSemanticState(),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      publishedSnapshotId: 'snapshot-published-risk',
      latestDraftCode: 'const publishedStrategy = {}',
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockRepo.findLatestBySessionId.mockResolvedValue({
      id: 'snapshot-published-risk',
      paramsSnapshot: {},
      lockedParams: {},
      specSnapshot: {},
    })
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '已把止损改成 3%，请确认逻辑图。',
        semanticPatch: {
          risk: [
            {
              key: 'risk.stop_loss_pct',
              params: { valuePct: 3, basis: 'entry_avg_price' },
            },
          ],
        },
      }),
    })

    const result = await service.continueSession('s-published-risk-edit', {
      userId: 'u1',
      message: '把止损改成 3%',
    })

    expect(mockAi.chat).toHaveBeenCalledTimes(1)
    const plannerPayload = JSON.parse(mockAi.chat.mock.calls[0][0].messages[1].content)
    expect(plannerPayload.message).toBe('把止损改成 3%')
    expect(plannerPayload.currentSemanticState.triggers).toEqual(buildLockedMaSemanticState().triggers)

    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(updatePayload.semanticState.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.stop_loss_pct',
        params: expect.objectContaining({ valuePct: 3 }),
      }),
    ]))
    expect(updatePayload.semanticState.triggers).toEqual(buildLockedMaSemanticState().triggers)
    expect(updatePayload.latestDraftCode).toBeNull()
    expect(updatePayload.validationReport).toBeNull()
    expect(updatePayload.semanticGraph).toEqual(expect.objectContaining({
      market: expect.objectContaining({
        symbol: 'BTCUSDT',
      }),
    }))
    expect(result.assistantPrompt).not.toContain('当前可直接修改交易标的')
  })

  it('routes unsupported atoms from whole-strategy replacement edits to fallback before projection', async () => {
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-rejected-unsupported-replacement',
      userId: 'u1',
      status: 'REJECTED',
      semanticState: buildLockedMaSemanticState(),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      latestDraftCode: 'const rejectedStrategy = {}',
      rejectReason: '旧代码生成失败',
      validationReport: { ok: false, errors: ['old validation error'] },
      semanticGraph: { version: 1, nodes: [{ id: 'old-graph' }] },
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '已改为 ATR 止损策略。',
        semanticPatch: {
          triggers: [
            {
              key: 'indicator.cross_over',
              phase: 'entry',
              sideScope: 'long',
              params: { indicator: 'ma', fastPeriod: 20, slowPeriod: 50 },
            },
          ],
          actions: [{ key: 'open_long' }],
          risk: [
            {
              key: 'risk.atr_stop',
              params: { atrPeriod: 14, multiplier: 2 },
            },
          ],
          position: {
            mode: 'fixed_ratio',
            value: 0.1,
            positionMode: 'long_only',
          },
          context: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'perp',
            timeframe: '15m',
          },
        },
      }),
    })

    const result = await service.continueSession('s-rejected-unsupported-replacement', {
      userId: 'u1',
      message: '之前策略不对，重新做一个带 ATR 止损的策略',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('ATR 动态止损')
    expect(result.assistantPrompt).toContain('是否改用这个策略继续')
    expect(result.specDesc).toBeNull()
    expect(result.canonicalDigest).toBeNull()
    expect(result.semanticGraph).toBeNull()
    expect(result.unsupportedFallback).toEqual(expect.objectContaining({
      status: 'pending',
    }))

    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(updatePayload.semanticState.unsupportedFallback).toEqual(expect.objectContaining({
      status: 'pending',
    }))
    expect(updatePayload.latestSpecDesc).toBeNull()
    expect(updatePayload.latestDraftCode).toBeNull()
    expect(updatePayload.rejectReason).toBeNull()
    expect(updatePayload.validationReport).toBeNull()
    expect(updatePayload.semanticGraph).toBeNull()
  })

  it('clears stale artifacts when existing sessions route to unknown atom support gate', async () => {
    const sessionFixture = buildPersistedSessionSnapshot(
      's-unknown-support-gate-artifacts',
      {},
      {
        userId: 'u1',
        status: 'REJECTED',
        semanticState: buildLockedMaSemanticState(),
        clarificationState: { status: 'CLEAR', items: [] },
        constraintPack: {},
        latestDraftCode: 'const oldStrategy = {}',
        rejectReason: '旧失败原因',
        validationReport: { ok: false, errors: ['old validation error'] },
        semanticGraph: { version: 1, nodes: [{ id: 'old-graph' }] },
      },
    ) as any
    const semanticState = {
      ...buildLockedMaSemanticState(),
      triggers: [{
        id: 'unknown-signal',
        key: 'external.signal',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
    }

    const result = await (service as any).handleSemanticSupportGateForExistingSession({
      session: sessionFixture,
      semanticState,
      message: '改成外部信号开多',
      userId: 'u1',
      constraintPack: (service as any).readConstraintPack({}),
    })
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>

    expect(result.response.status).toBe('DRAFTING')
    expect(result.response.specDesc).toBeNull()
    expect(result.response.canonicalDigest).toBeNull()
    expect(result.response.semanticGraph).toBeNull()
    expect(updatePayload.latestSpecDesc).toBeNull()
    expect(updatePayload.latestDraftCode).toBeNull()
    expect(updatePayload.rejectReason).toBeNull()
    expect(updatePayload.validationReport).toBeNull()
    expect(updatePayload.semanticGraph).toBeNull()
  })

  it('keeps unknown atom support gate out of execution open-slot clarification', async () => {
    const contextSlots = buildLockedMaSemanticState().contextSlots
    const sessionFixture = buildPersistedSessionSnapshot(
      's-unknown-support-gate-clear',
      {},
      {
        userId: 'u1',
        status: 'DRAFTING',
        semanticState: buildLockedMaSemanticState(),
        clarificationState: { status: 'CLEAR', items: [] },
        constraintPack: {},
      },
    ) as any
    const semanticState = {
      ...buildLockedMaSemanticState({
        contextSlots: {
          ...contextSlots,
          exchange: {
            ...contextSlots.exchange,
            status: 'open',
            value: null,
          },
        },
      }),
      triggers: [{
        id: 'unknown-signal',
        key: 'external.signal',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
    }

    const result = await (service as any).handleSemanticSupportGateForExistingSession({
      session: sessionFixture,
      semanticState,
      message: '用外部 webhook 信号开多',
      userId: 'u1',
      constraintPack: (service as any).readConstraintPack({}),
    })
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>

    expect(result.response.clarificationState).toEqual(expect.objectContaining({ status: 'CLEAR', items: [] }))
    expect(result.response.clarificationGate).toEqual(expect.objectContaining({
      blocked: false,
      items: [],
      pendingItems: [],
    }))
    expect(updatePayload.clarificationState).toEqual(expect.objectContaining({ status: 'CLEAR', items: [] }))
  })

  it('replaces a published script when the user pastes corrected script code', async () => {
    const correctedScript = 'const strategy = { protocolVersion: "v1", onBar: () => ({ action: "NOOP" }) }\nstrategy'
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-published-script-replace',
      userId: 'u1',
      status: 'PUBLISHED',
      semanticState: buildLockedMaSemanticState(),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {
        conversationHistory: [
          'U: 生成 MA 策略',
          'A: 策略代码已生成，现在可以开始回测。',
        ],
      },
      latestDraftCode: 'const oldStrategy = {}',
      latestSpecDesc: {
        canonicalDigest: 'sha256:old-spec',
        normalizedIntent: { context: { symbol: 'BTCUSDT' } },
        publishedSnapshotId: 'snapshot-old',
      },
      strategyInstanceId: 'strategy-instance-1',
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockRepo.findLatestBySessionId.mockResolvedValue({
      id: 'snapshot-old',
      strategyTemplateId: 'template-old',
      strategyInstanceId: 'strategy-instance-1',
      scriptSnapshot: 'const oldStrategy = {}',
      specSnapshot: {
        canonicalDigest: 'sha256:old-spec',
        normalizedIntent: { context: { symbol: 'BTCUSDT' } },
      },
      semanticGraph: { nodes: [] },
      compiledIr: null,
      irSnapshot: null,
      astSnapshot: null,
      compiledManifest: null,
      consistencyReport: { status: 'PASSED' },
      userIntentSummary: { text: 'MA 策略' },
      strategySummary: { text: 'MA 策略' },
      scriptSummary: { text: '旧脚本' },
      lockedParams: { symbol: 'BTCUSDT', timeframe: '15m' },
      paramsSnapshot: { symbol: 'BTCUSDT', timeframe: '15m', marketType: 'perp' },
      strategyConfig: { symbol: 'BTCUSDT', baseTimeframe: '15m', marketType: 'perp' },
      backtestConfigDefaults: { stateTimeframes: ['15m'] },
      deploymentExecutionDefaults: { mode: 'PAPER' },
      deploymentExecutionConstraints: { supported: true },
      executionEnvelope: null,
      executionPolicy: null,
      dataRequirements: { primary: ['15m'] },
    })
    mockRepo.create.mockResolvedValueOnce({
      id: 'snapshot-manual-replacement',
      snapshotHash: 'snapshot-hash-manual',
      consistencyReport: { status: 'MANUAL_REPLACEMENT' },
    })

    const result = await service.continueSession('s-published-script-replace', {
      userId: 'u1',
      message: correctedScript,
    })

    expect(result.status).toBe('PUBLISHED')
    expect(result.scriptCode).toBe(correctedScript)
    expect(result.publishedSnapshotId).toBe('snapshot-manual-replacement')
    expect(mockAi.chat).not.toHaveBeenCalled()
    expect(mockRepo.createVersion).toHaveBeenCalledWith(expect.objectContaining({
      scriptCode: correctedScript,
      specDesc: expect.objectContaining({
        version: 2,
      }),
    }))
    expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 's-published-script-replace',
      strategyInstanceId: 'strategy-instance-1',
      scriptSnapshot: correctedScript,
      specSnapshot: expect.objectContaining({
        version: 2,
      }),
      consistencyReport: expect.objectContaining({
        status: 'MANUAL_REPLACEMENT',
      }),
    }))
    expect(mockRepo.bindPublishedSnapshotToStrategyInstance).toHaveBeenCalledWith({
      strategyInstanceId: 'strategy-instance-1',
      userId: 'u1',
      publishedSnapshotId: 'snapshot-manual-replacement',
      snapshotHash: 'snapshot-hash-manual',
      strategyTemplateId: 'template-old',
    })
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(updatePayload.status).toBe('PUBLISHED')
    expect(updatePayload.latestDraftCode).toBe(correctedScript)
    expect(updatePayload.latestSpecDesc).toEqual(expect.objectContaining({
      publishedSnapshotId: 'snapshot-manual-replacement',
      consistencyReport: expect.objectContaining({ status: 'MANUAL_REPLACEMENT' }),
    }))
  })

  it('rejects pasted script code before the logic graph has generated a script', async () => {
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-drafting-script-paste',
      userId: 'u1',
      status: 'CONFIRM_GATE',
      semanticState: buildLockedMaSemanticState(),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      latestDraftCode: null,
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)

    const result = await service.continueSession('s-drafting-script-paste', {
      userId: 'u1',
      message: 'export default function strategy() { return { action: "NOOP" } }',
    })

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.assistantPrompt).toContain('现在还不能直接发送脚本代码')
    expect(result.assistantPrompt).toContain('请用策略想法')
    expect(mockAi.chat).not.toHaveBeenCalled()
    expect(mockRepo.create).not.toHaveBeenCalled()
    expect(mockRepo.createVersion).not.toHaveBeenCalled()
  })

  it('restores published status when canceling a published pending semantic edit', async () => {
    const currentSemanticState = {
      ...buildLockedMaSemanticState(),
      pendingEdit: {
        id: 'pending-trigger-1',
        op: 'replace_trigger',
        targetRef: 'trigger-entry-1',
        resumeStatusOnCancel: 'PUBLISHED',
        candidate: {
          id: 'candidate-trigger-1',
          key: 'indicator.rsi_threshold',
          phase: 'gate',
          params: { indicator: 'rsi' },
          status: 'open',
          source: 'user_explicit',
          openSlots: [],
        },
        status: 'needs_clarification',
        createdFromMessage: '把触发改成 RSI',
      },
    }
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-published-pending-cancel',
      userId: 'u1',
      status: 'DRAFTING',
      semanticState: currentSemanticState,
      clarificationState: { status: 'BLOCKED', items: [] },
      constraintPack: {},
      latestDraftCode: 'const publishedStrategy = {}',
      latestSpecDesc: {
        publishedSnapshotId: 'snapshot-old',
      },
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)

    await service.continueSession('s-published-pending-cancel', {
      userId: 'u1',
      message: '算了，保持原来',
    })

    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(updatePayload.status).toBe('PUBLISHED')
    expect(updatePayload.semanticState.pendingEdit).toBeNull()
    expect(updatePayload.latestSpecDesc).toBeNull()
    expect(updatePayload.latestDraftCode).toBeUndefined()
  })

  it.each(['REJECTED', 'CONSISTENCY_FAILED'] as const)(
    'allows %s terminal sessions to return to semantic editing when the message changes strategy meaning',
    async (status) => {
      const sessionId = `s-terminal-${status.toLowerCase()}`
      const sessionFixture = buildSemanticEraSessionFixture({
        id: sessionId,
        userId: 'u1',
        status,
        semanticState: buildLockedMaSemanticState(),
        clarificationState: { status: 'CLEAR', items: [] },
        constraintPack: {},
      })
      mockRepo.findById.mockResolvedValue(sessionFixture)

      const result = await service.continueSession(sessionId, {
        userId: 'u1',
        message: '把交易标的改成 BTCUSDT',
      })

      expect(result.status === 'CONFIRM_GATE' || result.status === 'DRAFTING').toBe(true)
      const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
      expect(updatePayload.semanticState.contextSlots.symbol.value).toBe('BTCUSDT')
      expect(updatePayload.semanticGraph).toEqual(expect.objectContaining({
        market: expect.objectContaining({
          symbol: 'BTCUSDT',
        }),
      }))
      expect(updatePayload.validationReport).toBeNull()
      expect(updatePayload.latestDraftCode).toBeNull()
      expect(updatePayload.rejectReason).toBeNull()
    },
  )

  it('replaces the whole strategy draft from a replacement seed instead of merging into the locked MA state', async () => {
    const currentSemanticState = buildLockedMaSemanticState()
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-semantic-whole-strategy-replacement',
      userId: 'u1',
      status: 'REJECTED',
      semanticState: currentSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {
        conversationHistory: [
          'U: 帮我做一个均线策略',
          'A: 先确认入场条件：例如 5/20 金叉。',
        ],
      },
      latestDraftCode: 'const oldMaStrategy = {}',
      latestSpecDesc: {
        canonicalSpec: {
          rules: [{ condition: { key: 'indicator.above', indicator: 'ma' } }],
        },
      },
      semanticGraph: {
        version: 1,
        market: { symbol: 'ETHUSDT', primaryTimeframe: '1h' },
        nodes: [{ id: 'old-ma-graph' }],
      },
      validationReport: { ok: false, errors: ['old validation error'] },
      rejectReason: '旧代码生成失败',
    })
    const oldSpecDesc = sessionFixture.latestSpecDesc
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '已改为 RSI 策略，请确认逻辑图。',
        semanticPatch: rsiSemanticPatch(),
      }),
    })

    const result = await service.continueSession('s-semantic-whole-strategy-replacement', {
      userId: 'u1',
      message: '之前策略不对，重新做一个 RSI 策略',
    })

    expect(mockAi.chat).toHaveBeenCalledTimes(1)
    const plannerPayload = JSON.parse(mockAi.chat.mock.calls[0][0].messages[1].content)
    expect(plannerPayload.message).toBe('重新做一个 RSI 策略')
    expect(plannerPayload.currentSemanticState.triggers).toEqual([])
    expect(JSON.stringify(mockAi.chat.mock.calls[0][0])).not.toContain('均线策略')

    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    const replacementState = updatePayload.semanticState
    expect(updatePayload.constraintPack.conversationHistory).toHaveLength(2)
    expect(updatePayload.constraintPack.conversationHistory[0]).toBe('U: 之前策略不对，重新做一个 RSI 策略')
    expect(JSON.stringify(updatePayload.constraintPack.conversationHistory)).not.toContain('均线策略')
    expect(replacementState.previousVersions).toHaveLength(1)
    expect(replacementState.previousVersions[0]).toEqual(expect.objectContaining({
      reason: 'strategy_replacement',
      semanticState: currentSemanticState,
    }))
    expect(replacementState.pendingEdit).toBeNull()
    expect(replacementState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'oscillator.rsi_lte',
        params: expect.objectContaining({ indicator: 'rsi' }),
      }),
    ]))
    expect(replacementState.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        params: expect.objectContaining({ indicator: 'ma' }),
      }),
    ]))
    expect(updatePayload.latestDraftCode).toBeNull()
    expect(updatePayload.rejectReason).toBeNull()
    expect(updatePayload.validationReport).toBeNull()
    expect(updatePayload.semanticGraph).toEqual(expect.objectContaining({
      market: expect.objectContaining({
        symbol: 'BTCUSDT',
        primaryTimeframe: '15m',
      }),
    }))
    expect(updatePayload.latestSpecDesc).not.toEqual(oldSpecDesc)
    expect(JSON.stringify(updatePayload.latestSpecDesc)).toContain('rsi')
    expect(result.status).toBe('CONFIRM_GATE')
  })

  it('clears failed artifacts when a rejected session enters semantic edit clarification', async () => {
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-rejected-edit-clarification',
      userId: 'u1',
      status: 'REJECTED',
      semanticState: buildLockedMaSemanticState(),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      latestDraftCode: 'const rejectedStrategy = {}',
      semanticGraph: {
        version: 1,
        market: { symbol: 'ETHUSDT', primaryTimeframe: '1h' },
        nodes: [{ id: 'old-rejected-graph' }],
      },
      validationReport: { ok: false, errors: ['old validation error'] },
      rejectReason: '旧代码生成失败',
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)

    const result = await service.continueSession('s-rejected-edit-clarification', {
      userId: 'u1',
      message: '把触发改成 RSI',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('RSI')
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(updatePayload.latestDraftCode).toBeNull()
    expect(updatePayload.rejectReason).toBeNull()
    expect(updatePayload.validationReport).toBeNull()
    expect(updatePayload.semanticState.pendingEdit).toEqual(expect.objectContaining({
      status: 'needs_clarification',
    }))
    expect(updatePayload.semanticGraph).toEqual(expect.objectContaining({
      market: expect.objectContaining({
        symbol: 'BTCUSDT',
        primaryTimeframe: '1h',
      }),
    }))
    expect(JSON.stringify(updatePayload.semanticGraph)).not.toContain('old-rejected-graph')
  })

  it('replaces a prior dynamic grid draft when the user provides a complete fixed grid strategy', async () => {
    const currentSemanticState = buildLockedMaSemanticState({
      families: ['grid'],
      triggers: [
        {
          id: 'entry-dynamic-grid',
          key: 'price.range_position_lte',
          phase: 'entry',
          params: { lookbackBars: 36, thresholdPct: 20 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'exit-dynamic-grid',
          key: 'price.range_position_gte',
          phase: 'exit',
          params: { lookbackBars: 36, thresholdPct: 55 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      risk: [
        { id: 'risk-stop-loss-old', key: 'risk.stop_loss_pct', params: { valuePct: 3 }, status: 'locked', source: 'user_explicit', openSlots: [] },
        { id: 'risk-take-profit-old', key: 'risk.take_profit_pct', params: { valuePct: 0.45 }, status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
      position: {
        mode: 'fixed_ratio',
        value: 0.25,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
      },
    })
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-semantic-grid-replacement',
      userId: 'u1',
      status: 'CONFIRM_GATE',
      semanticState: currentSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      latestDraftCode: 'const oldDynamicGridStrategy = {}',
    })
    const message = '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈'
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '已改为双向网格策略，请确认逻辑图。',
        semanticPatch: {
          families: ['grid'],
          triggers: [
            {
              key: 'grid.fixed_range',
              phase: 'entry',
              params: { lowerPrice: 60000, upperPrice: 80000, stepPct: 0.5, direction: 'bidirectional' },
            },
          ],
          actions: [{ key: 'open_long' }, { key: 'open_short' }, { key: 'close_position' }],
          risk: [
            { key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
            { key: 'risk.take_profit_pct', params: { valuePct: 10, basis: 'entry_avg_price' } },
          ],
          position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'both' },
          contextSlots: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            marketType: 'perp',
            timeframe: '15m',
          },
        },
      }),
    })

    await service.continueSession('s-semantic-grid-replacement', {
      userId: 'u1',
      message,
    })

    const plannerPayload = JSON.parse(mockAi.chat.mock.calls[0][0].messages[1].content)
    expect(plannerPayload.message).toBe(message)
    expect(plannerPayload.currentSemanticState.triggers).toEqual([])

    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(updatePayload.latestDraftCode).toBeNull()
    expect(updatePayload.semanticState.previousVersions).toHaveLength(1)
    expect(updatePayload.semanticState.triggers).toEqual([
      expect.objectContaining({
        key: 'grid.fixed_range',
        params: expect.objectContaining({ lowerPrice: 60000, upperPrice: 80000, stepPct: 0.5 }),
      }),
    ])
    expect(updatePayload.semanticState.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'price.range_position_lte' }),
      expect.objectContaining({ key: 'price.range_position_gte' }),
    ]))
    expect(updatePayload.semanticState.risk).toEqual([
      expect.objectContaining({ key: 'risk.stop_loss_pct', params: expect.objectContaining({ valuePct: 5 }) }),
      expect.objectContaining({ key: 'risk.take_profit_pct', params: expect.objectContaining({ valuePct: 10 }) }),
    ])
    expect(updatePayload.semanticState.position).toEqual(expect.objectContaining({ value: 0.1 }))
    expect(JSON.stringify(updatePayload.latestSpecDesc)).not.toContain('price.range_position')
    expect(JSON.stringify(updatePayload.latestSpecDesc)).not.toContain('0.45')
  })

  it('consumes pending strategy replacement seed from a follow-up message', async () => {
    const currentSemanticState = {
      ...buildLockedMaSemanticState(),
      pendingEdit: {
        id: 'pending-strategy-replacement-seed-1',
        op: 'replace_trigger',
        candidate: {
          id: 'candidate-strategy-replacement-seed-1',
          key: 'pending.strategy_replacement_seed',
          phase: 'gate',
          params: {},
          status: 'open',
          source: 'user_explicit',
          evidence: {
            text: '之前不对，重新来',
            source: 'user_explicit',
          },
          openSlots: [],
        },
        status: 'needs_clarification',
        createdFromMessage: '之前不对，重新来',
      },
    }
    const sessionFixture = buildSemanticEraSessionFixture({
      id: 's-pending-replacement-seed',
      userId: 'u1',
      status: 'DRAFTING',
      semanticState: currentSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      latestDraftCode: 'const oldMaStrategy = {}',
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValueOnce({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '已改为 RSI 策略，请确认逻辑图。',
        semanticPatch: rsiSemanticPatch(),
      }),
    })

    await service.continueSession('s-pending-replacement-seed', {
      userId: 'u1',
      message: '做一个 RSI 策略',
    })

    const plannerPayload = JSON.parse(mockAi.chat.mock.calls[0][0].messages[1].content)
    expect(plannerPayload.message).toBe('做一个 RSI 策略')
    expect(plannerPayload.currentSemanticState.triggers).toEqual([])

    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(updatePayload.latestDraftCode).toBeNull()
    expect(updatePayload.semanticState.previousVersions).toHaveLength(1)
    expect(updatePayload.semanticState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'oscillator.rsi_lte',
        params: expect.objectContaining({ indicator: 'rsi' }),
      }),
    ]))
    expect(updatePayload.semanticState.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        params: expect.objectContaining({ indicator: 'ma' }),
      }),
    ]))
  })

  it('does not return compileability blockers when semantic state is complete but planner follow-up is unrelated', async () => {
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-unrelated-compileability-blocker',
      userId: 'u1',
      status: 'DRAFTING',
      semanticState: buildLockedMaSemanticState({
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
        risk: [],
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
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
      }),
    })

    const result = await service.continueSession('s-unrelated-compileability-blocker', {
      userId: 'u1',
      message: '继续',
    })

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.assistantPrompt).not.toContain('未识别可编译入场规则')
    expect(result.assistantPrompt).not.toContain('未识别可编译出场规则')
  })

  it('does not return zero-signal compileability blockers when semantic slots are closed', async () => {
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-unrelated-zero-signal-compileability-blocker',
      userId: 'u1',
      status: 'DRAFTING',
      semanticState: buildLockedMaSemanticState({
        triggers: [],
        actions: [],
        risk: [],
        position: null,
        families: [],
      }),
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
      }),
    })

    const result = await service.continueSession('s-unrelated-zero-signal-compileability-blocker', {
      userId: 'u1',
      message: '继续',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).not.toContain('未识别可编译入场规则')
    expect(result.assistantPrompt).not.toContain('未识别可编译出场规则')
  })

  it('Bollinger-line follow-up flow stays in atomic semantic questions instead of legacy compileability prompts', async () => {
    const semanticState = buildLockedBollingerSemanticState({
      contextSlots: {
        ...buildLockedBollingerSemanticState().contextSlots,
        exchange: {
          ...buildLockedBollingerSemanticState().contextSlots.exchange,
          status: 'open',
          value: null,
        },
      },
    })
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-bollinger-line-atomic-follow-up',
      userId: 'u1',
      status: 'DRAFTING',
      semanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '我先继续完善策略逻辑，请补充入场和出场条件。',
      }),
    })

    const result = await service.continueSession('s-bollinger-line-atomic-follow-up', {
      userId: 'u1',
      message: '继续',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('请确认交易所')
    expect(result.assistantPrompt).not.toContain('补充入场和出场条件')
    expect(result.assistantPrompt).not.toContain('未识别可编译入场规则')
    expect(result.assistantPrompt).not.toContain('未识别可编译出场规则')
    expect(result.clarificationState.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'executionContext.exchange',
        reason: 'missing_exchange',
      }),
    ]))
  })

  it('context-only locked state asks for executable semantics instead of entering confirm gate', async () => {
    const semanticState = buildLockedMaSemanticState({
      families: [],
      triggers: [],
      actions: [],
      risk: [],
      position: null,
    })
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-context-only-no-strategy-atoms',
      userId: 'u1',
      status: 'DRAFTING',
      semanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
      }),
    })

    const result = await service.continueSession('s-context-only-no-strategy-atoms', {
      userId: 'u1',
      message: '继续',
    })
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('请补充入场触发条件')
    expect(result.assistantPrompt).not.toContain('未识别可编译入场规则')
    expect(result.assistantPrompt).not.toContain('未识别可编译出场规则')
    expect(result.clarificationState.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'missing_semantic_trigger',
        slotKey: 'trigger.entry',
      }),
    ]))
    expect(updatePayload.status).toBe('DRAFTING')
    expect(updatePayload.semanticState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic.missing_entry_atom',
        phase: 'entry',
      }),
      expect.objectContaining({
        key: 'semantic.missing_exit_atom',
        phase: 'exit',
      }),
    ]))
    expect(mockRepo.tryMarkGenerating).not.toHaveBeenCalled()
  })

  it('surfaces missing contract requirements through semantic open slots instead of legacy blockers', async () => {
    const semanticState = buildLockedMaSemanticState({
      actions: [
        {
          id: 'action-grid-ladder',
          key: 'open_long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          contracts: [{
            id: 'action-contract-grid-ladder',
            kind: 'action',
            capabilities: [{
              domain: 'order_program',
              verb: 'maintain',
              object: 'limit_ladder',
              shape: { timeInForce: 'gtc' },
            }],
            requires: [
              { domain: 'price', verb: 'define', object: 'level_set' },
            ],
            params: {},
          }],
        },
        { id: 'action-close-long', key: 'close_long', status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
      risk: [
        { id: 'risk-stop-loss', key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' }, status: 'locked', source: 'user_explicit', openSlots: [] },
        { id: 'risk-take-profit', key: 'risk.take_profit_pct', params: { valuePct: 10, basis: 'entry_avg_price' }, status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
    })
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-missing-contract-requirements',
      userId: 'u1',
      status: 'DRAFTING',
      semanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
      }),
    })

    const result = await service.continueSession('s-missing-contract-requirements', {
      userId: 'u1',
      message: '继续',
    })
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('price define level_set')
    expect(result.assistantPrompt).not.toContain('未识别可编译入场规则')
    expect(result.assistantPrompt).not.toContain('未识别可编译出场规则')
    expect(result.clarificationState.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'missing_semantic_contract_requirement',
        field: 'actions[action-grid-ladder].contracts[action-contract-grid-ladder].requires.price.define.level_set',
        slotKey: 'contract.requirement.price.define.level_set',
      }),
    ]))
    expect(result.clarificationState.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'ambiguous_state_gate',
        slotKey: 'contract.requirement.price.define.level_set',
      }),
    ]))
    expect(updatePayload.semanticState.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'action-grid-ladder',
        openSlots: expect.arrayContaining([
          expect.objectContaining({
            slotKey: 'contract.requirement.price.define.level_set',
            status: 'open',
          }),
        ]),
      }),
    ]))
  })

  it('keeps OKX spot ETH grid with complete contracts out of legacy entry and exit blockers', async () => {
    const semanticState = buildLockedMaSemanticState({
      families: ['grid.range_rebalance'],
      triggers: [
        {
          id: 'grid-range-rebalance',
          key: 'grid.range_rebalance',
          phase: 'entry',
          params: {
            rangeMin: 2800,
            rangeMax: 3600,
            stepPct: 0.5,
            sideMode: 'long_only',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          contracts: [{
            id: 'contract-grid-levels',
            kind: 'trigger',
            capabilities: [{
              domain: 'price',
              verb: 'define',
              object: 'level_set',
              shape: {
                lower: 2800,
                upper: 3600,
                spacingPct: 0.5,
                spacingMode: 'arithmetic',
              },
            }],
            requires: [],
            params: {},
          }],
        },
      ],
      actions: [
        {
          id: 'action-grid-ladder',
          key: 'open_long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          contracts: [{
            id: 'contract-grid-order-program',
            kind: 'action',
            capabilities: [
              {
                domain: 'order_program',
                verb: 'maintain',
                object: 'limit_ladder',
                shape: { timeInForce: 'gtc', recycleOnFill: true },
              },
              {
                domain: 'capital',
                verb: 'allocate',
                object: 'per_order_budget',
                shape: { value: 10, asset: 'USDT' },
              },
            ],
            requires: [
              { domain: 'price', verb: 'define', object: 'level_set' },
            ],
            params: {},
          }],
        },
        { id: 'action-close-long', key: 'close_long', status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
      risk: [
        { id: 'risk-stop-loss', key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' }, status: 'locked', source: 'user_explicit', openSlots: [] },
        { id: 'risk-take-profit', key: 'risk.take_profit_pct', params: { valuePct: 10, basis: 'entry_avg_price' }, status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
      },
      contextSlots: {
        ...buildLockedMaSemanticState().contextSlots,
        symbol: {
          ...buildLockedMaSemanticState().contextSlots.symbol,
          value: 'ETHUSDT',
        },
        marketType: {
          ...buildLockedMaSemanticState().contextSlots.marketType,
          value: 'spot',
        },
        timeframe: {
          ...buildLockedMaSemanticState().contextSlots.timeframe,
          value: '1m',
        },
      },
    })
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-okx-spot-eth-grid-contracts',
      userId: 'u1',
      status: 'DRAFTING',
      semanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
      }),
    })

    const result = await service.continueSession('s-okx-spot-eth-grid-contracts', {
      userId: 'u1',
      message: '继续',
    })
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.canonicalDigest).toMatch(/^sha256:/)
    expect(result.specDesc).toEqual(expect.objectContaining({
      viewType: 'canonical-semantic-view.v1',
      canonicalDigest: result.canonicalDigest,
    }))
    expect((result as any).clarificationGate).toEqual(expect.objectContaining({
      blocked: false,
    }))
    expect(result.assistantPrompt).not.toContain('未识别可编译入场规则')
    expect(result.assistantPrompt).not.toContain('未识别可编译出场规则')
    expect(updatePayload.status).toBe('CONFIRM_GATE')
    expect(updatePayload.latestSpecDesc).toEqual(expect.objectContaining({
      canonicalDigest: result.canonicalDigest,
    }))
    expect(updatePayload.semanticState.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'action-grid-ladder',
        openSlots: [],
      }),
    ]))
  })

  it('enters confirm gate after boundary guard clarification closes a real spot grid without legacy entry and exit rules', async () => {
    const semanticState = buildLockedMaSemanticState({
      families: ['grid.range_rebalance'],
      triggers: [
        {
          id: 'grid-range-rebalance',
          key: 'grid.range_rebalance',
          phase: 'entry',
          params: {
            sideMode: 'long_only',
            breakoutAction: 'pause',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          contracts: [{
            id: 'contract-grid-levels',
            kind: 'trigger',
            capabilities: [{
              domain: 'price',
              verb: 'define',
              object: 'level_set',
              shape: {
                mode: 'centered_percent_range',
                centerTiming: 'deployment',
                centerSource: 'last_trade',
                halfRangePct: 0.4,
                gridIntervals: 10,
                gridCount: 11,
                spacingMode: 'arithmetic',
              },
            }],
            requires: [],
            params: {},
          }],
        },
      ],
      actions: [
        {
          id: 'action-grid-ladder',
          key: 'open_long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          contracts: [{
            id: 'contract-grid-order-program',
            kind: 'action',
            capabilities: [
              {
                domain: 'order_program',
                verb: 'maintain',
                object: 'limit_ladder',
                shape: {
                  orderType: 'limit',
                  timeInForce: 'gtc',
                  recycleOnFill: true,
                  pairingPolicy: 'adjacent_level',
                },
              },
              {
                domain: 'capital',
                verb: 'allocate',
                object: 'per_order_budget',
                shape: { value: 10, asset: 'USDT' },
              },
            ],
            requires: [
              { domain: 'price', verb: 'define', object: 'level_set' },
            ],
            params: {},
          }],
        },
      ],
      risk: [
        {
          id: 'risk-boundary-stop',
          key: 'risk.boundary_guard',
          params: {},
          status: 'open',
          source: 'derived',
          openSlots: [{
            slotKey: 'contract.requirement.guard.enforce.boundary_cancel',
            fieldPath: 'risk[risk-boundary-stop].contracts[risk-contract-boundary-stop].requires.guard.enforce.boundary_cancel',
            status: 'open',
            priority: 'risk',
            questionHint: '当价格突破上下边界后，策略是否停止并撤销未成交订单且不再重新部署/不再创建新网格？',
            affectsExecution: true,
          }],
          contracts: [{
            id: 'risk-contract-boundary-stop',
            kind: 'risk',
            capabilities: [],
            requires: [
              { domain: 'guard', verb: 'enforce', object: 'boundary_cancel' },
            ],
            params: {},
          }],
        },
      ],
      position: {
        mode: 'fixed_quote',
        value: 10,
        asset: 'USDT',
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
      },
      contextSlots: {
        ...buildLockedMaSemanticState().contextSlots,
        symbol: {
          ...buildLockedMaSemanticState().contextSlots.symbol,
          value: 'ETHUSDT',
        },
        marketType: {
          ...buildLockedMaSemanticState().contextSlots.marketType,
          value: 'spot',
        },
        timeframe: {
          ...buildLockedMaSemanticState().contextSlots.timeframe,
          value: '1m',
        },
      },
    })
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-okx-real-grid-boundary-guard',
      userId: 'u1',
      status: 'DRAFTING',
      semanticState,
      clarificationState: { status: 'NEEDS_CLARIFICATION', items: [] },
      constraintPack: {},
    })
    mockRepo.findById.mockResolvedValue(sessionFixture)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '我先继续完善策略逻辑，请补充入场和出场条件。',
      }),
    })

    const result = await service.continueSession('s-okx-real-grid-boundary-guard', {
      userId: 'u1',
      message: '当价格突破上下边界时，策略是“停止并撤销未成交订单”后就不再重新部署/不再创建新网格',
    })
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.assistantPrompt).toContain('入场：区间网格，以部署时最新成交价为中心上下各 0.4%，共 10 格')
    expect(result.assistantPrompt).toContain('挂单：限价网格，成交后相邻网格反向挂单，每格 10 USDT')
    expect(result.assistantPrompt).toContain('风控：突破上下边界时停止策略并撤销未成交网格订单，不再重新部署网格')
    expect(result.assistantPrompt).not.toContain('已识别部分条件，但仍未完整')
    expect(result.assistantPrompt).not.toContain('补充入场和出场')
    expect(result.assistantPrompt).not.toContain('未识别可编译入场规则')
    expect(result.assistantPrompt).not.toContain('未识别可编译出场规则')
    expect(updatePayload.semanticState.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'risk-boundary-stop',
        status: 'locked',
        openSlots: [],
        contracts: [expect.objectContaining({
          capabilities: [expect.objectContaining({
            domain: 'guard',
            verb: 'enforce',
            object: 'boundary_cancel',
            shape: expect.objectContaining({
              onBreach: 'HALT_STRATEGY',
              cancelOrders: true,
              cancelScope: 'unfilled_grid_orders',
              regrid: false,
            }),
          })],
        })],
      }),
    ]))

    mockRepo.findById.mockResolvedValueOnce({
      ...sessionFixture,
      status: 'CONFIRM_GATE',
      semanticState: updatePayload.semanticState,
      clarificationState: updatePayload.clarificationState,
      constraintPack: updatePayload.constraintPack,
      latestSpecDesc: updatePayload.latestSpecDesc,
    })

    const confirmed = await service.continueSession('s-okx-real-grid-boundary-guard', {
      userId: 'u1',
      message: '对的',
    })

    expect(confirmed.status).toBe('GENERATING')
    expect(mockAi.chat).toHaveBeenCalledTimes(1)
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith(
      's-okx-real-grid-boundary-guard',
      expect.objectContaining({
        semanticState: expect.objectContaining({
          triggers: expect.any(Array),
          actions: expect.any(Array),
          risk: expect.any(Array),
        }),
      }),
    )
  })

  it('starts a complete OKX spot real grid from deterministic atomic contracts without fallback summary', async () => {
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: true,
        assistantPrompt: '我整理出的策略逻辑如下：已识别部分条件，但仍未完整。。请确认是否按这个逻辑生成脚本。',
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-okx-real-grid-start' })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: 'OKX 现货 ETHUSDT、1m 网格以部署时当前价为中心，上下各0.4%共10格、每格10 USDT、限价单并相邻网格自动挂反向单、不用趋势信号开仓；当价格突破上下边界时执行“立即停止并撤销所有未成交订单”',
    })
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(result.status).toBe('CONFIRM_GATE')
    expect(result.assistantPrompt).toContain('入场：区间网格，以部署时当前价为中心上下各 0.4%，共 10 格')
    expect(result.assistantPrompt).toContain('挂单：限价网格，成交后相邻网格反向挂单，每格 10 USDT')
    expect(result.assistantPrompt).toContain('风控：突破上下边界时停止策略并撤销未成交网格限价单，不再重新部署网格')
    expect(result.assistantPrompt).not.toContain('已识别部分条件，但仍未完整')
    expect(createPayload.semanticState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'grid.range_rebalance',
        contracts: [expect.objectContaining({
          capabilities: [expect.objectContaining({
            domain: 'price',
            verb: 'define',
            object: 'level_set',
          })],
        })],
      }),
    ]))
  })

  it('preserves a complete real-grid seed when the user only answers the missing timeframe slot', async () => {
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '我先继续完善策略逻辑，请补充入场和出场条件。',
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-okx-real-grid-timeframe-slot' })

    const started = await service.startSession({
      userId: 'u1',
      initialMessage: '创建一个 OKX 现货ETH/USDT 真实网格策略。 固定价格区间：以当前价格为中心，上下各 0.4%。 网格数量：10 格。 每格资金：10 USDT。 订单类型：限价单。 成交后在相邻网格自动挂反向单。 价格突破上下边界时停止并撤销未成交订单。 不要用趋势信号触发开仓，部署后立即创建网格挂单。',
    })
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(started.status).toBe('DRAFTING')
    expect(started.assistantPrompt).toContain('主周期')
    expect(createPayload.semanticState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'grid.range_rebalance',
        contracts: [expect.objectContaining({
          capabilities: [expect.objectContaining({
            domain: 'price',
            verb: 'define',
            object: 'level_set',
          })],
        })],
      }),
    ]))
    expect(createPayload.semanticState.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        contracts: expect.arrayContaining([expect.objectContaining({
          capabilities: expect.arrayContaining([expect.objectContaining({
            domain: 'order_program',
            verb: 'maintain',
            object: 'limit_ladder',
          })]),
        })]),
      }),
    ]))

    mockRepo.findById.mockResolvedValue(buildPersistedSessionSnapshot(
      's-okx-real-grid-timeframe-slot',
      createPayload,
      { status: started.status },
    ))

    const continued = await service.continueSession('s-okx-real-grid-timeframe-slot', {
      userId: 'u1',
      message: '1m',
    })
    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>

    expect(continued.status).toBe('CONFIRM_GATE')
    expect(continued.assistantPrompt).toContain('入场：区间网格，以部署时当前价为中心上下各 0.4%，共 10 格')
    expect(continued.assistantPrompt).toContain('挂单：限价网格，成交后相邻网格反向挂单，每格 10 USDT')
    expect(continued.assistantPrompt).toContain('风控：突破上下边界时停止策略并撤销未成交网格订单，不再重新部署网格')
    expect(continued.assistantPrompt).not.toContain('补充入场和出场')
    expect(updatePayload.semanticState.contextSlots.timeframe).toEqual(expect.objectContaining({
      status: 'locked',
      value: '1m',
    }))
    expect(updatePayload.semanticState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'grid.range_rebalance' }),
    ]))
    expect(updatePayload.semanticState.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
    ]))
  })

  it('keeps a real grid executable after position and timeframe slots are closed across turns', async () => {
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '我先继续完善策略逻辑，请补充入场和出场条件。',
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-okx-real-grid-slot-chain' })

    const started = await service.startSession({
      userId: 'u1',
      initialMessage: '建一个 OKX 现货ETH/USDT 真实网格策略。 固定价格区间：以当前价格为中心，上下各 0.4%。 网格数量：10 格。 订单类型：限价单。 成交后在相邻网格自动挂反向单。 价格突破上下边界时停止并撤销未成交订单。 不要用趋势信号触发开仓，部署后立即创建网格挂单。',
    })
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(started.status).toBe('DRAFTING')
    expect(started.assistantPrompt).toContain('单笔仓位大小')

    mockRepo.findById.mockResolvedValueOnce(buildPersistedSessionSnapshot(
      's-okx-real-grid-slot-chain',
      createPayload,
      { status: started.status },
    ))

    const afterPosition = await service.continueSession('s-okx-real-grid-slot-chain', {
      userId: 'u1',
      message: '10 USDT',
    })
    const positionPayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>

    expect(afterPosition.status).toBe('DRAFTING')
    expect(afterPosition.assistantPrompt).toContain('主周期')
    expect(positionPayload.semanticState.position).toEqual(expect.objectContaining({
      mode: 'fixed_quote',
      value: 10,
      sizing: expect.objectContaining({
        asset: 'USDT',
        kind: 'quote',
        value: 10,
      }),
      status: 'locked',
    }))

    mockRepo.findById.mockResolvedValueOnce(buildPersistedSessionSnapshot(
      's-okx-real-grid-slot-chain',
      positionPayload,
      { status: afterPosition.status },
    ))

    const afterTimeframe = await service.continueSession('s-okx-real-grid-slot-chain', {
      userId: 'u1',
      message: '1M',
    })
    const timeframePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>

    expect(afterTimeframe.status).toBe('CONFIRM_GATE')
    expect(afterTimeframe.assistantPrompt).toContain('入场：区间网格，以部署时当前价为中心上下各 0.4%，共 10 格')
    expect(afterTimeframe.assistantPrompt).toContain('挂单：限价网格，成交后相邻网格反向挂单')
    expect(afterTimeframe.assistantPrompt).toContain('风控：突破上下边界时停止策略并撤销未成交网格订单，不再重新部署网格')
    expect(afterTimeframe.assistantPrompt).toContain('仓位：10 USDT')

    mockRepo.findById.mockResolvedValueOnce(buildPersistedSessionSnapshot(
      's-okx-real-grid-slot-chain',
      timeframePayload,
      { status: afterTimeframe.status },
    ))

    const confirmed = await service.continueSession('s-okx-real-grid-slot-chain', {
      userId: 'u1',
      message: '对的',
    })

    expect(confirmed.status).toBe('GENERATING')
    expect(mockRepo.tryMarkGenerating).toHaveBeenCalledWith(
      's-okx-real-grid-slot-chain',
      expect.objectContaining({
        semanticState: expect.objectContaining({
          triggers: expect.arrayContaining([expect.objectContaining({ key: 'grid.range_rebalance' })]),
          actions: expect.arrayContaining([expect.objectContaining({
            contracts: expect.arrayContaining([expect.objectContaining({
              capabilities: expect.arrayContaining([expect.objectContaining({
                domain: 'order_program',
                verb: 'maintain',
                object: 'limit_ladder',
              })]),
            })]),
          })]),
          risk: expect.arrayContaining([expect.objectContaining({ key: 'risk.boundary_guard' })]),
        }),
      }),
    )
  })

  it('rejects compiler-first publish when compiled script fails structural validation', async () => {
    const emitSpy = jest
      .spyOn(CompiledScriptEmitterService.prototype, 'emit')
      .mockReturnValue('broken compiled script')

    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-runtime-invalid',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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

    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-compiler-consistency-failed',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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
      status: 'CONFIRM_GATE',
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
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's6',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
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

  it('does not generate from checklist-only persisted sessions without semanticState', async () => {
    const checklistOnlySession = buildPersistedSessionSnapshot('s7-checklist-only', {}, {
      userId: 'u1',
      status: 'CONFIRM_GATE',
      checklist: completeChecklist({
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      }),
      semanticState: null,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      latestSpecDesc: null,
    })
    const emptySemanticDigest = buildSemanticOnlyCanonicalDigest((service as any).createEmptySemanticState())
    mockRepo.findById.mockResolvedValue(checklistOnlySession)

    const result = await service.continueSession('s7-checklist-only', {
      userId: 'u1',
      message: '确认，直接生成代码',
      confirmGenerate: true,
      confirmedCanonicalDigest: emptySemanticDigest,
    })

    expect(result.status).toBe('DRAFTING')
    expect(mockRepo.tryMarkGenerating).not.toHaveBeenCalled()
    expect(mockRepo.updateSession).not.toHaveBeenCalledWith(
      's7-checklist-only',
      expect.objectContaining({ status: 'GENERATING' }),
    )
  })

  it('does not treat semantic families as executable mainflow evidence during confirmGenerate', async () => {
    const familiesOnlyState = {
      ...(service as any).createEmptySemanticState(),
      families: ['grid.range_rebalance'],
    }
    mockRepo.findById.mockResolvedValue(buildPersistedSessionSnapshot('s7-family-only', {}, {
      userId: 'u1',
      status: 'CONFIRM_GATE',
      checklist: null,
      semanticState: familiesOnlyState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      latestSpecDesc: null,
    }))

    const result = await service.continueSession('s7-family-only', {
      userId: 'u1',
      message: '确认，直接生成代码',
      confirmGenerate: true,
      confirmedCanonicalDigest: buildSemanticOnlyCanonicalDigest(familiesOnlyState),
    })

    expect(result.status).toBe('DRAFTING')
    expect(mockRepo.tryMarkGenerating).not.toHaveBeenCalled()
    expect(mockRepo.updateSession).not.toHaveBeenCalledWith(
      's7-family-only',
      expect.objectContaining({ status: 'GENERATING' }),
    )
  })

  it('does not block confirmGenerate with the legacy entry and exit completion prompt when the semantic snapshot is complete and the canonical spec can compile', async () => {
    const persistedSemanticState = buildLockedMaSemanticState({
      risk: [
        lockedStopLossRisk(),
        {
          id: 'risk-take-profit',
          key: 'risk.take_profit_pct',
          params: {
            valuePct: 10,
            basis: 'entry_avg_price',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
    })
    mockRepo.findById.mockResolvedValue({
      id: 's7-semantic-complete',
      userId: 'u1',
      status: 'CONFIRM_GATE',
      checklist: null,
      semanticState: persistedSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    const missingFieldsSpy = jest
      .spyOn(CodegenConversationService.prototype as any, 'resolveLogicSnapshotMissingFields')
      .mockReturnValue(['entryRules', 'exitRules'])
    const confirmedCanonicalDigest = buildSemanticOnlyCanonicalDigest(persistedSemanticState)
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

  it('blocks confirmGenerate when semantic state is ready but canonical projection is not executable', async () => {
    const persistedSemanticState = buildLockedMaSemanticState({
      risk: [
        lockedStopLossRisk(),
        {
          id: 'risk-take-profit',
          key: 'risk.take_profit_pct',
          params: {
            valuePct: 10,
            basis: 'entry_avg_price',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
    })
    mockRepo.findById.mockResolvedValue({
      id: 's7-semantic-projection-gap',
      userId: 'u1',
      status: 'CONFIRM_GATE',
      checklist: null,
      semanticState: persistedSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    const confirmedCanonicalDigest = buildSemanticOnlyCanonicalDigest(persistedSemanticState)
    const readCanonicalDigestSpy = jest
      .spyOn(CodegenConversationService.prototype as any, 'readCanonicalDigest')
      .mockReturnValue(confirmedCanonicalDigest)
    const compileabilitySpy = jest
      .spyOn(CodegenConversationService.prototype as any, 'evaluateCanonicalCompileability')
      .mockReturnValue({
        canCompile: false,
        entryRuleCount: 0,
        exitRuleCount: 0,
        reasons: ['canonical_projection_missing_entry_program', 'canonical_projection_missing_exit_program'],
      })
    const genericGapSpy = jest
      .spyOn(CodegenConversationService.prototype as any, 'hasUnresolvedGenericCompileabilityGap')
      .mockReturnValue(true)

    try {
      const result = await service.continueSession('s7-semantic-projection-gap', {
        userId: 'u1',
        message: '确认逻辑图',
        confirmGenerate: true,
        confirmedCanonicalDigest,
      })

      expect(result.status).toBe('DRAFTING')
      expect(result.assistantPrompt ?? '').not.toContain('未识别可编译入场规则')
      expect(result.assistantPrompt ?? '').not.toContain('未识别可编译出场规则')
      expect(result.assistantPrompt ?? '').toContain('不能稳定投影到可执行入场规则和可执行出场/风控规则')
      expect(mockRepo.tryMarkGenerating).not.toHaveBeenCalled()
      expect(mockRepo.updateSession).toHaveBeenCalledWith(
        's7-semantic-projection-gap',
        expect.objectContaining({ status: 'DRAFTING' }),
      )
    } finally {
      genericGapSpy.mockRestore()
      compileabilitySpy.mockRestore()
      readCanonicalDigestSpy.mockRestore()
    }
  })

  it('blocks confirmGenerate when a locked semantic risk atom is recognized but unsupported by projection', async () => {
    const persistedSemanticState = buildLockedMaSemanticState({
      risk: [
        lockedStopLossRisk(),
        {
          id: 'risk-unsupported-pause',
          key: 'risk.condition_expression',
          params: {
            condition: {
              kind: 'predicate',
              op: 'LTE',
              left: { kind: 'position', field: 'pnl_pct' },
              right: { kind: 'constant', value: -12, unit: 'percent' },
            },
            effect: { type: 'pause_strategy' },
            scope: 'strategy',
            capabilityStatus: 'recognized_unsupported',
            unsupportedReason: 'risk_expression_compiler_not_available',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
    })
    mockRepo.findById.mockResolvedValue({
      id: 's7-unsupported-risk-projection',
      userId: 'u1',
      status: 'CONFIRM_GATE',
      checklist: null,
      semanticState: persistedSemanticState,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
    })
    const confirmedCanonicalDigest = buildSemanticOnlyCanonicalDigest(persistedSemanticState)
    const readCanonicalDigestSpy = jest
      .spyOn(CodegenConversationService.prototype as any, 'readCanonicalDigest')
      .mockReturnValue(confirmedCanonicalDigest)

    try {
      const result = await service.continueSession('s7-unsupported-risk-projection', {
        userId: 'u1',
        message: '确认逻辑图',
        confirmGenerate: true,
        confirmedCanonicalDigest,
      })

      expect(result.status).toBe('DRAFTING')
      expect(result.assistantPrompt ?? '').toContain('执行层暂不支持')
      expect(mockRepo.tryMarkGenerating).not.toHaveBeenCalled()
    } finally {
      readCanonicalDigestSpy.mockRestore()
    }
  })

  it('persists updated semanticState when confirmGenerate closes a semantic slot before GENERATING', async () => {
    const persistedChecklist = completeChecklist({
      entryRules: ['价格突破长期均线时买入'],
      exitRules: ['价格跌破短期均线（20）时卖出'],
    })
    const persistedSemanticState = buildLockedMaSemanticState({
      risk: [lockedStopLossRisk()],
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
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
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
    const answeredFixture = buildLegacyChecklistBridgeSessionFixture({
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
      confirmedCanonicalDigest: readFixtureCanonicalDigest(answeredFixture),
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
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's8',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's8-publish-fail',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's8-publication-blocked',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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

    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's9',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-consistency',
      userId: 'u1',
      status: 'CONFIRM_GATE',
      semanticState: buildLockedBidirectionalBollingerSemanticState({
        risk: [lockedStopLossRisk()],
      }),
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

    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-v1',
      userId: 'u1',
      status: 'CONFIRM_GATE',
      semanticState: buildLockedBollingerSemanticState({
        risk: [lockedStopLossRisk()],
      }),
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
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-new-instance',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-perp-publish',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-existing-instance',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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
    const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
      id: 's-instance-failed',
      userId: 'u1',
      status: 'CONFIRM_GATE',
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


})
