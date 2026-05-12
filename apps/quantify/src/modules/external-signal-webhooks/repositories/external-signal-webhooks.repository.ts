import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { Prisma, PrismaClient, WebhookSignalSubscription } from '@/prisma/prisma.types'
import { OutboxStatus } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires value import with emitDecoratorMetadata
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

export interface CreateWebhookSignalEventInput {
  subscriptionId: string
  strategyInstanceId: string
  provider?: string | null
  signalId: string
  dedupeKey: string
  payload: Prisma.InputJsonValue
  headers: Prisma.InputJsonValue
  rawBodySha256: string
  sourceTimestamp?: Date | null
}

export interface CreateWebhookSignalAuditInput {
  subscriptionId?: string | null
  eventId?: string | null
  strategyInstanceId?: string | null
  provider?: string | null
  signalId?: string | null
  dedupeKey?: string | null
  signatureStatus: 'ACCEPTED' | 'REJECTED'
  reason?: string | null
  requestHeaders?: Prisma.InputJsonValue | null
  rawBodySha256?: string | null
  remoteIp?: string | null
  userAgent?: string | null
}

@Injectable()
export class ExternalSignalWebhooksRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async findStrategyOwner(strategyInstanceId: string): Promise<{ id: string; createdBy: string | null } | null> {
    return this.txHost.tx.strategyInstance.findUnique({
      where: { id: strategyInstanceId },
      select: { id: true, createdBy: true },
    })
  }

  async listSubscriptions(userId: string, strategyInstanceId: string): Promise<WebhookSignalSubscription[]> {
    return this.txHost.tx.webhookSignalSubscription.findMany({
      where: { userId, strategyInstanceId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createSubscription(data: {
    userId: string
    strategyInstanceId: string
    provider?: string | null
    signalId: string
    secretCiphertext: string
    metadata?: Prisma.InputJsonValue | null
  }): Promise<WebhookSignalSubscription> {
    return this.txHost.tx.webhookSignalSubscription.create({
      data: {
        userId: data.userId,
        strategyInstanceId: data.strategyInstanceId,
        provider: data.provider ?? null,
        signalId: data.signalId,
        secretCiphertext: data.secretCiphertext,
        metadata: data.metadata ?? undefined,
      },
    })
  }

  async findSubscriptionForOwner(subscriptionId: string, userId: string): Promise<WebhookSignalSubscription | null> {
    return this.txHost.tx.webhookSignalSubscription.findFirst({
      where: { id: subscriptionId, userId },
    })
  }

  async findActiveSubscription(strategyInstanceId: string, signalId: string): Promise<WebhookSignalSubscription | null> {
    return this.txHost.tx.webhookSignalSubscription.findFirst({
      where: { strategyInstanceId, signalId, status: 'ACTIVE' },
    })
  }

  async rotateSubscription(subscriptionId: string, secretCiphertext: string): Promise<WebhookSignalSubscription> {
    return this.txHost.tx.webhookSignalSubscription.update({
      where: { id: subscriptionId },
      data: {
        secretCiphertext,
        secretVersion: { increment: 1 },
        rotatedAt: new Date(),
      },
    })
  }

  async createEvent(data: CreateWebhookSignalEventInput) {
    return this.txHost.tx.webhookSignalEvent.create({
      data: {
        subscriptionId: data.subscriptionId,
        strategyInstanceId: data.strategyInstanceId,
        provider: data.provider ?? null,
        signalId: data.signalId,
        dedupeKey: data.dedupeKey,
        payload: data.payload,
        headers: data.headers,
        rawBodySha256: data.rawBodySha256,
        signatureStatus: 'ACCEPTED',
        sourceTimestamp: data.sourceTimestamp ?? null,
      },
    })
  }

  async findEventByDedupeKey(dedupeKey: string): Promise<{ id: string; receivedAt: Date } | null> {
    return this.txHost.tx.webhookSignalEvent.findUnique({
      where: { dedupeKey },
      select: { id: true, receivedAt: true },
    })
  }

  async markSubscriptionAccepted(subscriptionId: string, acceptedAt: Date): Promise<void> {
    await this.txHost.tx.webhookSignalSubscription.update({
      where: { id: subscriptionId },
      data: { lastAcceptedAt: acceptedAt },
    })
  }

  async createAudit(data: CreateWebhookSignalAuditInput) {
    return this.txHost.tx.webhookSignalAudit.create({
      data: {
        subscriptionId: data.subscriptionId ?? null,
        eventId: data.eventId ?? null,
        strategyInstanceId: data.strategyInstanceId ?? null,
        provider: data.provider ?? null,
        signalId: data.signalId ?? null,
        dedupeKey: data.dedupeKey ?? null,
        signatureStatus: data.signatureStatus,
        reason: data.reason ?? null,
        requestHeaders: data.requestHeaders ?? undefined,
        rawBodySha256: data.rawBodySha256 ?? null,
        remoteIp: data.remoteIp ?? null,
        userAgent: data.userAgent ?? null,
      },
    })
  }

  async createOutboxEnvelope(data: {
    topic: string
    type: string
    payload: Prisma.InputJsonValue
    dedupeKey: string
    correlationId?: string | null
    partitionKey?: string | null
  }) {
    return this.txHost.tx.outboxMessage.create({
      data: {
        topic: data.topic,
        type: data.type,
        payload: data.payload,
        status: OutboxStatus.PENDING,
        nextVisibleAt: new Date(),
        dedupeKey: data.dedupeKey,
        correlationId: data.correlationId ?? null,
        partitionKey: data.partitionKey ?? null,
      },
    })
  }
}
