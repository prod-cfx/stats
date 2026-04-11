/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

const getStrategyById = jest.fn()
const originalFetch = globalThis.fetch
const originalMockFallbackEnv = process.env.NEXT_PUBLIC_ACCOUNT_AI_QUANT_MOCK_FALLBACK
const originalAppEnv = process.env.NEXT_PUBLIC_APP_ENV

jest.mock('@/components/account/ai-quant-strategy-store', () => ({
  deleteStrategyById: jest.fn(),
  getStrategyById,
  listStrategies: jest.fn(() => []),
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

jest.mock('@ai/shared', () => ({
  buildBearerAuthHeaders: () => ({}),
  getErrorHttpStatus: () => undefined,
  unwrapTransportResponse: (value: unknown) => value,
}), { virtual: true })

describe('fetchAccountAiQuantStrategyDetail', () => {
  beforeEach(() => {
    getStrategyById.mockReset()
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

  it('does not fallback to local mock detail when backend detail request fails', async () => {
    process.env.NEXT_PUBLIC_ACCOUNT_AI_QUANT_MOCK_FALLBACK = 'true'
    process.env.NEXT_PUBLIC_APP_ENV = 'development'

    const fetchMock = jest.fn().mockRejectedValue(new TypeError('fetch failed'))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { fetchAccountAiQuantStrategyDetail } = await import('./api')

    await expect(fetchAccountAiQuantStrategyDetail('strategy-1', 'user-1')).rejects.toThrow('fetch failed')
    expect(getStrategyById).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
