import type { ConfigService } from '@nestjs/config'
import type { MarketTradesRepository } from '../repositories/market-trades.repository'
import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'

/**
 * 定时清理旧交易记录
 * 默认保留最近7天的数据（可通过 TRADES_RETENTION_DAYS 环境变量配置）
 */
@Injectable()
export class CleanupOldTradesJob {
  private readonly logger = new Logger(CleanupOldTradesJob.name)

  constructor(
    private readonly marketTradesRepository: MarketTradesRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 获取保留天数配置
   * 从环境变量 TRADES_RETENTION_DAYS 读取，默认为 7 天
   */
  private getRetentionDays(): number {
    const configValue = this.configService.get<number>('TRADES_RETENTION_DAYS')
    if (typeof configValue === 'number' && configValue > 0) {
      return configValue
    }
    return 7 // 默认 7 天
  }

  @Cron('0 3 * * *') // 每天凌晨3点执行
  async handleCron() {
    const retentionDays = this.getRetentionDays()
    this.logger.log(`Starting cleanup of old trades (retention: ${retentionDays} days)...`)

    try {
      const now = Date.now()
      const retentionMs = retentionDays * 24 * 60 * 60 * 1000
      const cutoffTimestamp = BigInt(now - retentionMs)

      // 获取清理前的统计
      const totalBefore = await this.marketTradesRepository.getTradeCount()
      const oldestBefore = await this.marketTradesRepository.getOldestTradeTimestamp()

      // 执行清理
      const deletedCount = await this.marketTradesRepository.deleteOldTrades(cutoffTimestamp)

      // 获取清理后的统计
      const totalAfter = await this.marketTradesRepository.getTradeCount()
      const oldestAfter = await this.marketTradesRepository.getOldestTradeTimestamp()

      this.logger.log(
        `Cleanup completed: deleted ${deletedCount} trades older than ${retentionDays} days. ` +
        `Total: ${totalBefore} -> ${totalAfter}. ` +
        `Oldest: ${oldestBefore ? new Date(Number(oldestBefore)).toISOString() : 'N/A'} -> ${oldestAfter ? new Date(Number(oldestAfter)).toISOString() : 'N/A'}`
      )
    } catch (error) {
      this.logger.error(`Failed to cleanup old trades: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
