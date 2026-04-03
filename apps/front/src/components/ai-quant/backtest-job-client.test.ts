import { API_BASE_URL } from '@/lib/api-client'
import { ApiError, AuthenticationError } from '@/lib/errors'
import {
  BACKTEST_REQUEST_TIMEOUT_MS,
  createBacktestJob,
  getBacktestJob,
  getBacktestJobResult,
} from './backtest-job-client'

const mockGetToken = jest.fn()

jest.mock('@/lib/auth-storage', () => ({
  getToken: () => mockGetToken(),
}))

interface MockFetchResponseInit {
  ok: boolean
  status: number
  statusText?: string
  body?: unknown
  jsonRejects?: boolean
}

function mockFetchResponse(init: MockFetchResponseInit) {
  ;(globalThis.fetch as jest.Mock).mockResolvedValue({
    ok: init.ok,
    status: init.status,
    statusText: init.statusText ?? '',
    json: init.jsonRejects
      ? jest.fn().mockRejectedValue(new Error('invalid json'))
      : jest.fn().mockResolvedValue(init.body),
  } as unknown as Response)
}

describe('backtest-job-client', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn()
    mockGetToken.mockReturnValue('header.payload.signature')
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('createBacktestJob calls correct endpoint and payload', async () => {
    const payload = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: ['15m'],
      initialCash: 10000,
      leverage: 1,
      execution: { slippageBps: 10, feeBps: 5, priceSource: 'close' },
      strategy: {
        id: 'strategy-1',
        protocolVersion: 'v1',
        publishedSnapshotId: 'snapshot-1',
        params: { foo: 'bar' },
      },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [],
    } as const

    mockFetchResponse({
      ok: true,
      status: 200,
      body: { data: { id: 'btjob-1', status: 'queued', createdAt: '2026-03-25T00:00:00.000Z' } },
    })

    const result = await createBacktestJob(payload)

    expect(globalThis.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/backtesting/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer header.payload.signature',
      },
      body: JSON.stringify(payload),
      signal: expect.any(AbortSignal),
    })
    expect(result).toEqual({
      id: 'btjob-1',
      status: 'queued',
      createdAt: '2026-03-25T00:00:00.000Z',
    })
  })

  it('getBacktestJob parses queued/running/succeeded/failed', async () => {
    const statuses = ['queued', 'running', 'succeeded', 'failed'] as const

    for (const status of statuses) {
      mockFetchResponse({
        ok: true,
        status: 200,
        body: { data: { id: 'btjob-1', status, createdAt: '2026-03-25T00:00:00.000Z' } },
      })
      const job = await getBacktestJob('btjob-1')
      expect(job.status).toBe(status)
    }

    expect(globalThis.fetch).toHaveBeenCalledTimes(4)
    expect(globalThis.fetch).toHaveBeenLastCalledWith(`${API_BASE_URL}/backtesting/jobs/btjob-1`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer header.payload.signature',
      },
      signal: expect.any(AbortSignal),
    })
  })

  it('encodes jobId safely in URL path', async () => {
    mockFetchResponse({
      ok: true,
      status: 200,
      body: { data: { id: 'btjob-1', status: 'queued', createdAt: '2026-03-25T00:00:00.000Z' } },
    })

    await getBacktestJob('job/with spaces?x=1')

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/backtesting/jobs/${encodeURIComponent('job/with spaces?x=1')}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer header.payload.signature',
        },
        signal: expect.any(AbortSignal),
      },
    )
  })

  it('throws auth error when token is missing', async () => {
    mockGetToken.mockReturnValueOnce(null)

    await expect(createBacktestJob({
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: ['15m'],
      initialCash: 10000,
      leverage: 1,
      execution: { slippageBps: 10, feeBps: 5, priceSource: 'close' },
      strategy: {
        id: 'strategy-1',
        protocolVersion: 'v1',
        publishedSnapshotId: 'snapshot-1',
        params: {},
      },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [],
    })).rejects.toBeInstanceOf(AuthenticationError)

    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('throws auth error when token is invalid', async () => {
    mockGetToken.mockReturnValueOnce('not-a-jwt')

    await expect(getBacktestJob('btjob-1')).rejects.toBeInstanceOf(AuthenticationError)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('getBacktestJobResult returns summary', async () => {
    mockFetchResponse({
      ok: true,
      status: 200,
      body: {
        data: {
          summary: {
            netProfit: 123,
            netProfitPct: 12.3,
            maxDrawdownPct: 4.5,
            winRate: 0.61,
            profitFactor: 1.8,
            totalTrades: 10,
          },
        },
      },
    })

    const report = await getBacktestJobResult('btjob-1')
    expect(report.summary).toEqual({
      netProfit: 123,
      netProfitPct: 12.3,
      maxDrawdownPct: 4.5,
      winRate: 0.61,
      profitFactor: 1.8,
      totalTrades: 10,
    })
  })

  it('throws ApiError with statusCode and message on non-2xx', async () => {
    mockFetchResponse({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      body: { message: 'backtest.job_not_completed' },
    })

    await expect(getBacktestJobResult('btjob-1')).rejects.toBeInstanceOf(ApiError)
    await expect(getBacktestJobResult('btjob-1')).rejects.toMatchObject({
      message: expect.stringContaining('backtest.job_not_completed'),
      statusCode: 409,
    })
  })

  it('rejects unknown status with ApiError', async () => {
    mockFetchResponse({
      ok: true,
      status: 200,
      body: { data: { id: 'btjob-1', status: 'unknown', createdAt: '2026-03-25T00:00:00.000Z' } },
    })

    await expect(getBacktestJob('btjob-1')).rejects.toBeInstanceOf(ApiError)
    await expect(getBacktestJob('btjob-1')).rejects.toMatchObject({
      statusCode: 500,
      code: 'API_ERROR',
    })
  })

  it('uses statusText fallback when error body is non-JSON', async () => {
    mockFetchResponse({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      jsonRejects: true,
    })

    await expect(getBacktestJobResult('btjob-1')).rejects.toBeInstanceOf(ApiError)
    await expect(getBacktestJobResult('btjob-1')).rejects.toMatchObject({
      message: expect.stringContaining('Bad Gateway'),
      statusCode: 502,
    })
  })

  it('uses statusText fallback when error body is empty', async () => {
    mockFetchResponse({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      body: null,
    })

    await expect(getBacktestJobResult('btjob-1')).rejects.toBeInstanceOf(ApiError)
    await expect(getBacktestJobResult('btjob-1')).rejects.toMatchObject({
      message: expect.stringContaining('Service Unavailable'),
      statusCode: 503,
    })
  })

  it('throws timeout ApiError when request hangs', async () => {
    jest.useFakeTimers()
    ;(globalThis.fetch as jest.Mock).mockImplementation((_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })

    const assertion = expect(getBacktestJobResult('btjob-1')).rejects.toMatchObject({
      code: 'API_TIMEOUT',
      statusCode: 408,
    })
    await jest.advanceTimersByTimeAsync(BACKTEST_REQUEST_TIMEOUT_MS)
    await assertion
    jest.useRealTimers()
  })
})
