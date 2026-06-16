import type { DataPullJob } from './contracts/data-pull-job'
import type { DataPullExecutionRepository } from './repositories/data-pull-execution.repository'
import type { DataPullTask, DataPullTaskRepository } from './repositories/data-pull-task.repository'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DataSyncOrchestrator } from './data-sync-orchestrator.service'
import { DataPullTaskRunnerService } from './services/data-pull-task-runner.service'

type TxEventsMock = {
  withAfterCommit: jest.Mock<Promise<unknown>, [() => Promise<unknown>]>
}

function createTask(overrides: Partial<DataPullTask> = {}): DataPullTask {
  return {
    id: 1,
    key: 'test-job',
    name: 'test job',
    source: 'test',
    type: 'test',
    cron: null,
    intervalSeconds: 60,
    enabled: true,
    cursor: 'cursor-1',
    meta: { limit: 10 },
    lastStatus: 'RUNNING',
    lastRunAt: new Date('2026-06-15T00:00:00.000Z'),
    lastSuccessAt: null,
    lastError: null,
    createdAt: new Date('2026-06-15T00:00:00.000Z'),
    updatedAt: new Date('2026-06-15T00:00:00.000Z'),
    ...overrides,
  }
}

function createHarness(jobOverrides: Partial<DataPullJob> = {}) {
  const task = createTask()
  const job: DataPullJob = {
    key: 'test-job',
    name: 'test job',
    run: jest.fn().mockResolvedValue({
      fetchedCount: 3,
      newCursor: 'cursor-2',
      meta: { ok: true },
    }),
    ...jobOverrides,
  }
  const taskRepo = {
    claimDueTasks: jest.fn().mockResolvedValue([task]),
    markSuccess: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  }
  const execRepo = {
    createStart: jest.fn().mockResolvedValue({ id: 9, taskId: task.id }),
    markSuccess: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  }
  const txEvents: TxEventsMock = {
    withAfterCommit: jest.fn(async fn => fn()),
  }
  const OrchestratorWithTx = DataSyncOrchestrator as unknown as new (
    jobs: DataPullJob[],
    taskRepo: DataPullTaskRepository,
    runner: DataPullTaskRunnerService,
  ) => DataSyncOrchestrator
  const runner = new DataPullTaskRunnerService(
    taskRepo as unknown as DataPullTaskRepository,
    execRepo as unknown as DataPullExecutionRepository,
    txEvents as never,
  )

  const service = new OrchestratorWithTx(
    [job],
    taskRepo as unknown as DataPullTaskRepository,
    runner,
  )

  return { service, task, job, taskRepo, execRepo, txEvents }
}

describe('DataSyncOrchestrator', () => {
  it('runs due jobs through TransactionEventsService.withAfterCommit', async () => {
    const { service, task, job, execRepo, taskRepo, txEvents } = createHarness()

    await service.runDueTasks()

    expect(txEvents.withAfterCommit).toHaveBeenCalledTimes(1)
    expect(job.run).toHaveBeenCalledWith(expect.objectContaining({
      taskId: task.id,
      key: task.key,
      cursor: task.cursor,
      meta: task.meta,
    }))
    expect(execRepo.markSuccess).toHaveBeenCalledWith(
      9,
      expect.any(Date),
      { fetchedCount: 3, newCursor: 'cursor-2', meta: { ok: true } },
    )
    expect(taskRepo.markSuccess).toHaveBeenCalledWith(
      task.id,
      expect.any(Date),
      'cursor-2',
      { ok: true },
    )
  })

  it('marks execution and task failed when the wrapped job throws', async () => {
    const error = new Error('job failed')
    const { service, task, job, execRepo, taskRepo, txEvents } = createHarness({
      run: jest.fn().mockRejectedValue(error),
    })

    await service.runDueTasks()

    expect(txEvents.withAfterCommit).toHaveBeenCalledTimes(1)
    expect(job.run).toHaveBeenCalledTimes(1)
    expect(execRepo.markFailed).toHaveBeenCalledWith(9, expect.any(Date), error)
    expect(taskRepo.markFailed).toHaveBeenCalledWith(task.id, expect.any(Date), error)
  })

  it('keeps registered data-pull job files free of per-job withAfterCommit wrappers', () => {
    const jobsDir = join(__dirname, 'jobs')
    const openInterestJobsDir = join(__dirname, '..', 'open-interest', 'jobs')
    const productionJobFiles = [
      ...readdirSync(jobsDir)
        .filter(file => file.endsWith('.job.ts'))
        .map(file => join(jobsDir, file)),
      join(openInterestJobsDir, 'oi-ohlc-aggregated.job.ts'),
    ]

    const offenders = productionJobFiles.filter((file) => {
      const source = readFileSync(file, 'utf8')
      return source.includes('withAfterCommit(')
    })

    expect(offenders).toEqual([])
  })
})
