import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { StrategyConsistencyService } from '../strategy-consistency.service'

describe('strategyConsistencyService', () => {
  const consistency = new StrategyConsistencyService(new ScriptProfileExtractorService())
  const canonicalBuilder = new CanonicalSpecBuilderService()

  it('passes when script aligns with canonical bollinger spec', () => {
    const spec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '突破布林带上轨时做空',
        '跌破布林带下轨时做多',
      ],
      exitRules: ['回到中轨时平仓'],
      riskRules: { positionPct: 10 },
    })

    const report = consistency.evaluate({
      canonicalSpec: spec,
      scriptCode: `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const closes = ctx.bars?.map(item => item.close) ?? []
    const bb = ctx.helpers?.ta?.bollingerBands(closes, 20, 2)
    if (!bb) return { action: 'NOOP' }
    if (closes.at(-1)! > bb.upper) return { action: 'OPEN_SHORT', size: { mode: 'RATIO', value: 0.1 } }
    if (closes.at(-1)! < bb.lower) return { action: 'OPEN_LONG', size: { mode: 'RATIO', value: 0.1 } }
    if (Math.abs(closes.at(-1)! - bb.middle) <= 1) return { action: 'ADJUST_POSITION', reason: 'middle' }
    return { action: 'NOOP' }
  },
}
strategy
`,
    })

    expect(report.status).toBe('PASSED')
    expect(report.summary.criticalFailed).toBe(0)
  })

  it('fails when fallback script is detected', () => {
    const spec = canonicalBuilder.build({
      entryRules: ['rsi < 30 做多'],
      exitRules: ['rsi > 70 平仓'],
    })

    const report = consistency.evaluate({
      canonicalSpec: spec,
      scriptCode: `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const closes = (ctx.bars ?? []).map(item => item.close)
    const fast = ctx.helpers?.ta?.sma(closes, 5)
    const slow = ctx.helpers?.ta?.sma(closes, 20)
    if (fast > slow) return { action: 'OPEN_LONG', reason: 'fallback: fast SMA above slow SMA' }
    return { action: 'NOOP', reason: 'fallback: neutral trend' }
  },
}
strategy
`,
    })

    expect(report.status).toBe('FAILED')
    expect(report.summary.criticalFailed).toBeGreaterThan(0)
    expect(report.checks.some(check => check.key === 'script.fallback_forbidden' && check.status === 'failed')).toBe(true)
  })

  it('fails when bollinger branch directions are reversed even if action set matches', () => {
    const spec = canonicalBuilder.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '突破布林带上轨时做空',
        '跌破布林带下轨时做多',
      ],
      exitRules: ['回到中轨时平仓'],
    })

    const report = consistency.evaluate({
      canonicalSpec: spec,
      scriptCode: `
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const closes = ctx.bars?.map(item => item.close) ?? []
    const bb = ctx.helpers?.ta?.bollingerBands(closes, 20, 2)
    if (!bb) return { action: 'NOOP' }
    if (closes.at(-1)! > bb.upper) return { action: 'OPEN_LONG', size: { mode: 'RATIO', value: 0.1 } }
    if (closes.at(-1)! < bb.lower) return { action: 'OPEN_SHORT', size: { mode: 'RATIO', value: 0.1 } }
    return { action: 'ADJUST_POSITION', reason: 'middle' }
  },
}
strategy
`,
    })

    expect(report.status).toBe('FAILED')
    expect(report.checks.some(check => check.key === 'rules.mapping' && check.status === 'failed')).toBe(true)
  })
})
