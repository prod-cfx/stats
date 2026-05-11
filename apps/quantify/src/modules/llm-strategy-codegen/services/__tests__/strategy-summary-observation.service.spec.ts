import { StrategySummaryObservationService } from '../strategy-summary-observation.service'

describe('strategySummaryObservationService', () => {
  const service = new StrategySummaryObservationService()

  it('treats user-intent and derived summary drift as observational warnings only', () => {
    const report = service.build({
      userIntentSummary: {
        strategyType: 'bollinger',
        indicators: ['bollingerBands'],
        entryRule: 'bollinger.upper_break_short',
        exitRule: 'bollinger.middle_revert',
        market: { symbol: 'BTCUSDT', timeframe: '15m', marketType: 'perp' },
        sizing: { mode: 'RATIO', evidence: 'explicit' },
      },
      strategySummary: {
        strategyType: 'bollinger',
        indicators: ['bollingerBands', 'sma'],
        entryRule: 'bollinger.upper_break_short',
        exitRule: 'bollinger.middle_revert',
        market: { symbol: 'BTCUSDT', timeframe: '15m', marketType: 'perp' },
        sizing: { mode: 'RATIO', evidence: 'explicit' },
      },
      scriptSummary: {
        strategyType: 'bollinger',
        indicators: ['bollingerBands'],
        entryRule: 'bollinger.upper_break_short',
        exitRule: 'bollinger.middle_revert',
        market: {},
        sizing: { mode: 'RATIO', evidence: 'explicit' },
      },
    })

    expect(report.status).toBe('drifted')
    expect(report.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('用户意图.indicators'),
      expect.stringContaining('策略描述.indicators'),
    ]))
  })

  // -------------------------------------------------------------------------
  // #1186 PR5: multi-leg legs[] diff
  // -------------------------------------------------------------------------

  it('reports no sizing diff when both summaries declare identical multi-leg legs[]', () => {
    const legs = [
      { legId: 'leg-1', mode: 'QUOTE' as const, value: 100, asset: 'USDT', scopeKey: 'scope-leg-leg-1' },
      { legId: 'leg-2', mode: 'QUOTE' as const, value: 200, asset: 'USDT', scopeKey: 'scope-leg-leg-2' },
    ]
    const report = service.build({
      userIntentSummary: {
        strategyType: 'custom',
        indicators: [],
        entryRule: 'custom',
        exitRule: 'custom',
        market: { symbol: 'BTCUSDT', timeframe: '15m', marketType: 'perp' },
        sizing: { mode: 'MULTI_LEG', evidence: 'explicit', legs },
      },
      strategySummary: {
        strategyType: 'custom',
        indicators: [],
        entryRule: 'custom',
        exitRule: 'custom',
        market: { symbol: 'BTCUSDT', timeframe: '15m', marketType: 'perp' },
        sizing: { mode: 'MULTI_LEG', evidence: 'explicit', legs },
      },
      scriptSummary: {
        strategyType: 'custom',
        indicators: [],
        entryRule: 'custom',
        exitRule: 'custom',
        market: {},
        sizing: { mode: 'MULTI_LEG', evidence: 'explicit', legs },
      },
    })

    expect(report.status).toBe('aligned')
    expect(report.warnings.filter(w => w.includes('sizing'))).toEqual([])
  })

  it('flags mode mismatch when one side is single-position and the other is multi-leg', () => {
    const report = service.build({
      userIntentSummary: {
        strategyType: 'custom',
        indicators: [],
        entryRule: 'custom',
        exitRule: 'custom',
        market: { symbol: 'BTCUSDT', timeframe: '15m', marketType: 'perp' },
        sizing: { mode: 'RATIO', evidence: 'explicit' },
      },
      strategySummary: {
        strategyType: 'custom',
        indicators: [],
        entryRule: 'custom',
        exitRule: 'custom',
        market: { symbol: 'BTCUSDT', timeframe: '15m', marketType: 'perp' },
        sizing: {
          mode: 'MULTI_LEG',
          evidence: 'explicit',
          legs: [
            { legId: 'leg-1', mode: 'QUOTE', value: 100, asset: 'USDT', scopeKey: 'scope-leg-leg-1' },
            { legId: 'leg-2', mode: 'QUOTE', value: 200, asset: 'USDT', scopeKey: 'scope-leg-leg-2' },
          ],
        },
      },
      scriptSummary: {
        strategyType: 'custom',
        indicators: [],
        entryRule: 'custom',
        exitRule: 'custom',
        market: {},
        sizing: { mode: 'RATIO', evidence: 'explicit' },
      },
    })

    expect(report.status).toBe('drifted')
    expect(report.warnings.some(w => w.includes('sizing') && w.includes('MULTI_LEG'))).toBe(true)
  })

  it('flags per-leg value drift even when both sides declare MULTI_LEG mode', () => {
    const report = service.build({
      userIntentSummary: {
        strategyType: 'custom',
        indicators: [],
        entryRule: 'custom',
        exitRule: 'custom',
        market: { symbol: 'BTCUSDT', timeframe: '15m', marketType: 'perp' },
        sizing: {
          mode: 'MULTI_LEG',
          evidence: 'explicit',
          legs: [
            { legId: 'leg-1', mode: 'QUOTE', value: 100, asset: 'USDT', scopeKey: 'scope-leg-leg-1' },
          ],
        },
      },
      strategySummary: {
        strategyType: 'custom',
        indicators: [],
        entryRule: 'custom',
        exitRule: 'custom',
        market: { symbol: 'BTCUSDT', timeframe: '15m', marketType: 'perp' },
        sizing: {
          mode: 'MULTI_LEG',
          evidence: 'explicit',
          legs: [
            { legId: 'leg-1', mode: 'QUOTE', value: 999, asset: 'USDT', scopeKey: 'scope-leg-leg-1' },
          ],
        },
      },
      scriptSummary: {
        strategyType: 'custom',
        indicators: [],
        entryRule: 'custom',
        exitRule: 'custom',
        market: {},
        sizing: {
          mode: 'MULTI_LEG',
          evidence: 'explicit',
          legs: [
            { legId: 'leg-1', mode: 'QUOTE', value: 100, asset: 'USDT', scopeKey: 'scope-leg-leg-1' },
          ],
        },
      },
    })

    expect(report.status).toBe('drifted')
    expect(report.warnings.some(w => w.includes('sizing.legs') && w.includes('leg-1'))).toBe(true)
  })

  it('returns unprovable when summaries are incomplete', () => {
    const report = service.build({
      strategySummary: {
        strategyType: 'bollinger',
        indicators: ['bollingerBands'],
        entryRule: 'bollinger.upper_break_short',
        exitRule: 'bollinger.middle_revert',
        market: {},
        sizing: null,
      },
    })

    expect(report.status).toBe('unprovable')
    expect(report.warnings).toEqual([])
  })
})
