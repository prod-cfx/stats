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
      semanticState: buildLockedBollingerSemanticState(),
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

    const artifacts = await stage.generate({ semanticState })

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
    expect(JSON.stringify(artifacts.sessionSpecDesc)).not.toContain('entryRules')
    expect(JSON.stringify(artifacts.sessionSpecDesc)).not.toContain('exitRules')
    expect(JSON.stringify(artifacts.sessionSpecDesc)).not.toContain('riskRules')
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
    )

    const artifacts = await stage.generate({
      semanticState: buildLockedBollingerSemanticState(),
    })

    expect(artifacts.semanticConsistency.checks.some((check: { key: string }) => check.key === 'summary.alignment')).toBe(false)
    expect(artifacts.sessionSpecDesc.summaryObservation).toEqual(expect.objectContaining({
      status: 'aligned',
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

    const semanticState = buildLockedMaSemanticState()
    const canonicalSpecOverride = canonicalSpecBuilder.buildFromNormalizedIntent(
      {
        market: {
          exchange: 'okx',
          marketType: 'spot',
          defaultTimeframe: '15m',
        },
        symbols: ['BTCUSDT'],
        timeframes: ['15m', '3m'],
      },
      buildNormalizedIntentFromSemanticState(semanticState),
    )
    canonicalSpecOverride.dataRequirements.requiredTimeframes = ['3m', '15m']

    const artifacts = await stage.generate({
      semanticState,
      canonicalSpecOverride,
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
    )

    const artifacts = await stage.generate({ semanticState })

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
    )

    const artifacts = await stage.generate({ semanticState })

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
    )

    const artifacts = await stage.generate({ semanticState })

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
    )

    const artifacts = await stage.generate({
      semanticState: buildLockedBollingerSemanticState(),
    })

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

    const canonicalSpec = canonicalSpecBuilder.buildFromNormalizedIntent(
      {
        market: { marketType: 'spot' },
      },
      buildNormalizedIntentFromSemanticState(semanticState),
    )
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
    )
    const semanticState = buildLockedMaSemanticState()
    semanticState.contextSlots = {
      exchange: null,
      symbol: null,
      marketType: null,
      timeframe: null,
    }
    const canonicalSpec = canonicalSpecBuilder.buildFromNormalizedIntent(
      {
        market: {
          exchange: 'okx',
          marketType: 'perp',
          defaultTimeframe: '15m',
        },
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
      },
      buildNormalizedIntentFromSemanticState(semanticState),
    )

    const artifacts = await stage.generate({
      semanticState,
      canonicalSpecOverride: canonicalSpec,
    })

    expect(artifacts.publishParams).toEqual({
      symbol: 'BTCUSDT',
      timeframe: '15m',
      marketType: 'perp',
    })
    expect(artifacts.lockedParams).not.toEqual(expect.objectContaining({
      symbol: expect.any(String),
      timeframe: expect.any(String),
      exchange: expect.any(String),
      marketType: expect.any(String),
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
    )

    const artifacts = await stage.generate({
      semanticState: buildLockedMaSemanticState(),
      canonicalSpecOverride,
    })

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
    )

    const artifacts = await stage.generate({
      semanticState: buildLockedBollingerSemanticState(),
    })

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
