export interface Staging31Case {
  index: number
  sessionId: string
  input: string
  expected: 'pass' | 'needs_clarification' | 'unsupported'
}

export const STAGING31_CASES: readonly Staging31Case[] = [
  { index: 1, sessionId: 'cmpc5u6xa0qpb0cqs8ehox5m2', input: '入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt', expected: 'pass' },
  { index: 2, sessionId: 'cmpc5ykbs0wdo0cqs39lesdtt', input: '15min k线里面 价格在ema20 ema60 ema144上方时做多开仓 都位于下方只开空 入场是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损5%止损', expected: 'pass' },
  { index: 3, sessionId: 'cmpc6a5161gfg0cqskhav4leb', input: '在okx交易所 我想买btc  3分钟之内跌百分1买入  15分钟之内涨百分2卖出  单笔用百分10资金 止损5% 止盈10%', expected: 'pass' },
  { index: 4, sessionId: 'cmpc6bxtc1is20cqsa8l2dcvo', input: 'OKX 合约 BTCUSDT 15m，价格触及/突破布林带(20,2)上轨时做空，触及/突破下轨时做多；多单在价格回到布林带中轨(MA20)时平仓，空单在价格跌破布林带中轨(MA20)时平仓；单笔仓位 10%。', expected: 'pass' },
  { index: 5, sessionId: 'cmpc6enhp1mi60cqsxhzufhj6', input: '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈', expected: 'pass' },
  { index: 6, sessionId: 'cmpc6fr181nsc0cqsdfs8t9yx', input: '在 OKX 现货 ORDI/USDT 上，主周期 1h，使用 10% 固定仓位只做多；入场动作为立即开始时市价买入；出场规则为价格相对前收盘上涨 1% 时卖出，另有相对入场均价下跌 5% 止损卖出、相对入场均价上涨 10% 止盈卖出。', expected: 'pass' },
  { index: 7, sessionId: 'cmpc6hh0a1q420cqsp2n51rpx', input: 'OKX 合约 BTCUSDT 1m，使用布林带 5,1。价格触及或突破上轨时做空，价格触及或突破下轨时做多；多单在价格回到中轨时平仓，空单在价格回到中轨时平仓；单笔仓位 10%，止损 1%，止盈 1.5%。', expected: 'pass' },
  { index: 8, sessionId: 'cmpc6ji181swc0cqs6mn1swdz', input: '用 BTCUSDT 1m K 线。每次最新 K 线收盘价高于开盘价时尝试开多。如果已有持仓则不再开仓。收盘价低于开盘价时平多。', expected: 'pass' },
  { index: 9, sessionId: 'cmpc6oub220q00cqs6ohyr6el', input: 'OKX 现货 ETHUSDT、1m 网格以部署时当前价为中心，上下各0.4%共10格、每格10 USDT、限价单并相邻网格自动挂反向单、不用趋势信号开仓；当价格突破上下边界时执行“立即停止并撤销所有未成交订单”', expected: 'pass' },
  { index: 10, sessionId: 'cmpc6v1qt2aoi0cqsg169ca4q', input: '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 79200-80200，采用双向网格，每格间距 0.1%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈', expected: 'pass' },
  { index: 11, sessionId: 'cmpc6wlch2d6c0cqsixe6xf9c', input: 'EMA7 上穿 EMA21 时开多；下穿 时平多。', expected: 'pass' },
  { index: 12, sessionId: 'cmpc6zpko2i3j0cqs4otsv6qb', input: '15min 布林带下轨买入 上轨卖出', expected: 'pass' },
  { index: 13, sessionId: 'cmpc74q2k2u9j0cqsszcyu7xb', input: 'EMA7 上穿 EMA21 时开多；下穿 时平多。', expected: 'pass' },
  { index: 14, sessionId: 'cmpc7b466337h0cqsj7jil21m', input: 'OKX 上用 BTC/USDT，1 小时 K，MACD 金叉买入死叉卖出', expected: 'pass' },
  { index: 15, sessionId: 'cmpc7cik4359k0cqs4gfe8nw2', input: '15m 周期，价格区间 79200-80200，采用双向网格', expected: 'pass' },
  { index: 16, sessionId: 'cmpc7elg7388x0cqstjyrakry', input: 'BTC 4小时突破过去 20 根 K 线最高价做多，跌破过去 10 根 K 线最低价平仓。', expected: 'pass' },
  { index: 17, sessionId: 'cmpc7j2rd3exb0cqsksonhg9h', input: 'ETH 日线在 MA120 上方时，只做多；价格回踩 MA20 后重新站上 MA20 买入,ETH 日线在 MA120 下方时平仓', expected: 'pass' },
  { index: 18, sessionId: 'cmpc7lthn3ixj0cqs54ahgsiw', input: 'BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点。', expected: 'pass' },
  { index: 19, sessionId: 'cmpc7sb1a3s4y0cqs6ir5xq8y', input: 'BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入，RSI 超过 65 卖出。', expected: 'pass' },
  { index: 20, sessionId: 'cmpc7ujqv3vbn0cqs2ijsfzi9', input: 'ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。', expected: 'pass' },
  { index: 21, sessionId: 'cmpc7xs3j3zd20cqsrpq7hx26', input: 'SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出。', expected: 'pass' },
  { index: 22, sessionId: 'cmpc80nw6434k0cqsyhewqtz5', input: 'BTC 突破过去 24 小时高点后不立刻买，等回踩不破突破位再买，跌回突破位下方止损。', expected: 'pass' },
  { index: 23, sessionId: 'cmpc820ia44sx0cqs42kewi6q', input: 'ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈。', expected: 'pass' },
  { index: 24, sessionId: 'cmpc843wq479r0cqscdhs3pgl', input: '15min 1h 4h的价格都在ema20的上方买入 15min跌破ema20卖出 再币安交易所 btcusdt永续合约', expected: 'pass' },
  { index: 25, sessionId: 'cmpc85c7q4e640cqs1sb50r7q', input: 'OKX 合约 BTCUSDT 15m，收到 webhook 事件 signalId 为 whale_buy 且 secret 已配置时开多，每次 100', expected: 'pass' },
  { index: 26, sessionId: 'cmpc86bhq4fp60cqsnntz2c23', input: 'BTC/USDT 4h，RSI 跌破 30 开多，RSI 回到 70 平仓，止损 2%', expected: 'pass' },
  { index: 27, sessionId: 'cmpc87f8x4h5l0cqsa55xtugi', input: 'ETH 1h，价格触及布林下轨开多，回到中轨止盈，触及上轨开空', expected: 'pass' },
  { index: 28, sessionId: 'cmpc88nq04iw10cqs39e42wow', input: 'SOL 1d，EMA20 上穿 EMA60 开多，下穿平仓，最大回撤 15% 熔断', expected: 'pass' },
  { index: 29, sessionId: 'cmpc8czl44oli0cqsoiovp6yn', input: 'BTC 1h 突破前高开多，盈利 3% 后加仓 50%，最多加 3 层', expected: 'pass' },
  { index: 30, sessionId: 'cmpc8ekc84qoy0cqskzvu03py', input: 'ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT', expected: 'pass' },
  { index: 31, sessionId: 'cmpc8g3hy4sq50cqs2atwtzwb', input: 'SOL 现货，30 分钟。价格在最近 24 小时区间的 0.3–0.7 分位之间运行时，启用自适应波动率网格；价格突破区间上沿则停止网格并平仓。', expected: 'pass' },
  { index: 32, sessionId: 'staging31-user-grid-trend-up', input: 'OKX 合约 BTCUSDT 15m，在 50000-60000 区间挂 10 档网格，5% 步长，趋势上涨时启用。', expected: 'pass' },
  { index: 33, sessionId: 'staging31-user-reverse-short', input: 'OKX 永续 BTCUSDT 15m。EMA20 下穿 EMA50 时从多头反手做空，单笔 10% 仓位。', expected: 'pass' },
  { index: 34, sessionId: 'staging31-user-webhook-buy', input: 'OKX 合约 BTCUSDT 15m，收到 TradingView webhook buy 信号后开多，单笔 10% 仓位。跌破 EMA20 时平多。', expected: 'pass' },
  { index: 35, sessionId: 'staging31-user-funding-ema20', input: 'OKX 永续合约 BTCUSDT 15m。资金费率为正并且 EMA20 上穿时开多，单笔仓位 1%。跌破 EMA20 时平多。', expected: 'pass' },
] as const
