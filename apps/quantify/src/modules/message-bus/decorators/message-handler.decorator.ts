import type { Job } from 'bull'
import type { MessageEnvelope } from '../message-bus.types'
import { Process, Processor } from '@nestjs/bull'
import { MESSAGE_BUS_QUEUE } from '../message-bus.types'
import { MessageBusService } from '../message-bus.service'
import { IdempotentConsumer } from './idempotent-consumer.decorator'

export function MessageHandler<TPayload = any>(opts: {
  topic: string
  idempotent?: boolean
  handshake?: boolean
  dedupeKeyFn?: (job: Job<MessageEnvelope<TPayload>>) => string
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(job: Job<MessageEnvelope<TPayload>>) => any>,
  ) {
    // 让仅使用 @MessageHandler 的类也具备队列消费元数据，避免遗漏 @Processor(queue)
    Processor(MESSAGE_BUS_QUEUE)(target.constructor)

    // 绑定 Bull 的 topic 处理
    Process(opts.topic)(target, propertyKey, descriptor as any)

    // 包装幂等
    if (opts.idempotent) {
      const keyFn =
        opts.dedupeKeyFn || ((job: Job<MessageEnvelope<TPayload>>) => `${opts.topic}:${job.id}`)
      IdempotentConsumer<TPayload>(keyFn)(target, propertyKey, descriptor as any)
    }

    // 包装握手完成标记
    if (opts.handshake) {
      const original = descriptor.value!
      descriptor.value = async function (job: Job<MessageEnvelope<TPayload>>) {
        const result = await original.apply(this, [job])
        const cid = job.data.meta?.correlationId
        const bus = MessageBusService.getInstance()
        if (cid && bus) await bus.markDone(cid, result, 60)
        return result
      }
    }

    return descriptor
  }
}
