/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

const listMockStrategies = jest.fn()
const getStrategyById = jest.fn()
const updateStrategyStatus = jest.fn()
const deleteStrategyById = jest.fn()
const originalFetch = globalThis.fetch
const originalMockFallbackEnv = process.env.NEXT_PUBLIC_ACCOUNT_AI_QUANT_MOCK_FALLBACK
const originalAppEnv = process.env.NEXT_PUBLIC_APP_ENV

jest.mock('@/components/account/ai-quant-strategy-store', () => ({
  deleteStrategyById,
  getStrategyById,
  listStrategies: listMockStrategies,
  updateStrategyStatus,
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

describe('account ai-quant detail/action mock fallback guard', () => {
  beforeEach(() => {
    jest.resetModules()
    listMockStrategies.mockReset()
    getStrategyById.mockReset()
    updateStrategyStatus.mockReset()
    deleteStrategyById.mockReset()
    process.env.NEXT_PUBLIC_ACCOUNT_AI_QUANT_MOCK_FALLBACK = 'true'
    process.env.NEXT_PUBLIC_APP_ENV = 'development'
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

  it('does not fallback to mock strategy detail when remote detail request fails', async () => {
    getStrategyById.mockReturnValue({
      id: 'mock-strategy',
      status: 'running',
    })
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch

    const { fetchAccountAiQuantStrategyDetail } = await import('./api')

    await expect(fetchAccountAiQuantStrategyDetail('strategy-1', 'user-1')).rejects.toMatchObject({
      message: 'fetch failed',
    })
    expect(getStrategyById).not.toHaveBeenCalled()
  })

  it('does not fallback to mock action updates when remote action request fails', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch

    const { performAccountAiQuantStrategyAction } = await import('./api')

    await expect(performAccountAiQuantStrategyAction('strategy-1', {
      userId: 'user-1',
      action: 'run',
    })).rejects.toMatchObject({
      message: 'fetch failed',
    })
    expect(updateStrategyStatus).not.toHaveBeenCalled()
    expect(getStrategyById).not.toHaveBeenCalled()
  })
})
