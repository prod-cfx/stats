import type { DataPullJob } from '../contracts/data-pull-job'
import { AdminDataPullTaskService } from './admin-data-pull-task.service'

function createJob(key: string, overrides: Partial<DataPullJob> = {}): DataPullJob {
  return {
    key,
    name: key,
    metaSchema: null,
    run: jest.fn(),
    ...overrides,
  }
}

function createTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    key: 'coinglass-aggregated-liquidation',
    name: 'task-1',
    source: 'coinglass',
    type: 'liquidation',
    cron: null,
    intervalSeconds: 60,
    enabled: true,
    cursor: null,
    meta: null,
    lastStatus: 'IDLE',
    lastRunAt: null,
    lastSuccessAt: null,
    lastError: null,
    createdAt: new Date('2026-04-14T00:00:00.000Z'),
    updatedAt: new Date('2026-04-14T00:00:00.000Z'),
    ...overrides,
  }
}

function createService() {
  const taskRepo = {
    findById: jest.fn(),
    findByKey: jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
    tryMarkRunningOnce: jest.fn(),
    markSuccess: jest.fn(),
    markFailed: jest.fn(),
    forceResetStatus: jest.fn(),
    listTasks: jest.fn(),
  }
  const execRepo = {
    createStart: jest.fn(),
    markSuccess: jest.fn(),
    markFailed: jest.fn(),
    listByTaskId: jest.fn(),
  }
  const jobs = [
    createJob('coinglass-aggregated-liquidation'),
    createJob('coinglass-heatmap'),
  ]

  const service = new AdminDataPullTaskService(taskRepo as never, jobs, execRepo as never)
  return { service, taskRepo, execRepo, jobs }
}

describe('adminDataPullTaskService', () => {
  it('rejects create when key is not registered', async () => {
    const { service } = createService()

    await expect(service.create({
      key: 'unknown-job',
      name: 'bad',
    })).rejects.toThrow('data_sync.task_key_not_registered')
  })

  it('rejects create when key already exists', async () => {
    const { service, taskRepo } = createService()
    taskRepo.findByKey.mockResolvedValue(createTask())

    await expect(service.create({
      key: 'coinglass-aggregated-liquidation',
      name: 'dup',
    })).rejects.toThrow('data_sync.task_key_duplicate')
  })

  it('rejects update enable when existing key is no longer registered', async () => {
    const { service, taskRepo } = createService()
    taskRepo.findById.mockResolvedValue(createTask({ key: 'unknown-job' }))

    await expect(service.update(1, { enabled: true })).rejects.toThrow('data_sync.task_key_not_registered')
  })

  it('runs triggerOnce and maps success execution dto', async () => {
    const { service, taskRepo, execRepo, jobs } = createService()
    const task = createTask()
    taskRepo.findById.mockResolvedValue(task)
    taskRepo.tryMarkRunningOnce.mockResolvedValue(true)
    execRepo.createStart.mockResolvedValue({ id: 9, taskId: 1, startedAt: new Date('2026-04-14T01:00:00.000Z') })
    ;(jobs[0].run as jest.Mock).mockResolvedValue({ fetchedCount: 12, newCursor: 'cursor-2', meta: { foo: 'bar' } })

    const result = await service.triggerOnce(1)

    expect(result).toEqual(expect.objectContaining({
      id: 9,
      taskId: 1,
      status: 'SUCCESS',
      fetchedCount: 12,
      errorMessage: null,
      meta: { foo: 'bar' },
    }))
    expect(taskRepo.markSuccess).toHaveBeenCalled()
    expect(execRepo.markSuccess).toHaveBeenCalled()
  })

  it('rejects interrupt when task is not running', async () => {
    const { service, taskRepo } = createService()
    taskRepo.findById.mockResolvedValue(createTask({ lastStatus: 'IDLE' }))

    await expect(service.interruptTask(1)).rejects.toThrow('data_sync.task_not_interruptible')
  })

  it('maps execution history dto list', async () => {
    const { service, taskRepo, execRepo } = createService()
    taskRepo.findById.mockResolvedValue(createTask())
    execRepo.listByTaskId.mockResolvedValue({
      total: 1,
      items: [{
        id: 11,
        taskId: 1,
        status: 'FAILED',
        fetchedCount: 0,
        startedAt: new Date('2026-04-14T01:00:00.000Z'),
        finishedAt: new Date('2026-04-14T01:01:00.000Z'),
        errorMessage: 'boom',
        meta: { reason: 'x' },
      }],
    })

    const result = await service.listExecutions(1, 1, 20)

    expect(result.items).toEqual([
      expect.objectContaining({
        id: 11,
        taskId: 1,
        status: 'FAILED',
        errorMessage: 'boom',
        meta: { reason: 'x' },
      }),
    ])
  })
})
