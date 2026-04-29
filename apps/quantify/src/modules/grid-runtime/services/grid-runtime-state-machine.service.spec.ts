import { GridRuntimeStateMachineService } from './grid-runtime-state-machine.service'

function createRepository() {
  return {
    updateInstanceStatus: jest.fn().mockResolvedValue({ id: 'grid-1' }),
    appendEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
  }
}

describe('GridRuntimeStateMachineService', () => {
  it('moves CREATED to INITIALIZING to RUNNING and appends runtime events', async () => {
    const repository = createRepository()
    const service = new GridRuntimeStateMachineService(repository as never)

    await service.initialize('grid-1')
    await service.markRunning('grid-1')

    expect(repository.updateInstanceStatus).toHaveBeenNthCalledWith(1, {
      id: 'grid-1',
      status: 'INITIALIZING',
      stopReason: null,
    })
    expect(repository.updateInstanceStatus).toHaveBeenNthCalledWith(2, {
      id: 'grid-1',
      status: 'RUNNING',
      stopReason: null,
    })
    expect(repository.appendEvent).toHaveBeenNthCalledWith(1, {
      gridRuntimeInstanceId: 'grid-1',
      eventType: 'runtime_initializing',
      severity: 'info',
      status: 'INITIALIZING',
      message: null,
      payload: undefined,
    })
    expect(repository.appendEvent).toHaveBeenNthCalledWith(2, {
      gridRuntimeInstanceId: 'grid-1',
      eventType: 'runtime_running',
      severity: 'info',
      status: 'RUNNING',
      message: null,
      payload: undefined,
    })
  })

  it('records stop and reconcile reasons on transitions', async () => {
    const repository = createRepository()
    const service = new GridRuntimeStateMachineService(repository as never)

    await service.stop('grid-1', 'boundary_break')
    await service.markReconcileRequired('grid-1', 'exchange_mismatch')

    expect(repository.updateInstanceStatus).toHaveBeenNthCalledWith(1, {
      id: 'grid-1',
      status: 'STOPPING',
      stopReason: 'boundary_break',
    })
    expect(repository.updateInstanceStatus).toHaveBeenNthCalledWith(2, {
      id: 'grid-1',
      status: 'RECONCILE_REQUIRED',
      stopReason: 'exchange_mismatch',
    })
  })
})
