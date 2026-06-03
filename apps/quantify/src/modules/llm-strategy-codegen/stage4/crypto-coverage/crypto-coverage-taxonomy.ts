import type { CryptoCoverageScope, CryptoCoverageSupportStatus } from './crypto-coverage-types'

interface ScopeMatch {
  readonly scope: CryptoCoverageScope
  readonly matchedPhrase: string | null
  readonly publicReason: string | null
}

const C_SCOPE_PATTERNS: ReadonlyArray<{ pattern: RegExp, phrase: string, publicReason: string }> = [
  { pattern: /跨所搬砖|cross[- ]exchange arbitrage/iu, phrase: '跨所搬砖', publicReason: 'cross_exchange_fund_transfer_arbitrage_out_of_scope' },
  { pattern: /自动(?:划转|转账)|fund transfer/iu, phrase: '自动划转', publicReason: 'cross_exchange_fund_transfer_arbitrage_out_of_scope' },
  { pattern: /三角套利|triangular arbitrage/iu, phrase: '三角套利', publicReason: 'triangular_arbitrage_matching_out_of_scope' },
  { pattern: /高频做市|HFT|high[- ]frequency market making/iu, phrase: 'HFT', publicReason: 'hft_market_making_out_of_scope' },
  { pattern: /order queue alpha|队列(?:位置|alpha)|queue position/iu, phrase: 'order queue alpha', publicReason: 'latency_sensitive_order_queue_alpha_out_of_scope' },
]

const ATOM_WEIGHTS = new Map<string, number>([
  ['action.open_long', 3],
  ['action.open_short', 3],
  ['action.close_long', 3],
  ['action.close_short', 3],
  ['action.reverse_position', 3],
  ['position.sizing', 3],
  ['risk.stop_loss_pct', 3],
  ['risk.max_drawdown_pct', 3],
  ['orderbook.imbalance', 3],
  ['fundingRate.condition', 2],
  ['openInterest.condition', 2],
  ['liquidation.condition', 2],
])

export function classifyCryptoIntentScope(message: string): ScopeMatch {
  for (const entry of C_SCOPE_PATTERNS) {
    if (entry.pattern.test(message)) {
      return { scope: 'C', matchedPhrase: entry.phrase, publicReason: entry.publicReason }
    }
  }
  return { scope: 'B', matchedPhrase: null, publicReason: null }
}

export function getCryptoAtomWeight(atomKey: string): number {
  return ATOM_WEIGHTS.get(atomKey) ?? 2
}

export function isBCoverageSupportedStatus(status: CryptoCoverageSupportStatus): boolean {
  return status === 'supported_executable'
}
