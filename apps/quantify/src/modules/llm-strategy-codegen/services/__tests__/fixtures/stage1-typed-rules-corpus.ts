export interface Stage1TypedRulesCorpusCase {
  id: string
  text: string
  expectedPhases: Array<'entry' | 'exit' | 'gate' | 'program'>
  expectedEffectRoles: Array<'actions' | 'risks' | 'positions' | 'orchestration' | 'programs'>
}

export const STAGE1_TYPED_RULES_CORPUS: Stage1TypedRulesCorpusCase[] = [
  {
    id: 'stage1-001-ema-stack-fixed-quote',
    text: '入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'risks', 'positions', 'orchestration'],
  },
  {
    id: 'stage1-002-ema-stack-boll-dual-side',
    text: '15min k线里面 价格在ema20 ema60 ema144上方时做多开仓 都位于下方只开空 入场是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损5%止损',
    expectedPhases: ['entry'],
    expectedEffectRoles: ['actions', 'risks', 'orchestration'],
  },
  {
    id: 'stage1-003-okx-percent-change',
    text: '在okx交易所 我想买btc  3分钟之内跌百分1买入  15分钟之内涨百分2卖出  单笔用百分10资金 止损5% 止盈10%',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'risks', 'positions', 'orchestration'],
  },
  {
    id: 'stage1-004-boll-mean-reversion',
    text: 'OKX 合约 BTCUSDT 15m，价格触及/突破布林带(20,2)上轨时做空，触及/突破下轨时做多；多单在价格回到布林带中轨(MA20)时平仓，空单在价格跌破布林带中轨(MA20)时平仓；单笔仓位 10%。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'positions', 'orchestration'],
  },
  {
    id: 'stage1-005-range-grid',
    text: '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈',
    expectedPhases: ['program'],
    expectedEffectRoles: ['risks', 'positions', 'orchestration', 'programs'],
  },
  {
    id: 'stage1-006-ordi-spot-on-start',
    text: '在 OKX 现货 ORDI/USDT 上，主周期 1h，使用 10% 固定仓位只做多；入场动作为立即开始时市价买入；出场规则为价格相对前收盘上涨 1% 时卖出，另有相对入场均价下跌 5% 止损卖出、相对入场均价上涨 10% 止盈卖出。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'risks', 'positions', 'orchestration'],
  },
  {
    id: 'stage1-007-boll-scalp',
    text: 'OKX 合约 BTCUSDT 1m，使用布林带 5,1。价格触及或突破上轨时做空，价格触及或突破下轨时做多；多单在价格回到中轨时平仓，空单在价格回到中轨时平仓；单笔仓位 10%，止损 1%，止盈 1.5%。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'risks', 'positions', 'orchestration'],
  },
  {
    id: 'stage1-008-candle-open-close',
    text: '用 BTCUSDT 1m K 线。每次最新 K 线收盘价高于开盘价时尝试开多。如果已有持仓则不再开仓。收盘价低于开盘价时平多。',
    expectedPhases: ['entry', 'exit', 'gate'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-009-deployment-centered-grid',
    text: 'OKX 现货 ETHUSDT、1m 网格以部署时当前价为中心，上下各0.4%共10格、每格10 USDT、限价单并相邻网格自动挂反向单、不用趋势信号开仓；当价格突破上下边界时执行“立即停止并撤销所有未成交订单”',
    expectedPhases: ['program'],
    expectedEffectRoles: ['positions', 'orchestration', 'programs'],
  },
  {
    id: 'stage1-010-tight-range-grid',
    text: '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 79200-80200，采用双向网格，每格间距 0.1%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈',
    expectedPhases: ['program'],
    expectedEffectRoles: ['risks', 'positions', 'orchestration', 'programs'],
  },
  {
    id: 'stage1-011-ema-cross-cross-margin',
    text: '创建一个 OKX BTCUSDT 永续合约策略，使用 15 分钟 K 线。当 EMA7 上穿 EMA21 时开多；当 EMA7 下穿 EMA21 时平多。每次使用账户权益的 10% 开仓，杠杆 1 倍，逐仓不要使用，使用全仓 cross。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'positions', 'orchestration'],
  },
  {
    id: 'stage1-012-boll-short-form',
    text: '15min 布林带下轨买入 上轨卖出',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-013-ema-cross-short-form',
    text: 'EMA7 上穿 EMA21 时开多；下穿 时平多。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions'],
  },
  {
    id: 'stage1-014-macd-cross',
    text: 'OKX 上用 BTC/USDT，1 小时 K，MACD 金叉买入死叉卖出',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-015-minimal-grid',
    text: '15m 周期，价格区间 79200-80200，采用双向网格',
    expectedPhases: ['program'],
    expectedEffectRoles: ['orchestration', 'programs'],
  },
  {
    id: 'stage1-016-breakout-channel',
    text: 'BTC 4小时突破过去 20 根 K 线最高价做多，跌破过去 10 根 K 线最低价平仓。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-017-ma-trend-pullback',
    text: 'ETH 日线在 MA120 上方时，只做多；价格回踩 MA20 后重新站上 MA20 买入,ETH 日线在 MA120 下方时平仓',
    expectedPhases: ['entry', 'exit', 'gate'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-018-consecutive-drop-volume-rebound',
    text: 'BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点。',
    expectedPhases: ['entry'],
    expectedEffectRoles: ['actions', 'positions', 'orchestration'],
  },
  {
    id: 'stage1-019-ma-gated-rsi',
    text: 'BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入，RSI 超过 65 卖出。',
    expectedPhases: ['entry', 'exit', 'gate'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-020-boll-volume-filter',
    text: 'ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-021-sol-ma-macd',
    text: 'SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出。',
    expectedPhases: ['entry', 'exit', 'gate'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-022-breakout-retest',
    text: 'BTC 突破过去 24 小时高点后不立刻买，等回踩不破突破位再买，跌回突破位下方止损。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'risks', 'orchestration'],
  },
  {
    id: 'stage1-023-ma-atr-risk-reward',
    text: 'ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈。',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'risks', 'orchestration'],
  },
  {
    id: 'stage1-024-multi-timeframe-ema',
    text: '15min 1h 4h的价格都在ema20的上方买入 15min跌破ema20卖出 再币安交易所 btcusdt永续合约',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-025-webhook-event',
    text: 'OKX 合约 BTCUSDT 15m，收到 webhook 事件 signalId 为 whale_buy 且 secret 已配置时开多，每次 100',
    expectedPhases: ['program'],
    expectedEffectRoles: ['programs'],
  },
  {
    id: 'stage1-026-rsi-band',
    text: 'BTC/USDT 4h，RSI 跌破 30 开多，RSI 回到 70 平仓，止损 2%',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'risks', 'orchestration'],
  },
  {
    id: 'stage1-027-boll-long-short',
    text: 'ETH 1h，价格触及布林下轨开多，回到中轨止盈，触及上轨开空',
    expectedPhases: ['entry', 'exit'],
    expectedEffectRoles: ['actions', 'orchestration'],
  },
  {
    id: 'stage1-028-drawdown-breaker',
    text: 'SOL 1d，EMA20 上穿 EMA60 开多，下穿平仓，最大回撤 15% 熔断',
    expectedPhases: ['entry', 'exit', 'program'],
    expectedEffectRoles: ['actions', 'risks', 'orchestration', 'programs'],
  },
  {
    id: 'stage1-029-pyramiding',
    text: 'BTC 1h 突破前高开多，盈利 3% 后加仓 50%，最多加 3 层',
    expectedPhases: ['entry', 'program'],
    expectedEffectRoles: ['actions', 'positions', 'orchestration', 'programs'],
  },
  {
    id: 'stage1-030-dca',
    text: 'ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT',
    expectedPhases: ['program'],
    expectedEffectRoles: ['programs'],
  },
  {
    id: 'stage1-031-adaptive-vol-grid',
    text: 'SOL 现货，30 分钟。价格在最近 24 小时区间的 0.3–0.7 分位之间运行时，启用自适应波动率网格；价格突破区间上沿则停止网格并平仓。',
    expectedPhases: ['program'],
    expectedEffectRoles: ['positions', 'orchestration', 'programs'],
  },
]
