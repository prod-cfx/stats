import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CodegenPublicationGenerationStage } from '../codegen-publication-generation.stage'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { StrategySummaryBuilderService } from '../strategy-summary-builder.service'

describe('codegenPublicationGenerationStage', () => {
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
})
