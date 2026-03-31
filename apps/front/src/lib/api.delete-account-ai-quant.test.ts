/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

const deleteMockStrategyById = jest.fn()
const originalFetch = globalThis.fetch

jest.mock('@/components/account/ai-quant-strategy-store', () => ({
  deleteStrategyById: deleteMockStrategyById,
  getStrategyById: jest.fn(),
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

const originalMockFallbackEnv = process.env.NEXT_PUBLIC_ACCOUNT_AI_QUANT_MOCK_FALLBACK
const originalAppEnv = process.env.NEXT_PUBLIC_APP_ENV

describe('deleteAccountAiQuantStrategy', () => {
  beforeEach(() => {
    deleteMockStrategyById.mockReset()
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

  it('throws instead of deleting local mock data when fallback is not explicitly enabled', async () => {
    delete process.env.NEXT_PUBLIC_ACCOUNT_AI_QUANT_MOCK_FALLBACK

    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ message: 'boom' }),
    } as Response)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { deleteAccountAiQuantStrategy } = await import('./api')

    await expect(deleteAccountAiQuantStrategy('strategy-1', 'user-1')).rejects.toThrow('boom')
    expect(deleteMockStrategyById).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to local delete only when fallback is explicitly enabled and network error is transient', async () => {
    process.env.NEXT_PUBLIC_ACCOUNT_AI_QUANT_MOCK_FALLBACK = 'true'

    const fetchMock = jest.fn().mockRejectedValue(new TypeError('fetch failed'))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { deleteAccountAiQuantStrategy } = await import('./api')

    await expect(deleteAccountAiQuantStrategy('strategy-2', 'user-2')).resolves.toBeUndefined()
    expect(deleteMockStrategyById).toHaveBeenCalledWith('strategy-2')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not fallback to local delete when backend returns non-retryable status', async () => {
    process.env.NEXT_PUBLIC_ACCOUNT_AI_QUANT_MOCK_FALLBACK = 'true'

    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ message: 'invalid request' }),
    } as Response)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { deleteAccountAiQuantStrategy } = await import('./api')

    await expect(deleteAccountAiQuantStrategy('strategy-3', 'user-3')).rejects.toThrow('invalid request')
    expect(deleteMockStrategyById).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never falls back to local delete in production mode even when fallback flag is true', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'production'
    process.env.NEXT_PUBLIC_ACCOUNT_AI_QUANT_MOCK_FALLBACK = 'true'

    const fetchMock = jest.fn().mockRejectedValue(new TypeError('fetch failed'))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { deleteAccountAiQuantStrategy } = await import('./api')

    await expect(deleteAccountAiQuantStrategy('strategy-4', 'user-4')).rejects.toThrow('fetch failed')
    expect(deleteMockStrategyById).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
