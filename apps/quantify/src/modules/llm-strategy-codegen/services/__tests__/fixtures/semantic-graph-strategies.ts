export interface OrdinarySemanticGraphStrategyFixture {
  id: string
  prompt: string
  planner: {
    related: true
    logicReady: true
    assistantPrompt: string
    logic: {
      symbols: string[]
      timeframes: string[]
      entryRules: string[]
      exitRules: string[]
      riskRules: Record<string, unknown>
    }
  }
  expected: {
    symbol: string
    primaryTimeframe: string
    nodeKinds: string[]
    actionKinds: string[]
    riskKinds: string[]
  }
}

export const ordinarySemanticGraphStrategyFixtures: OrdinarySemanticGraphStrategyFixture[] = [
  {
    id: 'bollinger-reversion',
    prompt:
      '在BTCUSDT 15分钟图上，突破布林带上轨做空、突破下轨做多，仓位10%；出场条件为价格回到布林带中轨（MA20）平仓、亏损≥5%强制止损，以及价格连续3根K线在轨外时提前减仓。',
    planner: {
      related: true,
      logicReady: true,
      assistantPrompt: '逻辑已完整，请确认后生成代码。',
      logic: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['突破布林带上轨做空', '突破布林带下轨做多'],
        exitRules: ['价格回到布林带中轨（MA20）平仓'],
        riskRules: {
          positionPct: 10,
          stopLossPct: 5,
          outsideBandRule: '价格连续3根K线在轨外时提前减仓',
        },
      },
    },
    expected: {
      symbol: 'BTCUSDT',
      primaryTimeframe: '15m',
      nodeKinds: ['bollinger_band_touch', 'bollinger_bars_outside'],
      actionKinds: ['OPEN_LONG', 'OPEN_SHORT', 'CLOSE_LONG', 'CLOSE_SHORT', 'REDUCE_POSITION'],
      riskKinds: ['STOP_LOSS_PCT'],
    },
  },
  {
    id: 'multi-timeframe-drop-rise',
    prompt:
      '在BTC/USDT的3分钟周期，当当前K线收盘价相对于上一根K线收盘价下跌≥1%时买入开仓；在15分钟周期，当当前K线收盘价相对于开仓均价上涨≥2%时卖出平仓，并设置5%止损和10%仓位。',
    planner: {
      related: true,
      logicReady: true,
      assistantPrompt: '逻辑已完整，请确认后生成代码。',
      logic: {
        symbols: ['BTCUSDT'],
        timeframes: ['3m', '15m'],
        entryRules: ['当前K线收盘价相对于上一根K线收盘价下跌≥1%时买入开仓'],
        exitRules: ['当前K线收盘价相对于开仓均价上涨≥2%时卖出平仓'],
        riskRules: {
          positionPct: 10,
          stopLossPct: 5,
        },
      },
    },
    expected: {
      symbol: 'BTCUSDT',
      primaryTimeframe: '3m',
      nodeKinds: ['price_change_pct', 'position_pnl_pct'],
      actionKinds: ['OPEN_LONG', 'CLOSE_LONG'],
      riskKinds: ['STOP_LOSS_PCT'],
    },
  },
  {
    id: 'fixed-range-grid',
    prompt:
      '在BTCUSDT上，基于60000-80000固定区间按1%等距划分网格线，当价格等于或低于网格线时买入，买入后价格上涨触及上方网格线时卖出。仓位为总资金1%，单笔最大亏损2%。',
    planner: {
      related: true,
      logicReady: true,
      assistantPrompt: '逻辑已完整，请确认后生成代码。',
      logic: {
        symbols: ['BTCUSDT'],
        timeframes: ['15m'],
        entryRules: ['在60000-80000固定区间按步长1%，共21格执行区间网格买入'],
        exitRules: ['价格触达上方网格卖出'],
        riskRules: {
          positionPct: 1,
          maxSingleLossPct: 2,
        },
      },
    },
    expected: {
      symbol: 'BTCUSDT',
      primaryTimeframe: '15m',
      nodeKinds: ['grid_level_touch'],
      actionKinds: ['OPEN_LONG', 'CLOSE_LONG'],
      riskKinds: ['MAX_SINGLE_LOSS_PCT'],
    },
  },
]
