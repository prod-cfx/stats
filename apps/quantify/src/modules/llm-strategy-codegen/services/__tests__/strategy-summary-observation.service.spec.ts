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
