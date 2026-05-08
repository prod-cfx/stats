export interface OriginalStrategyAtomicCase {
  id: string
  message: string
  expectedSummaryIncludes?: string[]
  expectedSummaryExcludes?: string[]
  expectedEntryAtomKeys?: string[]
  expectedExitAtomKeys?: string[]
  expectedActionTypes?: string[]
  expectedSemanticTriggers?: Array<{
    key: string
    phase?: string
    status?: string
    params?: Record<string, unknown>
  }>
  expectedOrderPrograms?: Array<{
    mode?: string
    levelSet?: Record<string, unknown>
    budget?: Record<string, unknown>
  }>
  expectedContext?: {
    exchange?: string
    symbol?: string
    marketType?: string
    timeframe?: string
  }
}

export const ORIGINAL_STRATEGY_ATOMIC_CASES: OriginalStrategyAtomicCase[] = [
  {
    id: 'ema-stack-and-exit-fixed-usdt',
    message: '入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt',
    expectedSummaryIncludes: ['EMA20 上方', 'EMA60 上方', 'EMA144 上方', '价格低于 EMA20', '10 USDT'],
    expectedEntryAtomKeys: ['indicator.above', 'indicator.above', 'indicator.above'],
    expectedExitAtomKeys: ['indicator.below'],
    expectedActionTypes: ['OPEN_LONG', 'CLOSE_LONG'],
    expectedSemanticTriggers: [
      { key: 'indicator.above', phase: 'entry', params: { 'reference.period': 20 } },
      { key: 'indicator.above', phase: 'entry', params: { 'reference.period': 60 } },
      { key: 'indicator.above', phase: 'entry', params: { 'reference.period': 144 } },
      { key: 'indicator.below', phase: 'exit', params: { 'reference.period': 20 } },
    ],
    expectedContext: { timeframe: '15m' },
  },
  {
    id: 'okx-btc-percent-window',
    message: '策略一：在okx交易所 我想买btc  3分钟之内跌百分1买入  15分钟之内涨百分2卖出  单笔用百分10资金 止损5% 止盈10%',
    expectedEntryAtomKeys: ['price.change_pct'],
    expectedExitAtomKeys: ['price.change_pct'],
    expectedActionTypes: ['OPEN_LONG', 'CLOSE_LONG'],
    expectedSemanticTriggers: [
      { key: 'price.percent_change', phase: 'entry', params: { window: '3m', valuePct: -1, direction: 'down' } },
      { key: 'price.percent_change', phase: 'exit', params: { window: '15m', valuePct: 2, direction: 'up' } },
    ],
    expectedContext: { exchange: 'okx', symbol: 'BTCUSDT' },
  },
  {
    id: 'okx-perp-bollinger-dual-side',
    message: '策略二：OKX 合约 BTCUSDT 15m，价格触及/突破布林带(20,2)上轨时做空，触及/突破下轨时做多；多单在价格回到布林带中轨(MA20)时平仓，空单在价格跌破布林带中轨(MA20)时平仓；单笔仓位 10%。',
    expectedEntryAtomKeys: ['bollinger.upper_break', 'bollinger.lower_break'],
    expectedExitAtomKeys: ['bollinger.middle_revert'],
    expectedActionTypes: ['OPEN_SHORT', 'OPEN_LONG', 'CLOSE_LONG', 'CLOSE_SHORT'],
    expectedContext: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
  },
  {
    id: 'okx-perp-fixed-range-grid',
    message: '策略三：在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈',
    expectedEntryAtomKeys: ['grid.range_rebalance'],
    expectedActionTypes: ['PLACE_GRID_ORDER'],
    expectedSemanticTriggers: [
      { key: 'grid.range_rebalance', phase: 'entry', params: { rangeLower: 60000, rangeUpper: 80000, stepPct: 0.5, sideMode: 'bidirectional' } },
    ],
    expectedOrderPrograms: [
      { mode: 'perp_neutral', levelSet: { lower: 60000, upper: 80000, spacingPct: 0.5 }, budget: { mode: 'per_order_pct_equity', value: 10 } },
    ],
    expectedContext: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
  },
  {
    id: 'okx-spot-ordi-immediate-entry',
    message: '在 OKX 现货 ORDI/USDT 上，主周期 1h，使用 10% 固定仓位只做多；入场动作为立即开始时市价买入；出场规则为价格相对前收盘上涨 1% 时卖出，另有相对入场均价下跌 5% 止损卖出、相对入场均价上涨 10% 止盈卖出。',
    expectedEntryAtomKeys: ['execution.on_start'],
    expectedExitAtomKeys: ['price.change_pct'],
    expectedActionTypes: ['OPEN_LONG', 'CLOSE_LONG'],
    expectedSemanticTriggers: [
      { key: 'execution.on_start', phase: 'entry', params: { timing: 'on_start', orderType: 'market', occurrence: 'once' } },
      { key: 'price.percent_change', phase: 'exit', params: { valuePct: 1, direction: 'up', basis: 'prev_close' } },
    ],
    expectedContext: { exchange: 'okx', symbol: 'ORDIUSDT', marketType: 'spot', timeframe: '1h' },
  },
  {
    id: 'okx-perp-bollinger-1m-tight-risk',
    message: 'OKX 合约 BTCUSDT 1m，使用布林带 5,1。价格触及或突破上轨时做空，价格触及或突破下轨时做多；多单在价格回到中轨时平仓，空单在价格回到中轨时平仓；单笔仓位 10%，止损 1%，止盈 1.5%。',
    expectedEntryAtomKeys: ['bollinger.upper_break', 'bollinger.lower_break'],
    expectedActionTypes: ['OPEN_SHORT', 'OPEN_LONG', 'CLOSE_LONG', 'CLOSE_SHORT'],
    expectedContext: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '1m' },
  },
  {
    id: 'btc-candle-close-open',
    message: '用 BTCUSDT 1m K 线。每次最新 K 线收盘价高于开盘价时尝试开多。如果已有持仓则不再开仓。收盘价低于开盘价时平多。',
    expectedEntryAtomKeys: ['condition.expression'],
    expectedExitAtomKeys: ['condition.expression'],
    expectedActionTypes: ['OPEN_LONG', 'CLOSE_LONG'],
    expectedSemanticTriggers: [
      { key: 'condition.expression', phase: 'entry', params: { expression: { op: 'GT', left: { field: 'close' }, right: { field: 'open' } } } },
      { key: 'condition.expression', phase: 'gate', params: { expression: { op: 'EQ', left: { field: 'has_position', side: 'long' }, right: { value: false } } } },
      { key: 'condition.expression', phase: 'exit', params: { expression: { op: 'LT', left: { field: 'close' }, right: { field: 'open' } } } },
    ],
    expectedContext: { symbol: 'BTCUSDT', timeframe: '1m' },
  },
  {
    id: 'okx-spot-eth-centered-grid-boundary-cancel',
    message: 'OKX 现货 ETHUSDT、1m 网格以部署时当前价为中心，上下各0.4%共10格、每格10 USDT、限价单并相邻网格自动挂反向单、不用趋势信号开仓；当价格突破上下边界时执行“立即停止并撤销所有未成交订单”',
    expectedEntryAtomKeys: ['grid.range_rebalance'],
    expectedActionTypes: ['PLACE_GRID_ORDER', 'CANCEL_UNFILLED_ORDERS', 'STOP_STRATEGY'],
    expectedSemanticTriggers: [
      { key: 'grid.range_rebalance', phase: 'entry', params: { sideMode: 'long_only', recycle: true } },
    ],
    expectedOrderPrograms: [
      { mode: 'spot', levelSet: { mode: 'centered_percent_range', halfRangePct: 0.4, gridIntervals: 10 }, budget: { mode: 'per_order_quote', value: 10, asset: 'USDT' } },
    ],
    expectedContext: { exchange: 'okx', symbol: 'ETHUSDT', marketType: 'spot', timeframe: '1m' },
  },
  {
    id: 'okx-perp-tight-grid',
    message: '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 79200-80200，采用双向网格，每格间距 0.1%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈',
    expectedEntryAtomKeys: ['grid.range_rebalance'],
    expectedActionTypes: ['PLACE_GRID_ORDER'],
    expectedSemanticTriggers: [
      { key: 'grid.range_rebalance', phase: 'entry', params: { rangeLower: 79200, rangeUpper: 80200, stepPct: 0.1, sideMode: 'bidirectional' } },
    ],
    expectedOrderPrograms: [
      { mode: 'perp_neutral', levelSet: { lower: 79200, upper: 80200, spacingPct: 0.1 }, budget: { mode: 'per_order_pct_equity', value: 10 } },
    ],
    expectedContext: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
  },
  {
    id: 'okx-perp-ema-cross-cross-margin',
    message: '创建一个 OKX BTCUSDT 永续合约策略，使用 15 分钟 K 线。当 EMA7 上穿 EMA21 时开多；当 EMA7 下穿 EMA21 时平多。每次使用账户权益的 10% 开仓，杠杆 1 倍，逐仓不要使用，使用全仓 cross。',
    expectedEntryAtomKeys: ['ma.golden_cross'],
    expectedExitAtomKeys: ['ma.death_cross'],
    expectedActionTypes: ['OPEN_LONG', 'CLOSE_LONG'],
    expectedSemanticTriggers: [
      { key: 'indicator.cross_over', phase: 'entry', params: { indicator: 'ema', fastPeriod: 7, slowPeriod: 21 } },
      { key: 'indicator.cross_under', phase: 'exit', params: { indicator: 'ema', fastPeriod: 7, slowPeriod: 21 } },
    ],
    expectedContext: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
  },
  {
    id: 'plain-bollinger-15m',
    message: '15min 布林带下轨买入 上轨卖出',
    expectedEntryAtomKeys: ['bollinger.lower_break'],
    expectedExitAtomKeys: ['bollinger.upper_break'],
    expectedActionTypes: ['OPEN_LONG', 'CLOSE_LONG'],
    expectedContext: { timeframe: '15m' },
  },
  {
    id: 'plain-ema-cross',
    message: 'EMA7 上穿 EMA21 时开多；下穿 时平多。',
    expectedEntryAtomKeys: ['ma.golden_cross'],
    expectedExitAtomKeys: ['ma.death_cross'],
    expectedActionTypes: ['OPEN_LONG', 'CLOSE_LONG'],
    expectedSemanticTriggers: [
      { key: 'indicator.cross_over', phase: 'entry', params: { indicator: 'ema', fastPeriod: 7, slowPeriod: 21 } },
      { key: 'indicator.cross_under', phase: 'exit', params: { indicator: 'ema', fastPeriod: 7, slowPeriod: 21 } },
    ],
  },
  {
    id: 'okx-btc-macd-hour',
    message: 'OKX 上用 BTC/USDT，1 小时 K，MACD 金叉买入死叉卖出',
    expectedEntryAtomKeys: ['macd.golden_cross'],
    expectedExitAtomKeys: ['macd.death_cross'],
    expectedActionTypes: ['OPEN_LONG', 'CLOSE_LONG'],
    expectedSemanticTriggers: [
      { key: 'indicator.cross_over', phase: 'entry', params: { indicator: 'macd', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
      { key: 'indicator.cross_under', phase: 'exit', params: { indicator: 'macd', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
    ],
    expectedContext: { exchange: 'okx', symbol: 'BTCUSDT', timeframe: '1h' },
  },
  {
    id: 'plain-grid-range',
    message: '15m 周期，价格区间 79200-80200，采用双向网格',
    expectedEntryAtomKeys: ['grid.range_rebalance'],
    expectedSemanticTriggers: [
      { key: 'grid.range_rebalance', phase: 'entry', params: { rangeLower: 79200, rangeUpper: 80200, sideMode: 'bidirectional' } },
    ],
    expectedContext: { timeframe: '15m' },
  },
  {
    id: 'btc-rolling-breakout',
    message: 'BTC 4小时突破过去 20 根 K 线最高价做多，跌破过去 10 根 K 线最低价平仓。',
    expectedEntryAtomKeys: ['price.rolling_extrema_breakout'],
    expectedExitAtomKeys: ['price.rolling_extrema_breakout'],
    expectedActionTypes: ['OPEN_LONG', 'CLOSE_LONG'],
    expectedContext: { symbol: 'BTCUSDT', timeframe: '4h' },
  },
  {
    id: 'eth-daily-ma120-ma20-pullback',
    message: 'ETH 日线在 MA120 上方时，只做多；价格回踩 MA20 后重新站上 MA20 买入。',
    expectedEntryAtomKeys: ['condition.expression', 'condition.sequence'],
    expectedActionTypes: ['OPEN_LONG'],
    expectedSemanticTriggers: [
      { key: 'condition.expression', phase: 'gate', params: { expression: { op: 'GT', right: { name: 'sma', params: { period: 120 } } } } },
      { key: 'condition.sequence', phase: 'entry', params: { sequenceKind: 'pullback_reclaim', reference: { indicator: 'ma', period: 20 } } },
    ],
    expectedContext: { symbol: 'ETHUSDT', timeframe: '1d' },
  },
  {
    id: 'btc-three-red-volume-rebound',
    message: 'BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点。',
    expectedEntryAtomKeys: ['condition.sequence'],
    expectedActionTypes: ['OPEN_LONG'],
    expectedSemanticTriggers: [
      { key: 'condition.sequence', phase: 'entry', params: { sequenceKind: 'consecutive_candles', count: 3, direction: 'down' } },
    ],
    expectedContext: { symbol: 'BTCUSDT', timeframe: '15m' },
  },
  {
    id: 'btc-ma50-ma200-rsi',
    message: 'BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入，RSI 超过 65 卖出。',
    expectedEntryAtomKeys: ['condition.expression', 'condition.sequence'],
    expectedExitAtomKeys: ['rsi.threshold_gte'],
    expectedActionTypes: ['OPEN_LONG', 'CLOSE_LONG'],
    expectedSemanticTriggers: [
      { key: 'condition.expression', phase: 'gate', params: { expression: { op: 'GT' } } },
      { key: 'condition.sequence', phase: 'entry', params: { sequenceKind: 'rsi_reclaim', threshold: 35 } },
      { key: 'oscillator.rsi_gte', phase: 'exit', params: { value: 65, thresholdRole: 'upper_threshold' } },
    ],
    expectedContext: { symbol: 'BTCUSDT', timeframe: '1h' },
  },
  {
    id: 'eth-bollinger-volume',
    message: 'ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。',
    expectedEntryAtomKeys: ['bollinger.lower_break', 'volume.relative_average'],
    expectedExitAtomKeys: ['bollinger.upper_break'],
    expectedActionTypes: ['OPEN_LONG', 'CLOSE_LONG'],
    expectedSemanticTriggers: [
      { key: 'volume.relative_average', phase: 'entry', params: { lookbackBars: 20, multiplier: 1.5 } },
    ],
    expectedContext: { symbol: 'ETHUSDT', timeframe: '15m' },
  },
  {
    id: 'sol-ma100-macd',
    message: 'SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出。',
    expectedEntryAtomKeys: ['indicator.above', 'macd.golden_cross'],
    expectedExitAtomKeys: ['indicator.below', 'macd.death_cross'],
    expectedActionTypes: ['OPEN_LONG', 'CLOSE_LONG'],
    expectedSemanticTriggers: [
      { key: 'indicator.above', phase: 'gate', params: { 'reference.period': 100 } },
      { key: 'indicator.cross_over', phase: 'entry', params: { indicator: 'macd' } },
      { key: 'logical.any_of', phase: 'exit', params: { items: [
        { key: 'indicator.below', params: { 'reference.period': 100 } },
        { key: 'indicator.cross_under', params: { indicator: 'macd' } },
      ] } },
    ],
    expectedContext: { symbol: 'SOLUSDT', timeframe: '30m' },
  },
  {
    id: 'btc-breakout-pullback',
    message: 'BTC 突破过去 24 小时高点后不立刻买，等回踩不破突破位再买，跌回突破位下方止损。',
    expectedEntryAtomKeys: ['condition.sequence'],
    expectedActionTypes: ['OPEN_LONG'],
    expectedSemanticTriggers: [
      { key: 'condition.sequence', phase: 'entry', status: 'locked', params: { sequenceKind: 'breakout_retest', lookbackWindow: '24h', memoryKey: 'breakout' } },
    ],
    expectedContext: { symbol: 'BTCUSDT' },
  },
  {
    id: 'eth-ma20-atr-risk',
    message: 'ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈。',
    expectedEntryAtomKeys: ['indicator.above'],
    expectedActionTypes: ['OPEN_LONG'],
    expectedContext: { symbol: 'ETHUSDT', timeframe: '1h' },
  },
  {
    id: 'binance-btc-multitimeframe-ema',
    message: '15min 1h 4h的价格都在ema20的上方买入 15min跌破ema20卖出 再币安交易所 btcusdt永续合约',
    expectedEntryAtomKeys: ['indicator.above', 'indicator.above', 'indicator.above'],
    expectedExitAtomKeys: ['indicator.below'],
    expectedActionTypes: ['OPEN_LONG', 'CLOSE_LONG'],
    expectedSemanticTriggers: [
      { key: 'indicator.above', phase: 'entry', params: { timeframe: '15m', 'reference.period': 20 } },
      { key: 'indicator.above', phase: 'entry', params: { timeframe: '1h', 'reference.period': 20 } },
      { key: 'indicator.above', phase: 'entry', params: { timeframe: '4h', 'reference.period': 20 } },
      { key: 'indicator.below', phase: 'exit', params: { timeframe: '15m', 'reference.period': 20 } },
    ],
    expectedContext: { exchange: 'binance', symbol: 'BTCUSDT', marketType: 'perp' },
  },
]
