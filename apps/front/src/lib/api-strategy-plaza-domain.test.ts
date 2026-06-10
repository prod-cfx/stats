/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

const originalFetch = globalThis.fetch
const mockGetToken = jest.fn()

jest.mock('@ai/shared', () => ({
  buildBearerAuthHeaders: (token: string) => ({
    Authorization: `Bearer ${token}`,
  }),
  getErrorHttpStatus: jest.fn(),
  unwrapTransportResponse: (value: unknown) => {
    if (value && typeof value === 'object' && 'data' in value) {
      return (value as { data: unknown }).data
    }
    return value
  },
}), { virtual: true })

jest.mock('@/components/account/ai-quant-strategy-store', () => ({
  deleteStrategyById: jest.fn(),
  getStrategyById: jest.fn(),
  listStrategies: jest.fn(() => []),
  updateStrategyStatus: jest.fn(),
}))

jest.mock('@/components/ai-quant/ai-quant-error-stage', () => ({
  buildAiQuantErrorMessage: jest.fn((_fallback: string) => 'fallback'),
  parseAiQuantErrorMeta: jest.fn(() => ({})),
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
  API_BASE_URL: 'http://localhost:3000/api/v1',
  client: {},
  safeApiCall: jest.fn(),
  unwrapApiResponse: (value: unknown) => value,
  validateId: (id: string, label?: string) => {
    if (!id?.trim() || !/^[a-z0-9]{24}$/.test(id)) {
      throw new Error(`${label ?? 'id'} is required`)
    }
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

const templatePayload = {
  id: 'ma-cross',
  name: 'MA Cross',
  description: 'Moving average crossover',
  logicDescription: 'Buy when fast MA crosses above slow MA',
  tags: ['trend', 'official'],
  riskLevel: 'medium',
  scenario: 'trend-following',
  exchange: 'okx',
  environment: 'demo',
  marketType: 'perp',
  symbol: 'BTC-USDT-SWAP',
  timeframe: '1h',
  positionPct: 20,
  leverage: 2,
  status: 'live',
  displayOrder: 1,
  displayMetrics: {
    label: 'official_sample_backtest',
    returnPct: 1.78,
    winRatePct: 58.14,
    maxDrawdownPct: 0.78,
    tradeCount: 43,
  },
  officialBacktest: {
    generatedAt: '2026-06-10T04:45:41.674Z',
    backtestFrom: 1775008800000,
    backtestTo: 1777167900000,
    source: 'https://www.okx.com/api/v5/market/history-candles',
    dataSource: {
      exchange: 'okx',
      marketType: 'swap',
      endpoint: 'https://www.okx.com/api/v5/market/history-candles',
      fixedEndTs: 1777168800000,
      pagination: { parameter: 'after', pageLimit: 300, pageCount: 8 },
    },
    candleCount: 2400,
    metrics: { returnPct: 1.78, winRatePct: 58.14, maxDrawdownPct: 0.78, tradeCount: 43 },
    equityCurve: [{ ts: 1775008800000, equity: 10000 }, { ts: 1777167900000, equity: 10177.53 }],
    trades: [{
      id: 'ma-cross-1',
      side: 'LONG',
      entryTs: 1775008800000,
      entryPrice: 100,
      exitTs: 1775095200000,
      exitPrice: 101.78,
      returnPct: 1.78,
    }],
    confidence: { level: 'high', reasons: ['样本回测满足官方基础准入条件。'] },
    disclaimer: '历史回测不代表未来收益。该结果基于固定历史窗口和官方参数，不等同于实盘表现。',
  },
}

const strategyDetailPayload = {
  ...templatePayload,
  id: 'strategy-1',
  isSubscribed: true,
  paramSchema: null,
  paramValues: null,
  schemaVersion: null,
  metrics: {
    returnPct: null,
    maxDrawdownPct: null,
    winRatePct: null,
    tradeCount: null,
  },
  updatedAt: '2026-04-24T00:00:00.000Z',
  totalPnl: null,
  todayPnl: null,
  equitySeries: [],
  snapshot: {
    exchange: 'okx',
    symbol: 'BTC-USDT-SWAP',
    timeframe: '1h',
    positionPct: 20,
    publishedSnapshotId: null,
    snapshotHash: null,
    paramSchema: null,
    paramValues: null,
    schemaVersion: null,
  },
  timeline: [],
  runtimeExecutionStates: [],
  accountOverview: {
    initialBalance: null,
    totalEquity: null,
    availableBalance: null,
    totalPnl: null,
    todayPnl: null,
    baseCurrency: null,
  },
  positionOverview: {
    openPositionsCount: null,
    closedPositionsCount: null,
    totalRealizedPnl: null,
    totalUnrealizedPnl: null,
  },
  latestOrders: [],
}

describe('strategy plaza domain API', () => {
  beforeEach(() => {
    jest.resetModules()
    mockGetToken.mockReset()
    mockGetToken.mockReturnValue('a.b.c')
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
    if (originalFetch) {
      globalThis.fetch = originalFetch
    } else {
      delete (globalThis as { fetch?: typeof fetch }).fetch
    }
  })

  it('fetches and unwraps strategy plaza templates without requiring login', async () => {
    mockGetToken.mockReturnValueOnce(null)
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [templatePayload], message: 'ok' }),
    } as Response)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { fetchStrategyPlazaTemplates } = await import('./api')
    await expect(fetchStrategyPlazaTemplates()).resolves.toEqual([templatePayload])
    await expect(fetchStrategyPlazaTemplates()).resolves.toMatchObject([{ officialBacktest: {
      metrics: { tradeCount: 43 },
      equityCurve: [{ ts: 1775008800000, equity: 10000 }, { ts: 1777167900000, equity: 10177.53 }],
      trades: [{ id: 'ma-cross-1' }],
      confidence: { level: 'high' },
      disclaimer: expect.stringContaining('历史回测不代表未来收益'),
    } }])

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/strategy-plaza/templates',
      expect.objectContaining({
        method: 'GET',
        headers: {},
      }),
    )
  })

  it('fetches and unwraps a public strategy plaza template detail without login', async () => {
    mockGetToken.mockReturnValueOnce(null)
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: templatePayload, message: 'ok' }),
    } as Response)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { fetchStrategyPlazaTemplate } = await import('./api')
    await expect(fetchStrategyPlazaTemplate('ma-cross')).resolves.toMatchObject({
      id: 'ma-cross',
      officialBacktest: { metrics: { tradeCount: 43 }, trades: [{ id: 'ma-cross-1' }] },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/strategy-plaza/templates/ma-cross',
      expect.objectContaining({ method: 'GET', headers: {} }),
    )
  })

  it('runs official strategy plaza template slugs with only runRequestId in the JSON body', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: strategyDetailPayload }),
    } as Response)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { runStrategyPlazaTemplate } = await import('./api')
    await expect(runStrategyPlazaTemplate('ma-cross', 'run-123456')).resolves.toEqual(strategyDetailPayload)
    await expect(runStrategyPlazaTemplate('bollinger-reversion', 'run-789012')).resolves.toEqual(strategyDetailPayload)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/v1/strategy-plaza/templates/ma-cross/run',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer a.b.c',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ runRequestId: 'run-123456' }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/v1/strategy-plaza/templates/bollinger-reversion/run',
      expect.objectContaining({
        body: JSON.stringify({ runRequestId: 'run-789012' }),
      }),
    )
  })

  it('starts and unwraps a strategy plaza edit session with auth headers and no body', async () => {
    const editSessionPayload = {
      sessionId: 'session-1',
      templateId: 'ma-cross',
      initialMessage: 'Help me customize this strategy',
    }
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: editSessionPayload }),
    } as Response)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { startStrategyPlazaEditSession } = await import('./api')
    await expect(startStrategyPlazaEditSession('ma-cross', 'en')).resolves.toEqual(editSessionPayload)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/strategy-plaza/templates/ma-cross/edit-session?locale=en',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer a.b.c',
        }),
      }),
    )
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('body')
  })

  it('creates plaza run request ids with the expected prefix', async () => {
    const { createStrategyPlazaRunRequestId } = await import('./api')
    const requestId = createStrategyPlazaRunRequestId()

    expect(requestId.startsWith('plaza-run-')).toBe(true)
    expect(requestId.length).toBeGreaterThanOrEqual('plaza-run-'.length + 8)
  })

  it('rejects blank template ids before making authenticated requests', async () => {
    const fetchMock = jest.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { runStrategyPlazaTemplate, startStrategyPlazaEditSession } = await import('./api')

    await expect(runStrategyPlazaTemplate('  ', 'run-123456')).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
    await expect(startStrategyPlazaEditSession('')).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('preserves backend strategy plaza error code and reason message', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        message: 'OKX demo API key required',
        error: {
          code: 'strategy_plaza.okx_demo_api_key_required',
          args: {
            reasonMessage: '请先绑定 OKX 模拟盘 API Key',
          },
        },
      }),
    } as Response)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { runStrategyPlazaTemplate } = await import('./api')

    await expect(runStrategyPlazaTemplate('ma-cross', 'run-123456')).rejects.toMatchObject({
      code: 'strategy_plaza.okx_demo_api_key_required',
      message: '请先绑定 OKX 模拟盘 API Key',
      statusCode: 400,
    })
  })
})
