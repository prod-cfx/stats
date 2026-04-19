import type { SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2DigestService } from '../canonical-spec-v2-digest.service'
import { CodegenPublicationGenerationStage } from '../codegen-publication-generation.stage'
import { buildNormalizedIntentFromSemanticState } from '../semantic-state-normalization'
import { SpecDescBuilderService } from '../spec-desc-builder.service'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { StrategySummaryBuilderService } from '../strategy-summary-builder.service'
import { bollingerGoldenCase, maGoldenCase } from './fixtures/semantic-state-golden-cases'

describe('codegenPublicationGenerationStage', () => {
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

  const buildLockedMaSemanticState = (): SemanticState => ({
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
          'reference.period': 10,
          confirmationMode: 'close_confirm',
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

  const buildLockedBollingerSemanticState = (): SemanticState => ({
    version: 1,
    families: ['single-leg'],
    triggers: [
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
    triggers: [
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
    )

    const artifacts = await stage.generate({
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['收盘价突破上轨时做空'],
        exitRules: ['价格回到中轨（20日均线）时平仓'],
        riskRules: { exchange: 'okx', marketType: 'perp', positionPct: 10, stopLossPct: 5 },
      },
      message: '中轨（20日均线）回归平仓',
    })

    expect(consistencyEvaluate).toHaveBeenCalledWith(expect.objectContaining({
      canonicalSpec: expect.any(Object),
      scriptCode: 'strategy',
    }))
    expect(consistencyEvaluate).not.toHaveBeenCalledWith(expect.objectContaining({
      userIntentSummary: expect.anything(),
    }))
    expect(artifacts.userIntentSummary.indicators).toEqual(['bollingerBands'])
    expect(artifacts.strategySummary.indicators).toEqual(['bollingerBands'])
    expect(artifacts.scriptSummary.indicators).toEqual(['bollingerBands'])
    expect(artifacts.sessionSpecDesc.summaryObservation).toEqual(expect.objectContaining({
      status: 'aligned',
    }))
  })

  it('routes semantic-state publication through normalized canonical compilation', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const semanticState = buildLockedGridSemanticState()
    const rawChecklist = {
      symbols: ['ETHUSDT'],
      timeframes: ['1h'],
      riskRules: { exchange: 'okx', marketType: 'perp', positionPct: 10 },
    }
    const expectedNormalizedIntent = buildNormalizedIntentFromSemanticState(semanticState)
    const buildSpy = jest.spyOn(canonicalSpecBuilder, 'build')
    const buildFromNormalizedIntentSpy = jest.spyOn(canonicalSpecBuilder, 'buildFromNormalizedIntent')
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
    )

    const artifacts = await stage.generate({
      checklist: rawChecklist,
      semanticState,
      message: '在 60000-80000 区间做 1% 步长的网格策略，突破区间就停掉',
    } as any)

    expect(buildFromNormalizedIntentSpy).toHaveBeenCalledWith(
      {
        market: {
          exchange: 'okx',
          marketType: 'perp',
          defaultTimeframe: '15m',
        },
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
      },
      expectedNormalizedIntent,
    )
    expect(buildSpy).not.toHaveBeenCalled()
    expect(artifacts.sessionSpecDesc.canonicalSpec).toEqual(artifacts.canonicalSpec)
    expect(artifacts.sessionSpecDesc.normalizedIntent).toEqual(expectedNormalizedIntent)
    expect(artifacts.canonicalSpec.market).toEqual(expect.objectContaining({
      symbol: 'BTCUSDT',
      defaultTimeframe: '15m',
      marketType: 'perp',
    }))
    expect(artifacts.canonicalSpec.dataRequirements.requiredTimeframes).toEqual(['15m'])
    expect(artifacts.canonicalSpec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
        }),
        metadata: expect.objectContaining({
          normalized: expect.objectContaining({
            family: 'grid.range_rebalance',
          }),
        }),
      }),
    ]))
    expect(executionEnvelopeBuild).toHaveBeenCalledWith(artifacts.canonicalSpec)
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
    )

    const artifacts = await stage.generate({
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['价格突破关键阻力位入场'],
        exitRules: ['价格跌破关键支撑位出场'],
        riskRules: { exchange: 'okx', marketType: 'perp', positionPct: 10 },
      },
      message: '做一个策略',
    })

    expect(artifacts.strategySummary.indicators).toEqual(['bollingerBands'])
    expect(artifacts.strategySummary.entryRule).toBe('bollinger.upper_break_short')
    expect(artifacts.strategySummary.exitRule).toBe('bollinger.middle_revert')
  })

  it('records summary drift as observational diagnostics instead of formal consistency checks', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const realSummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const strategySummaryBuilder = {
      buildUserIntentSummary: jest.fn().mockReturnValue({
        strategyType: 'bollinger',
        indicators: ['bollingerBands', 'sma'],
        entryRule: 'bollinger.upper_break_short',
        exitRule: 'bollinger.middle_revert',
        market: { symbol: 'BTCUSDT', timeframe: '15m', marketType: 'perp' },
        sizing: { mode: 'RATIO', evidence: 'explicit' },
      }),
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
    )

    const artifacts = await stage.generate({
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['收盘价突破上轨时做空'],
        exitRules: ['价格回到中轨（20日均线）时平仓'],
        riskRules: { exchange: 'okx', marketType: 'perp', positionPct: 10 },
      },
      message: '我要一个会被旧 summary 误识别为 sma 的布林带策略',
    })

    expect(artifacts.semanticConsistency.checks.some((check: { key: string }) => check.key === 'summary.alignment')).toBe(false)
    expect(artifacts.sessionSpecDesc.summaryObservation).toEqual(expect.objectContaining({
      status: 'drifted',
      warnings: expect.arrayContaining([
        expect.stringContaining('用户意图.indicators'),
      ]),
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
    )

    const artifacts = await stage.generate({
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m', '3m'],
        entryRules: ['3m 内下跌 1% 买入'],
        exitRules: ['15m 内上涨 2% 卖出'],
        entryRuleDrafts: [{ id: 'entry-1', phase: 'entry', text: '3m 内下跌 1% 买入', timeframe: '3m' }],
        exitRuleDrafts: [{ id: 'exit-1', phase: 'exit', text: '15m 内上涨 2% 卖出', timeframe: '15m', basis: 'entry_avg_price' }],
        riskRules: { exchange: 'okx', marketType: 'spot', positionPct: 10, stopLossPct: 5 },
      },
      message: 'OKX BTCUSDT；3 分钟内下跌 1% 买入；15 分钟内上涨 2% 卖出；单笔 10% 资金',
    })

    expect(compile).toHaveBeenCalledWith(expect.objectContaining({
      fallback: expect.objectContaining({
        baseTimeframe: '3m',
      }),
    }))
    expect(artifacts.publishParams).toEqual({
      symbol: 'BTCUSDT',
      timeframe: '3m',
      marketType: 'spot',
    })
  })

  it('keeps the MA golden case canonical digest stable through semanticState compile input', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const digestService = new CanonicalSpecV2DigestService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const semanticState = buildLockedMaSemanticState()
    const expectedNormalizedIntent = buildNormalizedIntentFromSemanticState(semanticState)
    const expectedDigest = digestService.hash(
      canonicalSpecBuilder.buildFromNormalizedIntent({
        market: {
          exchange: 'okx',
          marketType: 'spot',
          defaultTimeframe: '15m',
        },
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
      }, expectedNormalizedIntent),
    )

    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      new SpecDescBuilderService(canonicalSpecBuilder),
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
    )

    const artifacts = await stage.generate({
      checklist: {
        riskRules: {
          exchange: 'okx',
          marketType: 'spot',
        },
      },
      semanticState,
      message: maGoldenCase.message,
    } as any)

    expect(artifacts.sessionSpecDesc.canonicalDigest).toMatch(maGoldenCase.expectedDigestPattern)
    expect(artifacts.sessionSpecDesc).toEqual(expect.objectContaining({
      canonicalDigest: expectedDigest,
      normalizedIntent: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({ key: 'indicator.above', phase: 'entry' }),
          expect.objectContaining({ key: 'indicator.below', phase: 'exit' }),
        ]),
      }),
    }))
  })

  it('keeps the Bollinger golden case canonical digest stable through semantic-only compile input', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const digestService = new CanonicalSpecV2DigestService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const semanticState = buildLockedBollingerSemanticState()
    const expectedNormalizedIntent = buildNormalizedIntentFromSemanticState(semanticState)
    const expectedDigest = digestService.hash(
      canonicalSpecBuilder.buildFromNormalizedIntent({
        market: {
          exchange: 'okx',
          marketType: 'perp',
          defaultTimeframe: '15m',
        },
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
      }, expectedNormalizedIntent),
    )

    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      new SpecDescBuilderService(canonicalSpecBuilder),
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
    )

    const artifacts = await stage.generate({
      checklist: {},
      semanticState,
      message: bollingerGoldenCase.message,
    } as any)

    expect(artifacts.sessionSpecDesc.canonicalDigest).toMatch(bollingerGoldenCase.expectedDigestPattern)
    expect(artifacts.sessionSpecDesc).toEqual(expect.objectContaining({
      canonicalDigest: expectedDigest,
      normalizedIntent: expect.objectContaining({
        triggers: expect.arrayContaining([
          expect.objectContaining({ key: 'bollinger.touch_upper', phase: 'entry', sideScope: 'short' }),
          expect.objectContaining({ key: 'bollinger.touch_middle', phase: 'exit', sideScope: 'short' }),
        ]),
      }),
    }))
  })

  it('keeps the grid semantic digest stable through semantic-only compile input', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const digestService = new CanonicalSpecV2DigestService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const semanticState = buildLockedGridSemanticState()
    const expectedNormalizedIntent = buildNormalizedIntentFromSemanticState(semanticState)
    const expectedDigest = digestService.hash(
      canonicalSpecBuilder.buildFromNormalizedIntent({
        market: {
          exchange: 'okx',
          marketType: 'perp',
          defaultTimeframe: '15m',
        },
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
      }, expectedNormalizedIntent),
    )

    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      new SpecDescBuilderService(canonicalSpecBuilder),
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
    )

    const artifacts = await stage.generate({
      checklist: {},
      semanticState,
      message: '在 okx 合约 BTCUSDT 15m 上做 60000-80000、每格 1%、突破暂停的双向网格。',
    } as any)

    expect(artifacts.sessionSpecDesc).toEqual(expect.objectContaining({
      canonicalDigest: expectedDigest,
      normalizedIntent: expect.objectContaining({
        grid: expect.objectContaining({
          family: 'grid.range_rebalance',
          range: { lower: 60000, upper: 80000 },
          stepPct: 1,
          breakoutAction: 'pause',
        }),
      }),
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
      new SpecDescBuilderService(canonicalSpecBuilder),
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
    )

    const artifacts = await stage.generate({
      checklist: {},
      semanticState: buildLockedBollingerSemanticState(),
      message: '确认逻辑图',
    } as any)

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
      positionPct: 10,
    }))
  })

  it('reuses the confirmed canonical selection and labels fallback semanticSource as rule-derived', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const buildFromNormalizedIntentSpy = jest.spyOn(canonicalSpecBuilder, 'buildFromNormalizedIntent')
    const canonicalSpecOverride = canonicalSpecBuilder.build({
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
      new SpecDescBuilderService(canonicalSpecBuilder),
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
    )

    const artifacts = await stage.generate({
      checklist: {},
      semanticState: buildLockedMaSemanticState(),
      canonicalSpecOverride,
      message: '确认逻辑图',
    } as any)

    expect(buildFromNormalizedIntentSpy).not.toHaveBeenCalled()
    expect(artifacts.canonicalSpec).toEqual(canonicalSpecOverride)
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
      new SpecDescBuilderService(canonicalSpecBuilder),
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
    )

    const artifacts = await stage.generate({
      checklist: {
        riskRules: {
          exchange: 'okx',
          marketType: 'perp',
        },
      },
      semanticState: buildLockedBollingerSemanticState(),
      message: bollingerGoldenCase.message,
    } as any)

    expect(compile).toHaveBeenCalledWith(expect.objectContaining({
      canonicalSpec: expect.objectContaining({
        indicators: expect.arrayContaining([
          expect.objectContaining({ kind: 'bollingerBands', params: { period: 30, stdDev: 2.5 } }),
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
    expect(artifacts.sessionSpecDesc.normalizedIntent).toEqual(expect.any(Object))
    expect(artifacts.compiled.ir.source.graphDigest).toMatch(bollingerGoldenCase.expectedDigestPattern)
    expect(artifacts.semanticConsistency.status).toBe('PASSED')
  })
})
