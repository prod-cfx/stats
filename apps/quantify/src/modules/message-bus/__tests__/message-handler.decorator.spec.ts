import 'reflect-metadata'
import { BULL_MODULE_QUEUE, BULL_MODULE_QUEUE_PROCESS } from '@nestjs/bull/dist/bull.constants'
import { Job } from 'bull'
import { MessageHandler } from '../decorators/message-handler.decorator'
import { MESSAGE_BUS_QUEUE, MessageEnvelope } from '../message-bus.types'

describe('MessageHandler decorator', () => {
  it('adds queue metadata to the host class and topic metadata to the handler method', () => {
    class TestConsumer {
      @MessageHandler({ topic: 'message-bus.self-test' })
      async handle(_job: Job<MessageEnvelope<unknown>>) {}
    }

    expect(Reflect.getMetadata(BULL_MODULE_QUEUE, TestConsumer)).toEqual({
      name: MESSAGE_BUS_QUEUE,
    })
    expect(
      Reflect.getMetadata(BULL_MODULE_QUEUE_PROCESS, TestConsumer.prototype.handle),
    ).toEqual({
      name: 'message-bus.self-test',
    })
  })
})
