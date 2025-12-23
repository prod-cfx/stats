import type { DataPullJob, JobRunResult } from '../contracts/data-pull-job'
import { Injectable, Logger } from '@nestjs/common'

/**
 * 示例：K 线数据拉取 Job
 *
 * 这里只展示结构，你可以将内部逻辑替换为真实的行情获取 / 处理 / 入库代码。
 */
@Injectable()
export class ExampleKlineJob implements DataPullJob {
  readonly key = 'example-kline-1m'
  private readonly logger = new Logger(ExampleKlineJob.name)

  async run(currentCursor: string | null): Promise<JobRunResult> {
    this.logger.log(`ExampleKlineJob.run called, cursor=${currentCursor ?? 'null'}`)

    // TODO: 在这里实现：
    // 1. 解析 cursor（例如 { symbol, from, to }）
    // 2. 调用外部行情接口拉取数据
    // 3. 清洗/映射数据
    // 4. 使用 Prisma 仓储 upsert 入库
    // 5. 计算新的游标（例如最新一根 K 线的结束时间）

    // 为了让整个管线可以先跑起来，这里先返回一个虚拟结果
    // 实际使用时请删除这段模拟逻辑
    const fetchedCount = 0
    const newCursor = currentCursor ?? null

    return {
      fetchedCount,
      newCursor,
      meta: {
        note: 'example kline job, please replace with real implementation',
      },
    }
  }
}

