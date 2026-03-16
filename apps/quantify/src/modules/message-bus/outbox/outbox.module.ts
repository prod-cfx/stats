import { Module } from '@nestjs/common'
import { OutboxDispatcher } from './outbox.dispatcher'
import { OutboxRepository } from './outbox.repository'
import { OutboxService } from './outbox.service'

@Module({
  providers: [OutboxRepository, OutboxService, OutboxDispatcher],
  exports: [
    OutboxService,
    OutboxDispatcher, // 导出定时任务服务，供 SchedulerAdmin 使用
  ],
})
export class OutboxModule {}
