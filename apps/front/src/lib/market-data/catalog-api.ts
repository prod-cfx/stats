import type { MarketDataCatalogItem } from './catalog-types'
import { fetchMarketDataCatalogItems } from '@/lib/api'

export async function fetchMarketDataCatalog(): Promise<MarketDataCatalogItem[]> {
  return fetchMarketDataCatalogItems()
}

