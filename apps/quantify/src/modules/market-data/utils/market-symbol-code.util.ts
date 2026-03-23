import { ErrorCode } from '@ai/shared'
import { DomainException } from '@/common/exceptions/domain.exception'

export type SymbolMarketType = 'SPOT' | 'PERP'

export const normalizeExactCode = (input: string): string => input.trim().toUpperCase()

export const extractRawSymbol = (input: string): string => normalizeExactCode(input).split(':')[0] ?? ''

export const toSymbolCode = (raw: string, market: SymbolMarketType): string =>
  `${extractRawSymbol(raw)}:${market}`

export const normalizeRequestedCode = (input: string): string => {
  const normalized = normalizeExactCode(input)
  if (normalized.includes(':')) {
    return normalized
  }
  return toSymbolCode(normalized, 'SPOT')
}

export const parseSymbolMarket = (input: string): SymbolMarketType => {
  const normalized = normalizeExactCode(input)
  if (normalized.endsWith(':PERP')) return 'PERP'
  if (normalized.endsWith(':SPOT') || !normalized.includes(':')) return 'SPOT'
  throw new DomainException('market.symbol_unknown_suffix', { code: ErrorCode.MARKET_INVALID_SYMBOL, args: { symbol: input } })
}

export const instrumentTypeToMarket = (instrumentType?: string): SymbolMarketType => {
  const normalized = normalizeExactCode(instrumentType ?? '')
  if (normalized === 'PERPETUAL' || normalized === 'FUTURE' || normalized === 'PERP') {
    return 'PERP'
  }
  return 'SPOT'
}

export const normalizeProviderCode = (raw: string, instrumentType?: string): string =>
  toSymbolCode(raw, instrumentTypeToMarket(instrumentType))
