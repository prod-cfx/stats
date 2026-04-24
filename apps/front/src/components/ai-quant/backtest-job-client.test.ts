import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ApiError, AuthenticationError } from '@/lib/errors'
import {
  BACKTEST_REQUEST_TIMEOUT_MS,
  createBacktestJob,
  formatBacktestJobFailure,
  getBacktestJob,
  getBacktestJobResult,
} from './backtest-job-client'

const mockGetToken = jest.fn()

jest.mock('@/lib/api-client', () => ({
  client: {
    BacktestingProxyController_createJob: jest.fn(),
    BacktestingProxyController_getJob: jest.fn(),
    BacktestingProxyController_getJobResult: jest.fn(),
  },
  unwrapApiResponse: (response: unknown) => {
    if (response && typeof response === 'object' && 'data' in response) {
      return (response as { data: unknown }).data
    }
    return response
  },
}))

jest.mock('@/lib/auth-storage', () => ({
  getToken: () => mockGetToken(),
}))

const { client: mockClient } = jest.requireMock('@/lib/api-client') as {
  client: {
    BacktestingProxyController_createJob: jest.Mock
    BacktestingProxyController_getJob: jest.Mock
    BacktestingProxyController_getJobResult: jest.Mock
  }
}

describe('backtest-job-client', () => {
  const apiSourcePath = resolve(__dirname, '../../lib/backtesting-api.ts')

  beforeEach(() => {
    mockGetToken.mockReset()
    mockGetToken.mockReturnValue('header.payload.signature')
    mockClient.BacktestingProxyController_createJob.mockReset()
    mockClient.BacktestingProxyController_getJob.mockReset()
    mockClient.BacktestingProxyController_getJobResult.mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.resetAllMocks()
  })

  it('createBacktestJob calls contract endpoint and payload', async () => {
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

    mockClient.BacktestingProxyController_createJob.mockResolvedValue({
      data: { id: 'btjob-1', status: 'queued', createdAt: '2026-03-25T00:00:00.000Z' },
    })

    const result = await createBacktestJob(payload)

    expect(mockClient.BacktestingProxyController_createJob).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer header.payload.signature',
          'x-request-id': expect.stringContaining('front-backtest:create-job:'),
        }),
        signal: expect.anything(),
      }),
    )
    expect(result).toEqual({
      id: 'btjob-1',
      status: 'queued',
      createdAt: '2026-03-25T00:00:00.000Z',
    })
  })

  it('createBacktestJob uses the typed contract client without any-cast', () => {
    const source = readFileSync(apiSourcePath, 'utf8')

    expect(source).toContain('schemas.BacktestingCreateJobRequestDto.parse(payload)')
    expect(source).toContain('client.BacktestingProxyController_createJob(request, {')
    expect(source).not.toContain('(client as any).BacktestingProxyController_createJob(payload, {')
  })

  it('getBacktestJob parses queued/running/succeeded/failed', async () => {
    const statuses = ['queued', 'running', 'succeeded', 'failed'] as const

    for (const status of statuses) {
      mockClient.BacktestingProxyController_getJob.mockResolvedValueOnce({
        data: { id: 'btjob-1', status, createdAt: '2026-03-25T00:00:00.000Z' },
      })
      const job = await getBacktestJob('btjob-1')
      expect(job.status).toBe(status)
    }

    expect(mockClient.BacktestingProxyController_getJob).toHaveBeenCalledTimes(4)
    expect(mockClient.BacktestingProxyController_getJob).toHaveBeenLastCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer header.payload.signature',
          'x-request-id': expect.stringContaining('front-backtest:job:btjob-1'),
        }),
        params: { id: 'btjob-1' },
        signal: expect.anything(),
      }),
    )
  })

  it('preserves structured failure details on failed jobs', async () => {
    mockClient.BacktestingProxyController_getJob.mockResolvedValue({
      data: {
        id: 'btjob-1',
        status: 'failed',
        createdAt: '2026-03-25T00:00:00.000Z',
        error: 'backtest.data_range_out_of_coverage',
        errorDetails: {
          code: 'backtest.data_range_out_of_coverage',
          message: 'backtest.data_range_out_of_coverage',
          args: {
            suggestedRange: {
              fromTs: 2,
              toTs: 3,
            },
          },
        },
      },
    })

    await expect(getBacktestJob('btjob-1')).resolves.toMatchObject({
      status: 'failed',
      error: 'backtest.data_range_out_of_coverage',
      errorDetails: {
        code: 'backtest.data_range_out_of_coverage',
        args: {
          suggestedRange: {
            fromTs: 2,
            toTs: 3,
          },
        },
      },
    })
  })

  it('formats coverage failures with suggested range details', () => {
    expect(formatBacktestJobFailure({
      error: 'backtest.data_range_out_of_coverage',
      errorDetails: {
        code: 'backtest.data_range_out_of_coverage',
        message: 'backtest.data_range_out_of_coverage',
        args: {
          suggestedRange: {
            fromTs: Date.parse('2026-03-15T04:24:00.000Z'),
            toTs: Date.parse('2026-04-14T04:24:00.000Z'),
          },
        },
      },
    })).toContain('建议改为 2026-03-15T04:24:00.000Z ~ 2026-04-14T04:24:00.000Z 后重试')
  })

  it('encodes jobId safely in path params', async () => {
    mockClient.BacktestingProxyController_getJob.mockResolvedValue({
      data: { id: 'btjob-1', status: 'queued', createdAt: '2026-03-25T00:00:00.000Z' },
    })

    await getBacktestJob('job/with spaces?x=1')

    expect(mockClient.BacktestingProxyController_getJob).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { id: encodeURIComponent('job/with spaces?x=1') },
      }),
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

    expect(mockClient.BacktestingProxyController_createJob).not.toHaveBeenCalled()
  })

  it('throws auth error when token is invalid', async () => {
    mockGetToken.mockReturnValueOnce('not-a-jwt')

    await expect(getBacktestJob('btjob-1')).rejects.toBeInstanceOf(AuthenticationError)
    expect(mockClient.BacktestingProxyController_getJob).not.toHaveBeenCalled()
  })

  it('getBacktestJobResult returns summary', async () => {
    mockClient.BacktestingProxyController_getJobResult.mockResolvedValue({
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
    mockClient.BacktestingProxyController_getJobResult.mockRejectedValue({
      response: {
        status: 409,
        statusText: 'Conflict',
        data: { message: 'backtest.job_not_completed' },
      },
    })

    await expect(getBacktestJobResult('btjob-1')).rejects.toBeInstanceOf(ApiError)
    await expect(getBacktestJobResult('btjob-1')).rejects.toMatchObject({
      message: expect.stringContaining('backtest.job_not_completed'),
      statusCode: 409,
    })
  })

  it('rejects unknown status with ApiError', async () => {
    mockClient.BacktestingProxyController_getJob.mockResolvedValue({
      data: { id: 'btjob-1', status: 'unknown', createdAt: '2026-03-25T00:00:00.000Z' },
    })

    await expect(getBacktestJob('btjob-1')).rejects.toBeInstanceOf(ApiError)
    await expect(getBacktestJob('btjob-1')).rejects.toMatchObject({
      statusCode: 500,
      code: 'API_ERROR',
    })
  })

  it('uses statusText fallback when error body is empty', async () => {
    mockClient.BacktestingProxyController_getJobResult.mockRejectedValue({
      response: {
        status: 503,
        statusText: 'Service Unavailable',
        data: null,
      },
    })

    await expect(getBacktestJobResult('btjob-1')).rejects.toBeInstanceOf(ApiError)
    await expect(getBacktestJobResult('btjob-1')).rejects.toMatchObject({
      message: expect.stringContaining('Service Unavailable'),
      statusCode: 503,
    })
  })

  it('throws timeout ApiError when request hangs', async () => {
    jest.useFakeTimers()
    mockClient.BacktestingProxyController_getJobResult.mockImplementation(
      ({ signal }: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }),
    )

    const assertion = expect(getBacktestJobResult('btjob-1')).rejects.toMatchObject({
      code: 'API_TIMEOUT',
      statusCode: 408,
    })
    await jest.advanceTimersByTimeAsync(BACKTEST_REQUEST_TIMEOUT_MS)
    await assertion
  })
})
