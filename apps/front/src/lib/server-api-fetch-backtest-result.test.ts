import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { buildServerAuthHeaders, getServerAuthHeaders, getServerToken } from './server-auth'

jest.mock('./api-client', () => ({
  API_BASE_URL: '/api/v1',
  SERVER_API_BASE_URL: 'http://localhost:3000/api/v1',
  unwrapApiResponse: (response: any) => {
    if (response && typeof response === 'object' && 'data' in response) {
      return response.data
    }
    return response
  },
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

describe('fetchBacktestJobResultServer', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('uses absolute URL for server-side fetch', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
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
      }),
    }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { fetchBacktestJobResultServer } = await import('./server-api')
    await fetchBacktestJobResultServer('btjob-1')

    expect(mockGetServerToken).toHaveBeenCalledTimes(1)
    expect(mockBuildServerAuthHeaders).toHaveBeenCalledWith('a.b.c')
    expect(mockGetServerAuthHeaders).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^https?:\/\//),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('returns null before building auth headers when token is missing', async () => {
    mockGetServerToken.mockResolvedValueOnce(null)
    mockGetServerAuthHeaders.mockResolvedValueOnce({ Authorization: 'Bearer a.b.c' })
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
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
      }),
    }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { fetchBacktestJobResultServer } = await import('./server-api')
    await expect(fetchBacktestJobResultServer('btjob-2')).resolves.toBeNull()
    expect(mockBuildServerAuthHeaders).toHaveBeenCalledWith(null)
    expect(mockGetServerAuthHeaders).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
