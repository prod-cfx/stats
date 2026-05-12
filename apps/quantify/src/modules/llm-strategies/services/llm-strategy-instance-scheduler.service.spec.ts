import { LlmStrategyInstanceSchedulerService } from './llm-strategy-instance-scheduler.service'

describe('llmStrategyInstanceSchedulerService sharding', () => {
  function createService(ownsStrategyInstance: jest.Mock) {
    const instancesRepo = {
      findByIdWithStrategy: jest.fn(),
      findRunningWithSchedule: jest.fn().mockResolvedValue([]),
    }
    const schedulerRegistry = {
      addCronJob: jest.fn(),
      deleteCronJob: jest.fn(),
      doesExist: jest.fn().mockReturnValue(false),
    }
    const engine = { runForInstance: jest.fn() }
    const service = new LlmStrategyInstanceSchedulerService(
      instancesRepo as any,
      schedulerRegistry as any,
      engine as any,
      { ownsStrategyInstance } as any,
    )

    return { service, instancesRepo, schedulerRegistry }
  }

  it('does not start a cron job for instances owned by another shard', async () => {
    const { service, schedulerRegistry } = createService(jest.fn().mockReturnValue(false))

    await service.startInstance({
      id: 'llm-instance-1',
      createdBy: 'user-1',
      scheduleCron: '*/15 * * * *',
    } as any)

    expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled()
    expect(service.isInstanceRunning('llm-instance-1')).toBe(false)
  })

  it('starts a cron job for instances owned by the current shard', async () => {
    const { service, schedulerRegistry } = createService(jest.fn().mockReturnValue(true))

    await service.startInstance({
      id: 'llm-instance-1',
      createdBy: 'user-1',
      scheduleCron: '*/15 * * * *',
    } as any)

    expect(schedulerRegistry.addCronJob).toHaveBeenCalledTimes(1)
    expect(service.isInstanceRunning('llm-instance-1')).toBe(true)

    await service.stopInstance('llm-instance-1')
  })
})
