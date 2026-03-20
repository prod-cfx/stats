import type { CryptoStockQuoteLatest } from '../../lib/api'
import { mergeQuotesBySymbol } from './merge-quotes'

type QuoteSource = 'BBX_SCRAPER' | 'BBX'
type QuoteFetcher = (args: { source: QuoteSource }) => Promise<CryptoStockQuoteLatest[]>

export async function fetchPublicCompanyQuotes(
  fetcher: QuoteFetcher,
): Promise<CryptoStockQuoteLatest[]> {
  const [holdingsResult, priceResult] = await Promise.allSettled([
    fetcher({ source: 'BBX_SCRAPER' }),
    fetcher({ source: 'BBX' }),
  ])

  const holdingsQuotes = holdingsResult.status === 'fulfilled' ? holdingsResult.value : []
  const priceQuotes = priceResult.status === 'fulfilled' ? priceResult.value : []

  if (holdingsResult.status === 'rejected' && priceResult.status === 'rejected') {
    throw holdingsResult.reason
  }

  return mergeQuotesBySymbol(holdingsQuotes, priceQuotes)
}
