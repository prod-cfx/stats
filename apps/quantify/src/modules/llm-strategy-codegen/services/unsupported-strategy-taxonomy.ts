export interface UnsupportedStrategyIntentMatch {
  readonly atomKey: string
  readonly matchedPhrase: string
  readonly reasonCode: string
  readonly publicReason: string
  readonly publicPromptZh: string
  readonly publicPromptEn: string
}

const UNSUPPORTED_STRATEGY_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp
  readonly atomKey: string
  readonly matchedPhrase: string
  readonly reasonCode: string
  readonly publicReason: string
  readonly publicPromptZh: string
  readonly publicPromptEn: string
}> = [
  {
    pattern: /跨所搬砖|cross[- ]exchange arbitrage|(?:Binance|OKX|币安|欧易)[^，。；;]{0,40}(?:Binance|OKX|币安|欧易)[^，。；;]{0,40}(?:自动)?(?:划转|转账|套利|搬砖)/iu,
    atomKey: 'unsupported.cross_exchange_fund_transfer_arbitrage',
    matchedPhrase: '跨所搬砖',
    reasonCode: 'cross_exchange_fund_transfer_arbitrage_out_of_scope',
    publicReason: '当前不支持跨交易所资金划转和套利执行闭环。',
    publicPromptZh: '目前不支持跨所搬砖套利，因为涉及跨交易所资金划转和套利执行闭环。',
    publicPromptEn: 'Cross-exchange transfer arbitrage is not supported because it requires cross-exchange fund transfers and an arbitrage execution loop.',
  },
  {
    pattern: /三角套利|triangular arbitrage|(?:BTC\s*\/\s*USDT|ETH\s*\/\s*USDT|ETH\s*\/\s*BTC)[^，。；;]{0,80}(?:三条腿|自动撮合|撮合三条腿)/iu,
    atomKey: 'unsupported.triangular_arbitrage_matching',
    matchedPhrase: '三角套利',
    reasonCode: 'triangular_arbitrage_matching_out_of_scope',
    publicReason: '当前不支持三腿同步撮合。',
    publicPromptZh: '目前不支持三角套利策略，因为涉及三腿同步撮合。',
    publicPromptEn: 'Triangular arbitrage is not supported because it requires synchronized three-leg matching.',
  },
  {
    pattern: /高频做市|HFT|high[- ]frequency market making|毫秒级[^，。；;]{0,24}(?:撤单|挂单|盘口)|不断撤单挂单/iu,
    atomKey: 'unsupported.hft_market_making',
    matchedPhrase: 'HFT',
    reasonCode: 'hft_market_making_out_of_scope',
    publicReason: '当前不支持毫秒级盘口、撤单挂单和低延迟执行。',
    publicPromptZh: '目前不支持高频做市策略，因为涉及毫秒级盘口、撤单挂单和低延迟执行。',
    publicPromptEn: 'High-frequency market making is not supported because it requires millisecond order book handling, cancel/replace loops, and low-latency execution.',
  },
  {
    pattern: /order queue alpha|队列(?:位置|alpha)|queue position|抢\s*maker\s*成交/iu,
    atomKey: 'unsupported.latency_sensitive_order_queue_alpha',
    matchedPhrase: 'order queue alpha',
    reasonCode: 'latency_sensitive_order_queue_alpha_out_of_scope',
    publicReason: '当前不支持队列位置和 maker 抢成交。',
    publicPromptZh: '目前不支持延迟敏感 order queue alpha，因为涉及队列位置和 maker 抢成交。',
    publicPromptEn: 'Latency-sensitive order queue alpha is not supported because it depends on queue position and maker fill priority.',
  },
]

export function classifyUnsupportedStrategyIntent(message: string): UnsupportedStrategyIntentMatch | null {
  for (const entry of UNSUPPORTED_STRATEGY_PATTERNS) {
    if (entry.pattern.test(message)) {
      return {
        atomKey: entry.atomKey,
        matchedPhrase: entry.matchedPhrase,
        reasonCode: entry.reasonCode,
        publicReason: entry.publicReason,
        publicPromptZh: entry.publicPromptZh,
        publicPromptEn: entry.publicPromptEn,
      }
    }
  }
  return null
}
