import { Injectable } from '@nestjs/common'
import type { GridRuntimeStatus } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { GridRuntimeRepository } from '../repositories/grid-runtime.repository'
import type { GridRuntimeJsonValue } from '../types/grid-runtime.types'

interface TransitionInput {
  instanceId: string
  fromStatuses: GridRuntimeStatus[]
  status: GridRuntimeStatus
  eventType: string
  severity?: 'info' | 'warn' | 'error'
  reason?: string
  clearStopReason?: boolean
  payload?: GridRuntimeJsonValue
}

@Injectable()
export class GridRuntimeStateMachineService {
  constructor(private readonly repository: GridRuntimeRepository) {}

  initialize(instanceId: string) {
    return this.transition({
      instanceId,
      fromStatuses: ['CREATED'],
      status: 'INITIALIZING',
      eventType: 'runtime_initializing',
    })
  }

  markRunning(instanceId: string) {
    return this.transition({
      instanceId,
      fromStatuses: ['INITIALIZING', 'RUNNING'],
      status: 'RUNNING',
      eventType: 'runtime_running',
    })
  }

  pause(instanceId: string) {
    return this.transition({
      instanceId,
      fromStatuses: ['RUNNING'],
      status: 'PAUSED',
      eventType: 'runtime_paused',
    })
  }

  resume(instanceId: string) {
    return this.transition({
      instanceId,
      fromStatuses: ['PAUSED'],
      status: 'RUNNING',
      eventType: 'runtime_resumed',
      clearStopReason: true,
    })
  }

  stop(instanceId: string, reason: string) {
    return this.transition({
      instanceId,
      fromStatuses: ['CREATED', 'INITIALIZING', 'RUNNING', 'PAUSED', 'RECONCILE_REQUIRED', 'ERROR'],
      status: 'STOPPING',
      eventType: 'runtime_stopping',
      severity: 'warn',
      reason,
    })
  }

  markReconcileRequired(instanceId: string, reason: string) {
    return this.transition({
      instanceId,
      fromStatuses: ['INITIALIZING', 'RUNNING', 'PAUSED'],
      status: 'RECONCILE_REQUIRED',
      eventType: 'runtime_reconcile_required',
      severity: 'warn',
      reason,
    })
  }

  markError(instanceId: string, reason: string) {
    return this.transition({
      instanceId,
      fromStatuses: ['CREATED', 'INITIALIZING', 'RUNNING', 'PAUSED', 'RECONCILE_REQUIRED', 'STOPPING'],
      status: 'ERROR',
      eventType: 'runtime_error',
      severity: 'error',
      reason,
    })
  }

  private async transition(input: TransitionInput) {
    const transitioned = await this.repository.transitionInstanceStatus({
      id: input.instanceId,
      fromStatuses: input.fromStatuses,
      toStatus: input.status,
      ...this.stopReasonPatch(input),
    })
    if (!transitioned) {
      throw new Error(`grid_runtime_invalid_status_transition:${input.eventType}`)
    }

    return this.repository.appendEvent({
      gridRuntimeInstanceId: input.instanceId,
      eventType: input.eventType,
      severity: input.severity ?? 'info',
      status: input.status,
      message: input.reason ?? null,
      payload: input.payload,
    })
  }

  private stopReasonPatch(input: TransitionInput): { stopReason?: string | null } {
    if (input.reason !== undefined) return { stopReason: input.reason }
    if (input.clearStopReason) return { stopReason: null }
    return {}
  }
}
