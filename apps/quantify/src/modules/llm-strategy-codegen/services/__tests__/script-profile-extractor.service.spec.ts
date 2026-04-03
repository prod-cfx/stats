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
    expect(profile.sizing).toEqual({ mode: 'RATIO', value: 0.1 })
  })
})
