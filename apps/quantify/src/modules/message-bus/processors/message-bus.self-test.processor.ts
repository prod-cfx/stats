import { Processor } from '@nestjs/bull'
import { Injectable } from '@nestjs/common'
import { Job } from 'bull'
import { MESSAGE_BUS_QUEUE, MessageEnvelope } from '../message-bus.types'
import { MessageHandler } from '../decorators/message-handler.decorator'

@Injectable()
@Processor(MESSAGE_BUS_QUEUE)
export class MessageBusSelfTestProcessor {
  @MessageHandler({
    topic: 'message-bus.self-test',
    handshake: true,
  })
  async handle(job: Job<MessageEnvelope<Record<string, unknown>>>) {
    return {
      ok: true,
      echo: job.data.data ?? null,
    }
  }
}
