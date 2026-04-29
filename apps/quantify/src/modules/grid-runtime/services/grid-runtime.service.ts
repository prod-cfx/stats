import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { GridOrderSyncService } from './grid-order-sync.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { GridRuntimeStateMachineService } from './grid-runtime-state-machine.service'

@Injectable()
export class GridRuntimeService {
  constructor(
    private readonly orderSync: GridOrderSyncService,
    private readonly stateMachine: GridRuntimeStateMachineService,
  ) {}

  syncInstance(instanceId: string): Promise<void> {
    return this.orderSync.syncInstance(instanceId)
  }

  initialize(instanceId: string) {
    return this.stateMachine.initialize(instanceId)
  }

  markRunning(instanceId: string) {
    return this.stateMachine.markRunning(instanceId)
  }

  pause(instanceId: string) {
    return this.stateMachine.pause(instanceId)
  }

  resume(instanceId: string) {
    return this.stateMachine.resume(instanceId)
  }

  stop(instanceId: string, reason: string) {
    return this.stateMachine.stop(instanceId, reason)
  }
}
