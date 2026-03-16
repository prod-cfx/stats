import type { OnModuleInit } from '@nestjs/common'
import type { MessageEnvelope } from '../message-bus.types'
import type { Prisma } from '@/prisma/prisma.types'
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { OutboxRepository } from './outbox.repository'

export interface OutboxRecordOptions {
  dedupeKey?: string
  correlationId?: string
  partitionKey?: string
  priority?: number
  deliverAt?: Date
}

@Injectable()
export class OutboxService implements OnModuleInit {
  private readonly logger = new Logger(OutboxService.name)
  private static _instance: OutboxService | undefined

  static getInstance(): OutboxService | undefined {
    return this._instance
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: OutboxRepository,
  ) {}

  onModuleInit() {
    OutboxService._instance = this
  }

  /**
   * 在事务中记录 Outbox 消息；若未处于事务，使用非事务客户端（保持可用性）
   */
  async record<T = unknown>(
    envelope: MessageEnvelope<T>,
    options?: OutboxRecordOptions,
    tx?: Prisma.TransactionClient,
  ) {
    const client = (tx as any) || this.prisma.getClient()

    const row = await this.repo.create(
      {
        topic: envelope.topic,
        type: envelope.type,
        payload: envelope.data as any,
        dedupeKey: options?.dedupeKey ?? undefined,
        correlationId: envelope.meta?.correlationId || options?.correlationId,
        partitionKey: options?.partitionKey ?? undefined,
        priority: options?.priority ?? undefined,
        deliverAt: options?.deliverAt ?? undefined,
      },
      client,
    )

    this.logger.debug(
      `Outbox recorded id='${row.id}' topic='${envelope.topic}' type='${envelope.type}'`,
    )
    return row
  }
}
