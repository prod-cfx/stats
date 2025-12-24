import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
// 这里需要值导入以保证 Nest DI 能正确解析依赖，禁止改为 type import
// eslint-disable-next-line ts/consistent-type-imports
import { DataSyncOrchestrator } from './data-sync-orchestrator.service'

@Injectable()
export class DataSyncCronService {
  private readonly logger = new Logger(DataSyncCronService.name)
  private isRunning = false

  constructor(private readonly orchestrator: DataSyncOrchestrator) {}

  /**
   * 统一调度入口：
   * - 每分钟触发一次
   * - 内部根据任务配置表决定哪些任务实际执行
   *
   * 如需更细粒度控制（不同任务不同频率），可以：
   * - 在 DataPullTaskRepository.findDueTasks 中解析 cron 字段
   * - 或者给每个 Job 单独加 Cron（仍然通过 orchestrator 记录状态）
   */
  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'data-sync-orchestrator',
    timeZone: 'Asia/Shanghai',
  })
  async handleCron(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Previous data-sync-orchestrator tick still running, skip')
      return
    }

    this.isRunning = true
    const startedAt = Date.now()

    try {
      await this.orchestrator.runDueTasks()
    } catch (error) {
      this.logger.error(
        `data-sync-orchestrator failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    } finally {
      this.isRunning = false
      const cost = Date.now() - startedAt
      this.logger.log(`data-sync-orchestrator finished in ${cost}ms`)
    }
  }
}

