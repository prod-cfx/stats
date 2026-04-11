/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

const mockGetToken = jest.fn()
const mockClient = {
  AccountExchangeAccountsController_list: jest.fn(),
}

jest.mock('@ai/api-contracts', () => ({
  createApiClient: jest.fn(() => mockClient),
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
  })

  it('sends bearer auth headers and unwraps response envelopes for exchange accounts', async () => {
    mockClient.AccountExchangeAccountsController_list.mockResolvedValue({
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
    })

    const { fetchUserExchangeAccountStatuses } = await import('./api')
    const result = await fetchUserExchangeAccountStatuses()

    expect(result).toEqual([
      expect.objectContaining({
        exchangeId: 'binance',
        isBound: false,
      }),
    ])
    expect(mockClient.AccountExchangeAccountsController_list).toHaveBeenCalledWith({
      headers: expect.objectContaining({
        Authorization: 'Bearer a.b.c',
      }),
    })
  })
})
