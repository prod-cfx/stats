import type { Job } from 'bull'
import type { MessageEnvelope } from '@/modules/message-bus/message-bus.types'
import { Processor } from '@nestjs/bull'
import { Injectable } from '@nestjs/common'
import { MessageHandler } from '@/modules/message-bus/decorators/message-handler.decorator'
import { TOPIC_EXTERNAL_SIGNAL_RECEIVED } from '@/modules/message-bus/message-bus.topics'
import { MESSAGE_BUS_QUEUE } from '@/modules/message-bus/message-bus.types'
import { ExternalSignalReceivedPayload, ExternalSignalRuntimeService } from '../services/external-signal-runtime.service'

@Injectable()
@Processor(MESSAGE_BUS_QUEUE)
export class ExternalSignalReceivedProcessor {
  constructor(private readonly runtime: ExternalSignalRuntimeService) {}

  @MessageHandler<ExternalSignalReceivedPayload>({
    topic: TOPIC_EXTERNAL_SIGNAL_RECEIVED,
    idempotent: true,
    dedupeKeyFn: job => `${TOPIC_EXTERNAL_SIGNAL_RECEIVED}:${job.data.data.eventId}`,
  })
  async handle(job: Job<MessageEnvelope<ExternalSignalReceivedPayload>>) {
    return this.runtime.handleReceived(job.data.data)
  }
}
