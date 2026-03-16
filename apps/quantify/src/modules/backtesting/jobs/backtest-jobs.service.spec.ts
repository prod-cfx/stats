import type { BacktestRunInput } from '../types/backtesting.types'
import { ConflictException } from '@nestjs/common'
import { BacktestJobsService } from './backtest-jobs.service'

function createInput(): BacktestRunInput {
  return {
    symbols: ['BTCUSDT'],
    baseTimeframe: '5m',
    stateTimeframes: ['1h'],
    initialCash: 10000,
    leverage: 2,
    execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
    strategy: {
      id: 's1',
      params: {},
      fn: () => ({ type: 'NOOP' }),
    },
    dataRange: { fromTs: 1, toTs: 2 },
    bars: [],
  }
}

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('backtestJobsService', () => {
  it('should transition queued -> running -> succeeded', async () => {
    const runner = {
      run: jest.fn().mockResolvedValue({
        summary: { totalTrades: 0 },
      }),
    }
    const service = new BacktestJobsService(runner as never)
    const created = service.createJob(createInput())

    expect(created.status).toBe('queued')
    await flushMicrotasks()

    const job = service.getJob(created.id)
    expect(job.status).toBe('succeeded')
    expect(service.getJobResult(created.id)).toEqual({ summary: { totalTrades: 0 } })
  })

  it('should transition queued -> running -> failed when runner throws', async () => {
    const runner = {
      run: jest.fn().mockRejectedValue(new Error('boom')),
    }
    const service = new BacktestJobsService(runner as never)
    const created = service.createJob(createInput())
    await flushMicrotasks()

    const job = service.getJob(created.id)
    expect(job.status).toBe('failed')
    expect(job.error).toContain('boom')
  })

  it('should reject result query when job is not completed', () => {
    const runner = {
      run: jest.fn().mockImplementation(() => new Promise(() => {})),
    }
    const service = new BacktestJobsService(runner as never)
    const created = service.createJob(createInput())

    expect(() => service.getJobResult(created.id)).toThrow(ConflictException)
  })
})

