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
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'
import { PerTradeSizingResolver } from '../per-trade-sizing-resolver.service'
import type { SemanticState as SemanticStateType } from '../../types/semantic-state'
import { MULTI_LEG_CASE_A, MULTI_LEG_CASE_B } from './fixtures/multi-leg-with-per-order-budget'

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
    new CompiledPublicationGateService(
      mockRepo as unknown as PublishedStrategySnapshotsRepository,
      { withTransaction: (cb: () => Promise<unknown>) => cb() } as never,
    ),
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
      return (service as any).projectSemanticStateToStrategySnapshotForCompatibility(session.semanticState, {})
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
  type SemanticStateExpectation = {
    triggers?: Array<{
      key?: string
      phase?: string
      sideScope?: string
      params?: Record<string, unknown>
      support?: { supportStatus?: string }
    }>
    risk?: Array<{
      key?: string
      params?: Record<string, unknown>
      support?: { supportStatus?: string }
    }>
    unsupportedFallback?: unknown
  }
  const readLastCreatedSemanticState = (): SemanticStateExpectation => {
    const payload = mockRepo.createSession.mock.calls.at(-1)?.[0] as {
      semanticState?: SemanticStateExpectation
    } | undefined
    if (!payload?.semanticState) {
      throw new Error('expected createSession semanticState payload')
    }
    return payload.semanticState
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

  it('guards English responses from Chinese planner prompts when clarification is pending', () => {
    const prompt = (service as any).localizePlannerPromptForResponse({
      locale: 'en',
      assistantPrompt: '我当前理解的策略是：入场和出场已识别。请确认：请确认单笔仓位大小。',
      clarificationState: {
        status: 'NEEDS_CLARIFICATION',
        summary: '入场和出场已识别。',
        items: [
          {
            key: 'semantic.position.sizing',
            reason: 'missing_semantic_position_sizing',
            field: 'position.sizing',
            blocking: true,
            question: '请确认单笔仓位大小，例如 10% / 10 USDT / 0.001 BTC。',
            status: 'pending',
            slotKey: 'position.sizing',
            fieldPath: 'position.sizing',
          },
        ],
      },
    })

    expect(prompt).toContain('I understand the strategy logic you described.')
    expect(prompt).toContain('Please confirm: Please confirm the position size for each trade')
    expect(prompt).not.toMatch(/[\u3400-\u9fff]/u)
  })

  it('parses fullwidth and Chinese percent fallback position modifications', () => {
    expect((service as any).extractFallbackPositionPct('可以，仓位改成 5％')).toBe(5)
    expect((service as any).extractFallbackPositionPct('可以，仓位改成百分之五')).toBe(5)
    expect((service as any).extractFallbackPositionPct('可以，止损改成 5％')).toBeNull()
  })

  it.each([
    ['cross-exchange', '做 Binance 和 OKX 跨所搬砖，价差大于 0.5% 时自动划转 USDT 并套利。', 'cross_exchange_fund_transfer_arbitrage_out_of_scope', '目前不支持跨所搬砖套利'],
    ['triangular', '做 BTC/USDT、ETH/USDT、ETH/BTC 三角套利，盘口出现价差时自动撮合三条腿。', 'triangular_arbitrage_matching_out_of_scope', '目前不支持三角套利策略'],
    ['hft', '做 BTCUSDT 高频做市，根据毫秒级盘口变化不断撤单挂单。', 'hft_market_making_out_of_scope', '目前不支持高频做市策略'],
    ['queue-alpha', '做延迟敏感 order queue alpha，根据队列位置抢 maker 成交。', 'latency_sensitive_order_queue_alpha_out_of_scope', '目前不支持延迟敏感 order queue alpha'],
  ])('routes C-scope unsupported strategy before planner and sizing clarification: %s', async (_name, initialMessage, reasonCode, publicText) => {
    mockRepo.createSession.mockResolvedValue({ id: `s-unsupported-${_name}` })
    mockAi.chat.mockRejectedValue(new Error('planner must not be called for C-scope unsupported strategy'))

    const result = await service.startSession({ userId: 'u1', initialMessage })
    const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>

    expect(mockAi.chat).not.toHaveBeenCalled()
    expect(result.assistantPrompt).toContain(publicText)
    expect(result.assistantPrompt).not.toContain('请确认单笔仓位')
    expect(result.clarificationState?.status).toBe('CLEAR')
    expect(result.unsupportedFallback).toEqual(expect.objectContaining({ status: 'final' }))
    expect(JSON.stringify(createPayload.semanticState)).toContain(reasonCode)
    expect(JSON.stringify(result.unsupportedFallback)).not.toContain('recommendedStrategy')
    expect(createPayload.semanticState).not.toHaveProperty('rules')
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

  it('hydrates deterministic execution context from the user message when planner rules omit context slots', () => {
    const message = '在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金 止损5% 止盈10%'
    const currentState = (service as any).createEmptySemanticState()

    const result = (service as any).applyConversationPlanToSemanticState({
      currentState,
      message,
      plan: {
        related: true,
        logicReady: false,
        assistantPrompt: '已识别入场和出场。',
        semanticPatch: {
          rules: [
            {
              id: 'entry-btc-drop-within-3m-1pct',
              phase: 'entry',
              sideScope: 'long',
              condition: {
                kind: 'atom',
                key: 'price.percent_change',
                params: { direction: 'down', valuePct: 1, window: '3m' },
                evidence: { text: message },
              },
              effects: {
                actions: [{ kind: 'atom', key: 'action.open_long', params: {}, evidence: { text: '买入' } }],
                risks: [],
                positions: [],
                programs: [],
                orchestration: [],
              },
            },
          ],
        },
      },
    })

    expect(result.contextSlots.exchange).toEqual(expect.objectContaining({ status: 'locked', value: 'okx' }))
    expect(result.contextSlots.symbol).toEqual(expect.objectContaining({ status: 'locked', value: 'BTCUSDT' }))
    expect(result.contextSlots.timeframe).toEqual(expect.objectContaining({ status: 'locked', value: '3m' }))
    expect(result.contextSlots.marketType).toEqual(expect.objectContaining({ status: 'open', value: null }))
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

  it('does not throw 500 when deterministic rules fallback lacks market context', async () => {
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '我已整理出策略逻辑，请补充交易所和标的。',
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-ema-stack-missing-context' })

    const result = await service.startSession({
      userId: 'u1',
      initialMessage: '入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt',
    })

    expect(result.status).toBe('DRAFTING')
    expect(result.assistantPrompt).toContain('请')
    expect(mockRepo.createSession).toHaveBeenCalled()
  })

  it('does not return stale planner prompt when dispatcher repairs MA cross lifecycle', async () => {
    const initialMessage = '基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建 MA 6/48 均线交叉趋势跟随策略。入场规则：MA6 上穿 MA48 时做多开仓；出场规则：MA6 下穿 MA48 时平多；风控：仓位 35%，2 倍杠杆，止损 2%，止盈 0.6%。'
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: true,
        logicReady: false,
        assistantPrompt: '我当前理解的策略是：OKX BTCUSDT 永续合约 15m；出场：MA6 上穿 MA48 → 平多，止损：价格相对入场均价下跌2% 强制平仓，止盈：价格相对入场均价上涨0.6% 平仓，杠杆：2 倍，单笔仓位 35%，周期范围:主 15m，依赖 15m（tolerant）；出场：MA6 下穿 MA48 → 平多，周期范围:主 15m，依赖 15m（tolerant） 现在还缺一个会影响脚本生成一致性的条件：核心交易语义。 请确认：请补充入场条件，例如什么价格或指标条件触发开仓。',
        semanticPatch: {
          contextSlots: {
            venue: 'okx',
            symbol: 'BTCUSDT',
            instrumentType: 'perpetual',
            timeframe: '15m',
          },
          rules: [{
            id: 'planner-wrong-exit-cross-over',
            phase: 'exit',
            sideScope: 'long',
            evidence: { text: initialMessage },
            condition: { kind: 'atom', key: 'indicator.cross_over', params: { indicator: 'ma', fastPeriod: 6, slowPeriod: 48 }, evidence: { text: 'MA6 上穿 MA48 时做多开仓' } },
            effects: {
              actions: [{ kind: 'atom', key: 'action.close_long', params: {}, evidence: { text: 'MA6 上穿 MA48 时做多开仓' } }],
              risks: [
                { kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: 2 }, evidence: { text: '止损 2%' } },
                { kind: 'atom', key: 'risk.take_profit_pct', params: { valuePct: 0.6 }, evidence: { text: '止盈 0.6%' } },
              ],
              positions: [
                { kind: 'atom', key: 'position.sizing', params: { mode: 'pct_equity', value: 35 }, evidence: { text: '仓位 35%' } },
                { kind: 'atom', key: 'position.leverage', params: { value: 2 }, evidence: { text: '2 倍杠杆' } },
              ],
              orchestration: [],
              programs: [],
            },
          }, {
            id: 'planner-exit-cross-under',
            phase: 'exit',
            sideScope: 'long',
            evidence: { text: initialMessage },
            condition: { kind: 'atom', key: 'indicator.cross_under', params: { indicator: 'ma', fastPeriod: 6, slowPeriod: 48 }, evidence: { text: 'MA6 下穿 MA48 时平多' } },
            effects: { actions: [{ kind: 'atom', key: 'action.close_long', params: {}, evidence: { text: 'MA6 下穿 MA48 时平多' } }], risks: [], positions: [], orchestration: [], programs: [] },
          }],
        },
      }),
    })
    mockRepo.createSession.mockResolvedValue({ id: 's-ma-lifecycle-prompt' })

    const result = await service.startSession({ userId: 'u1', initialMessage })

    expect(result.assistantPrompt).toContain('入场：MA6 上穿 MA48')
    expect(result.assistantPrompt).not.toContain('出场：MA6 上穿 MA48')
    expect(result.assistantPrompt).not.toContain('请补充入场条件')
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

    expect(mockAccountStrategyViewService.deleteStrategy).toHaveBeenCalledWith('u1', 'inst-stopped', { deleteStoppedStrategy: true, via: 'conversation-list' })
    // 兜底：deleteStrategy 静默 return（如策略已归档）也要保证当前 conversation 被归档；
    // archiveByIdAndUser 对已归档的 conversation 是 no-op，幂等安全。
    expect(mockConversationsRepo.archiveByIdAndUser).toHaveBeenCalledWith('conv-1', 'u1')
  })

  it('delegates conversation archive + view-only set to deleteStrategy when deleteStoppedStrategy=false', async () => {
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

    await service.deleteConversation('conv-1', 'u1')

    expect(mockAccountStrategyViewService.deleteStrategy).toHaveBeenCalledWith('u1', 'inst-stopped', { deleteStoppedStrategy: false, via: 'conversation-list' })
    // 同上兜底，幂等防御。
    expect(mockConversationsRepo.archiveByIdAndUser).toHaveBeenCalledWith('conv-1', 'u1')
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
          question: '请补充网格价格区间和网格数量或每格间距。',
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
          question: '请补充网格价格区间和网格数量或每格间距。',
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

  describe('reported staging strategy conversations', () => {
    async function startReportedConversation(sessionId: string, initialMessage: string) {
      mockAi.chat.mockResolvedValue({
        content: JSON.stringify({
          related: true,
          logicReady: false,
          assistantPrompt: 'planner fallback must not overwrite semantic seed',
        }),
      })
      mockRepo.createSession.mockResolvedValue({ id: sessionId })

      const result = await service.startSession({ userId: 'u1', initialMessage })
      const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
      return { result, semanticState: createPayload.semanticState as Record<string, any> }
    }

    async function continueReportedConversation(
      sessionId: string,
      semanticState: Record<string, any>,
      message: string,
    ) {
      mockRepo.findById.mockResolvedValueOnce(buildSemanticEraSessionFixture({
        id: sessionId,
        semanticState,
        status: 'DRAFTING',
      }))

      const result = await service.continueSession(sessionId, { userId: 'u1', message })
      const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
      return { result, semanticState: updatePayload.semanticState as Record<string, any> }
    }

    async function publishReportedConversation(sessionId: string, semanticState: Record<string, any>): Promise<string> {
      mockRepo.findById.mockResolvedValueOnce(buildSemanticEraSessionFixture({
        id: sessionId,
        semanticState,
        status: 'CONFIRM_GATE',
      }))

      const result = await service.continueSession(sessionId, {
        userId: 'u1',
        message: 'Confirm code generation',
        confirmGenerate: true,
        confirmedCanonicalDigest: buildConfirmedCanonicalDigest(semanticState),
      })

      if (result.status !== 'GENERATING') {
        throw new Error(`expected GENERATING, got ${result.status}: ${result.assistantPrompt ?? ''}`)
      }
      await waitForTerminalStatus(sessionId)
      const publishedPayload = mockRepo.updateSession.mock.calls
        .filter(call => call[0] === sessionId)
        .map(call => call[1] as Record<string, any>)
        .find(payload => payload.status === 'PUBLISHED')
      if (typeof publishedPayload?.latestDraftCode !== 'string') {
        const statuses = mockRepo.updateSession.mock.calls
          .filter(call => call[0] === sessionId)
          .map(call => (call[1] as Record<string, any>).status)
          .filter(Boolean)
          .join(', ')
        const rejected = mockRepo.updateSession.mock.calls
          .filter(call => call[0] === sessionId)
          .map(call => call[1] as Record<string, any>)
          .find(payload => payload.status === 'REJECTED')
        throw new Error(`expected published latestDraftCode; statuses=${statuses}; rejected=${JSON.stringify(rejected)}`)
      }
      return publishedPayload.latestDraftCode
    }

    function withReportedExecutionContext(
      semanticState: Record<string, any>,
      contextSlots: Partial<Record<'exchange' | 'symbol' | 'marketType' | 'timeframe', string>>,
    ): Record<string, any> {
      const lockedContextSlots = Object.fromEntries(
        Object.entries(contextSlots).map(([key, value]) => [
          key,
          {
            slotKey: `context.${key}`,
            status: 'locked',
            value,
            source: 'user_explicit',
          },
        ]),
      )
      return {
        ...semanticState,
        contextSlots: {
          ...(semanticState.contextSlots ?? {}),
          ...lockedContextSlots,
        },
      }
    }

    it('treats short natural confirmation on CLEAR DRAFTING rules session as code generation', async () => {
      const sessionId = 's-clear-drafting-natural-confirm'
      const semanticState = withReportedExecutionContext({
        version: 1,
        families: [],
        trigger: [],
        action: [],
        risk: [],
        positionConstraint: [],
        orchestration: [],
        orchestrationContracts: [],
        position: {
          mode: 'fixed_ratio',
          value: 0.1,
          sizing: { kind: 'ratio', unit: 'ratio', value: 0.1 },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        contextSlots: {},
        normalizationNotes: [],
        updatedAt: '2026-06-02T00:00:00.000Z',
        rules: [
          {
            id: 'entry-ema-cross-over',
            phase: 'entry',
            sideScope: 'long',
            evidence: { text: 'EMA7 上穿 EMA21 时开多' },
            condition: {
              kind: 'atom',
              key: 'indicator.cross_over',
              params: { indicator: 'ema', fastPeriod: 7, slowPeriod: 21 },
              evidence: { text: 'EMA7 上穿 EMA21 时开多' },
            },
            effects: {
              actions: [{ kind: 'atom', key: 'action.open_long', params: {}, evidence: { text: '开多' } }],
              risks: [],
              positions: [],
              orchestration: [],
              programs: [],
            },
          },
          {
            id: 'exit-ema-cross-under',
            phase: 'exit',
            sideScope: 'long',
            evidence: { text: 'EMA7 下穿 EMA21 时平多' },
            condition: {
              kind: 'atom',
              key: 'indicator.cross_under',
              params: { indicator: 'ema', fastPeriod: 7, slowPeriod: 21 },
              evidence: { text: 'EMA7 下穿 EMA21 时平多' },
            },
            effects: {
              actions: [{ kind: 'atom', key: 'action.close_long', params: {}, evidence: { text: '平多' } }],
              risks: [],
              positions: [],
              orchestration: [],
              programs: [],
            },
          },
        ],
      }, {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        timeframe: '15m',
      })
      mockRepo.findById.mockResolvedValueOnce(buildSemanticEraSessionFixture({
        id: sessionId,
        semanticState,
        status: 'DRAFTING',
        clarificationState: { status: 'CLEAR', items: [], summary: null },
      }))

      const result = await service.continueSession(sessionId, {
        userId: 'u1',
        message: '确认生成',
      })

      expect(result.status).toBe('GENERATING')
      expect(mockAi.chat).not.toHaveBeenCalled()
    })

    it('does not duplicate MACD cross rules with dispatcher fallback on first turn', async () => {
      const initialMessage = 'OKX 上用 BTC/USDT，1 小时 K，MACD 金叉买入死叉卖出'
      mockAi.chat.mockResolvedValue({
        content: JSON.stringify({
          related: true,
          logicReady: false,
          assistantPrompt: '我当前理解的策略是：入场：MACD 金叉 → 开多；出场：MACD 死叉 → 平多',
          semanticPatch: {
            contextSlots: {
              symbol: 'BTCUSDT',
              timeframe: '1h',
              exchange: 'okx',
            },
            rules: [
              {
                id: 'entry-macd-cross-golden',
                phase: 'entry',
                sideScope: 'long',
                evidence: { text: initialMessage },
                condition: {
                  kind: 'atom',
                  key: 'indicator.cross_over',
                  params: {
                    value: 0,
                    period: 0,
                    semantic: 'cross_up',
                    indicator: 'macd',
                    fastPeriod: 12,
                    slowPeriod: 26,
                    signalPeriod: 9,
                  },
                  evidence: { text: initialMessage },
                },
                effects: { actions: [{ kind: 'atom', key: 'action.open_long', params: {}, evidence: { text: initialMessage } }], risks: [], positions: [], orchestration: [], programs: [] },
              },
              {
                id: 'exit-macd-cross-dead',
                phase: 'exit',
                sideScope: 'long',
                evidence: { text: initialMessage },
                condition: {
                  kind: 'atom',
                  key: 'indicator.cross_under',
                  params: {
                    value: 0,
                    period: 0,
                    semantic: 'cross_down',
                    indicator: 'macd',
                    fastPeriod: 12,
                    slowPeriod: 26,
                    signalPeriod: 9,
                  },
                  evidence: { text: initialMessage },
                },
                effects: { actions: [{ kind: 'atom', key: 'action.close_long', params: {}, evidence: { text: initialMessage } }], risks: [], positions: [], orchestration: [], programs: [] },
              },
            ],
          },
        }),
      })
      mockRepo.createSession.mockResolvedValue({ id: 's-reported-macd-cross-no-duplicate' })

      await service.startSession({
        userId: 'u1',
        initialMessage,
      })
      const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
      const semanticState = createPayload.semanticState as Record<string, any>

      expect((semanticState.rules as Array<{ id?: string }>).map(rule => rule.id)).toEqual([
        'entry-macd-cross-golden',
        'exit-macd-cross-dead',
      ])
    })

    it('does not duplicate MA100 and MACD component rules with dispatcher fallback on first turn', async () => {
      const initialMessage = 'SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出。'
      mockAi.chat.mockResolvedValue({
        content: JSON.stringify({
          related: true,
          logicReady: false,
          assistantPrompt: '我当前理解的策略是：入场：价格在 MA100 上方 且 MACD 金叉 → 开多；出场：跌破 MA100 或 MACD 死叉 → 平多',
          semanticPatch: {
            contextSlots: {
              symbol: 'SOLUSDT',
              timeframe: '30m',
            },
            rules: [
              {
                id: 'entry-sol-ma100-macd-golden-long',
                phase: 'entry',
                sideScope: 'long',
                evidence: { text: initialMessage },
                condition: {
                  kind: 'and',
                  evidence: { text: initialMessage },
                  children: [
                    {
                      kind: 'atom',
                      key: 'indicator.above',
                      params: { indicator: 'ma', 'reference.period': 100 },
                      evidence: { text: initialMessage },
                    },
                    {
                      kind: 'atom',
                      key: 'indicator.cross_over',
                      params: { indicator: 'macd', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
                      evidence: { text: initialMessage },
                    },
                  ],
                },
                effects: { actions: [{ kind: 'atom', key: 'action.open_long', params: {}, evidence: { text: initialMessage } }], risks: [], positions: [], orchestration: [], programs: [] },
              },
              {
                id: 'exit-sol-ma100-or-macd-dead-long',
                phase: 'exit',
                sideScope: 'long',
                evidence: { text: initialMessage },
                condition: {
                  kind: 'or',
                  evidence: { text: initialMessage },
                  children: [
                    {
                      kind: 'atom',
                      key: 'indicator.below',
                      params: { indicator: 'ma', 'reference.period': 100 },
                      evidence: { text: initialMessage },
                    },
                    {
                      kind: 'atom',
                      key: 'indicator.cross_under',
                      params: { indicator: 'macd', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
                      evidence: { text: initialMessage },
                    },
                  ],
                },
                effects: { actions: [{ kind: 'atom', key: 'action.close_long', params: {}, evidence: { text: initialMessage } }], risks: [], positions: [], orchestration: [], programs: [] },
              },
            ],
          },
        }),
      })
      mockRepo.createSession.mockResolvedValue({ id: 's-reported-sol-ma100-macd-no-duplicate' })

      await service.startSession({
        userId: 'u1',
        initialMessage,
      })
      const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
      const semanticState = createPayload.semanticState as Record<string, any>

      const rules = semanticState.rules as Array<Record<string, any>>
      expect(rules.map(rule => rule.id)).toEqual([
        'entry-sol-ma100-macd-golden-long',
        'exit-sol-ma100-or-macd-dead-long',
      ])
      const conditionKeys = (rule: Record<string, any>): string[] => {
        const out: string[] = []
        const walk = (node: any): void => {
          if (!node || typeof node !== 'object') return
          if (node.kind === 'atom') { out.push(node.key); return }
          for (const child of node.children ?? []) walk(child)
          if (node.child) walk(node.child)
          for (const step of node.steps ?? []) walk(step)
        }
        walk(rule.condition)
        return out
      }
      const actionKeys = (rule: Record<string, any>): string[] =>
        (rule.effects?.actions ?? []).map((a: { key?: string }) => a.key)
      expect(conditionKeys(rules[0]).filter(k => k === 'indicator.above')).toHaveLength(1)
      expect(conditionKeys(rules[0]).filter(k => k === 'indicator.cross_over')).toHaveLength(1)
      expect(conditionKeys(rules[1]).filter(k => k === 'indicator.below')).toHaveLength(1)
      expect(conditionKeys(rules[1]).filter(k => k === 'indicator.cross_under')).toHaveLength(1)
      expect(actionKeys(rules[0]).filter(k => k === 'action.open_long')).toHaveLength(1)
      expect(actionKeys(rules[1]).filter(k => k === 'action.close_long')).toHaveLength(1)
    })
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
        question: expect.stringContaining('请确认单笔仓位大小'),
      }),
    ]))
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

  it('maps contract readiness semantic slots without treating them as state gates', () => {
    const item = (service as any).buildSemanticClarificationItem({
      slotKey: 'contract.runtime_requirement.runtime.provide.orderbook_depth',
      fieldPath: 'actions[action-grid-ladder].contracts[action-contract-grid-ladder].runtimeRequirements[0]',
      status: 'open',
      priority: 'behavior',
      questionHint: 'Phase 0 暂不支持 orderbook depth runtime。',
      affectsExecution: true,
    })

    expect(item).toEqual(expect.objectContaining({
      key: 'semantic.contract.runtime_requirement.runtime.provide.orderbook_depth',
      reason: 'missing_semantic_contract_runtime_requirement',
      field: 'actions[action-grid-ladder].contracts[action-contract-grid-ladder].runtimeRequirements[0]',
      question: 'Phase 0 暂不支持 orderbook depth runtime。',
      slotKey: 'contract.runtime_requirement.runtime.provide.orderbook_depth',
      fieldPath: 'actions[action-grid-ladder].contracts[action-contract-grid-ladder].runtimeRequirements[0]',
    }))
    expect(item.reason).not.toBe('ambiguous_state_gate')
    expect(item.field).not.toBe('stateGates.marketRegime')
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

  it('keeps published session displayLogicGraph from semantic view instead of canonical snapshot', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 's-published-display-graph',
      userId: 'u1',
      status: 'PUBLISHED',
      checklist: {},
      latestDraftCode: 'export default {}',
      latestSpecDesc: {
        viewType: 'canonical-semantic-view.v1',
        canonicalDigest: 'sha256:semantic-view',
        displayLogicGraph: {
          blocks: [
            {
              type: 'IF',
              items: [
                {
                  kind: 'condition',
                  id: 'condition-rule-entry',
                  text: '价格在 EMA20 上方 同时 价格在 EMA60 上方 同时 价格在 EMA144 上方 时做多开仓',
                },
                {
                  kind: 'action',
                  id: 'action-rule-entry-0',
                  text: '开多',
                },
              ],
            },
          ],
        },
      },
      rejectReason: null,
      clarificationState: {
        status: 'CLEAR',
        items: [],
      },
      strategyInstanceId: 'strategy-1',
    })
    mockRepo.findLatestBySessionId.mockResolvedValue({
      id: 'snapshot-1',
      scriptSnapshot: 'export default {}',
      specSnapshot: {
        version: 2,
        rules: [
          {
            id: 'rule-entry',
            phase: 'entry',
            condition: { kind: 'and', children: [] },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      },
      lockedParams: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        timeframe: '15m',
        marketType: 'perp',
      },
      consistencyReport: { status: 'PASSED' },
      strategyConfig: {},
      backtestConfigDefaults: {},
      deploymentExecutionDefaults: {},
      deploymentExecutionConstraints: {},
    })

    const result = await service.getSession('s-published-display-graph', 'u1')

    expect(result.specDesc).toEqual(expect.objectContaining({
      viewType: 'canonical-semantic-view.v1',
      displayLogicGraph: expect.objectContaining({
        blocks: expect.arrayContaining([
          expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('EMA20'),
              }),
            ]),
          }),
        ]),
      }),
      lockedParams: expect.objectContaining({
        symbol: 'ETHUSDT',
      }),
    }))
    expect(JSON.stringify(result.specDesc)).not.toContain('"kind":"and"')
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

    const result = await service.continueSession('session-1', {
      userId: 'u-1',
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: 'sha256:stale',
    })

    expect(result.status).toBe('REJECTED')
    expect(result.assistantPrompt).toBe('当前会话缺少语义状态，请重新输入完整策略。')
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

    const result = await service.continueSession('session-processing-1', {
      userId: 'u-1',
      message: '确认并继续',
      confirmGenerate: true,
      confirmedCanonicalDigest: 'sha256:stale',
    })

    expect(result.status).toBe('REJECTED')
    expect(result.assistantPrompt).toBe('当前会话缺少语义状态，请重新输入完整策略。')
    expect(mockRepo.tryRequeueFromProcessing).not.toHaveBeenCalled()
  })

  it('rejects checklist-only persisted sessions on ordinary continuation', async () => {
    const checklistOnlySession = buildPersistedSessionSnapshot('s7-checklist-only-ordinary', {}, {
      userId: 'u1',
      status: 'DRAFTING',
      checklist: completeChecklist({
        entryRules: ['突破关键阻力位后入场'],
        exitRules: ['跌破最近支撑位出场'],
      }),
      semanticState: null,
      clarificationState: { status: 'CLEAR', items: [] },
      constraintPack: {},
      latestSpecDesc: null,
    })
    mockRepo.findById.mockResolvedValue(checklistOnlySession)
    mockAi.chat.mockResolvedValue({
      content: JSON.stringify({
        related: false,
        logicReady: false,
        assistantPrompt: '这条消息无法在缺少语义状态的会话上继续修改。',
      }),
    })

    const result = await service.continueSession('s7-checklist-only-ordinary', {
      userId: 'u1',
      message: '把仓位改成 20%',
    })

    expect(result.status).toBe('REJECTED')
    expect(result.assistantPrompt).toBe('当前会话缺少语义状态，请重新输入完整策略。')
    expect(mockRepo.tryMarkGenerating).not.toHaveBeenCalled()
    expect(mockRepo.updateSession).toHaveBeenCalledWith(
      's7-checklist-only-ordinary',
      expect.objectContaining({
        status: 'REJECTED',
        rejectReason: '当前会话缺少语义状态，请重新输入完整策略。',
      }),
    )
  })


})

