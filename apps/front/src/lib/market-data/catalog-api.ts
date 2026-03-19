import type { MarketDataCatalogItem } from './catalog-types'
import { cachedRequest, CacheTTL } from '@/lib/api-cache'
import { API_BASE_URL } from '@/lib/api-client'
import { FALLBACK_MARKET_DATA_CATALOG } from './catalog-fallback'

const CACHE_KEY = 'meta:market-data-catalog'

export async function fetchMarketDataCatalog(): Promise<MarketDataCatalogItem[]> {
  // Mock mode: avoid network request entirely (especially because this app uses `output: 'export'`)
  // and Next.js API routes are not supported in static export.
  if (process.env.NEXT_PUBLIC_MOCK_API === '1') {
    return FALLBACK_MARKET_DATA_CATALOG
  }

  return cachedRequest(
    CACHE_KEY,
    async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/meta/market-data-catalog`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        // Backend TransformInterceptor wraps as { data }, but unwrap defensively.
        const body = await res.json().catch(() => undefined)
        const data = body && typeof body === 'object' && 'data' in body ? (body as any).data : body
        if (Array.isArray(data)) {
          return data as MarketDataCatalogItem[]
        }
        return FALLBACK_MARKET_DATA_CATALOG
      } catch {
        return FALLBACK_MARKET_DATA_CATALOG
      }
    },
    CacheTTL.VERY_LONG,
  )
}


