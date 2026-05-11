import type { CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec-v2'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { StrategySummaryBuilderService } from '../strategy-summary-builder.service'
import { bollingerGoldenCase, maGoldenCase } from './fixtures/semantic-state-golden-cases'

describe('strategySummaryBuilderService', () => {
  it('builds user intent summary from clarified checklist band semantics instead of moving-average alias text', () => {
    const service = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const summary = service.buildUserIntentSummary({
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['收盘价突破上轨时做空'],
        exitRules: ['价格回到中轨（20日均线）时平仓'],
        riskRules: { exchange: 'okx', marketType: 'perp', positionPct: 10, stopLossPct: 5 },
      },
      message: '中轨（20日均线）回归平仓',
    })

    expect(summary.strategyType).toBe('bollinger')
    expect(summary.indicators).toEqual(['bollingerBands'])
    expect(summary.entryRule).toBe('bollinger.upper_break_short')
    expect(summary.exitRule).toBe('bollinger.middle_revert')
    expect(summary.indicators).not.toContain('sma')
  })

  it('extracts bollinger user intent without inventing ma defaults', () => {
    const service = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const summary = service.buildUserIntentSummary({
      checklist: {
        symbols: ['ETHUSDT'],
        timeframes: ['1h'],
        entryRules: ['价格突破布林带上轨做空'],
        exitRules: ['回到布林带中轨平仓'],
      },
      message: '我要布林带策略，不要均线金叉那一套',
    })

    expect(summary.strategyType).toBe('bollinger')
    expect(summary.indicators).toEqual(['bollingerBands'])
    expect(summary.entryRule).toBe('bollinger.upper_break_short')
    expect(summary.exitRule).toBe('bollinger.middle_revert')
    expect(summary.indicators).not.toContain('sma')
  })

  it('keeps MA golden case summary anchored to explicit MA periods instead of generic open/close phrasing', () => {
    const service = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const summary = service.buildUserIntentSummary({
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['收盘确认价格突破长期均线（50）时买入'],
        exitRules: ['收盘确认价格跌破短期均线（10）时卖出'],
        riskRules: { exchange: 'okx', marketType: 'spot', positionPct: 10, stopLossPct: 5, takeProfitPct: 10 },
      },
      message: maGoldenCase.message,
    })

    expect(summary.strategyType).toBe('movingAverage')
    expect(summary.indicators).toEqual(['sma'])
  })

  it('keeps Bollinger golden case summary anchored to band semantics without reintroducing sma aliases', () => {
    const service = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const summary = service.buildUserIntentSummary({
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['K线收盘后确认突破布林带(30,2.5)上轨时做空'],
        exitRules: ['价格回到布林带中轨(MA30)时平空'],
        riskRules: { exchange: 'okx', marketType: 'perp', positionPct: 10 },
      },
      message: bollingerGoldenCase.message,
    })

    expect(summary.strategyType).toBe('bollinger')
    expect(summary.indicators).toEqual(['bollingerBands'])
    expect(summary.entryRule).toBe('bollinger.upper_break_short')
    expect(summary.exitRule).toBe('bollinger.middle_revert')
    expect(summary.indicators).not.toContain('sma')
  })

  it('builds strategy summary from canonical spec without injecting missing defaults', () => {
    const canonicalBuilder = new CanonicalSpecBuilderService()
    const service = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const spec = canonicalBuilder.buildFromLegacyChecklistForTestsOnly({
      entryRules: ['价格突破关键阻力位入场'],
      exitRules: ['价格跌破关键支撑位出场'],
    })

    const summary = service.buildStrategySummary(spec)

    expect(summary.strategyType).toBe('custom')
    expect(summary.indicators).toEqual([])
    expect(summary.market).toEqual({ marketType: 'spot' })
    expect(summary.sizing).toBeNull()
  })

  it('builds strategy summary market timeframe from canonical default timeframe while preserving multi-timeframe requirements', () => {
    const service = new StrategySummaryBuilderService(new ScriptProfileExtractorService())

    const summary = service.buildStrategySummary({
      version: 2,
      market: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        defaultTimeframe: '3m',
      },
      indicators: [],
      sizing: { mode: 'RATIO', value: 0.1 },
      executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
      dataRequirements: { requiredTimeframes: ['3m', '15m'] },
      rules: [],
    } as any)

    expect(summary.market).toEqual({
      symbol: 'BTCUSDT',
      timeframe: '3m',
      marketType: 'spot',
    })
  })

  it('does not label moving-average summaries as golden/death cross without explicit crossover evidence', () => {
    const service = new StrategySummaryBuilderService(new ScriptProfileExtractorService())

    const summary = service.buildScriptSummary({
      scriptCode: `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const closes = ctx.bars?.map(item => item.close) ?? []
    const fast = ctx.helpers?.ta?.sma(closes, 5)
    const slow = ctx.helpers?.ta?.sma(closes, 20)
    if (typeof fast !== 'number' || typeof slow !== 'number') return { action: 'NOOP' }
    if (closes.at(-1)! > fast) return { action: 'OPEN_LONG', size: { mode: 'RATIO', value: 0.1 } }
    if (closes.at(-1)! < slow) return { action: 'CLOSE_LONG' }
    return { action: 'NOOP' }
  },
}
strategy
`,
    })

    expect(summary.strategyType).toBe('movingAverage')
    expect(summary.entryRule).toBe('custom')
    expect(summary.exitRule).toBe('custom')
  })

  it('binds moving-average summary rules to entry and exit action direction', () => {
    const service = new StrategySummaryBuilderService(new ScriptProfileExtractorService())

    const userIntentSummary = service.buildUserIntentSummary({
      checklist: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['短均线下穿长均线（死叉）时做空'],
        exitRules: ['短均线上穿长均线（金叉）时平空'],
      },
      message: '我要一个均线死叉开空、金叉平空的策略',
    })

    const scriptSummary = service.buildScriptSummary({
      scriptCode: `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const closes = ctx.bars?.map(item => item.close) ?? []
    const fast = ctx.helpers?.ta?.sma(closes, 5)
    const slow = ctx.helpers?.ta?.sma(closes, 20)
    if (typeof fast !== 'number' || typeof slow !== 'number') return { action: 'NOOP' }
    if (fast < slow) return { action: 'OPEN_SHORT', size: { mode: 'RATIO', value: 0.1 } }
    if (fast > slow) return { action: 'CLOSE_SHORT' }
    return { action: 'NOOP' }
  },
}
strategy
`,
    })

    expect(userIntentSummary.entryRule).toBe('ma.death_cross')
    expect(userIntentSummary.exitRule).toBe('ma.golden_cross')
    expect(scriptSummary.entryRule).toBe('ma.death_cross')
    expect(scriptSummary.exitRule).toBe('ma.golden_cross')
  })

  it('normalizes bollinger middle-band MA20 alias out of script summary indicators', () => {
    const service = new StrategySummaryBuilderService(new ScriptProfileExtractorService())

    const summary = service.buildScriptSummary({
      scriptCode: `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const closes = ctx.bars?.map(item => item.close) ?? []
    const bb = ctx.helpers?.ta?.bollingerBands(closes, 20, 2)
    const mid = ctx.helpers?.ta?.sma(closes, 20)
    if (!bb || typeof mid !== 'number') return { action: 'NOOP' }
    if (closes.at(-1)! > bb.upper) return { action: 'OPEN_SHORT', size: { mode: 'RATIO', value: 0.1 } }
    if (Math.abs(closes.at(-1)! - mid) <= 1 && ctx.position?.side === 'short') return { action: 'CLOSE_SHORT' }
    return { action: 'NOOP' }
  },
}
strategy
`,
    })

    expect(summary.strategyType).toBe('bollinger')
    expect(summary.indicators).toEqual(['bollingerBands'])
    expect(summary.exitRule).toBe('bollinger.middle_revert')
  })

  // ---------------------------------------------------------------------------
  // #1186 PR5: multi-leg sizing rendering
  // ---------------------------------------------------------------------------

  function makeMultiLegSpec(legs: ReadonlyArray<{
    id: string
    direction: 'long' | 'short'
    mode: 'fixed_quote' | 'fixed_pct' | 'fixed_base' | 'fixed_ratio'
    value: number
    asset?: string
  }>): CanonicalStrategySpecV2 {
    return {
      version: 2,
      market: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        defaultTimeframe: '15m',
      },
      indicators: [],
      sizing: null,
      executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
      dataRequirements: { requiredTimeframes: ['15m'] },
      rules: [],
      orchestration: {
        legScopes: legs.map(leg => ({
          id: `scope-leg-${leg.id}`,
          scopeKind: 'leg',
          legId: leg.id,
          direction: leg.direction,
          instrumentRef: 'scope-symbol-btcusdt',
          legSizing: {
            mode: leg.mode,
            value: leg.value,
            asset: leg.asset,
          },
        })),
      },
    } as unknown as CanonicalStrategySpecV2
  }

  it('renders multi-leg sizing.legs[] when spec.orchestration.legScopes carries legSizing', () => {
    const service = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const spec = makeMultiLegSpec([
      { id: 'leg-1', direction: 'long', mode: 'fixed_quote', value: 100, asset: 'USDT' },
      { id: 'leg-2', direction: 'short', mode: 'fixed_quote', value: 200, asset: 'USDT' },
    ])

    const summary = service.buildStrategySummary(spec)

    expect(summary.sizing).not.toBeNull()
    expect(summary.sizing?.mode).toBe('MULTI_LEG')
    expect(summary.sizing?.evidence).toBe('explicit')
    expect(summary.sizing?.value).toBeUndefined()
    expect(summary.sizing?.asset).toBeUndefined()
    expect(summary.sizing?.legs).toHaveLength(2)
    expect(summary.sizing?.legs?.[0]).toEqual({
      legId: 'leg-1',
      mode: 'QUOTE',
      value: 100,
      asset: 'USDT',
      scopeKey: 'scope-leg-leg-1',
    })
    expect(summary.sizing?.legs?.[1]).toEqual({
      legId: 'leg-2',
      mode: 'QUOTE',
      value: 200,
      asset: 'USDT',
      scopeKey: 'scope-leg-leg-2',
    })
  })

  it('renders heterogeneous multi-leg sizing modes (fixed_quote + fixed_pct + fixed_base)', () => {
    const service = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const spec = makeMultiLegSpec([
      { id: 'leg-1', direction: 'long', mode: 'fixed_quote', value: 100, asset: 'USDT' },
      { id: 'leg-2', direction: 'short', mode: 'fixed_pct', value: 0.1 },
      { id: 'leg-3', direction: 'long', mode: 'fixed_base', value: 0.001, asset: 'BTC' },
    ])

    const summary = service.buildStrategySummary(spec)

    expect(summary.sizing?.mode).toBe('MULTI_LEG')
    expect(summary.sizing?.legs).toHaveLength(3)
    expect(summary.sizing?.legs?.[0].mode).toBe('QUOTE')
    expect(summary.sizing?.legs?.[1].mode).toBe('RATIO')
    expect(summary.sizing?.legs?.[1].asset).toBeUndefined()
    expect(summary.sizing?.legs?.[2].mode).toBe('QTY')
    expect(summary.sizing?.legs?.[2].asset).toBe('BTC')
  })

  it('falls back to single-position sizing rendering when legScopes is empty (single-leg byte regression)', () => {
    const service = new StrategySummaryBuilderService(new ScriptProfileExtractorService())

    const summary = service.buildStrategySummary({
      version: 2,
      market: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        defaultTimeframe: '3m',
      },
      indicators: [],
      sizing: { mode: 'RATIO', value: 0.1 },
      executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
      dataRequirements: { requiredTimeframes: ['3m'] },
      rules: [],
    } as any)

    expect(summary.sizing).toEqual({ mode: 'RATIO', evidence: 'explicit' })
    expect(summary.sizing?.legs).toBeUndefined()
  })

  it('treats legScopes without any legSizing as single-position path (互斥 sentinel)', () => {
    const service = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const spec = {
      version: 2,
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', defaultTimeframe: '15m' },
      indicators: [],
      sizing: { mode: 'QUOTE', value: 100 },
      executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
      dataRequirements: { requiredTimeframes: ['15m'] },
      rules: [],
      orchestration: {
        legScopes: [
          { id: 'scope-leg-1', scopeKind: 'leg', legId: 'leg-1', direction: 'long', instrumentRef: 'sym' },
        ],
      },
    } as unknown as CanonicalStrategySpecV2

    const summary = service.buildStrategySummary(spec)

    expect(summary.sizing).toEqual({ mode: 'QUOTE', evidence: 'explicit' })
    expect(summary.sizing?.legs).toBeUndefined()
  })
})
