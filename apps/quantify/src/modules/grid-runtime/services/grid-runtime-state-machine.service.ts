import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { GridRuntimeRepository } from '../repositories/grid-runtime.repository'
import type { GridRuntimeJsonValue } from '../types/grid-runtime.types'

type GridRuntimeTransitionStatus =
  | 'INITIALIZING'
  | 'RUNNING'
  | 'PAUSED'
  | 'STOPPING'
  | 'RECONCILE_REQUIRED'
  | 'ERROR'

interface TransitionInput {
  instanceId: string
  status: GridRuntimeTransitionStatus
  eventType: string
  severity?: 'info' | 'warn' | 'error'
  reason?: string
  payload?: GridRuntimeJsonValue
}

@Injectable()
export class GridRuntimeStateMachineService {
  constructor(private readonly repository: GridRuntimeRepository) {}

  initialize(instanceId: string) {
    return this.transition({
      instanceId,
      status: 'INITIALIZING',
      eventType: 'runtime_initializing',
    })
  }

  markRunning(instanceId: string) {
    return this.transition({
      instanceId,
      status: 'RUNNING',
      eventType: 'runtime_running',
    })
  }

  pause(instanceId: string) {
    return this.transition({
      instanceId,
      status: 'PAUSED',
      eventType: 'runtime_paused',
    })
  }

  resume(instanceId: string) {
    return this.transition({
      instanceId,
      status: 'RUNNING',
      eventType: 'runtime_resumed',
    })
  }

  stop(instanceId: string, reason: string) {
    return this.transition({
      instanceId,
      status: 'STOPPING',
      eventType: 'runtime_stopping',
      severity: 'warn',
      reason,
    })
  }

  markReconcileRequired(instanceId: string, reason: string) {
    return this.transition({
      instanceId,
      status: 'RECONCILE_REQUIRED',
      eventType: 'runtime_reconcile_required',
      severity: 'warn',
      reason,
    })
  }

  markError(instanceId: string, reason: string) {
    return this.transition({
      instanceId,
      status: 'ERROR',
      eventType: 'runtime_error',
      severity: 'error',
      reason,
    })
  }

  private async transition(input: TransitionInput) {
    await this.repository.updateInstanceStatus({
      id: input.instanceId,
      status: input.status,
      stopReason: input.reason ?? null,
    })

    return this.repository.appendEvent({
      gridRuntimeInstanceId: input.instanceId,
      eventType: input.eventType,
      severity: input.severity ?? 'info',
      status: input.status,
      message: input.reason ?? null,
      payload: input.payload,
    })
  }
}
