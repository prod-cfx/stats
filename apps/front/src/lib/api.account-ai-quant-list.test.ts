/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

const listMockStrategies = jest.fn()
const originalFetch = globalThis.fetch
const originalMockFallbackEnv = process.env.NEXT_PUBLIC_ACCOUNT_AI_QUANT_MOCK_FALLBACK
const originalAppEnv = process.env.NEXT_PUBLIC_APP_ENV

jest.mock('@/components/account/ai-quant-strategy-store', () => ({
  deleteStrategyById: jest.fn(),
  getStrategyById: jest.fn(),
  listStrategies: listMockStrategies,
  updateStrategyStatus: jest.fn(),
}))

jest.mock('./api-cache', () => ({
  cachedRequest: jest.fn(),
  CacheTTL: {
    SHORT: 30,
    MEDIUM: 60,
    LONG: 300,
  },
}))

jest.mock('./api-client', () => ({
  API_BASE_URL: 'http://localhost:3000/api',
  client: {},
  safeApiCall: jest.fn(),
  unwrapApiResponse: (value: unknown) => value,
  validateId: (id: string) => {
    if (!id?.trim()) throw new Error('invalid id')
  },
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

describe('fetchAccountAiQuantStrategies', () => {
  beforeEach(() => {
    listMockStrategies.mockReset()
    listMockStrategies.mockReturnValue([])
    jest.resetModules()
  })

  afterEach(() => {
    if (originalMockFallbackEnv === undefined) {
      delete process.env.NEXT_PUBLIC_ACCOUNT_AI_QUANT_MOCK_FALLBACK
    } else {
      process.env.NEXT_PUBLIC_ACCOUNT_AI_QUANT_MOCK_FALLBACK = originalMockFallbackEnv
    }
    if (originalAppEnv === undefined) {
      delete process.env.NEXT_PUBLIC_APP_ENV
    } else {
      process.env.NEXT_PUBLIC_APP_ENV = originalAppEnv
    }
    jest.restoreAllMocks()
    if (originalFetch) {
      globalThis.fetch = originalFetch
    } else {
      delete (globalThis as { fetch?: typeof fetch }).fetch
    }
  })

  it('requests subscribedOnly and excludeDraft, and keeps backend paging payload unchanged', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        total: 3,
        page: 1,
        limit: 20,
        items: [
          { id: 's1', name: 'A', status: 'running', isSubscribed: true, metrics: {}, updatedAt: '2026-03-30T00:00:00.000Z' },
          { id: 's2', name: 'B', status: 'draft', isSubscribed: true, metrics: {}, updatedAt: '2026-03-30T00:00:00.000Z' },
          { id: 's3', name: 'C', status: 'running', isSubscribed: false, metrics: {}, updatedAt: '2026-03-30T00:00:00.000Z' },
        ],
      }),
    } as Response)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { fetchAccountAiQuantStrategies } = await import('./api')
    const result = await fetchAccountAiQuantStrategies({ userId: 'user-1', page: 1, limit: 20 })

    const firstUrl = String(fetchMock.mock.calls[0]?.[0] ?? '')
    expect(firstUrl).toContain('subscribedOnly=true')
    expect(firstUrl).toContain('excludeDraft=true')
    expect(result.total).toBe(3)
    expect(result.items.map(item => item.id)).toEqual(['s1', 's2', 's3'])
  })

  it('falls back to local mock list in non-production only and still excludes draft', async () => {
    process.env.NEXT_PUBLIC_ACCOUNT_AI_QUANT_MOCK_FALLBACK = 'true'
    process.env.NEXT_PUBLIC_APP_ENV = 'development'

    listMockStrategies.mockReturnValue([
      {
        id: 'm1',
        name: 'mock running',
        status: 'running',
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
        paramSchema: null,
        paramValues: null,
        schemaVersion: null,
        metrics: { returnPct: 0, maxDrawdownPct: 0, winRatePct: 0, tradeCount: 0 },
        updatedAt: '2026-03-30T00:00:00.000Z',
      },
      {
        id: 'm2',
        name: 'mock draft',
        status: 'draft',
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
        paramSchema: null,
        paramValues: null,
        schemaVersion: null,
        metrics: { returnPct: 0, maxDrawdownPct: 0, winRatePct: 0, tradeCount: 0 },
        updatedAt: '2026-03-30T00:00:00.000Z',
      },
    ])

    const fetchMock = jest.fn().mockRejectedValue(new TypeError('fetch failed'))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { fetchAccountAiQuantStrategies } = await import('./api')
    const result = await fetchAccountAiQuantStrategies({ userId: 'user-1', page: 1, limit: 20 })

    expect(result.items.map(item => item.id)).toEqual(['m1'])
  })
})
