import type { Job } from 'bull'
import type { MessageEnvelope } from '../message-bus.types';
import { BULL_MODULE_QUEUE, BULL_MODULE_QUEUE_PROCESS } from '@nestjs/bull/dist/bull.constants'
import { MessageHandler } from '../decorators/message-handler.decorator'
import { MESSAGE_BUS_QUEUE } from '../message-bus.types'
import 'reflect-metadata'

describe('messageHandler decorator', () => {
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
