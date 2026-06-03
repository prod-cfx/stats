import type { CryptoCoverageScope, CryptoCoverageSupportStatus } from './crypto-coverage-types'
import { classifyUnsupportedStrategyIntent } from '../../services/unsupported-strategy-taxonomy'

interface ScopeMatch {
  readonly scope: CryptoCoverageScope
  readonly matchedPhrase: string | null
  readonly publicReason: string | null
}

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
  const unsupported = classifyUnsupportedStrategyIntent(message)
  if (unsupported) {
    return { scope: 'C', matchedPhrase: unsupported.matchedPhrase, publicReason: unsupported.reasonCode }
  }
  return { scope: 'B', matchedPhrase: null, publicReason: null }
}

export function getCryptoAtomWeight(atomKey: string): number {
  return ATOM_WEIGHTS.get(atomKey) ?? 2
}

export function isBCoverageSupportedStatus(status: CryptoCoverageSupportStatus): boolean {
  return status === 'supported_executable'
}
