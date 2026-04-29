import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { GridRuntimeRepository } from '../repositories/grid-runtime.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { GridOrderSyncService } from './grid-order-sync.service'

@Injectable()
export class GridRuntimeSchedulerService {
  private readonly logger = new Logger(GridRuntimeSchedulerService.name)
  private readonly batchSize = 20

  constructor(
    private readonly repository: GridRuntimeRepository,
    private readonly orderSync: GridOrderSyncService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async syncActiveInstances(): Promise<void> {
    const instances = await this.repository.listActiveInstances(this.batchSize)
    for (const instance of instances) {
      try {
        await this.orderSync.syncInstance(instance.id)
      }
      catch (error) {
        this.logger.warn(`Grid runtime sync failed for ${instance.id}: ${(error as Error).message}`)
      }
    }
  }
}
