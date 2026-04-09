import { StrategyClarificationRulesService } from '../strategy-clarification-rules.service'

describe('strategyClarificationRulesService', () => {
  const service = new StrategyClarificationRulesService()

  it('detects missing side scope for upper-band breakout entry rule', () => {
    const state = service.detect({
      entryRules: ['突破布林带上轨交易'],
    })

    expect(state.status).toBe('NEEDS_CLARIFICATION')
    expect(state.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'entry.side',
        reason: 'missing_side_scope',
        status: 'pending',
      }),
    ]))
  })

  it('detects entry action uniqueness conflict when one rule includes long and short actions', () => {
    const state = service.detect({
      entryRules: ['突破后同时做多和做空'],
    })

    expect(state.status).toBe('NEEDS_CLARIFICATION')
    expect(state.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'missing_action_uniqueness',
        status: 'pending',
      }),
    ]))
  })

  it('detects ambiguous risk effect when risk text contains force-exit and reduce-position alternatives', () => {
    const state = service.detect({
      riskRules: {
        earlyStop: '价格连续3根K线在轨外时全平或减仓',
      },
    })

    expect(state.status).toBe('NEEDS_CLARIFICATION')
    expect(state.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'riskRules.earlyStop.action',
        reason: 'ambiguous_risk_effect',
        field: 'riskRules.earlyStop.action',
        allowedAnswers: ['reduce', 'close'],
        blocking: true,
      }),
    ]))
  })

  it('blocks short-side bollinger strategy when marketType is missing', () => {
    const state = service.detect({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['突破布林带上轨时做空'],
      riskRules: { exchange: 'binance' },
    })

    expect(state.status).toBe('NEEDS_CLARIFICATION')
    expect(state.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'market.marketType',
        reason: 'missing_market_type',
        field: 'marketType',
        blocking: true,
        status: 'pending',
      }),
    ]))
  })

  it('blocks short-side strategy with spot marketType as invalid spot-short combo', () => {
    const state = service.detect({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['突破布林带上轨时做空'],
      riskRules: { exchange: 'binance', marketType: 'spot' },
    })

    expect(state.status).toBe('NEEDS_CLARIFICATION')
    expect(state.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'market.marketType',
        reason: 'invalid_spot_short_combo',
        field: 'marketType',
        blocking: true,
        status: 'pending',
      }),
    ]))
  })

  it('blocks short-side strategy when exchange is missing', () => {
    const state = service.detect({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['突破布林带上轨时做空'],
      riskRules: { marketType: 'perp' },
    })

    expect(state.status).toBe('NEEDS_CLARIFICATION')
    expect(state.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'market.exchange',
        reason: 'missing_exchange',
        field: 'exchange',
        blocking: true,
        status: 'pending',
      }),
    ]))
  })

  it('does not emit market blockers before action uniqueness is resolved', () => {
    const state = service.detect({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['突破后同时做多和做空'],
      riskRules: {},
    })

    expect(state.status).toBe('NEEDS_CLARIFICATION')
    expect(state.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'missing_action_uniqueness',
      }),
    ]))
    expect(state.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'missing_market_type' }),
      expect.objectContaining({ reason: 'missing_exchange' }),
      expect.objectContaining({ reason: 'invalid_spot_short_combo' }),
    ]))
  })

  it('blocks early-stop rule when action is ambiguous between close and reduce', () => {
    const state = service.detect({
      riskRules: {
        earlyStop: '价格连续3根K线在轨外时提前止损或减仓',
      },
    })

    expect(state.status).toBe('NEEDS_CLARIFICATION')
    expect(state.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'riskRules.earlyStop.action',
        reason: 'ambiguous_risk_effect',
        field: 'riskRules.earlyStop.action',
        allowedAnswers: ['reduce', 'close'],
        blocking: true,
        status: 'pending',
      }),
    ]))
  })

  it('returns CLEAR for unambiguous rules', () => {
    const state = service.detect({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['突破布林带上轨时做空'],
      riskRules: {
        exchange: 'binance',
        marketType: 'perp',
        stopLossPct: 5,
      },
    })

    expect(state).toEqual({
      status: 'CLEAR',
      items: [],
    })
  })
})
