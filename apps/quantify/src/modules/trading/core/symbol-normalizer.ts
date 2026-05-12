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

export function normalizeExecutionSymbol(
  raw: string,
  marketType: MarketType,
  exchangeId: ExchangeId,
): string {
  const trimmed = raw.trim()
  if (exchangeId === 'okx' && trimmed.includes('-')) {
    const upper = trimmed.toUpperCase().replace(/:(PERP|SPOT)$/, '')
    const parts = upper.split('-').filter(Boolean)
    const [base, quote, suffix] = parts
    if (base && quote && (parts.length === 2 || suffix === 'SWAP')) {
      const unified = `${base}/${quote}`
      return marketType === 'perp' ? `${unified}:PERP` : unified
    }
  }

  if (raw.includes('/')) {
    if (marketType === 'perp' && !raw.endsWith(':PERP')) {
      return `${raw}:PERP`
    }
    if (marketType === 'spot' && raw.endsWith(':PERP')) {
      return raw.replace(':PERP', '')
    }
    return raw
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
  const upper = raw.toUpperCase()
  const withoutMarketSuffix = upper.replace(/:(PERP|SPOT)$/, '')

  return withoutMarketSuffix.replace('/', '')
}
