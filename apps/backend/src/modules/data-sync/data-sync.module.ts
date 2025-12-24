import type { DataPullJob } from './contracts/data-pull-job'
import { Module } from '@nestjs/common'
import { AuthModule } from '@/modules/auth/auth.module'
import { OrderbookConfigModule } from '@/modules/orderbook-config/orderbook-config.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { AdminDataPullTaskController } from './controllers/admin-data-pull-task.controller'
import { DataSyncCronService } from './data-sync-cron.service'
import { DataSyncOrchestrator } from './data-sync-orchestrator.service'
import { DATA_PULL_JOB_REGISTRY } from './data-sync.tokens'
import { ExampleKlineJob } from './jobs/example-kline.job'
import { ExampleNewsJob } from './jobs/example-news.job'
import { ExampleOrderbookJob } from './jobs/example-orderbook.job'
import { DataPullExecutionRepository } from './repositories/data-pull-execution.repository'
import { DataPullTaskRepository } from './repositories/data-pull-task.repository'
import { AdminDataPullTaskService } from './services/admin-data-pull-task.service'

/**
 * 统一的数据拉取调度模块：
 * - 通过 DataPullJob 接口抽象不同数据类型（K 线、深度、新闻等）
 * - 使用 Prisma 表记录任务配置与执行历史
 * - 使用 Nest Schedule 进行统一 Cron 调度
 */

@Module({
  imports: [PrismaModule, OrderbookConfigModule, AuthModule],
  controllers: [AdminDataPullTaskController],
  providers: [
    // 仓储
    DataPullTaskRepository,
    DataPullExecutionRepository,
    // Job 实现（示例）
    ExampleKlineJob,
    ExampleNewsJob,
    ExampleOrderbookJob,
    // Job registry，将多个 Job 注入为一个数组
    {
      provide: DATA_PULL_JOB_REGISTRY,
      // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
      useFactory: (
        exampleKlineJob: ExampleKlineJob,
        exampleNewsJob: ExampleNewsJob,
        exampleOrderbookJob: ExampleOrderbookJob,
      ): DataPullJob[] => [exampleKlineJob, exampleNewsJob, exampleOrderbookJob],
      inject: [ExampleKlineJob, ExampleNewsJob, ExampleOrderbookJob],
    },
    // 统一编排 & Cron
    DataSyncOrchestrator,
    DataSyncCronService,
    // 管理后台：数据拉取任务 CRUD
    AdminDataPullTaskService,
  ],
})
export class DataSyncModule {}

