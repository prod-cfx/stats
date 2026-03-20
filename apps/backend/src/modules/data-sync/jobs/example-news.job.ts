import type { DataPullJob, DataPullJobContext, JobRunResult } from '../contracts/data-pull-job'
import { Injectable, Logger } from '@nestjs/common'

/**
 * 示例：新闻/公告数据拉取 Job
 *
 * 这里只展示结构，你可以将内部逻辑替换为真实的新闻源抓取 / 处理 / 入库代码。
 */
@Injectable()
export class ExampleNewsJob implements DataPullJob {
  readonly key = 'example-news-latest'
  private readonly logger = new Logger(ExampleNewsJob.name)

  async run(ctx: DataPullJobContext): Promise<JobRunResult> {
    this.logger.log(`ExampleNewsJob.run called, cursor=${ctx.cursor ?? 'null'}`)

    // TODO: 在这里实现：
    // 1. 解析 cursor（例如 lastPublishedAt）
    // 2. 调用新闻/公告 API 拉取从 lastPublishedAt 之后的增量数据
    // 3. 清洗/映射数据
    // 4. 使用 Prisma 仓储 upsert 入库（按唯一 key 去重）
    // 5. 计算新的游标（例如最新一条新闻的发布时间）

    const fetchedCount = 0
    const newCursor = ctx.cursor ?? null

    return {
      fetchedCount,
      newCursor,
      meta: {
        note: 'example news job, please replace with real implementation',
      },
    }
  }
}

