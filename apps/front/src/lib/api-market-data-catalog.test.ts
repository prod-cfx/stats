/** @jest-environment jsdom */

import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { FALLBACK_MARKET_DATA_CATALOG } from './market-data/catalog-fallback'

const originalFetch = globalThis.fetch
const originalMockApiEnv = process.env.NEXT_PUBLIC_MOCK_API

jest.mock('./api-cache', () => ({
  cachedRequest: async (_key: string, fn: () => Promise<unknown>) => fn(),
  CacheTTL: {
    VERY_LONG: 300,
  },
}))

jest.mock('@ai/shared', () => ({
  buildBearerAuthHeaders: jest.fn(),
  getErrorHttpStatus: jest.fn(),
  unwrapTransportResponse: (value: unknown) => value,
}), { virtual: true })

jest.mock('./api-client', () => ({
  API_BASE_URL: 'http://localhost:3000/api/v1',
  client: {},
  safeApiCall: jest.fn(),
  unwrapApiResponse: (value: unknown) => value,
  validateId: jest.fn(),
}))

jest.mock('./auth-storage', () => ({
  getToken: () => null,
}))

jest.mock('./hyperliquid-api', () => ({
  fetchTraderFullData: jest.fn(),
  fetchTraderOpenOrdersFromHyperliquid: jest.fn(),
  fetchUserFillsFromHyperliquid: jest.fn(),
  fetchUserPortfolioFromHyperliquid: jest.fn(),
}))

describe('fetchMarketDataCatalogItems', () => {
  afterEach(() => {
    jest.resetModules()
    jest.clearAllMocks()

    if (originalFetch) {
      globalThis.fetch = originalFetch
    } else {
      delete (globalThis as { fetch?: typeof fetch }).fetch
    }

    if (originalMockApiEnv === undefined) {
      delete process.env.NEXT_PUBLIC_MOCK_API
    } else {
      process.env.NEXT_PUBLIC_MOCK_API = originalMockApiEnv
    }
  })

  it('returns the bundled fallback catalog without calling the removed backend meta endpoint', async () => {
    const fetchMock = jest.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { fetchMarketDataCatalogItems } = await import('./api')
    const result = await fetchMarketDataCatalogItems()

    expect(result).toEqual(FALLBACK_MARKET_DATA_CATALOG)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