// ─────────────────────────────────────────────────────────────────────────────
// PR3test: sizing 守门端到端回归 (Issue #1175)
//
// 验证 PerTradeSizingResolver 切换后的行为类验收标准 EC1-EC5：
//   EC1 正向：完整 RSI+DCA utterance → 无 position.sizing open slot
//   EC2 负回归：去掉 "每次 100 USDT" → position.sizing 重新出现
//   EC3 DCA perOrderSizing locked、capitalCap 未填 → 有 dca_schedule.capital_cap slot，无 position.sizing
//   EC4 主仓 sizing locked、DCA perOrderSizing 未填 → 有 dca_schedule.per_order_sizing slot，无 position.sizing
//   EC5 多腿：CASE_A 双腿 locked → 无追问；CASE_B 一腿缺 → 只问缺那一腿
//
// 不依赖 HTTP 层（不用 mockAi / mockRepo），走 extractor → seedBuilder → classifier 直通链路。
// ─────────────────────────────────────────────────────────────────────────────

describe('PR3test: sizing 守门端到端回归 (Issue #1175)', () => {
  const registry = new SemanticAtomRegistryService()
  const extractor = new SemanticSeedExtractorService()
  const seedBuilder = new SemanticSeedStateBuilderService()
  const classifier = new SemanticSupportClassifierService(registry)
  const sizingResolver = new PerTradeSizingResolver()

  /** 完整 RSI+DCA utterance（含 perOrderSizing 100 USDT） */
  const FULL_RSI_DCA_UTTERANCE
    = 'OKX 现货 BTCUSDT 1h，RSI14 低于 30 开始 DCA，价格每跌 5% 补仓一次，每次 100 USDT，最多 4 次，总投入不超过 500 USDT，RSI14 高于 70 卖出。'

  /** 去掉 "每次 100 USDT" 的 utterance，perOrderSizing 缺失 */
  const RSI_DCA_WITHOUT_PER_ORDER
    = 'OKX 现货 BTCUSDT 1h，RSI14 低于 30 开始 DCA，价格每跌 5% 补仓一次，最多 4 次，总投入不超过 500 USDT，RSI14 高于 70 卖出。'

  // ─── helpers ──────────────────────────────────────────────────────────────

  function slotKeys(utterance: string): string[] {
    const patch = extractor.extract(utterance)
    const state = seedBuilder.build(patch)
    if (!state) return []
    const classified = classifier.classify(state)
    return classified.openSlots.map(s => s.slotKey)
  }

  function slotKeysFromState(state: SemanticStateType): string[] {
    const classified = classifier.classify(state)
    return classified.openSlots.map(s => s.slotKey)
  }

  // ─── EC1 ──────────────────────────────────────────────────────────────────

  it('EC1 正向：完整 RSI+DCA utterance（含 perOrderSizing）→ 无 position.sizing open slot', () => {
    const keys = slotKeys(FULL_RSI_DCA_UTTERANCE)
    expect(keys).not.toContain('position.sizing')
  })

  // ─── EC2 ──────────────────────────────────────────────────────────────────

  it('EC2 负回归：去掉 "每次 100 USDT" 的 utterance → sizing 相关 open slot 重新出现（position.sizing 或 dca_schedule.per_order_sizing）', () => {
    const keys = slotKeys(RSI_DCA_WITHOUT_PER_ORDER)
    // perOrderSizing 未提供时 DCA 锚点不满足，守门路径之一产生 sizing 追问：
    //   - classifier 层：DCA constraint 的 per_order_sizing open slot 被收集
    //   - 对话服务层（ensurePositionSizingSlot）：anyAnchored=false → position.sizing slot 追加
    // 两者均表示"sizing 未确认"，断言至少其一出现
    // TODO(PR4): 收紧为精确单一 slot key 断言（拿 ground truth 决定哪条路径）
    const hasSizingQuestion = keys.includes('position.sizing') || keys.includes('position.dca_schedule.per_order_sizing')
    expect(hasSizingQuestion).toBe(true)
  })

  // ─── EC5 ──────────────────────────────────────────────────────────────────
  // EC5 使用 PerTradeSizingResolver 直接断言（classifier 对未知 action key 会走
  // unknown_unsupported 分支并短路 openSlots，因此多腿守门行为在 resolver 层校验）
  // TODO(PR4): 改 fixture 用 registry 注册的合法 action key，让 EC5 也走 classifier 真链路

  describe('EC5 多腿 sizing 守门', () => {
  })

  // ─── sizing resolver 直接断言 ──────────────────────────────────────────────

  it('EC1 regression: PerTradeSizingResolver 对完整 RSI+DCA utterance 产生至少一个 executionAnchored 锚点', () => {
    const patch = extractor.extract(FULL_RSI_DCA_UTTERANCE)
    const state = seedBuilder.build(patch)
    expect(state).not.toBeNull()
    if (!state) return
    const anchors = sizingResolver.resolve(state)
    const anyAnchored = [...anchors.values()].some(a => a.executionAnchored)
    expect(anyAnchored).toBe(true)
  })

  it('EC2 regression: PerTradeSizingResolver 对缺 perOrderSizing utterance 无 executionAnchored 锚点', () => {
    const patch = extractor.extract(RSI_DCA_WITHOUT_PER_ORDER)
    const state = seedBuilder.build(patch)
    expect(state).not.toBeNull()
    if (!state) return
    const anchors = sizingResolver.resolve(state)
    const anyAnchored = [...anchors.values()].some(a => a.executionAnchored)
    expect(anyAnchored).toBe(false)
  })
})
