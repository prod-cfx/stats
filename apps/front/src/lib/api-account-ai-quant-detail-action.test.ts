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

  it('posts liquidate_and_stop action to the strategy actions endpoint', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: 'strategy-1',
          name: 'Strategy 1',
          status: 'stopped',
          exchange: 'okx',
          symbol: 'BTC-USDT-SWAP',
          timeframe: '15m',
          positionPct: 10,
          isSubscribed: true,
          paramSchema: null,
          paramValues: null,
          schemaVersion: null,
          metrics: {
            returnPct: 0,
            maxDrawdownPct: 0,
            winRatePct: 0,
            tradeCount: 0,
          },
          updatedAt: '2026-04-25T00:00:00.000Z',
          totalPnl: 0,
          todayPnl: 0,
          equitySeries: [],
          snapshot: {
            exchange: 'okx',
            symbol: 'BTC-USDT-SWAP',
            timeframe: '15m',
            positionPct: 10,
            publishedSnapshotId: 'snapshot-1',
            snapshotHash: 'hash-1',
            paramSchema: null,
            paramValues: null,
            schemaVersion: null,
          },
          timeline: [],
          runtimeExecutionStates: [],
          accountOverview: {
            initialBalance: 10000,
            totalEquity: 10000,
            availableBalance: 10000,
            totalPnl: 0,
            todayPnl: 0,
            baseCurrency: 'USDT',
          },
          positionOverview: {
            openPositionsCount: 0,
            closedPositionsCount: 0,
            totalRealizedPnl: 0,
            totalUnrealizedPnl: 0,
          },
          latestOrders: [],
          runtimeSemanticSummary: null,
        },
      }),
    }) as unknown as typeof fetch

    const { performAccountAiQuantStrategyAction } = await import('./api')

    await performAccountAiQuantStrategyAction('strategy-1', {
      userId: 'user-1',
      action: 'liquidate_and_stop',
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/account/ai-quant/strategies/strategy-1/actions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ userId: 'user-1', action: 'liquidate_and_stop' }),
      }),
    )
  })
})
