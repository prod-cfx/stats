import { ErrorCode } from '@ai/shared'
import { ConfigService } from '@nestjs/config'
import { DEFAULT_BACKTEST_JOB_TIMEOUT_MS, DEFAULT_BACKTEST_QUEUE_TIMEOUT_MS } from './backtest-queue.constants'
import { BacktestRecoveryService } from './backtest-recovery.service'

function createRepositoryMock() {
  return {
    findStaleRunning: jest.fn().mockResolvedValue([]),
    findQueuedBefore: jest.fn().mockResolvedValue([]),
    markFailed: jest.fn().mockResolvedValue(undefined),
  }
}

function createConfigMock(values: Record<string, unknown> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  }
}

describe('BacktestRecoveryService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-01T12:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('marks stale running jobs failed', async () => {
    const repository = createRepositoryMock()
    repository.findStaleRunning.mockResolvedValue([{ id: 'job-1' }])
    const service = new BacktestRecoveryService(repository as never, createConfigMock() as unknown as ConfigService)

    await service.recoverStaleJobs()

    expect(repository.findStaleRunning).toHaveBeenCalledWith(new Date(Date.now() - DEFAULT_BACKTEST_JOB_TIMEOUT_MS))
    expect(repository.markFailed).toHaveBeenCalledWith('job-1', expect.objectContaining({
      code: ErrorCode.BACKTEST_JOB_TIMEOUT,
      message: 'Backtest job timed out',
    }))
  })

  it('marks queued jobs failed when queue wait exceeds configured timeout', async () => {
    const repository = createRepositoryMock()
    repository.findQueuedBefore.mockResolvedValue([{ id: 'job-2' }])
    const config = createConfigMock({ BACKTEST_QUEUE_TIMEOUT_MS: '120000' })
    const service = new BacktestRecoveryService(repository as never, config as unknown as ConfigService)

    await service.recoverStaleJobs()

    expect(repository.findQueuedBefore).toHaveBeenCalledWith(new Date(Date.now() - 120_000))
    expect(repository.markFailed).toHaveBeenCalledWith('job-2', expect.objectContaining({
      code: ErrorCode.BACKTEST_QUEUE_TIMEOUT,
      message: 'Backtest queue wait timed out',
    }))
  })

  it('uses default queue timeout when config value is invalid', async () => {
    const repository = createRepositoryMock()
    const config = createConfigMock({ BACKTEST_QUEUE_TIMEOUT_MS: 'invalid' })
    const service = new BacktestRecoveryService(repository as never, config as unknown as ConfigService)

    await service.recoverStaleJobs()

    expect(repository.findQueuedBefore).toHaveBeenCalledWith(new Date(Date.now() - DEFAULT_BACKTEST_QUEUE_TIMEOUT_MS))
  })
})
