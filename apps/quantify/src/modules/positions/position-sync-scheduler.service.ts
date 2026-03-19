import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PositionSyncService } from './position-sync.service'

/**
 * 仓位同步定时任务调度
 * 定期执行与交易所的仓位对账
 */
@Injectable()
export class PositionSyncSchedulerService {
  private readonly logger = new Logger(PositionSyncSchedulerService.name)

  constructor(private readonly positionSyncService: PositionSyncService) {}

  /**
   * 每 30 分钟执行一次批量仓位同步
   * 可根据业务需求调整频率
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handlePositionReconciliation() {
    this.logger.log('Starting scheduled position reconciliation')
    const startTime = Date.now()

    try {
      const results = await this.positionSyncService.syncAllActivePositions()

      const duration = Date.now() - startTime
      const successCount = results.filter(r => r.success).length
      const totalDifferences = results.reduce((sum, r) => sum + r.differences.length, 0)

      this.logger.log(
        `Position reconciliation completed in ${duration}ms: ` +
        `${successCount}/${results.length} accounts successful, ` +
        `${totalDifferences} total differences found`,
      )

      // 记录有问题的账户
      const failedResults = results.filter(r => !r.success)
      if (failedResults.length > 0) {
        this.logger.warn(
          `${failedResults.length} accounts failed reconciliation: ${
            failedResults.map(r => `${r.userId}(${r.errors?.join(', ')})`).join('; ')
          }`,
        )
      }

      // 记录有显著差异的账户
      const significantDiffs = results.filter(r => r.differences.length > 0)
      if (significantDiffs.length > 0) {
        this.logger.log(
          `Found ${significantDiffs.length} accounts with position differences`,
        )
        for (const result of significantDiffs) {
          this.logger.debug(
            `Account ${result.userId}: ${result.differences.map(d =>
              `${d.symbol} ${d.positionSide} ${d.action} (${d.difference})`
            ).join(', ')}`,
          )
        }
      }
    }
    catch (error) {
      this.logger.error(
        `Scheduled position reconciliation failed: ${(error as Error).message}`,
        (error as Error).stack,
      )
    }
  }

  /**
   * 每天凌晨2点执行完整的仓位审计
   * 用于生成日报和检测长期未修正的差异
   */
  @Cron('0 2 * * *')
  async handleDailyPositionAudit() {
    this.logger.log('Starting daily position audit')

    try {
      const results = await this.positionSyncService.syncAllActivePositions()

      // 可以在这里添加更详细的审计逻辑，例如：
      // - 生成审计报告
      // - 发送告警通知
      // - 记录到专门的审计日志

      const totalAccounts = results.length
      const accountsWithDiffs = results.filter(r => r.differences.length > 0).length
      const totalDiffs = results.reduce((sum, r) => sum + r.differences.length, 0)

      this.logger.log(
        `Daily audit completed: ${totalAccounts} accounts checked, ` +
        `${accountsWithDiffs} with differences, ${totalDiffs} total differences`,
      )

      // 保存审计结果到数据库（可选）
      // await this.saveAuditResults(results)
    }
    catch (error) {
      this.logger.error(
        `Daily position audit failed: ${(error as Error).message}`,
        (error as Error).stack,
      )
    }
  }
}
