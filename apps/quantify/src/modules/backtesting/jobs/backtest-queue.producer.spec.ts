import { ConfigService } from '@nestjs/config'
import { BacktestQueueProducer } from './backtest-queue.producer'
import { BACKTEST_QUEUE_JOB_RUN, DEFAULT_BACKTEST_JOB_TIMEOUT_MS } from './backtest-queue.constants'

describe('BacktestQueueProducer', () => {
  it('enqueues backtest job with stable jobId and timeout', async () => {
    const queue = { add: jest.fn().mockResolvedValue({ id: 'btjob-1' }) }
    const config = { get: jest.fn().mockReturnValue(undefined) }
    const producer = new BacktestQueueProducer(queue as never, config as unknown as ConfigService)

    await expect(producer.enqueue('btjob-1')).resolves.toBe('btjob-1')

    expect(queue.add).toHaveBeenCalledWith(
      BACKTEST_QUEUE_JOB_RUN,
      { jobId: 'btjob-1' },
      expect.objectContaining({
        jobId: 'btjob-1',
        attempts: 1,
        timeout: DEFAULT_BACKTEST_JOB_TIMEOUT_MS,
        removeOnComplete: true,
        removeOnFail: false,
      }),
    )
  })
})
