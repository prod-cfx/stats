import type { Job } from 'bull'
import { BacktestWorkerProcessor } from './backtest-worker.processor'

describe('BacktestWorkerProcessor', () => {
  it('loads job input and delegates execution', async () => {
    const jobs = {
      getExecutionInput: jest.fn().mockResolvedValue({
        input: { strategy: {} },
        inputSummary: { symbols: ['BTCUSDT'] },
      }),
    }
    const executor = { execute: jest.fn().mockResolvedValue(undefined) }
    const processor = new BacktestWorkerProcessor(jobs as never, executor as never)

    await processor.handle({ data: { jobId: 'btjob-1' } } as Job<{ jobId: string }>)

    expect(jobs.getExecutionInput).toHaveBeenCalledWith('btjob-1')
    expect(executor.execute).toHaveBeenCalledWith('btjob-1', { strategy: {} }, { symbols: ['BTCUSDT'] })
  })
})
