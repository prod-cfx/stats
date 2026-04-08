import { ScriptProfileExtractorService } from '../script-profile-extractor.service'

describe('scriptProfileExtractorService', () => {
  it('extracts bollinger, actions and sizing from strategy script', () => {
    const service = new ScriptProfileExtractorService()
    const profile = service.extract(`
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const bands = ctx.helpers?.ta?.bollingerBands([], 20, 2)
    if (ctx.price > upper) return { action: 'OPEN_SHORT', size: { mode: 'RATIO', value: 0.1 } }
    if (ctx.price < lower) return { action: 'OPEN_LONG', size: { mode: 'RATIO', value: 0.1 } }
    if (ctx.price === bands?.middle) return { action: 'ADJUST_POSITION', size: { mode: 'QTY', value: 0 }, reason: 'middle' }
    return { action: 'NOOP', reason: 'wait' }
  },
}
strategy`)

    expect(profile.indicators.some(item => item.kind === 'bollingerBands')).toBe(true)
    expect(profile.actions).toEqual(expect.arrayContaining(['OPEN_SHORT', 'OPEN_LONG', 'ADJUST_POSITION']))
    expect(profile.ruleMappings).toEqual(expect.arrayContaining([
      { key: 'bollinger.upper_break', action: 'OPEN_SHORT' },
      { key: 'bollinger.lower_break', action: 'OPEN_LONG' },
      { key: 'bollinger.middle_revert', action: 'ADJUST_POSITION' },
    ]))
    expect(profile.sizing).toEqual({ mode: 'RATIO', value: 0.1, source: 'literal' })
  })

  it('extracts normalized ratio sizing derived from positionPct params', () => {
    const service = new ScriptProfileExtractorService()
    const profile = service.extract(`
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const positionPct = ctx.paramsNormalized?.positionPct
    const ratio = typeof positionPct === 'number' && positionPct > 0
      ? Math.min(positionPct / 100, 1)
      : 0.1
    return { action: 'OPEN_LONG', size: { mode: 'RATIO', value: ratio }, reason: 'x' }
  },
}
strategy`)

    expect(profile.sizing).toMatchObject({
      mode: 'RATIO',
      source: 'positionPct_normalized',
    })
  })

  it('recognizes BBANDS evidence and keeps sizing empty when script has no explicit size field', () => {
    const service = new ScriptProfileExtractorService()
    const profile = service.extract(`
const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar(ctx): StrategyDecisionV1 {
    const closes = (ctx.bars ?? []).map(item => item.close)
    const bb = ctx.helpers?.ta?.BBANDS(closes, 20, 2)
    if (!bb) return { action: 'NOOP', reason: 'wait' }
    if (closes.at(-1)! > bb.upper) return { action: 'OPEN_SHORT', reason: 'upper break' }
    if (closes.at(-1)! < bb.lower) return { action: 'OPEN_LONG', reason: 'lower break' }
    return { action: 'NOOP', reason: 'wait' }
  },
}
strategy`)

    expect(profile.indicators.some(item => item.kind === 'bollingerBands')).toBe(true)
    expect(profile.actions).toEqual(expect.arrayContaining(['OPEN_SHORT', 'OPEN_LONG']))
    expect(profile.sizing).toBeNull()
  })

  it('normalizes compiled pct_equity quantity literals back to ratio semantics', () => {
    const service = new ScriptProfileExtractorService()
    const profile = service.extract(`
const DECISION_PROGRAMS = [
  {
    id: 'decision_01_entry',
    actions: [{ kind: 'OPEN_SHORT', quantity: { mode: 'pct_equity', value: 10 } }],
  },
]
`)

    expect(profile.sizing).toEqual({ mode: 'RATIO', value: 0.1, source: 'literal' })
  })

  it('binds moving-average crossover rules to executable actions instead of preceding NOOP guards', () => {
    const service = new ScriptProfileExtractorService()
    const profile = service.extract(`
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
strategy`)

    expect(profile.ruleMappings).toEqual(expect.arrayContaining([
      { key: 'ma.death_cross', action: 'OPEN_SHORT' },
      { key: 'ma.golden_cross', action: 'CLOSE_SHORT' },
    ]))
  })
})
