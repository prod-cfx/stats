import type { SemanticAtomContract, SemanticEvidence, SemanticSlotState } from './semantic-state'

export type MarketInstrumentQuote = 'FDUSD' | 'USDT' | 'USDC' | 'BUSD' | 'TUSD' | 'USD'
export type MarketInstrumentSymbolSource = 'user_explicit' | 'inferred'
export type MarketInstrumentQuoteSource = 'explicit' | 'default_usdt'

export interface MarketInstrumentSymbolResolution {
  value: string
  source: MarketInstrumentSymbolSource
  evidenceText: string
  base: string
  quote: MarketInstrumentQuote
  quoteSource: MarketInstrumentQuoteSource
  venueSymbolHint?: string
  marketTypeHint?: 'perp' | 'spot'
}

export interface MarketInstrumentSymbolSlotPatch {
  slotKey?: 'symbol'
  fieldPath?: 'contextSlots.symbol'
  value: string
  status?: 'locked'
  source?: MarketInstrumentSymbolSource
  evidence?: SemanticEvidence
  contracts?: SemanticAtomContract[]
}

export type CodegenContextSlotPatchValue =
  | string
  | number
  | boolean
  | null
  | SemanticSlotState
  | MarketInstrumentSymbolResolution
  | MarketInstrumentSymbolSlotPatch
