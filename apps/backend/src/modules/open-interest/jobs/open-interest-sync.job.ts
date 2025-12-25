import type {
  DataPullJob,
  JobRunResult,
} from '../../data-sync/contracts/data-pull-job'
import type { CreateOpenInterestDto } from '../dto/open-interest.dto'
import type { OpenInterestService } from '../open-interest.service'
import { Injectable, Logger } from '@nestjs/common'

/**
 * 持仓量数据同步任务
 *
 * 该任务负责从外部数据源拉取持仓量数据并存储到数据库
 */
@Injectable()
export class OpenInterestSyncJob implements DataPullJob {
  readonly key = 'open-interest-sync'
  private readonly logger = new Logger(OpenInterestSyncJob.name)

  constructor(private readonly openInterestService: OpenInterestService) {}

  /**
   * 执行数据拉取任务
   * @param currentCursor 当前保存的游标位置
   * @returns 任务执行结果
   */
  async run(currentCursor: string | null): Promise<JobRunResult> {
    this.logger.log(
      `Starting open interest data sync... (cursor: ${currentCursor})`,
    )

    try {
      // TODO: 这里应该调用实际的数据源 API
      // 例如: const data = await this.fetchFromExternalAPI(currentCursor)

      // 示例数据
      const sampleData: CreateOpenInterestDto[] = [
        {
          exchange: 'All',
          symbol: 'BTC',
          open_interest_usd: 57437891724.5572,
          open_interest_quantity: 659557.3064,
          open_interest_by_stable_coin_margin: 48920274435.15,
          open_interest_quantity_by_coin_margin: 97551.2547,
          open_interest_quantity_by_stable_coin_margin: 562006.0517,
          open_interest_change_percent_5m: 0.34,
          open_interest_change_percent_15m: 0.59,
          open_interest_change_percent_30m: 1.42,
          open_interest_change_percent_1h: 2.27,
          open_interest_change_percent_4h: 2.95,
          open_interest_change_percent_24h: 0.9,
          data_timestamp: new Date().toISOString(),
        },
      ]

      // 批量插入或更新数据
      await this.openInterestService.batchUpsert(sampleData)

      const newCursor = new Date().toISOString()

      this.logger.log(
        `Successfully synced ${sampleData.length} open interest records`,
      )

      return {
        fetchedCount: sampleData.length,
        newCursor,
        meta: {
          symbols: sampleData.map(d => d.symbol),
          timestamp: newCursor,
        },
      }
    } catch (error) {
      this.logger.error(
        `Failed to sync open interest data: ${error.message}`,
        error.stack,
      )
      throw error
    }
  }

  /**
   * 从外部 API 获取持仓量数据
   *
   * 这是一个示例方法，实际实现需要根据具体的数据源 API 进行调整
   *
   * @param _cursor 游标位置，用于增量获取数据
   * @example
   * 可能的数据源包括：
   * - CoinGlass API
   * - Binance API
   * - OKX API
   * - Bybit API
   * 等等
   */
  private async fetchFromExternalAPI(
    _cursor: string | null,
  ): Promise<CreateOpenInterestDto[]> {
    // TODO: 实现实际的 API 调用逻辑
    // 例如:
    // const response = await fetch(`https://api.example.com/open-interest?cursor=${cursor}`)
    // const data = await response.json()
    // return this.transformData(data)

    throw new Error('Not implemented: fetchFromExternalAPI')
  }

  /**
   * 将外部 API 数据转换为内部数据格式
   */
  private transformData(_externalData: any[]): CreateOpenInterestDto[] {
    // TODO: 实现数据转换逻辑
    return []
  }
}
