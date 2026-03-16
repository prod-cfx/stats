import type { Job } from 'bull'
import type { MessageEnvelope } from '../message-bus.types';
import { Processor } from '@nestjs/bull'
import { Injectable } from '@nestjs/common'
import { MessageHandler } from '../decorators/message-handler.decorator'
import { MESSAGE_BUS_QUEUE } from '../message-bus.types'

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
