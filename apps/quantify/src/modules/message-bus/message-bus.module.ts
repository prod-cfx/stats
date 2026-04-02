import type { Provider } from '@nestjs/common';
import { BullModule } from '@nestjs/bull'
import { Global, Module } from '@nestjs/common'
import { MessageBusService } from './message-bus.service'
import { MESSAGE_BUS_QUEUE } from './message-bus.types'
import { MessageBusMetricsService } from './metrics/message-bus-metrics.service'
import { OutboxModule } from './outbox/outbox.module'
import { MessageBusSelfTestProcessor } from './processors/message-bus.self-test.processor'
import { MessageBusDedupeService } from './runtime/message-bus-dedupe.service'

/**
 * MessageBusModule
 * - 注册单队列 `message-bus`
 * - 导出 MessageBusService 供各业务模块注入使用
 */
const providers: Provider[] = [
  MessageBusService,
  MessageBusMetricsService,
  MessageBusDedupeService,
  MessageBusSelfTestProcessor,
]

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: MESSAGE_BUS_QUEUE }), OutboxModule],
  providers,
  exports: [
    MessageBusService,
    MessageBusMetricsService,
    MessageBusDedupeService,
    OutboxModule,
  ],
})
export class MessageBusModule {}
