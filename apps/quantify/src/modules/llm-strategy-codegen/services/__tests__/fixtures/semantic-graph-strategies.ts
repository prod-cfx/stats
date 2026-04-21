export interface OrdinarySemanticGraphStrategyFixture {
  id: string
  prompt: string
  planner: {
    related: true
    logicReady: true
    assistantPrompt: string
    semanticPatch: Record<string, unknown>
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
      semanticPatch: {
        contextSlots: { symbol: 'BTCUSDT', timeframe: '15m' },
        triggers: [
          { key: 'bollinger.touch_upper', phase: 'entry', sideScope: 'short', params: { band: 'upper' } },
          { key: 'bollinger.touch_lower', phase: 'entry', sideScope: 'long', params: { band: 'lower' } },
          { key: 'bollinger.touch_middle', phase: 'exit', sideScope: 'both', params: { band: 'middle', period: 20 } },
          { key: 'bollinger.bars_outside', phase: 'risk', sideScope: 'both', params: { bars: 3 } },
        ],
        actions: [
          { key: 'open_short' },
          { key: 'open_long' },
          { key: 'close_short' },
          { key: 'close_long' },
        ],
        risk: [
          { key: 'risk.stop_loss_pct', params: { valuePct: 5 } },
        ],
        position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_short' },
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
      semanticPatch: {
        contextSlots: { symbol: 'BTCUSDT', timeframe: '3m' },
        triggers: [
          { key: 'price.percent_change', phase: 'entry', sideScope: 'long', params: { valuePct: -1, basis: 'prev_close', window: '3m' } },
          { key: 'price.percent_change', phase: 'exit', sideScope: 'long', params: { valuePct: 2, basis: 'entry_avg_price', window: '15m' } },
        ],
        actions: [
          { key: 'open_long' },
          { key: 'close_long' },
        ],
        risk: [
          { key: 'risk.stop_loss_pct', params: { valuePct: 5 } },
        ],
        position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only' },
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
      semanticPatch: {
        contextSlots: { symbol: 'BTCUSDT', timeframe: '15m' },
        triggers: [
          {
            key: 'grid.range_rebalance',
            phase: 'entry',
            sideScope: 'long',
            params: { rangeLower: 60000, rangeUpper: 80000, stepPct: 1 },
          },
        ],
        actions: [
          { key: 'open_long' },
          { key: 'close_long' },
        ],
        risk: [
          { key: 'risk.max_single_loss_pct', params: { valuePct: 2 } },
        ],
        position: { mode: 'fixed_ratio', value: 0.01, positionMode: 'long_only' },
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
