import { afterEach, describe, expect, it, jest } from '@jest/globals'

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
  getServerAuthHeaders: jest.fn(async () => ({ Authorization: 'Bearer a.b.c' })),
}))

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

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^https?:\/\//),
      expect.objectContaining({ method: 'GET' }),
    )
  })
})
