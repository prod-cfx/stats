import type { CryptoStrategyCoverageCase } from './crypto-coverage-types'
import { STAGE4_REAL_STRATEGY_CORPUS } from '../stage4-real-strategy-corpus'
import { classifyCryptoIntentScope } from './crypto-coverage-taxonomy'

const stage4SeedCases: CryptoStrategyCoverageCase[] = STAGE4_REAL_STRATEGY_CORPUS.map(item => ({
  id: item.id,
  labels: [item.category],
  scope: classifyCryptoIntentScope(item.initialUserMessage).scope,
  initialUserMessage: item.initialUserMessage,
  clarificationTurns: item.clarificationTurns,
  expectedAtomKeys: item.expectedAtomKeys,
}))

const p1AddedCases: CryptoStrategyCoverageCase[] = [
  {
    id: 'crypto-b-orderbook-spread-post-only',
    labels: ['orderbook', 'execution'],
    scope: 'B',
    initialUserMessage: 'OKX BTCUSDT 永续 1m，盘口价差小于 0.03% 且买一卖一深度比超过 2 倍时，只用 post-only 限价单开多，亏损 1% 止损。',
    clarificationTurns: [],
    expectedAtomKeys: ['orderbook.spread_condition', 'orderbook.depth_ratio', 'action.open_long', 'action.limit_order', 'execution.post_only', 'risk.stop_loss_pct'],
  },
  {
    id: 'crypto-b-portfolio-daily-loss-kill-switch',
    labels: ['portfolio_risk', 'risk'],
    scope: 'B',
    initialUserMessage: 'OKX 合约 BTC 和 ETH 15m，EMA20 上穿 EMA50 开多。账户当天亏损超过 5% 后停止新开仓，最多同时持有 3 个仓位。',
    clarificationTurns: [{ assistantSlotPath: 'exit_rule', userAnswer: '跌破 EMA20 时平多。' }],
    expectedAtomKeys: ['indicator.cross_over', 'action.open_long', 'risk.daily_loss_limit', 'risk.kill_switch', 'position.max_concurrent_positions'],
  },
  {
    id: 'crypto-b-limit-chase-reduce-only',
    labels: ['execution', 'action_lifecycle'],
    scope: 'B',
    initialUserMessage: 'BTCUSDT 5m，RSI14 高于 70 时 reduce-only 限价平多，如果 3 根 K 线没成交就追价一次。',
    clarificationTurns: [],
    expectedAtomKeys: ['oscillator.rsi_gte', 'action.close_long', 'action.limit_order', 'execution.reduce_only', 'execution.limit_chase'],
  },
  {
    id: 'crypto-c-cross-exchange-transfer-arbitrage',
    labels: ['unsupported', 'cross_exchange'],
    scope: 'C',
    initialUserMessage: '做 Binance 和 OKX 跨所搬砖，价差大于 0.5% 时自动划转 USDT 并套利。',
    clarificationTurns: [],
    expectedAtomKeys: ['unsupported.cross_exchange_fund_transfer_arbitrage'],
    expectedUnsupportedReason: 'cross_exchange_fund_transfer_arbitrage_out_of_scope',
  },
  {
    id: 'crypto-c-triangular-arbitrage-matching',
    labels: ['unsupported', 'arbitrage_matching'],
    scope: 'C',
    initialUserMessage: '做 BTC/USDT、ETH/USDT、ETH/BTC 三角套利，盘口出现价差时自动撮合三条腿。',
    clarificationTurns: [],
    expectedAtomKeys: ['unsupported.triangular_arbitrage_matching'],
    expectedUnsupportedReason: 'triangular_arbitrage_matching_out_of_scope',
  },
  {
    id: 'crypto-c-hft-market-making',
    labels: ['unsupported', 'hft'],
    scope: 'C',
    initialUserMessage: '做 BTCUSDT 高频做市，根据毫秒级盘口变化不断撤单挂单。',
    clarificationTurns: [],
    expectedAtomKeys: ['unsupported.hft_market_making'],
    expectedUnsupportedReason: 'hft_market_making_out_of_scope',
  },
  {
    id: 'crypto-c-order-queue-alpha',
    labels: ['unsupported', 'latency'],
    scope: 'C',
    initialUserMessage: '做延迟敏感 order queue alpha，根据队列位置抢 maker 成交。',
    clarificationTurns: [],
    expectedAtomKeys: ['unsupported.latency_sensitive_order_queue_alpha'],
    expectedUnsupportedReason: 'latency_sensitive_order_queue_alpha_out_of_scope',
  },
]

export const CRYPTO_STRATEGY_COVERAGE_CORPUS = [...stage4SeedCases, ...p1AddedCases] as const satisfies readonly CryptoStrategyCoverageCase[]
