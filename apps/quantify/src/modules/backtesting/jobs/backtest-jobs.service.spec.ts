import type { BacktestRunInput } from '../types/backtesting.types'
import { ConflictException } from '@nestjs/common'
import { BacktestJobsService } from './backtest-jobs.service'

const OWNER_USER_ID = 'user-1'

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
    const created = service.createJob(createInput(), OWNER_USER_ID)

    expect(created.status).toBe('queued')
    await flushMicrotasks()

    const job = service.getJob(created.id, OWNER_USER_ID)
    expect(job.status).toBe('succeeded')
    expect(service.getJobResult(created.id, OWNER_USER_ID)).toEqual({ summary: { totalTrades: 0 } })
  })

  it('should transition queued -> running -> failed when runner throws', async () => {
    const runner = {
      run: jest.fn().mockRejectedValue(new Error('boom')),
    }
    const service = new BacktestJobsService(runner as never)
    const created = service.createJob(createInput(), OWNER_USER_ID)
    await flushMicrotasks()

    const job = service.getJob(created.id, OWNER_USER_ID)
    expect(job.status).toBe('failed')
    expect(job.error).toContain('boom')
  })

  it('should reject result query when job is not completed', () => {
    const runner = {
      run: jest.fn().mockImplementation(() => new Promise(() => {})),
    }
    const service = new BacktestJobsService(runner as never)
    const created = service.createJob(createInput(), OWNER_USER_ID)

    expect(() => service.getJobResult(created.id, OWNER_USER_ID)).toThrow(ConflictException)
  })

  it('should reject reading job for non-owner user', () => {
    const runner = {
      run: jest.fn().mockImplementation(() => new Promise(() => {})),
    }
    const service = new BacktestJobsService(runner as never)
    const created = service.createJob(createInput(), OWNER_USER_ID)

    expect(() => service.getJob(created.id, 'user-2')).toThrow('backtest.job_not_found')
    expect(() => service.getJobResult(created.id, 'user-2')).toThrow('backtest.job_not_found')
  })

  it('should keep active jobs and reject new job when queue is full', async () => {
    const maxJobsHolder = BacktestJobsService as unknown as { MAX_JOBS: number }
    const originalMaxJobs = maxJobsHolder.MAX_JOBS
    Object.defineProperty(maxJobsHolder, 'MAX_JOBS', {
      configurable: true,
      value: 2,
    })

    try {
      const runner = {
        run: jest.fn().mockImplementation(() => new Promise(() => {})),
      }
      const service = new BacktestJobsService(runner as never)
      const first = service.createJob(createInput(), OWNER_USER_ID)
      const second = service.createJob(createInput(), OWNER_USER_ID)
      await flushMicrotasks()

      expect(service.getJob(first.id, OWNER_USER_ID).status).toBe('running')
      expect(service.getJob(second.id, OWNER_USER_ID).status).toBe('running')
      expect(() => service.createJob(createInput(), OWNER_USER_ID)).toThrow(ConflictException)
      expect(service.getJob(first.id, OWNER_USER_ID).id).toBe(first.id)
      expect(service.getJob(second.id, OWNER_USER_ID).id).toBe(second.id)
    } finally {
      Object.defineProperty(maxJobsHolder, 'MAX_JOBS', {
        configurable: true,
        value: originalMaxJobs,
      })
    }
  })
})
