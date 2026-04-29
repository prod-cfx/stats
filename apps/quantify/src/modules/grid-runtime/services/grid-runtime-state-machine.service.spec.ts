import { GridRuntimeStateMachineService } from './grid-runtime-state-machine.service'

function asDependency<T>(value: Partial<T>): T {
  return value as T
}

function createRepository() {
  return {
    transitionInstanceStatusWithEvent: jest.fn().mockResolvedValue(true),
  }
}

function createService(repository: ReturnType<typeof createRepository>) {
  return new GridRuntimeStateMachineService(asDependency<ConstructorParameters<typeof GridRuntimeStateMachineService>[0]>(repository))
}

describe('GridRuntimeStateMachineService', () => {
  it('moves CREATED to INITIALIZING to RUNNING and appends runtime events', async () => {
    const repository = createRepository()
    const service = createService(repository)

    await service.initialize('grid-1')
    await service.markRunning('grid-1')

    expect(repository.transitionInstanceStatusWithEvent).toHaveBeenNthCalledWith(1, {
      id: 'grid-1',
      fromStatuses: ['CREATED'],
      toStatus: 'INITIALIZING',
      event: {
        gridRuntimeInstanceId: 'grid-1',
        eventType: 'runtime_initializing',
        severity: 'info',
        status: 'INITIALIZING',
        message: null,
        payload: undefined,
      },
    })
    expect(repository.transitionInstanceStatusWithEvent).toHaveBeenNthCalledWith(2, {
      id: 'grid-1',
      fromStatuses: ['INITIALIZING', 'RUNNING'],
      toStatus: 'RUNNING',
      event: {
        gridRuntimeInstanceId: 'grid-1',
        eventType: 'runtime_running',
        severity: 'info',
        status: 'RUNNING',
        message: null,
        payload: undefined,
      },
    })
  })

  it('records stop and reconcile reasons on transitions', async () => {
    const repository = createRepository()
    const service = createService(repository)

    await service.stop('grid-1', 'boundary_break')
    await service.markReconcileRequired('grid-1', 'exchange_mismatch')

    expect(repository.transitionInstanceStatusWithEvent).toHaveBeenNthCalledWith(1, {
      id: 'grid-1',
      fromStatuses: ['CREATED', 'INITIALIZING', 'RUNNING', 'PAUSED', 'RECONCILE_REQUIRED', 'ERROR'],
      toStatus: 'STOPPING',
      stopReason: 'boundary_break',
      event: {
        gridRuntimeInstanceId: 'grid-1',
        eventType: 'runtime_stopping',
        severity: 'warn',
        status: 'STOPPING',
        message: 'boundary_break',
        payload: undefined,
      },
    })
    expect(repository.transitionInstanceStatusWithEvent).toHaveBeenNthCalledWith(2, {
      id: 'grid-1',
      fromStatuses: ['INITIALIZING', 'RUNNING', 'PAUSED'],
      toStatus: 'RECONCILE_REQUIRED',
      stopReason: 'exchange_mismatch',
      event: {
        gridRuntimeInstanceId: 'grid-1',
        eventType: 'runtime_reconcile_required',
        severity: 'warn',
        status: 'RECONCILE_REQUIRED',
        message: 'exchange_mismatch',
        payload: undefined,
      },
    })
  })

  it('clears stop reason only for resume transition', async () => {
    const repository = createRepository()
    const service = createService(repository)

    await service.pause('grid-1')
    await service.resume('grid-1')

    expect(repository.transitionInstanceStatusWithEvent).toHaveBeenNthCalledWith(1, {
      id: 'grid-1',
      fromStatuses: ['RUNNING'],
      toStatus: 'PAUSED',
      event: {
        gridRuntimeInstanceId: 'grid-1',
        eventType: 'runtime_paused',
        severity: 'info',
        status: 'PAUSED',
        message: null,
        payload: undefined,
      },
    })
    expect(repository.transitionInstanceStatusWithEvent).toHaveBeenNthCalledWith(2, {
      id: 'grid-1',
      fromStatuses: ['PAUSED'],
      toStatus: 'RUNNING',
      stopReason: null,
      event: {
        gridRuntimeInstanceId: 'grid-1',
        eventType: 'runtime_resumed',
        severity: 'info',
        status: 'RUNNING',
        message: null,
        payload: undefined,
      },
    })
  })

  it('rejects markRunning when the current status is not INITIALIZING or RUNNING', async () => {
    const repository = createRepository()
    repository.transitionInstanceStatusWithEvent.mockResolvedValue(false)
    const service = createService(repository)

    await expect(service.markRunning('grid-1')).rejects.toThrow('grid_runtime_invalid_status_transition:runtime_running')
  })
})
