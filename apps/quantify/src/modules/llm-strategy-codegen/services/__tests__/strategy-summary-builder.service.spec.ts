import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { StrategySummaryBuilderService } from '../strategy-summary-builder.service'

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

  it('builds strategy summary from canonical spec without injecting missing defaults', () => {
    const canonicalBuilder = new CanonicalSpecBuilderService()
    const service = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const spec = canonicalBuilder.build({
      entryRules: ['价格突破关键阻力位入场'],
      exitRules: ['价格跌破关键支撑位出场'],
    })

    const summary = service.buildStrategySummary(spec)

    expect(summary.strategyType).toBe('custom')
    expect(summary.indicators).toEqual([])
    expect(summary.market).toEqual({ marketType: 'spot' })
    expect(summary.sizing).toBeNull()
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
})
