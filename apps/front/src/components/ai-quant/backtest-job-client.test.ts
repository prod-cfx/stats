import { API_BASE_URL } from '@/lib/api-client'
import {
  createBacktestJob,
  getBacktestJob,
  getBacktestJobResult,
} from './backtest-job-client'

type MockFetchResponseInit = {
  ok: boolean
  status: number
  statusText?: string
  body?: unknown
}

function mockFetchResponse(init: MockFetchResponseInit) {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: init.ok,
    status: init.status,
    statusText: init.statusText ?? '',
    json: jest.fn().mockResolvedValue(init.body),
  } as unknown as Response)
}

describe('backtest-job-client', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
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
        scriptCode: 'return { type: "NOOP" }',
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

    expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/backtesting/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

    expect(global.fetch).toHaveBeenCalledTimes(4)
    expect(global.fetch).toHaveBeenLastCalledWith(`${API_BASE_URL}/backtesting/jobs/btjob-1`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
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

  it('throws error with status and message on non-2xx', async () => {
    mockFetchResponse({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      body: { message: 'backtest.job_not_completed' },
    })

    await expect(getBacktestJobResult('btjob-1')).rejects.toThrow('409')
    await expect(getBacktestJobResult('btjob-1')).rejects.toThrow('backtest.job_not_completed')
  })
})
