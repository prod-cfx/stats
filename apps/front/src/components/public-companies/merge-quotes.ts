import type { CryptoStockQuoteLatest } from '@/lib/api'

function isPresent(value: string | null | undefined): value is string {
  return value != null && value.trim() !== ''
}

function pickPreferred(
  primary: string | null | undefined,
  fallback: string | null | undefined,
): string | null | undefined {
  return isPresent(primary) ? primary : fallback
}

export function mergeQuotesBySymbol(
  holdingsQuotes: CryptoStockQuoteLatest[],
  priceQuotes: CryptoStockQuoteLatest[],
): CryptoStockQuoteLatest[] {
  if (!holdingsQuotes.length) return priceQuotes
  if (!priceQuotes.length) return holdingsQuotes

  const priceBySymbol = new Map<string, CryptoStockQuoteLatest>()
  for (const quote of priceQuotes) {
    priceBySymbol.set(quote.symbol, quote)
  }

  return holdingsQuotes.map(holdingQuote => {
    const priceQuote = priceBySymbol.get(holdingQuote.symbol)
    if (!priceQuote) return holdingQuote

    return {
      ...holdingQuote,
      price: pickPreferred(priceQuote.price, holdingQuote.price) ?? holdingQuote.price,
      openPrice: pickPreferred(priceQuote.openPrice, holdingQuote.openPrice) ?? null,
      highPrice: pickPreferred(priceQuote.highPrice, holdingQuote.highPrice) ?? null,
      lowPrice: pickPreferred(priceQuote.lowPrice, holdingQuote.lowPrice) ?? null,
      closePrice: pickPreferred(priceQuote.closePrice, holdingQuote.closePrice) ?? null,
      priceChange: pickPreferred(priceQuote.priceChange, holdingQuote.priceChange) ?? null,
      priceChangePercent:
        pickPreferred(priceQuote.priceChangePercent, holdingQuote.priceChangePercent) ?? null,
      quoteTimestamp:
        pickPreferred(priceQuote.quoteTimestamp, holdingQuote.quoteTimestamp) ??
        holdingQuote.quoteTimestamp,
      updatedAt: pickPreferred(priceQuote.updatedAt, holdingQuote.updatedAt) ?? holdingQuote.updatedAt,
      source: pickPreferred(priceQuote.source, holdingQuote.source) ?? holdingQuote.source,
    }
  })
}
