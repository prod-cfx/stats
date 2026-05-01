import type { ExchangeId, MarketType } from './types'

const KNOWN_QUOTES = [
  'USDT',
  'USDC',
  'FDUSD',
  'TUSD',
  'BUSD',
  'BTC',
  'BNB',
  'ETH',
  'EUR',
  'TRY',
  'BRL',
]

function normalizeDashSymbol(raw: string): { base: string; quote: string; marketTypeHint: MarketType | null } | null {
  const upper = raw.toUpperCase().replace(/:(PERP|SPOT)$/, '')
  const parts = upper.split('-').filter(Boolean)
  if (parts.length < 2) return null
  const [base, quote, suffix] = parts
  if (!base || !quote) return null
  return {
    base,
    quote,
    marketTypeHint: suffix === 'SWAP' ? 'perp' : null,
  }
}

export function normalizeExecutionSymbol(
  raw: string,
  marketType: MarketType,
  _exchangeId: ExchangeId,
): string {
  if (raw.includes('/')) {
    if (marketType === 'perp' && !raw.endsWith(':PERP')) {
      return `${raw}:PERP`
    }
    if (marketType === 'spot' && raw.endsWith(':PERP')) {
      return raw.replace(':PERP', '')
    }
    return raw
  }

  const dashSymbol = normalizeDashSymbol(raw)
  if (dashSymbol) {
    const resolvedMarketType = dashSymbol.marketTypeHint ?? marketType
    const unified = `${dashSymbol.base}/${dashSymbol.quote}`
    return resolvedMarketType === 'perp' ? `${unified}:PERP` : unified
  }

  const upper = raw.toUpperCase().replace(':PERP', '')
  for (const quote of KNOWN_QUOTES) {
    if (!upper.endsWith(quote))
      continue
    const base = upper.slice(0, -quote.length)
    if (!base)
      continue
    const unified = `${base}/${quote}`
    return marketType === 'perp' ? `${unified}:PERP` : unified
  }

  return marketType === 'perp' ? `${upper}:PERP` : upper
}

export function normalizeLedgerSymbol(raw: string): string {
  const dashSymbol = normalizeDashSymbol(raw)
  if (dashSymbol) {
    return `${dashSymbol.base}${dashSymbol.quote}`
  }

  const upper = raw.toUpperCase()
  const withoutMarketSuffix = upper.replace(/:(PERP|SPOT)$/, '')

  return withoutMarketSuffix.replace('/', '')
}
