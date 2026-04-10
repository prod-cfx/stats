/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

const mockGetToken = jest.fn()
const originalFetch = globalThis.fetch

jest.mock('@ai/api-contracts', () => ({
  createApiClient: jest.fn(() => ({})),
}))

jest.mock('@/components/account/ai-quant-strategy-store', () => ({
  deleteStrategyById: jest.fn(),
  getStrategyById: jest.fn(),
  listStrategies: jest.fn(() => []),
  updateStrategyStatus: jest.fn(),
}))

jest.mock('@/components/ai-quant/ai-quant-error-stage', () => ({
  buildAiQuantStageFallbackMessage: jest.fn(() => 'fallback'),
  parseAiQuantErrorMeta: jest.fn(() => null),
}))

jest.mock('./api-cache', () => ({
  cachedRequest: jest.fn(),
  CacheTTL: {
    SHORT: 30,
    MEDIUM: 60,
    LONG: 300,
  },
}))

jest.mock('./auth-storage', () => ({
  getToken: () => mockGetToken(),
}))

jest.mock('./hyperliquid-api', () => ({
  fetchTraderFullData: jest.fn(),
  fetchTraderOpenOrdersFromHyperliquid: jest.fn(),
  fetchUserFillsFromHyperliquid: jest.fn(),
  fetchUserPortfolioFromHyperliquid: jest.fn(),
}))

describe('exchange account transport', () => {
  beforeEach(() => {
    jest.resetModules()
    mockGetToken.mockReset()
    mockGetToken.mockReturnValue('a.b.c')
  })

  afterEach(() => {
    jest.restoreAllMocks()
    if (originalFetch) {
      globalThis.fetch = originalFetch
    } else {
      delete (globalThis as { fetch?: typeof fetch }).fetch
    }
  })

  it('sends bearer auth headers and unwraps response envelopes for exchange accounts', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            id: null,
            exchangeId: 'binance',
            isBound: false,
            name: null,
            maskedCredential: null,
            isTestnet: null,
            lastValidatedAt: null,
            createdAt: null,
          },
        ],
      }),
    } as Response)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { fetchUserExchangeAccountStatuses } = await import('./api')
    const result = await fetchUserExchangeAccountStatuses()

    expect(result).toEqual([
      expect.objectContaining({
        exchangeId: 'binance',
        isBound: false,
      }),
    ])
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/account/exchange-accounts'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer a.b.c',
        }),
      }),
    )
  })
})
