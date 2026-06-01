import { ErrorCode } from '@ai/shared'
import { BacktestJobRepository } from './backtest-job.repository'

function createTxHostMock() {
  const backtestJob = {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
  }
  return {
    tx: { backtestJob },
    backtestJob,
  }
}

describe('BacktestJobRepository', () => {
  it('starts queued job with compare-and-set transition', async () => {
    const { tx, backtestJob } = createTxHostMock()
    const startedAt = new Date('2026-06-01T00:00:00.000Z')
    backtestJob.updateMany.mockResolvedValue({ count: 1 })
    backtestJob.findUnique.mockResolvedValue({ id: 'job-1', status: 'running' })
    const repo = new BacktestJobRepository({ tx } as never)

    await expect(repo.markRunning('job-1', startedAt)).resolves.toMatchObject({
      id: 'job-1',
      status: 'running',
    })

    expect(backtestJob.updateMany).toHaveBeenCalledWith({
      where: { id: 'job-1', status: 'queued' },
      data: { status: 'running', startedAt },
    })
  })

  it('returns null when queued job was already consumed', async () => {
    const { tx, backtestJob } = createTxHostMock()
    backtestJob.updateMany.mockResolvedValue({ count: 0 })
    const repo = new BacktestJobRepository({ tx } as never)

    await expect(repo.markRunning('job-1', new Date())).resolves.toBeNull()
    expect(backtestJob.findUnique).not.toHaveBeenCalled()
  })

  it('marks failed with structured error details and finishedAt', async () => {
    const { tx, backtestJob } = createTxHostMock()
    const finishedAt = new Date('2026-06-01T00:01:00.000Z')
    backtestJob.update.mockResolvedValue({ id: 'job-1', status: 'failed' })
    const repo = new BacktestJobRepository({ tx } as never)

    await repo.markFailed('job-1', {
      code: ErrorCode.BACKTEST_JOB_TIMEOUT,
      message: 'Backtest job timed out',
      finishedAt,
    })

    expect(backtestJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        status: 'failed',
        error: 'Backtest job timed out',
        result: {
          failure: {
            code: ErrorCode.BACKTEST_JOB_TIMEOUT,
            message: 'Backtest job timed out',
          },
        },
        finishedAt,
      },
    })
  })
})
