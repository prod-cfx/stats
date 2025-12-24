import type { DataPullJob, JobRunResult } from '../contracts/data-pull-job'
import { Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 Service，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { OrderbookPairConfigService } from '@/modules/orderbook-config/services/orderbook-pair-config.service'

/**
 * 示例：订单薄数据拉取 Job
 *
 * 该 Job 展示如何：
 * 1. 从 orderbook_pair_configs 表读取启用的交易对配置
 * 2. 根据配置拉取对应交易所的订单薄数据
 * 3. 处理并入库数据
 *
 * 使用方式：
 * - 在 data-sync.module.ts 中注册此 Job
 * - 在数据库 data_pull_tasks 表中创建对应的任务记录
 * - 系统将按照任务配置的频率自动调度执行
 */
@Injectable()
export class ExampleOrderbookJob implements DataPullJob {
  readonly key = 'orderbook-snapshot'
  private readonly logger = new Logger(ExampleOrderbookJob.name)

  constructor(
    private readonly orderbookConfigService: OrderbookPairConfigService,
  ) {}

  async run(currentCursor: string | null): Promise<JobRunResult> {
    this.logger.log(`ExampleOrderbookJob.run called, cursor=${currentCursor ?? 'null'}`)

    try {
      // 1. 获取所有启用的订单薄配置
      const configs = await this.orderbookConfigService.findEnabledConfigs()
      this.logger.log(`Found ${configs.length} enabled orderbook configs`)

      if (configs.length === 0) {
        return {
          fetchedCount: 0,
          newCursor: currentCursor,
          meta: {
            note: 'No enabled orderbook configs found',
          },
        }
      }

      // 2. 按优先级排序，优先处理高优先级的配置
      const sortedConfigs = configs.sort((a, b) => a.priority - b.priority)

      let totalFetched = 0

      // 3. 遍历每个配置，拉取订单薄数据
      for (const config of sortedConfigs) {
        try {
          // TODO: 在这里实现实际的订单薄数据拉取逻辑
          // 示例步骤：
          // a. 根据 config.venue 和 config.venueType 选择对应的交易所适配器
          // b. 调用适配器的 getOrderBook() 方法获取数据
          // c. 使用 config.depthLevels 限制返回的档位数量
          // d. 将数据标准化并入库
          // e. 考虑使用 config.metadata 中的额外参数（如特殊的 API endpoint）

          this.logger.debug(
            `Processing ${config.pairId}: venue=${config.venue}, symbol=${config.symbol}, ` +
            `depthLevels=${config.depthLevels ?? 'default'}, interval=${config.pullIntervalSeconds ?? 'default'}s`,
          )

          // 模拟数据拉取（实际使用时替换为真实逻辑）
          // const orderbook = await this.fetchOrderbookFromVenue(config)
          // await this.saveOrderbookToDatabase(orderbook)

          totalFetched++
        }
        catch (error) {
          this.logger.error(
            `Failed to fetch orderbook for ${config.pairId}: ${error instanceof Error ? error.message : String(error)}`,
          )
          // 继续处理其他配置，不因单个失败而中断整个任务
        }
      }

      // 4. 返回执行结果
      return {
        fetchedCount: totalFetched,
        newCursor: new Date().toISOString(), // 使用当前时间作为游标
        meta: {
          configsProcessed: configs.length,
          successCount: totalFetched,
          failedCount: configs.length - totalFetched,
        },
      }
    }
    catch (error) {
      this.logger.error(`Job execution failed: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  /**
   * 示例：从交易所拉取订单薄数据（需要实现）
   */
  // private async fetchOrderbookFromVenue(config: OrderbookPairConfig): Promise<any> {
  //   // TODO: 实现交易所适配器调用
  //   // 例如：
  //   // if (config.venueType === 'CEX') {
  //   //   const adapter = this.cexAdapterFactory.getAdapter(config.venue)
  //   //   return adapter.getOrderbook(config.symbol, config.depthLevels ?? 20)
  //   // }
  //   throw new Error('Not implemented')
  // }

  /**
   * 示例：将订单薄数据保存到数据库（需要实现）
   */
  // private async saveOrderbookToDatabase(orderbook: any): Promise<void> {
  //   // TODO: 实现数据库保存逻辑
  //   // 例如：
  //   // await this.prisma.orderbookSnapshot.upsert({
  //   //   where: { pairId_timestamp: { pairId: orderbook.pairId, timestamp: orderbook.timestamp } },
  //   //   update: { bids: orderbook.bids, asks: orderbook.asks },
  //   //   create: orderbook,
  //   // })
  // }
}

