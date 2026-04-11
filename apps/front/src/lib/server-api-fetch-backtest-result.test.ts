import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { buildServerAuthHeaders, getServerAuthHeaders, getServerToken } from './server-auth'

const mockServerClient = {
  BacktestingProxyController_getJob: jest.fn(),
  BacktestingProxyController_getJobResult: jest.fn(),
  LlmStrategyInstancesController_detail: jest.fn(),
  LlmStrategyInstancesController_list: jest.fn(),
}

jest.mock('@ai/api-contracts', () => ({
  createApiClient: jest.fn(() => mockServerClient),
}))

jest.mock('@ai/shared', () => ({
  getErrorHttpStatus: jest.fn((error: { status?: number }) => error?.status),
  unwrapTransportResponse: jest.fn((response: any) => {
    if (response && typeof response === 'object' && 'data' in response) {
      return response.data
    }
    return response
  }),
}))

jest.mock('./api-client', () => ({
  SERVER_API_BASE_URL: 'http://localhost:3000/api/v1',
}))

jest.mock('./server-auth', () => ({
  buildServerAuthHeaders: jest.fn((token: string | null) =>
    token ? { Authorization: `Bearer ${token}` } : {},
  ),
  getServerToken: jest.fn(async () => 'a.b.c'),
  getServerAuthHeaders: jest.fn(async () => ({ Authorization: 'Bearer a.b.c' })),
}))

const mockBuildServerAuthHeaders = jest.mocked(buildServerAuthHeaders)
const mockGetServerToken = jest.mocked(getServerToken)
const mockGetServerAuthHeaders = jest.mocked(getServerAuthHeaders)

describe('server-api backtest and llm transport', () => {
  beforeEach(() => {
    Object.values(mockServerClient).forEach(mock => mock.mockReset())
    mockBuildServerAuthHeaders.mockClear()
    mockGetServerToken.mockClear()
    mockGetServerAuthHeaders.mockClear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('uses contract client for server-side backtest result fetch', async () => {
    mockServerClient.BacktestingProxyController_getJobResult.mockResolvedValue({
      data: {
        summary: {
          netProfit: 100,
          netProfitPct: 1,
          maxDrawdownPct: 2,
          winRate: 60,
          profitFactor: 1.5,
          totalTrades: 10,
        },
      },
    })

    const { fetchBacktestJobResultServer } = await import('./server-api')
    await fetchBacktestJobResultServer('btjob-1')

    expect(mockGetServerToken).toHaveBeenCalledTimes(1)
    expect(mockBuildServerAuthHeaders).toHaveBeenCalledWith('a.b.c')
    expect(mockServerClient.BacktestingProxyController_getJobResult).toHaveBeenCalledWith({
      headers: { Authorization: 'Bearer a.b.c' },
      params: { id: 'btjob-1' },
    })
  })

  it('returns null before building auth headers when token is missing', async () => {
    mockGetServerToken.mockResolvedValueOnce(null)

    const { fetchBacktestJobResultServer } = await import('./server-api')
    await expect(fetchBacktestJobResultServer('btjob-2')).resolves.toBeNull()

    expect(mockBuildServerAuthHeaders).toHaveBeenCalledWith(null)
    expect(mockServerClient.BacktestingProxyController_getJobResult).not.toHaveBeenCalled()
  })

  it('uses contract client for server-side backtest summary requests', async () => {
    mockServerClient.BacktestingProxyController_getJob.mockResolvedValue({
      data: {
        id: 'btjob-1',
        status: 'succeeded',
        createdAt: '2026-03-25T00:00:00.000Z',
        resultSummary: {
          netProfit: 100,
          netProfitPct: 1,
          maxDrawdownPct: 2,
          winRate: 0.6,
          profitFactor: 1.5,
          totalTrades: 10,
        },
      },
    })

    const { fetchBacktestJobServer } = await import('./server-api')
    await fetchBacktestJobServer('btjob-1')

    expect(mockGetServerToken).toHaveBeenCalledTimes(1)
    expect(mockBuildServerAuthHeaders).toHaveBeenCalledWith('a.b.c')
    expect(mockServerClient.BacktestingProxyController_getJob).toHaveBeenCalledWith({
      headers: { Authorization: 'Bearer a.b.c' },
      params: { id: 'btjob-1' },
    })
  })

  it('retries llm strategy list anonymously after 401/403', async () => {
    mockServerClient.LlmStrategyInstancesController_list
      .mockRejectedValueOnce({ status: 401, message: 'expired' })
      .mockResolvedValueOnce({
        data: {
          items: [],
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        },
      })

    const { fetchLlmStrategyInstancesServer } = await import('./server-api')
    await fetchLlmStrategyInstancesServer({ page: 1, limit: 20 })

    expect(mockGetServerAuthHeaders).toHaveBeenCalledTimes(1)
    expect(mockServerClient.LlmStrategyInstancesController_list).toHaveBeenNthCalledWith(1, {
      headers: { Authorization: 'Bearer a.b.c' },
      queries: { page: 1, limit: 20 },
    })
    expect(mockServerClient.LlmStrategyInstancesController_list).toHaveBeenNthCalledWith(2, {
      queries: { page: 1, limit: 20 },
    })
  })
})
