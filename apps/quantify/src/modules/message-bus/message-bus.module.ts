import { Global, Module, Provider } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { MESSAGE_BUS_QUEUE } from './message-bus.types'
import { MessageBusService } from './message-bus.service'
import { OutboxModule } from './outbox/outbox.module'
import { MessageBusMetricsService } from './metrics/message-bus.metrics.service'
import { MessageBusDedupeService } from './runtime/message-bus.dedupe.service'

/**
 * MessageBusModule
 * - 注册单队列 `message-bus`
 * - 导出 MessageBusService 供各业务模块注入使用
 */
const providers: Provider[] = [MessageBusService, MessageBusMetricsService, MessageBusDedupeService]

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
