import type { AtomExprAtom, SemanticRule } from '../../types/atom-expr'
import type { SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CanonicalSpecV2DigestService } from '../canonical-spec-v2-digest.service'
import { CodegenPublicationGenerationStage } from '../codegen-publication-generation.stage'
import { CodegenGraphSnapshotService } from '../codegen-graph-snapshot.service'
import { CompiledPublicationGateService } from '../compiled-publication-gate.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'
import { SpecDescBuilderService } from '../spec-desc-builder.service'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { StrategyConsistencyService } from '../strategy-consistency.service'
import { StrategySummaryBuilderService } from '../strategy-summary-builder.service'
import { bollingerGoldenCase, maGoldenCase } from './fixtures/semantic-state-golden-cases'

describe('codegenPublicationGenerationStage', () => {
  const passingSemanticAtomInvariant = () => ({
    validate: jest.fn().mockReturnValue([]),
  })

  const completeRiskRules = (riskRules: Record<string, unknown> = {}) => ({
    exchange: 'okx',
    marketType: 'perp',
    positionPct: 10,
    stopLossPct: 5,
    stopLossBasis: 'entry_avg_price',
    takeProfitPct: 10,
    takeProfitBasis: 'entry_avg_price',
    ...riskRules,
  })

  const atom = (key: string, params: Record<string, unknown> = {}): AtomExprAtom => ({
    kind: 'atom',
    key,
    params,
  })

  const rule = (input: {
    id: string
    phase: SemanticRule['phase']
    sideScope?: SemanticRule['sideScope']
    condition: SemanticRule['condition']
    actions?: AtomExprAtom[]
    risks?: AtomExprAtom[]
    positions?: AtomExprAtom[]
  }): SemanticRule => ({
    id: input.id,
    phase: input.phase,
    sideScope: input.sideScope,
    condition: input.condition,
    effects: {
      actions: input.actions ?? [],
      risks: input.risks ?? [],
      positions: input.positions ?? [],
      orchestration: [],
      programs: [],
    },
  })

  const buildTypedRulesSemanticState = (): SemanticState => ({
    ...buildLockedBollingerSemanticState(),
    trigger: [],
    action: [],
    risk: [],
    position: null,
    rules: [{
      id: 'rule-entry-long',
      phase: 'entry',
      sideScope: 'long',
      condition: {
        kind: 'atom',
        key: 'execution.on_start',
        params: {},
      },
      effects: {
        actions: [{
          kind: 'atom',
          key: 'action.open_long',
          params: {},
        }],
        risks: [],
        positions: [{
          kind: 'atom',
          key: 'position.per_order_budget',
          params: { value: 25, asset: 'USDT' },
        }],
        orchestration: [],
        programs: [],
      },
    }],
  } as SemanticState)

  const buildLockedMaSemanticState = (): SemanticState => ({
    version: 1,
    families: ['single-leg'],
    trigger: [
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
          'reference.period': 10,
          confirmationMode: 'close_confirm',
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    ],
    action: [
      { id: 'action-open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
      { id: 'action-close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
    ],
    rules: [
      rule({
        id: 'rule-entry-ma',
        phase: 'entry',
        sideScope: 'long',
        condition: atom('indicator.above', {
          indicator: 'ma',
          referenceRole: 'long_term',
          'reference.period': 50,
          confirmationMode: 'close_confirm',
        }),
        actions: [atom('action.open_long')],
        risks: [
          atom('risk.stop_loss_pct', { valuePct: 5, basis: 'entry_avg_price' }),
          atom('risk.take_profit_pct', { valuePct: 10, basis: 'entry_avg_price' }),
        ],
      }),
      rule({
        id: 'rule-exit-ma',
        phase: 'exit',
        sideScope: 'long',
        condition: atom('indicator.below', {
          indicator: 'ma',
          referenceRole: 'short_term',
          'reference.period': 10,
          confirmationMode: 'close_confirm',
        }),
        actions: [atom('action.close_long')],
      }),
    ],
    risk: [
      {
        id: 'risk-stop-loss',
        key: 'risk.stop_loss_pct',
        params: { valuePct: 5, basis: 'entry_avg_price' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      {
        id: 'risk-take-profit',
        key: 'risk.take_profit_pct',
        params: { valuePct: 10, basis: 'entry_avg_price' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    ],
    position: {
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
    },
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: {
      exchange: {
        slotKey: 'exchange',
        fieldPath: 'contextSlots.exchange',
        value: 'okx',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认交易所。',
        affectsExecution: true,
      },
      symbol: {
        slotKey: 'symbol',
        fieldPath: 'contextSlots.symbol',
        value: 'BTCUSDT',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认交易标的。',
        affectsExecution: true,
      },
      marketType: {
        slotKey: 'marketType',
        fieldPath: 'contextSlots.marketType',
        value: 'spot',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认市场类型。',
        affectsExecution: true,
      },
      timeframe: {
        slotKey: 'timeframe',
        fieldPath: 'contextSlots.timeframe',
        value: '15m',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认周期。',
        affectsExecution: true,
      },
    },
    normalizationNotes: [],
    updatedAt: '2026-04-15T10:00:00.000Z',
  })

  const buildLockedCloseOpenExpressionSemanticState = (): SemanticState => ({
    version: 1,
    families: ['single-leg'],
    trigger: [
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
    action: [
      { id: 'action-open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
      { id: 'action-close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
    ],
    rules: [
      rule({
        id: 'rule-entry-close-gt-open',
        phase: 'entry',
        sideScope: 'long',
        condition: atom('condition.expression', {
          expression: {
            kind: 'predicate',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'series', source: 'bar', field: 'open' },
          },
        }),
        actions: [atom('action.open_long')],
        positions: [atom('position.per_order_budget', { value: 10, asset: 'USDT' })],
      }),
      rule({
        id: 'rule-exit-close-lt-open',
        phase: 'exit',
        sideScope: 'long',
        condition: atom('condition.expression', {
          expression: {
            kind: 'predicate',
            op: 'LT',
            left: { kind: 'series', source: 'bar', field: 'close' },
            right: { kind: 'series', source: 'bar', field: 'open' },
          },
        }),
        actions: [atom('action.close_long')],
      }),
      rule({
        id: 'rule-gate-no-position',
        phase: 'gate',
        sideScope: 'long',
        condition: atom('condition.expression', {
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
        }),
        actions: [],
      }),
    ],
    risk: [],
    position: {
      mode: 'fixed_quote',
      value: 10,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
    },
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: {
      exchange: {
        slotKey: 'exchange',
        fieldPath: 'contextSlots.exchange',
        value: 'okx',
        status: 'locked',
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
        value: 'perp',
        status: 'locked',
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
    },
    normalizationNotes: [],
    updatedAt: '2026-04-28T00:00:00.000Z',
  })

  const buildLockedBollingerSemanticState = (): SemanticState => ({
    version: 1,
    families: ['single-leg'],
    trigger: [
      {
        id: 'entry-bollinger-upper',
        key: 'bollinger.touch_upper',
        phase: 'entry',
        params: {
          indicator: 'bollinger',
          period: 30,
          stdDev: 2.5,
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
          period: 30,
          stdDev: 2.5,
          confirmationMode: 'close_confirm',
        },
        sideScope: 'short',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    ],
    action: [
      { id: 'action-open-short', key: 'open_short', status: 'locked', source: 'user_explicit' },
      { id: 'action-close-short', key: 'close_short', status: 'locked', source: 'user_explicit' },
    ],
    rules: [
      rule({
        id: 'rule-entry-bollinger',
        phase: 'entry',
        sideScope: 'short',
        condition: atom('bollinger.touch_upper', {
          indicator: 'bollinger',
          period: 30,
          stdDev: 2.5,
          confirmationMode: 'close_confirm',
        }),
        actions: [atom('action.open_short')],
      }),
      rule({
        id: 'rule-exit-bollinger',
        phase: 'exit',
        sideScope: 'short',
        condition: atom('bollinger.touch_middle', {
          indicator: 'bollinger',
          period: 30,
          stdDev: 2.5,
          confirmationMode: 'close_confirm',
        }),
        actions: [atom('action.close_short')],
      }),
    ],
    risk: [],
    position: {
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'short_only',
      status: 'locked',
      source: 'user_explicit',
    },
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: {
      exchange: {
        slotKey: 'exchange',
        fieldPath: 'contextSlots.exchange',
        value: 'okx',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认交易所。',
        affectsExecution: true,
      },
      symbol: {
        slotKey: 'symbol',
        fieldPath: 'contextSlots.symbol',
        value: 'BTCUSDT',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认交易标的。',
        affectsExecution: true,
      },
      marketType: {
        slotKey: 'marketType',
        fieldPath: 'contextSlots.marketType',
        value: 'perp',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认市场类型。',
        affectsExecution: true,
      },
      timeframe: {
        slotKey: 'timeframe',
        fieldPath: 'contextSlots.timeframe',
        value: '15m',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认周期。',
        affectsExecution: true,
      },
    },
    normalizationNotes: [],
    updatedAt: '2026-04-15T10:00:00.000Z',
  })

  const buildLockedGridSemanticState = (): SemanticState => ({
    version: 1,
    families: ['grid.range_rebalance'],
    trigger: [
      {
        id: 'grid-entry',
        key: 'grid.range_rebalance',
        phase: 'entry',
        sideScope: 'both',
        params: {
          rangeLower: 60000,
          rangeUpper: 80000,
          stepPct: 1,
          sideMode: 'bidirectional',
          recycle: true,
          breakoutAction: 'pause',
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    ],
    action: [],
    rules: [
      rule({
        id: 'rule-grid-range-rebalance',
        phase: 'entry',
        sideScope: 'both',
        condition: atom('grid.range_rebalance', {
          rangeLower: 60000,
          rangeUpper: 80000,
          stepPct: 1,
          sideMode: 'bidirectional',
          recycle: true,
          breakoutAction: 'pause',
        }),
        actions: [],
      }),
    ],
    risk: [],
    position: {
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
    },
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: {
      exchange: {
        slotKey: 'exchange',
        fieldPath: 'contextSlots.exchange',
        value: 'okx',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认交易所。',
        affectsExecution: true,
      },
      symbol: {
        slotKey: 'symbol',
        fieldPath: 'contextSlots.symbol',
        value: 'BTCUSDT',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认交易标的。',
        affectsExecution: true,
      },
      marketType: {
        slotKey: 'marketType',
        fieldPath: 'contextSlots.marketType',
        value: 'perp',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认市场类型。',
        affectsExecution: true,
      },
      timeframe: {
        slotKey: 'timeframe',
        fieldPath: 'contextSlots.timeframe',
        value: '15m',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认周期。',
        affectsExecution: true,
      },
    },
    normalizationNotes: [],
    updatedAt: '2026-04-15T10:00:00.000Z',
  })

  const buildPreviousCloseRiseSemanticState = (): SemanticState => ({
    version: 1,
    families: ['single-leg'],
    trigger: [
      {
        id: 'entry-on-start',
        key: 'execution.on_start',
        phase: 'entry',
        sideScope: 'long',
        params: { timing: 'on_start', orderType: 'market', occurrence: 'once' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      {
        id: 'exit-rise-prev-close',
        key: 'price.percent_change',
        phase: 'exit',
        sideScope: 'long',
        params: { direction: 'up', valuePct: 1, basis: 'prev_close', window: '1h' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    ],
    action: [
      { id: 'action-open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
      { id: 'action-close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
    ],
    rules: [
      rule({
        id: 'rule-entry-on-start',
        phase: 'entry',
        sideScope: 'long',
        condition: atom('execution.on_start', { timing: 'on_start', orderType: 'market', occurrence: 'once' }),
        actions: [atom('action.open_long')],
        risks: [
          atom('risk.stop_loss_pct', { valuePct: 5, basis: 'entry_avg_price' }),
          atom('risk.take_profit_pct', { valuePct: 10, basis: 'entry_avg_price' }),
        ],
      }),
      rule({
        id: 'rule-exit-rise-prev-close',
        phase: 'exit',
        sideScope: 'long',
        condition: atom('price.percent_change', { direction: 'up', valuePct: 1, basis: 'prev_close', window: '1h' }),
        actions: [atom('action.close_long')],
      }),
    ],
    risk: [
      {
        id: 'risk-stop-loss',
        key: 'risk.stop_loss_pct',
        params: { valuePct: 5, basis: 'entry_avg_price' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      {
        id: 'risk-take-profit',
        key: 'risk.take_profit_pct',
        params: { valuePct: 10, basis: 'entry_avg_price' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    ],
    position: {
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
    },
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: {
      exchange: {
        slotKey: 'exchange',
        fieldPath: 'contextSlots.exchange',
        value: 'okx',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认交易所。',
        affectsExecution: true,
      },
      symbol: {
        slotKey: 'symbol',
        fieldPath: 'contextSlots.symbol',
        value: 'ORDIUSDT',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认交易标的。',
        affectsExecution: true,
      },
      marketType: {
        slotKey: 'marketType',
        fieldPath: 'contextSlots.marketType',
        value: 'spot',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认市场类型。',
        affectsExecution: true,
      },
      timeframe: {
        slotKey: 'timeframe',
        fieldPath: 'contextSlots.timeframe',
        value: '1h',
        status: 'locked',
        priority: 'context',
        questionHint: '请确认周期。',
        affectsExecution: true,
      },
    },
    normalizationNotes: [],
    updatedAt: '2026-04-23T00:00:00.000Z',
  })

  it('keeps clarified bollinger middle-band summaries aligned through generation', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const consistencyEvaluate = jest.fn().mockReturnValue({
      status: 'PASSED',
      specProfile: {
        indicators: [{ kind: 'bollingerBands', params: { period: 20, multiplier: 2 } }],
        actions: ['OPEN_SHORT', 'CLOSE_SHORT'],
        ruleMappings: [
          { key: 'bollinger.upper_break', action: 'OPEN_SHORT' },
          { key: 'bollinger.middle_revert', action: 'CLOSE_SHORT' },
        ],
        rules: [],
        sizing: { mode: 'RATIO', value: 0.1, source: 'literal' },
        requiredParams: [],
        fallbackDetected: false,
      },
      scriptProfile: {
        indicators: [{ kind: 'bollingerBands', params: { period: 20, multiplier: 2 } }],
        actions: ['OPEN_SHORT', 'CLOSE_SHORT'],
        ruleMappings: [
          { key: 'bollinger.upper_break', action: 'OPEN_SHORT' },
          { key: 'bollinger.middle_revert', action: 'CLOSE_SHORT' },
        ],
        rules: [],
        sizing: { mode: 'RATIO', value: 0.1, source: 'literal' },
        requiredParams: [],
        fallbackDetected: false,
      },
      checks: [],
      summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
    })

    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      { buildFromCanonicalSpec: jest.fn().mockReturnValue({}) } as any,
      strategySummaryBuilder as any,
      { evaluate: consistencyEvaluate } as any,
      { compile: jest.fn().mockReturnValue({ ir: { id: 'compiled-ir' } }) } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
    )

    const semanticState = buildLockedBollingerSemanticState()
    const artifacts = await stage.generate({ semanticState })

    expect(consistencyEvaluate).toHaveBeenCalledWith(expect.objectContaining({
      canonicalSpec: expect.any(Object),
      scriptCode: 'strategy',
    }))
    expect(consistencyEvaluate).not.toHaveBeenCalledWith(expect.objectContaining({
      userIntentSummary: expect.anything(),
    }))
    expect(artifacts.userIntentSummary.indicators).toEqual([])
    expect(artifacts.strategySummary.indicators).toEqual(['bollingerBands'])
    expect(artifacts.scriptSummary.indicators).toEqual(['bollingerBands'])
    expect(artifacts.sessionSpecDesc.summaryObservation).toEqual(expect.objectContaining({
      status: 'drifted',
    }))
  })

  it('skips semantic consistency evaluation when compiled script structural validation fails', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const consistencyEvaluate = jest.fn().mockImplementation(() => {
      throw new Error('semantic parser should not run')
    })

    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      { buildFromCanonicalSpec: jest.fn().mockReturnValue({}) } as any,
      strategySummaryBuilder as any,
      { evaluate: consistencyEvaluate } as any,
      { compile: jest.fn().mockReturnValue({ ir: { id: 'compiled-ir' } }) } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('invalid compiled script') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockImplementation(() => { throw new Error('invalid compiled manifest') }) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
    )

    const artifacts = await stage.generate({
      semanticState: buildLockedBollingerSemanticState(),
    })

    expect(artifacts.validation.passed).toBe(false)
    expect(consistencyEvaluate).not.toHaveBeenCalled()
    expect(artifacts.semanticConsistency).toEqual(expect.objectContaining({
      status: 'FAILED',
      specProfile: expect.any(Object),
      scriptProfile: expect.any(Object),
      checks: expect.arrayContaining([
        expect.objectContaining({
          key: 'script.structural_validation',
          status: 'failed',
        }),
      ]),
      summary: expect.objectContaining({ criticalFailed: 1 }),
    }))
    expect(artifacts.sessionSpecDesc).not.toHaveProperty('stage1ConsistencyEvidence')
  })

  it('throws with gate result when rules-only hash chain blocks after script generation', async () => {
    const blockedGate = {
      assertClarificationResolvedForIrBuild: jest.fn(),
      validateRulesOnlyHashChain: jest.fn().mockReturnValue({
        passed: false,
        blocked: true,
        reason: 'rules_only_trace_missing',
        hashes: {
          rulesHash: 'r',
          canonicalSpecHash: 'c',
          irHash: 'i',
          astHash: 'a',
          scriptHash: 's',
        },
        checks: [{ key: 'trace.ir', passed: false }],
      }),
    }
    const stage = new CodegenPublicationGenerationStage(
      new CanonicalSpecBuilderService(),
      { buildFromCanonicalSpec: jest.fn().mockReturnValue({}) } as any,
      new StrategySummaryBuilderService(new ScriptProfileExtractorService()) as any,
      { evaluate: jest.fn() } as any,
      { compile: jest.fn().mockReturnValue({ ir: { id: 'compiled-ir' } }) } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
      undefined,
      blockedGate as any,
    )
    const semanticState = buildLockedBollingerSemanticState()
    const canonicalSpecOverride = new CanonicalSpecBuilderService().buildFromSemanticState(semanticState)

    let caught: unknown = null
    try {
      await stage.generate({
        semanticState: {
          ...semanticState,
          rules: [{
            id: 'rule-entry',
            phase: 'entry',
            condition: { kind: 'atom', key: 'price.above' },
            effects: { actions: [], risks: [], positions: [], orchestration: [], programs: [] },
          }],
        } as any,
        canonicalSpecOverride,
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toContain('rules_only_trace_missing')
    expect((caught as { publicationGate?: unknown }).publicationGate).toEqual(
      expect.objectContaining({ reason: 'rules_only_trace_missing' }),
    )
    expect(blockedGate.validateRulesOnlyHashChain).toHaveBeenCalledTimes(1)
  })

  it('persists rules-only hash chain in sessionSpecDesc when gate passes', async () => {
    const hashChain = {
      passed: true,
      blocked: false,
      hashes: {
        rulesHash: 'rules-hash',
        canonicalSpecHash: 'canonical-hash',
        irHash: 'ir-hash',
        astHash: 'ast-hash',
        scriptHash: 'script-hash',
      },
      checks: [{ key: 'trace.ir', passed: true }],
    }
    const stage = new CodegenPublicationGenerationStage(
      new CanonicalSpecBuilderService(),
      { buildFromCanonicalSpec: jest.fn().mockReturnValue({}) } as any,
      new StrategySummaryBuilderService(new ScriptProfileExtractorService()) as any,
      {
        evaluate: jest.fn().mockReturnValue({
          status: 'PASSED',
          specProfile: { indicators: [], actions: [], ruleMappings: [], rules: [], sizing: null, requiredParams: [], fallbackDetected: false },
          scriptProfile: { indicators: [], actions: [], ruleMappings: [], rules: [], sizing: null, requiredParams: [], fallbackDetected: false },
          checks: [],
          summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
        }),
      } as any,
      { compile: jest.fn().mockReturnValue({ ir: { id: 'compiled-ir' } }) } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
      undefined,
      {
        assertClarificationResolvedForIrBuild: jest.fn(),
        validateRulesOnlyHashChain: jest.fn().mockReturnValue(hashChain),
      } as any,
    )
    const semanticState = buildLockedBollingerSemanticState()
    const canonicalSpecOverride = new CanonicalSpecBuilderService().buildFromSemanticState(semanticState)

    const artifacts = await stage.generate({
      semanticState: {
        ...semanticState,
        rules: [{
          id: 'rule-entry',
          phase: 'entry',
          condition: { kind: 'atom', key: 'price.above' },
          effects: { actions: [], risks: [], positions: [], orchestration: [], programs: [] },
        }],
      } as any,
      canonicalSpecOverride,
    })

    expect(artifacts.rulesOnlyHashChain).toBe(hashChain)
    expect(artifacts.sessionSpecDesc.rulesOnlyHashChain).toBe(hashChain)
    expect(artifacts.sessionSpecDesc.stage1ConsistencyEvidence).toEqual(hashChain.hashes)
  })

  it('passes rules-only hash gate with canonicalSpec produced by real semantic builder', async () => {
    const semanticState = buildTypedRulesSemanticState()
    const stage = new CodegenPublicationGenerationStage(
      new CanonicalSpecBuilderService(),
      { buildFromCanonicalSpec: jest.fn().mockReturnValue({}) } as any,
      new StrategySummaryBuilderService(new ScriptProfileExtractorService()) as any,
      {
        evaluate: jest.fn().mockReturnValue({
          status: 'PASSED',
          specProfile: { indicators: [], actions: [], ruleMappings: [], rules: [], sizing: null, requiredParams: [], fallbackDetected: false },
          scriptProfile: { indicators: [], actions: [], ruleMappings: [], rules: [], sizing: null, requiredParams: [], fallbackDetected: false },
          checks: [],
          summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
        }),
      } as any,
      new CanonicalSpecV2IrCompilerService(),
      new CanonicalStrategyAstCompilerService(),
      new CompiledScriptEmitterService(),
      new CompiledScriptExecutionEnvelopeService(),
      new CompiledScriptParserService(),
      undefined,
      passingSemanticAtomInvariant() as any,
      undefined,
      new CompiledPublicationGateService(
        { create: jest.fn() } as never,
        { withTransaction: (cb: () => Promise<unknown>) => cb() } as never,
      ),
    )

    const artifacts = await stage.generate({ semanticState })

    expect(artifacts.rulesOnlyHashChain).toEqual(expect.objectContaining({
      passed: true,
      blocked: false,
    }))
    expect(artifacts.sessionSpecDesc.rulesOnlyHashChain).toEqual(expect.objectContaining({
      checks: expect.arrayContaining([
        expect.objectContaining({ key: 'hash.canonical.rulesHash', passed: true }),
      ]),
    }))
  })

  it('blocks publication generation when rules-only semanticState has empty rules', async () => {
    const gate = {
      assertClarificationResolvedForIrBuild: jest.fn(),
      validateRulesOnlyHashChain: jest.fn(),
    }
    const stage = new CodegenPublicationGenerationStage(
      new CanonicalSpecBuilderService(),
      { buildFromCanonicalSpec: jest.fn().mockReturnValue({}) } as any,
      new StrategySummaryBuilderService(new ScriptProfileExtractorService()) as any,
      { evaluate: jest.fn() } as any,
      { compile: jest.fn().mockReturnValue({ ir: { id: 'compiled-ir' } }) } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
      undefined,
      gate as any,
    )
    const semanticState = buildLockedBollingerSemanticState()

    await expect(stage.generate({
      semanticState: { ...semanticState, rules: [] } as any,
      canonicalSpecOverride: new CanonicalSpecBuilderService().buildFromSemanticState(semanticState),
    })).rejects.toMatchObject({
      publicationGate: expect.objectContaining({
        blocked: true,
        reason: 'rules_only_trace_missing',
      }),
    })
    expect(gate.validateRulesOnlyHashChain).not.toHaveBeenCalled()
  })

  it('blocks publication generation when rules-only semanticState uses legacy effects array', async () => {
    const gate = {
      assertClarificationResolvedForIrBuild: jest.fn(),
      validateRulesOnlyHashChain: jest.fn(),
    }
    const stage = new CodegenPublicationGenerationStage(
      new CanonicalSpecBuilderService(),
      { buildFromCanonicalSpec: jest.fn().mockReturnValue({}) } as any,
      new StrategySummaryBuilderService(new ScriptProfileExtractorService()) as any,
      { evaluate: jest.fn() } as any,
      { compile: jest.fn().mockReturnValue({ ir: { id: 'compiled-ir' } }) } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
      undefined,
      gate as any,
    )
    const semanticState = buildLockedBollingerSemanticState()

    await expect(stage.generate({
      semanticState: {
        ...semanticState,
        rules: [{ id: 'rule-entry', phase: 'entry', condition: { kind: 'atom', key: 'price.above' }, effects: [] }],
      } as any,
      canonicalSpecOverride: new CanonicalSpecBuilderService().buildFromSemanticState(semanticState),
    })).rejects.toMatchObject({
      publicationGate: expect.objectContaining({
        blocked: true,
        reason: 'rules_only_trace_missing',
      }),
    })
    expect(gate.validateRulesOnlyHashChain).not.toHaveBeenCalled()
  })

  it('routes semantic-state publication through semantic canonical compilation', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const semanticState = buildLockedGridSemanticState()
    const legacyBuildSpy = jest.spyOn(canonicalSpecBuilder, 'buildFromLegacyChecklistForTestsOnly')
    const buildFromNormalizedIntentSpy = jest.spyOn(canonicalSpecBuilder, 'buildFromNormalizedIntent')
    const buildFromSemanticStateSpy = jest.spyOn(canonicalSpecBuilder, 'buildFromSemanticState')
    const executionEnvelopeBuild = jest.fn().mockReturnValue({})

    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      { buildFromCanonicalSpec: jest.fn().mockReturnValue({}) } as any,
      strategySummaryBuilder as any,
      { evaluate: jest.fn().mockReturnValue({
        status: 'PASSED',
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
        checks: [],
        summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
      }) } as any,
      { compile: jest.fn().mockReturnValue({ ir: { id: 'compiled-ir' }, graphSnapshot: {} }) } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: executionEnvelopeBuild } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
    )

    const artifacts = await stage.generate({ semanticState })

    expect(buildFromSemanticStateSpy).toHaveBeenCalledWith(semanticState)
    expect(buildFromNormalizedIntentSpy).not.toHaveBeenCalled()
    expect(legacyBuildSpy).not.toHaveBeenCalled()
    expect(artifacts.sessionSpecDesc.canonicalSpec).toEqual(artifacts.canonicalSpec)
    expect(artifacts.sessionSpecDesc.normalizedIntent).toEqual(expect.objectContaining({
      families: ['grid.range_rebalance'],
      triggers: [],
    }))
    expect(artifacts.semanticAtomInvariant.status).toBe('PASSED')
    expect(artifacts.sessionSpecDesc.semanticAtomInvariant).toEqual(artifacts.semanticAtomInvariant)
    expect(JSON.stringify(artifacts.sessionSpecDesc)).not.toContain('entryRules')
    expect(JSON.stringify(artifacts.sessionSpecDesc)).not.toContain('exitRules')
    expect(JSON.stringify(artifacts.sessionSpecDesc)).not.toContain('riskRules')
    expect(artifacts.canonicalSpec.market).toEqual(expect.objectContaining({
      symbol: 'BTCUSDT',
      defaultTimeframe: '15m',
      marketType: 'perp',
    }))
    expect(artifacts.canonicalSpec.dataRequirements.requiredTimeframes).toEqual(['15m'])
    expect(artifacts.canonicalSpec.rules).toEqual([])
    expect(executionEnvelopeBuild).toHaveBeenCalledWith(artifacts.canonicalSpec, 'long_only')
  })

  it('keeps spot grid execution envelope long_only instead of forcing long_short', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const semanticState = {
      ...buildLockedGridSemanticState(),
      contextSlots: {
        ...buildLockedGridSemanticState().contextSlots,
        marketType: {
          slotKey: 'marketType',
          fieldPath: 'contextSlots.marketType',
          value: 'spot',
          status: 'locked' as const,
          priority: 'context' as const,
          questionHint: '请确认市场类型。',
          affectsExecution: true,
        },
      },
    }
    const executionEnvelopeBuild = jest.fn().mockReturnValue({})

    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      { buildFromCanonicalSpec: jest.fn().mockReturnValue({}) } as any,
      strategySummaryBuilder as any,
      { evaluate: jest.fn().mockReturnValue({
        status: 'PASSED',
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
        checks: [],
        summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
      }) } as any,
      { compile: jest.fn().mockReturnValue({ ir: { id: 'compiled-ir' }, graphSnapshot: {} }) } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: executionEnvelopeBuild } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
    )

    const artifacts = await stage.generate({ semanticState })

    expect(artifacts.canonicalSpec.market.marketType).toBe('spot')
    expect(executionEnvelopeBuild).toHaveBeenCalledWith(artifacts.canonicalSpec, 'long_only')
  })

  it('rejects publication generation when a previous-close rise atom drifts before script publication', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const semanticState = buildPreviousCloseRiseSemanticState()
    const canonicalSpecOverride = canonicalSpecBuilder.buildFromSemanticState(semanticState)
    canonicalSpecOverride.rules = canonicalSpecOverride.rules.map(rule =>
      rule.phase === 'exit' && rule.actions.some(action => action.type === 'CLOSE_LONG')
        ? {
            ...rule,
            condition: {
              kind: 'atom',
              key: 'price.change_pct',
              semanticScope: 'market',
              op: 'LTE',
              value: -0.01,
              params: { timeframe: '1h', lookbackBars: 1, basis: 'prev_close' },
            },
          }
        : rule,
    )
    const emit = jest.fn().mockReturnValue('strategy')

    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      new SpecDescBuilderService(),
      new StrategySummaryBuilderService(new ScriptProfileExtractorService()),
      { evaluate: jest.fn().mockReturnValue({
        status: 'PASSED',
        specProfile: { indicators: [], actions: [], ruleMappings: [], rules: [], sizing: null, requiredParams: [], fallbackDetected: false },
        scriptProfile: { indicators: [], actions: [], ruleMappings: [], rules: [], sizing: null, requiredParams: [], fallbackDetected: false },
        checks: [],
        summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
      }) } as any,
      new CanonicalSpecV2IrCompilerService(),
      new CanonicalStrategyAstCompilerService(),
      { emit } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
    )

    const artifacts = await stage.generate({
      semanticState,
      canonicalSpecOverride,
    })

    expect(artifacts.canonicalSpec).not.toEqual(canonicalSpecOverride)
    expect(artifacts.canonicalSpec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'exit',
        condition: expect.objectContaining({
          key: 'price.change_pct',
          op: 'GTE',
        }),
      }),
    ]))
    expect(emit).toHaveBeenCalled()
  })

  it('keeps the ORDIUSDT previous-close rise exit atom stable through real publication generation', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const specDescBuilder = new SpecDescBuilderService()
    const scriptProfileExtractor = new ScriptProfileExtractorService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(scriptProfileExtractor)
    const strategyConsistencyService = new StrategyConsistencyService(scriptProfileExtractor)
    const compiledScriptParser = new CompiledScriptParserService()
    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      specDescBuilder,
      strategySummaryBuilder,
      strategyConsistencyService,
      new CanonicalSpecV2IrCompilerService(),
      new CanonicalStrategyAstCompilerService(),
      new CompiledScriptEmitterService(),
      new CompiledScriptExecutionEnvelopeService(),
      compiledScriptParser,
    )

    const artifacts = await stage.generate({
      semanticState: buildPreviousCloseRiseSemanticState(),
    })

    const exitDecision = artifacts.ast.decisionPrograms.find(program =>
      program.phase === 'exit'
      && program.actions.some(action => action.kind === 'CLOSE_LONG'),
    )
    const exitPredicate = artifacts.ast.exprPool.find(expr => expr.id === exitDecision?.when)
    const priceChangeExpr = artifacts.ast.exprPool.find(expr =>
      exitPredicate?.deps.includes(expr.id)
      && expr.nodeType === 'series'
      && expr.payload.kind === 'PRICE_CHANGE_PCT',
    )
    const constExpr = artifacts.ast.exprPool.find(expr =>
      exitPredicate?.deps.includes(expr.id)
      && expr.nodeType === 'series'
      && expr.payload.kind === 'CONST',
    )

    expect(artifacts.semanticAtomInvariant.status).toBe('PASSED')
    expect(exitDecision).toEqual(expect.objectContaining({
      phase: 'exit',
      actions: [expect.objectContaining({ kind: 'CLOSE_LONG' })],
    }))
    expect(exitPredicate).toEqual(expect.objectContaining({
      nodeType: 'predicate',
      payload: expect.objectContaining({
        kind: 'GTE',
      }),
    }))
    expect(constExpr).toEqual(expect.objectContaining({
      nodeType: 'series',
      payload: expect.objectContaining({
        kind: 'CONST',
        value: 0.01,
      }),
    }))
    expect(priceChangeExpr).toEqual(expect.objectContaining({
      nodeType: 'series',
      payload: expect.objectContaining({
        kind: 'PRICE_CHANGE_PCT',
        timeframe: '1h',
      }),
    }))
    expect(exitPredicate?.deps).toEqual(expect.arrayContaining([
      priceChangeExpr?.id,
      constExpr?.id,
    ]))
    expect(artifacts.publishParams).toEqual({
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      marketType: 'spot',
    })
  })

  it('builds strategy summary from specProfile rather than legacy canonical-spec text heuristics', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const consistencyEvaluate = jest.fn().mockReturnValue({
      status: 'PASSED',
      specProfile: {
        indicators: [{ kind: 'bollingerBands', params: { period: 20, stdDev: 2 } }],
        actions: ['OPEN_SHORT', 'CLOSE_SHORT'],
        ruleMappings: [
          { key: 'bollinger.upper_break', action: 'OPEN_SHORT' },
          { key: 'bollinger.middle_revert', action: 'CLOSE_SHORT' },
        ],
        rules: [],
        sizing: { mode: 'RATIO', value: 0.1, source: 'literal' },
        requiredParams: [],
        fallbackDetected: false,
      },
      scriptProfile: {
        indicators: [{ kind: 'bollingerBands', params: { period: 20, stdDev: 2 } }],
        actions: ['OPEN_SHORT', 'CLOSE_SHORT'],
        ruleMappings: [
          { key: 'bollinger.upper_break', action: 'OPEN_SHORT' },
          { key: 'bollinger.middle_revert', action: 'CLOSE_SHORT' },
        ],
        rules: [],
        sizing: { mode: 'RATIO', value: 0.1, source: 'literal' },
        requiredParams: [],
        fallbackDetected: false,
      },
      checks: [],
      summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
    })

    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      { buildFromCanonicalSpec: jest.fn().mockReturnValue({}) } as any,
      strategySummaryBuilder as any,
      { evaluate: consistencyEvaluate } as any,
      { compile: jest.fn().mockReturnValue({ ir: { id: 'compiled-ir' } }) } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
    )

    const artifacts = await stage.generate({
      semanticState: buildLockedBollingerSemanticState(),
    })

    expect(artifacts.strategySummary.indicators).toEqual(['bollingerBands'])
    expect(artifacts.strategySummary.entryRule).toBe('bollinger.upper_break_short')
    expect(artifacts.strategySummary.exitRule).toBe('bollinger.middle_revert')
  })

  it('records summary observation from semantic canonical summaries instead of checklist text', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const realSummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const strategySummaryBuilder = {
      buildStrategySummary: realSummaryBuilder.buildStrategySummary.bind(realSummaryBuilder),
      buildSummaryFromProfile: realSummaryBuilder.buildSummaryFromProfile.bind(realSummaryBuilder),
    }
    const consistencyEvaluate = jest.fn().mockReturnValue({
      status: 'PASSED',
      specProfile: {
        indicators: [{ kind: 'bollingerBands', params: { period: 20, stdDev: 2 } }],
        actions: ['OPEN_SHORT', 'CLOSE_SHORT'],
        ruleMappings: [
          { key: 'bollinger.upper_break', action: 'OPEN_SHORT' },
          { key: 'bollinger.middle_revert', action: 'CLOSE_SHORT' },
        ],
        rules: [],
        sizing: { mode: 'RATIO', value: 0.1, source: 'literal' },
        requiredParams: [],
        fallbackDetected: false,
      },
      scriptProfile: {
        indicators: [{ kind: 'bollingerBands', params: { period: 20, stdDev: 2 } }],
        actions: ['OPEN_SHORT', 'CLOSE_SHORT'],
        ruleMappings: [
          { key: 'bollinger.upper_break', action: 'OPEN_SHORT' },
          { key: 'bollinger.middle_revert', action: 'CLOSE_SHORT' },
        ],
        rules: [],
        sizing: { mode: 'RATIO', value: 0.1, source: 'literal' },
        requiredParams: [],
        fallbackDetected: false,
      },
      checks: [],
      summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
    })

    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      { buildFromCanonicalSpec: jest.fn().mockReturnValue({}) } as any,
      strategySummaryBuilder as any,
      { evaluate: consistencyEvaluate } as any,
      { compile: jest.fn().mockReturnValue({ ir: { id: 'compiled-ir' } }) } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
    )

    const artifacts = await stage.generate({
      semanticState: buildLockedBollingerSemanticState(),
    })

    expect(artifacts.semanticConsistency.checks.some((check: { key: string }) => check.key === 'summary.alignment')).toBe(false)
    expect(artifacts.sessionSpecDesc.summaryObservation).toEqual(expect.objectContaining({
      status: 'drifted',
    }))
  })

  it('derives publish params from canonical multi-timeframe truth instead of checklist order alone', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const compile = jest.fn().mockReturnValue({
      ir: {
        market: { timeframes: ['3m', '15m'] },
      },
    })

    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      { buildFromCanonicalSpec: jest.fn().mockReturnValue({}) } as any,
      strategySummaryBuilder,
      { evaluate: jest.fn().mockReturnValue({
        status: 'PASSED',
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
        checks: [],
        summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
      }) } as any,
      { compile } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
    )

    const semanticState = buildLockedMaSemanticState()
    const canonicalSpecOverride = canonicalSpecBuilder.buildFromSemanticState(semanticState)
    canonicalSpecOverride.dataRequirements.requiredTimeframes = ['3m', '15m']

    const artifacts = await stage.generate({
      semanticState,
      canonicalSpecOverride,
    })

    expect(compile).toHaveBeenCalledWith(expect.objectContaining({
      fallback: expect.objectContaining({
        baseTimeframe: '15m',
      }),
    }))
    expect(artifacts.publishParams).toEqual({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      marketType: 'spot',
    })
  })

  it('keeps the MA golden case canonical digest stable through semanticState compile input', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const digestService = new CanonicalSpecV2DigestService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const semanticState = buildLockedMaSemanticState()
    const expectedDigest = digestService.hash(canonicalSpecBuilder.buildFromSemanticState(semanticState))

    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      new SpecDescBuilderService(),
      strategySummaryBuilder,
      { evaluate: jest.fn().mockReturnValue({
        status: 'PASSED',
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
        checks: [],
        summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
      }) } as any,
      { compile: jest.fn().mockReturnValue({ ir: { source: { graphDigest: 'sha256:ma' } }, graphSnapshot: {} }) } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
    )

    const artifacts = await stage.generate({ semanticState })

    expect(artifacts.sessionSpecDesc.canonicalDigest).toMatch(maGoldenCase.expectedDigestPattern)
    expect(artifacts.sessionSpecDesc).toEqual(expect.objectContaining({
      canonicalDigest: expectedDigest,
      canonicalSpec: expect.objectContaining({
        rules: expect.arrayContaining([
          expect.objectContaining({ phase: 'entry', condition: expect.objectContaining({ key: 'indicator.above' }) }),
          expect.objectContaining({ phase: 'exit', condition: expect.objectContaining({ key: 'indicator.below' }) }),
        ]),
      }),
    }))
  })

  it('keeps the Bollinger golden case canonical digest stable through semantic-only compile input', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const digestService = new CanonicalSpecV2DigestService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const semanticState = buildLockedBollingerSemanticState()
    const expectedDigest = digestService.hash(canonicalSpecBuilder.buildFromSemanticState(semanticState))

    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      new SpecDescBuilderService(),
      strategySummaryBuilder,
      { evaluate: jest.fn().mockReturnValue({
        status: 'PASSED',
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
        checks: [],
        summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
      }) } as any,
      { compile: jest.fn().mockReturnValue({ ir: { source: { graphDigest: 'sha256:bollinger' } }, graphSnapshot: {} }) } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
    )

    const artifacts = await stage.generate({ semanticState })

    expect(artifacts.sessionSpecDesc.canonicalDigest).toMatch(bollingerGoldenCase.expectedDigestPattern)
    expect(artifacts.sessionSpecDesc).toEqual(expect.objectContaining({
      canonicalDigest: expectedDigest,
      canonicalSpec: expect.objectContaining({
        rules: expect.arrayContaining([
          expect.objectContaining({ phase: 'entry', condition: expect.objectContaining({ key: 'bollinger.upper_break' }) }),
          expect.objectContaining({ phase: 'exit', condition: expect.objectContaining({ key: 'bollinger.middle_revert' }) }),
        ]),
      }),
    }))
  })

  it('keeps the grid semantic digest stable through semantic-only compile input', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const digestService = new CanonicalSpecV2DigestService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const semanticState = buildLockedGridSemanticState()
    const expectedDigest = digestService.hash(canonicalSpecBuilder.buildFromSemanticState(semanticState))

    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      new SpecDescBuilderService(),
      strategySummaryBuilder,
      { evaluate: jest.fn().mockReturnValue({
        status: 'PASSED',
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
        checks: [],
        summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
      }) } as any,
      { compile: jest.fn().mockReturnValue({ ir: { source: { graphDigest: 'sha256:grid' } }, graphSnapshot: {} }) } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
    )

    const artifacts = await stage.generate({ semanticState })

    expect(artifacts.sessionSpecDesc).toEqual(expect.objectContaining({
      canonicalDigest: expectedDigest,
      canonicalSpec: expect.objectContaining({ rules: [] }),
    }))
    expect(artifacts.publishParams).toEqual({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      marketType: 'perp',
    })
  })

  it('derives semantic publication params and locked params without checklist fallback payload', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      new SpecDescBuilderService(),
      strategySummaryBuilder,
      { evaluate: jest.fn().mockReturnValue({
        status: 'PASSED',
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
        checks: [],
        summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
      }) } as any,
      { compile: jest.fn().mockReturnValue({ ir: { source: { graphDigest: 'sha256:semantic' } }, graphSnapshot: {} }) } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
    )

    const semanticState = buildLockedBollingerSemanticState()
    semanticState.position = null
    semanticState.rules = [
      {
        id: 'rules-entry-bollinger',
        phase: 'entry',
        sideScope: 'short',
        condition: {
          kind: 'atom',
          key: 'bollinger.touch_upper',
          params: { period: 30, stdDev: 2.5, confirmationMode: 'close_confirm' },
        },
        effects: {
          actions: [{ kind: 'atom', key: 'action.open_short', params: {} }],
          risks: [{ kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } }],
          positions: [{ kind: 'atom', key: 'position.per_order_budget', params: { value: 25 } }],
          orchestration: [],
          programs: [],
        },
      },
      {
        id: 'rules-exit-bollinger',
        phase: 'exit',
        sideScope: 'short',
        condition: {
          kind: 'atom',
          key: 'bollinger.touch_middle',
          params: { period: 30, stdDev: 2.5, confirmationMode: 'close_confirm' },
        },
        effects: {
          actions: [{ kind: 'atom', key: 'action.close_short', params: {} }],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
      },
    ]
    ;(semanticState as { risk: SemanticState['risk'] }).risk = [{
      id: 'poison-flat-risk',
      key: 'risk.stop_loss_pct',
      params: {
        direction: 'loss',
        valuePct: 77,
        basis: 'entry_avg_price',
        marker: 'POISON_FLAT_RISK',
      },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }]

    const artifacts = await stage.generate({ semanticState })

    expect(artifacts.publishParams).toEqual({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      marketType: 'perp',
    })
    expect(artifacts.lockedParams).toEqual(expect.objectContaining({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      marketType: 'perp',
      exchange: 'okx',
      positionPct: 25,
      stopLossPct: 5,
      stopLossBasis: 'entry_avg_price',
    }))
    expect(artifacts.lockedParams).toEqual(expect.not.objectContaining({
      stopLossPct: 77,
      stopLossBasis: 'entry_avg_price',
    }))
    expect(artifacts.normalizedIntent.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'action.open_short' }),
      expect.objectContaining({ key: 'action.close_short' }),
    ]))
    expect(artifacts.normalizedIntent.risk).toEqual([
      expect.objectContaining({ key: 'risk.stop_loss_pct', params: expect.objectContaining({ valuePct: 5 }) }),
    ])
    expect(artifacts.normalizedIntent.position).toEqual(expect.objectContaining({
      mode: 'fixed_ratio',
      value: 0.25,
      positionMode: 'short_only',
    }))
    expect(JSON.stringify(artifacts.sessionSpecDesc.normalizedIntent)).not.toContain('POISON_FLAT_RISK')
    expect(artifacts.strategySummary.market).toEqual(expect.objectContaining({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      marketType: 'perp',
    }))
  })

  it('uses normalized ETHUSDT semantic context symbol in publication artifacts', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const compile = jest.fn().mockReturnValue({ ir: { source: { graphDigest: 'sha256:semantic-eth' } }, graphSnapshot: {} })
    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      new SpecDescBuilderService(),
      strategySummaryBuilder,
      { evaluate: jest.fn().mockReturnValue({
        status: 'PASSED',
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
        checks: [],
        summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
      }) } as any,
      { compile } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
    )
    const semanticState = buildLockedGridSemanticState()
    const symbolSlot = semanticState.contextSlots.symbol
    if (!symbolSlot) {
      throw new Error('expected locked grid fixture to include symbol slot')
    }
    semanticState.contextSlots.symbol = {
      ...symbolSlot,
      value: 'ETHUSDT',
    }

    const artifacts = await stage.generate({
      semanticState,
    })

    expect(artifacts.canonicalSpec.market.symbol).toBe('ETHUSDT')
    expect(artifacts.publishParams).toEqual({
      symbol: 'ETHUSDT',
      timeframe: '15m',
      marketType: 'perp',
    })
    expect(artifacts.lockedParams).toEqual(expect.objectContaining({
      symbol: 'ETHUSDT',
    }))
    expect(artifacts.sessionSpecDesc.lockedParams).toEqual(expect.objectContaining({
      symbol: 'ETHUSDT',
    }))
    expect(artifacts.sessionSpecDesc.canonicalSpec).toEqual(expect.objectContaining({
      market: expect.objectContaining({
        symbol: 'ETHUSDT',
      }),
    }))
    expect(compile).toHaveBeenCalledWith(expect.objectContaining({
      fallback: expect.objectContaining({
        symbol: 'ETHUSDT',
      }),
    }))
  })

  it('carries normalized locked stop loss basis into publication metadata', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      new SpecDescBuilderService(),
      strategySummaryBuilder,
      { evaluate: jest.fn().mockReturnValue({
        status: 'PASSED',
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
        checks: [],
        summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
      }) } as any,
      { compile: jest.fn().mockReturnValue({ ir: { source: { graphDigest: 'sha256:semantic-risk' } }, graphSnapshot: {} }) } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
    )
    const baseSemanticState = buildLockedMaSemanticState()
    const semanticState = {
      ...baseSemanticState,
      risk: [{
        id: 'risk-1',
        key: 'risk.stop_loss_pct' as const,
        params: { valuePct: 5 },
        status: 'locked' as const,
        source: 'user_explicit' as const,
        openSlots: [],
      }],
    }

    const artifacts = await stage.generate({ semanticState })

    expect(artifacts.lockedParams).toEqual(expect.objectContaining({
      stopLossPct: 5,
      stopLossBasis: 'entry_avg_price',
    }))
    expect(artifacts.normalizedIntent.risk).toContainEqual(expect.objectContaining({
      key: 'risk.stop_loss_pct',
      params: expect.objectContaining({
        valuePct: 5,
        basis: 'entry_avg_price',
      }),
    }))
    expect(artifacts.sessionSpecDesc.normalizedIntent).toEqual(expect.objectContaining({
      risk: expect.arrayContaining([
        expect.objectContaining({
          key: 'risk.stop_loss_pct',
          params: expect.objectContaining({
            valuePct: 5,
            basis: 'entry_avg_price',
          }),
        }),
      ]),
    }))
  })

  it('ignores non-locked semantic context values when reading publication context', () => {
    const stage = new CodegenPublicationGenerationStage(
      new CanonicalSpecBuilderService(),
      new SpecDescBuilderService(),
      new StrategySummaryBuilderService(new ScriptProfileExtractorService()),
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    )

    expect((stage as any).readSemanticContextValue({
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: 'BTCUSDT',
      status: 'open',
      priority: 'context',
      questionHint: '',
      affectsExecution: true,
    })).toBeNull()
    expect((stage as any).readSemanticContextValue({
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: 'BTCUSDT',
      status: 'superseded',
      priority: 'context',
      questionHint: '',
      affectsExecution: true,
    })).toBeNull()
    expect((stage as any).readSemanticContextValue({
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: 'BTCUSDT',
      status: 'locked',
      priority: 'context',
      questionHint: '',
      affectsExecution: true,
    })).toBe('BTCUSDT')
  })

  it('rejects publication generation when semantic and canonical context omit symbol or timeframe', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      new SpecDescBuilderService(),
      strategySummaryBuilder,
      { evaluate: jest.fn() } as any,
      { compile: jest.fn() } as any,
      { compile: jest.fn() } as any,
      { emit: jest.fn() } as any,
      { build: jest.fn() } as any,
      { parse: jest.fn() } as any,
    )
    const semanticState = buildLockedMaSemanticState()
    semanticState.contextSlots.symbol = null
    semanticState.contextSlots.timeframe = null

    const canonicalSpec = canonicalSpecBuilder.buildFromSemanticState(semanticState)
    canonicalSpec.market.symbol = null
    canonicalSpec.market.defaultTimeframe = null
    canonicalSpec.dataRequirements.requiredTimeframes = []

    await expect(stage.generate({
      semanticState,
      canonicalSpecOverride: canonicalSpec,
    })).rejects.toThrow('codegen.publication_context_missing')
  })

  it('does not promote canonical market values into locked params without locked semantic context', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      new SpecDescBuilderService(),
      strategySummaryBuilder,
      { evaluate: jest.fn().mockReturnValue({
        status: 'PASSED',
        specProfile: { indicators: [], actions: [], ruleMappings: [], rules: [], sizing: null, requiredParams: [], fallbackDetected: false },
        scriptProfile: { indicators: [], actions: [], ruleMappings: [], rules: [], sizing: null, requiredParams: [], fallbackDetected: false },
        checks: [],
        summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
      }) } as any,
      { compile: jest.fn().mockReturnValue({ ir: { source: { graphDigest: 'sha256:canonical-market' } }, graphSnapshot: {} }) } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
    )
    const semanticState = buildLockedMaSemanticState()
    semanticState.contextSlots = {
      exchange: null,
      symbol: null,
      marketType: null,
      timeframe: null,
    }
    const canonicalSpec = canonicalSpecBuilder.buildFromSemanticState(buildLockedMaSemanticState())
    canonicalSpec.market.marketType = 'perp'

    await expect(stage.generate({
      semanticState,
      canonicalSpecOverride: canonicalSpec,
    })).rejects.toThrow('codegen.publication_context_missing')
  })

  it('uses SemanticState canonical expression mainline', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const semanticState = buildLockedCloseOpenExpressionSemanticState()
    const buildFromSemanticStateSpy = jest.spyOn(canonicalSpecBuilder, 'buildFromSemanticState')
    const buildFromNormalizedIntentSpy = jest.spyOn(canonicalSpecBuilder, 'buildFromNormalizedIntent')
    const graphSnapshotService = new CodegenGraphSnapshotService()
    const buildFromSemanticArtifactsSpy = jest.spyOn(graphSnapshotService, 'buildFromSemanticArtifacts')

    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      new SpecDescBuilderService(),
      strategySummaryBuilder,
      { evaluate: jest.fn().mockReturnValue({
        status: 'PASSED',
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
        checks: [],
        summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
      }) } as any,
      new CanonicalSpecV2IrCompilerService(),
      new CanonicalStrategyAstCompilerService(),
      new CompiledScriptEmitterService(),
      new CompiledScriptExecutionEnvelopeService(),
      new CompiledScriptParserService(),
      undefined,
      undefined,
      graphSnapshotService,
    )

    const artifacts = await stage.generate({ semanticState })
    const priceSeries = artifacts.compiled.ir.signalCatalog.series.filter(series => series.kind === 'PRICE')

    expect(buildFromSemanticStateSpy).toHaveBeenCalledWith(semanticState)
    expect(buildFromNormalizedIntentSpy).not.toHaveBeenCalled()
    expect(artifacts.canonicalSpec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        condition: expect.objectContaining({ kind: 'expression', op: 'GT' }),
      }),
      expect.objectContaining({
        phase: 'exit',
        condition: expect.objectContaining({ kind: 'expression', op: 'LT' }),
      }),
    ]))
    expect(priceSeries).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'close', timeframe: '1m' }),
      expect.objectContaining({ field: 'open', timeframe: '1m' }),
    ]))
    expect(artifacts.semanticAtomInvariant.status).toBe('PASSED')
    expect(buildFromSemanticArtifactsSpy).toHaveBeenCalledWith({ canonicalSpec: artifacts.canonicalSpec })
    expect(artifacts.semanticPredicateGraph).toEqual(expect.objectContaining({
      version: 2,
      nodes: expect.arrayContaining([
        expect.objectContaining({ kind: 'predicate', op: 'GT' }),
        expect.objectContaining({ kind: 'predicate', op: 'LT' }),
      ]),
    }))
  })

  it('reuses the confirmed canonical selection and labels fallback semanticSource as rule-derived', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const buildFromNormalizedIntentSpy = jest.spyOn(canonicalSpecBuilder, 'buildFromNormalizedIntent')
    const canonicalSpecOverride = canonicalSpecBuilder.buildFromLegacyChecklistForTestsOnly({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['EMA7 上穿 EMA21 做多'],
      exitRules: ['EMA7 下穿 EMA21 平多'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
      },
    } as any)
    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      new SpecDescBuilderService(),
      strategySummaryBuilder,
      { evaluate: jest.fn().mockReturnValue({
        status: 'PASSED',
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
        checks: [],
        summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
      }) } as any,
      { compile: jest.fn().mockReturnValue({ ir: { source: { graphDigest: 'sha256:fallback' } }, graphSnapshot: {} }) } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
    )

    const artifacts = await stage.generate({
      semanticState: buildLockedMaSemanticState(),
      canonicalSpecOverride,
    })

    expect(buildFromNormalizedIntentSpy).not.toHaveBeenCalled()
    expect(artifacts.canonicalSpec).not.toEqual(canonicalSpecOverride)
    expect(artifacts.canonicalSpec.market).toEqual(expect.objectContaining({
      defaultTimeframe: '15m',
      marketType: 'spot',
    }))
    expect(artifacts.semanticView.semanticSource).toBe('rule-derived')
  })

  it('keeps the Bollinger golden case semantic graph stable through semanticState compile input', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const compile = jest.fn().mockReturnValue({
      ir: {
        source: { graphDigest: 'sha256:bollinger' },
      },
      graphSnapshot: {},
    })

    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      new SpecDescBuilderService(),
      strategySummaryBuilder,
      { evaluate: jest.fn().mockReturnValue({
        status: 'PASSED',
        specProfile: {
          indicators: [{ kind: 'bollingerBands', params: { period: 30, stdDev: 2.5 } }],
          actions: ['OPEN_SHORT', 'CLOSE_SHORT'],
          ruleMappings: [
            { key: 'bollinger.upper_break', action: 'OPEN_SHORT' },
            { key: 'bollinger.middle_revert', action: 'CLOSE_SHORT' },
          ],
          rules: [],
          sizing: { mode: 'RATIO', value: 0.1, source: 'literal' },
          requiredParams: [],
          fallbackDetected: false,
        },
        scriptProfile: {
          indicators: [{ kind: 'bollingerBands', params: { period: 30, stdDev: 2.5 } }],
          actions: ['OPEN_SHORT', 'CLOSE_SHORT'],
          ruleMappings: [
            { key: 'bollinger.upper_break', action: 'OPEN_SHORT' },
            { key: 'bollinger.middle_revert', action: 'CLOSE_SHORT' },
          ],
          rules: [],
          sizing: { mode: 'RATIO', value: 0.1, source: 'literal' },
          requiredParams: [],
          fallbackDetected: false,
        },
        checks: [],
        summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
      }) } as any,
      { compile } as any,
      { compile: jest.fn().mockReturnValue({ id: 'compiled-ast' }) } as any,
      { emit: jest.fn().mockReturnValue('strategy') } as any,
      { build: jest.fn().mockReturnValue({}) } as any,
      { parse: jest.fn().mockReturnValue({}) } as any,
      undefined,
      passingSemanticAtomInvariant() as any,
    )

    const artifacts = await stage.generate({
      semanticState: buildLockedBollingerSemanticState(),
    })

    expect(compile).toHaveBeenCalledWith(expect.objectContaining({
      canonicalSpec: expect.objectContaining({
        indicators: [],
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
    expect(artifacts.sessionSpecDesc.normalizedIntent).toEqual(expect.any(Object))
    expect(artifacts.compiled.ir.source.graphDigest).toMatch(bollingerGoldenCase.expectedDigestPattern)
    expect(artifacts.semanticConsistency.status).toBe('PASSED')
  })

  describe('Issue #1456 闸 1 — IR builder 入口 assertion', () => {
    it('publicationGate 注入后，未澄清的 clarificationState 进入 generate() 立即 throw，且不会调用任何下游 builder', async () => {
      const canonicalBuilder = { buildFromSemanticState: jest.fn(), buildFromLegacyChecklistForTestsOnly: jest.fn(), buildFromNormalizedIntent: jest.fn() }
      const specDescBuilder = { buildFromCanonicalSpec: jest.fn() }
      const consistencyEvaluate = jest.fn()
      const irCompilerCompile = jest.fn()
      const astCompile = jest.fn()
      const scriptEmit = jest.fn()
      const envelopeBuild = jest.fn()
      const parserParse = jest.fn()
      const publicationGate = {
        assertClarificationResolvedForIrBuild: jest.fn().mockImplementation(() => {
          // 模拟真实 gate fail-closed 路径
          const err: any = new Error('publication gate blocked: CLARIFICATION_PENDING')
          err.publicationGate = {
            blocked: true,
            reason: 'CLARIFICATION_PENDING',
            pendingItems: [],
            blockedIrFields: [],
          }
          throw err
        }),
      }

      const stage = new CodegenPublicationGenerationStage(
        canonicalBuilder as any,
        specDescBuilder as any,
        { buildStrategySummary: jest.fn(), buildSummaryFromProfile: jest.fn() } as any,
        { evaluate: consistencyEvaluate } as any,
        { compile: irCompilerCompile } as any,
        { compile: astCompile } as any,
        { emit: scriptEmit } as any,
        { build: envelopeBuild } as any,
        { parse: parserParse } as any,
        undefined,
        passingSemanticAtomInvariant() as any,
        undefined,
        publicationGate as any,
      )

      await expect(
        stage.generate({
          semanticState: { version: 1, families: [], trigger: [], action: [], risk: [], normalizationNotes: [], contextSlots: {} } as any,
          clarificationState: {
            status: 'NEEDS_CLARIFICATION',
            items: [{
              key: 'k', reason: 'missing_exchange', field: 'exchange',
              blocking: true, question: 'q', status: 'pending',
            }],
          },
        }),
      ).rejects.toThrow(/CLARIFICATION_PENDING/)

      expect(publicationGate.assertClarificationResolvedForIrBuild).toHaveBeenCalledTimes(1)
      // 关键：下游 builder 全部未被触达 —— 这是"硬拒绝产出 IR"的可观察证据
      expect(canonicalBuilder.buildFromSemanticState).not.toHaveBeenCalled()
      expect(irCompilerCompile).not.toHaveBeenCalled()
      expect(astCompile).not.toHaveBeenCalled()
      expect(scriptEmit).not.toHaveBeenCalled()
      expect(consistencyEvaluate).not.toHaveBeenCalled()
    })

    it('未注入 publicationGate 时维持原行为（向后兼容旧调用方）', async () => {
      const canonicalBuilder = { buildFromSemanticState: jest.fn().mockImplementation(() => { throw new Error('downstream-still-runs') }) }

      const stage = new CodegenPublicationGenerationStage(
        canonicalBuilder as any,
        { buildFromCanonicalSpec: jest.fn() } as any,
        {} as any,
        { evaluate: jest.fn() } as any,
        { compile: jest.fn() } as any,
        { compile: jest.fn() } as any,
        { emit: jest.fn() } as any,
        { build: jest.fn() } as any,
        { parse: jest.fn() } as any,
      )

      // publicationGate 未注入 → 直接进入下游 builder（这里 mock 故意抛 downstream-still-runs）
      await expect(
        stage.generate({
          semanticState: { version: 1, families: [] } as any,
          clarificationState: { status: 'NEEDS_CLARIFICATION', items: [{ key: 'k', reason: 'missing_exchange', field: 'exchange', blocking: true, question: 'q', status: 'pending' }] },
        }),
      ).rejects.toThrow(/downstream-still-runs/)
    })
  })
})
