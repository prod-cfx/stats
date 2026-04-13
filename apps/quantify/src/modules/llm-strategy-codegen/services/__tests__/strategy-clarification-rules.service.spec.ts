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
        key: 'entry.side.1',
        reason: 'missing_side_scope',
        allowedAnswers: ['long', 'short'],
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
        key: 'entry.action_uniqueness.1',
        reason: 'missing_action_uniqueness',
        allowedAnswers: ['long', 'short'],
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

  it('blocks long-side strategy when marketType is missing', () => {
    const state = service.detect({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['跌破布林带下轨时做多'],
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

  it('does not block long-only spot strategy as invalid spot-short combo', () => {
    const state = service.detect({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['跌破布林带下轨时做多'],
      riskRules: { exchange: 'binance', marketType: 'spot' },
    })

    expect(state.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: 'invalid_spot_short_combo',
      }),
    ]))
  })

  it('blocks conflicting market scope when session merges two different exchanges', () => {
    const state = service.detect({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['跌破布林带下轨时做多'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        _marketScopeConflicts: [
          {
            field: 'exchange',
            previous: 'okx',
            next: 'binance',
          },
        ],
      },
    })

    expect(state.status).toBe('NEEDS_CLARIFICATION')
    expect(state.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'market.conflict.exchange',
        reason: 'conflicting_market_scope',
        field: 'exchange',
        allowedAnswers: ['okx', 'binance'],
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

  it('blocks generation when symbol, timeframe, and sizing are still missing', () => {
    const state = service.detect({
      entryRules: ['收盘价突破布林带上轨时做空'],
      exitRules: ['价格回到布林带中轨时平仓'],
      riskRules: { exchange: 'okx', marketType: 'perp', stopLossPct: 5 },
    })

    expect(state.status).toBe('NEEDS_CLARIFICATION')
    expect(state.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'market.symbol', reason: 'missing_symbol' }),
      expect.objectContaining({ key: 'market.timeframe', reason: 'missing_timeframe' }),
      expect.objectContaining({ key: 'sizing.positionPct', reason: 'missing_position_pct' }),
    ]))
  })

  it('blocks missing required rule buckets and market sizing fields even when entry rules are absent', () => {
    const state = service.detect({
      riskRules: { exchange: 'okx', marketType: 'perp' },
    })

    expect(state.status).toBe('NEEDS_CLARIFICATION')
    expect(state.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'entry.rules', reason: 'missing_entry_rules' }),
      expect.objectContaining({ key: 'exit.rules', reason: 'missing_exit_rules' }),
      expect.objectContaining({ key: 'risk.stopLoss.rule', reason: 'missing_stop_loss_rule' }),
      expect.objectContaining({ key: 'risk.takeProfit.rule', reason: 'missing_take_profit_rule' }),
      expect.objectContaining({ key: 'market.symbol', reason: 'missing_symbol' }),
      expect.objectContaining({ key: 'market.timeframe', reason: 'missing_timeframe' }),
      expect.objectContaining({ key: 'sizing.positionPct', reason: 'missing_position_pct' }),
    ]))
  })

  it('blocks percentage rules that omit comparison basis', () => {
    const state = service.detect({
      symbols: ['BTCUSDT'],
      timeframes: ['3m', '15m'],
      entryRules: ['3 分钟内跌 1% 买入'],
      exitRules: ['15 分钟内涨 2% 卖出'],
      riskRules: { exchange: 'okx', marketType: 'spot', positionPct: 10, stopLossPct: 5 },
    })

    expect(state.status).toBe('NEEDS_CLARIFICATION')
    expect(state.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'ambiguous_condition_basis', key: 'entry.basis.1' }),
      expect.objectContaining({ reason: 'ambiguous_condition_basis', key: 'exit.basis.1' }),
      expect.objectContaining({ reason: 'ambiguous_condition_basis', key: 'risk.stopLoss.basis' }),
    ]))
    expect(state.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'entry.basis.1',
        question: '入场规则“3 分钟内跌 1% 买入”里的百分比条件，是相对上一根 K 线收盘价、开仓均价、持仓收益，还是别的基准？',
      }),
      expect.objectContaining({
        key: 'exit.basis.1',
        question: '出场规则“15 分钟内涨 2% 卖出”里的百分比条件，是相对上一根 K 线收盘价、开仓均价、持仓收益，还是别的基准？',
      }),
    ]))
  })

  it('blocks sequence, take-profit, and drawdown basis gaps beyond simple rise fall percentages', () => {
    const state = service.detect({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['连续 3 根 K 线累计回撤 2% 后买入'],
      exitRules: ['回撤 5% 止盈'],
      riskRules: {
      exchange: 'okx',
      marketType: 'perp',
      positionPct: 10,
      stopLossPct: 5,
      stopLossBasis: 'entry_avg_price',
      takeProfitPct: 12,
    },
  })

  expect(state.status).toBe('NEEDS_CLARIFICATION')
  expect(state.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ reason: 'ambiguous_condition_basis', key: 'entry.basis.1' }),
    expect.objectContaining({ reason: 'ambiguous_condition_basis', key: 'exit.basis.1' }),
  ]))
  })

  it('does not block percentage rules that already state an explicit basis in text', () => {
    const state = service.detect({
      symbols: ['BTCUSDT'],
      timeframes: ['3m', '15m'],
      entryRules: ['当前K线收盘价相对于上一根K线收盘价下跌≥1%时买入开仓'],
      exitRules: ['当前K线收盘价相对于开仓均价上涨≥2%时卖出平仓'],
      riskRules: {
        exchange: 'okx',
        marketType: 'spot',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
        takeProfitPct: 8,
        takeProfitBasis: 'position_pnl',
      },
    })

    expect(state.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'entry.basis.1' }),
      expect.objectContaining({ key: 'exit.basis.1' }),
    ]))
  })

  it('treats stop-loss and take-profit semantics in exit rules as satisfying required buckets', () => {
    const state = service.detect({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['突破布林带上轨时做空'],
      exitRules: ['盈利 10% 止盈', '亏损 5% 止损'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    })

    expect(state.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'missing_stop_loss_rule' }),
      expect.objectContaining({ reason: 'missing_take_profit_rule' }),
    ]))
  })

  it('does not duplicate risk basis blockers when exit rules already carry stop-loss or take-profit semantics', () => {
    const state = service.detect({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['突破布林带上轨时做空'],
      exitRules: ['盈利 10% 止盈', '亏损达到 5% 强制止损'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
        stopLossPct: 5,
        takeProfitPct: 10,
      },
    })

    expect(state.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'exit.basis.1', reason: 'ambiguous_condition_basis' }),
      expect.objectContaining({ key: 'exit.basis.2', reason: 'ambiguous_condition_basis' }),
    ]))
    expect(state.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'risk.stopLoss.basis' }),
      expect.objectContaining({ key: 'risk.takeProfit.basis' }),
    ]))
  })

  it('returns CLEAR for unambiguous rules', () => {
    const state = service.detect({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['突破布林带上轨时做空'],
      exitRules: ['价格回到布林带中轨时平仓'],
      riskRules: {
        exchange: 'binance',
        marketType: 'perp',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
        takeProfitPct: 12,
        takeProfitBasis: 'position_pnl',
      },
    })

    expect(state).toEqual({
      status: 'CLEAR',
      items: [],
    })
  })
})
