import type { Request } from 'express'
import type { WebhookSignalSubscription } from '@/prisma/prisma.types'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import { createHash, randomBytes } from 'node:crypto'
import { ErrorCode } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires value import with emitDecoratorMetadata
import { TransactionHost } from '@nestjs-cls/transactional'
import { HttpStatus, Injectable } from '@nestjs/common'
import { ConfigCryptoService } from '@/common/services/config-crypto.service'
import { DomainException } from '@/common/exceptions/domain.exception'
import { TOPIC_EXTERNAL_SIGNAL_RECEIVED } from '@/modules/message-bus/message-bus.topics'
import { Prisma, type PrismaClient } from '@/prisma/prisma.types'
import { CreateExternalSignalWebhookSubscriptionDto, ExternalSignalWebhookAcceptedResponseDto, ExternalSignalWebhookSubscriptionResponseDto, ExternalSignalWebhookSubscriptionSecretResponseDto } from '../dto/external-signal-webhook-subscription.dto'
import { ExternalSignalWebhooksRepository } from '../repositories/external-signal-webhooks.repository'
import { ExternalSignalWebhookSignatureService } from './external-signal-webhook-signature.service'

interface SecretEnvelope {
  secret: string
}

interface PublicWebhookInput {
  strategyInstanceId: string
  payload: unknown
  rawBody: Buffer
  timestamp?: string
  signature?: string
  request: Request
}

@Injectable()
export class ExternalSignalWebhooksService {
  constructor(
    private readonly repo: ExternalSignalWebhooksRepository,
    private readonly crypto: ConfigCryptoService,
    private readonly signatures: ExternalSignalWebhookSignatureService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
  ) {}

  async createSubscription(
    userId: string,
    strategyInstanceId: string,
    dto: CreateExternalSignalWebhookSubscriptionDto,
  ): Promise<ExternalSignalWebhookSubscriptionSecretResponseDto> {
    await this.assertOwner(userId, strategyInstanceId)
    const signalId = dto.signalId.trim()
    const existingSubscription = await this.repo.findActiveSubscription(strategyInstanceId, signalId)
    if (existingSubscription) {
      throw new DomainException('external_signal.subscription_conflict', {
        code: ErrorCode.EXTERNAL_SIGNAL_WEBHOOK_SUBSCRIPTION_CONFLICT,
        status: HttpStatus.CONFLICT,
        args: { strategyInstanceId, signalId },
      })
    }

    const secret = this.generateSecret()
    try {
      const record = await this.repo.createSubscription({
        userId,
        strategyInstanceId,
        provider: this.normalizeOptionalString(dto.provider),
        signalId,
        secretCiphertext: this.crypto.encryptConfig<SecretEnvelope>({ secret }),
        metadata: this.toJsonObject(dto.metadata),
      })
      return {
        ...this.toSubscriptionResponse(record),
        secret,
      }
    }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainException('external_signal.subscription_conflict', {
          code: ErrorCode.EXTERNAL_SIGNAL_WEBHOOK_SUBSCRIPTION_CONFLICT,
          status: HttpStatus.CONFLICT,
          args: { strategyInstanceId, signalId },
        })
      }
      throw error
    }
  }

  async listSubscriptions(
    userId: string,
    strategyInstanceId: string,
  ): Promise<ExternalSignalWebhookSubscriptionResponseDto[]> {
    await this.assertOwner(userId, strategyInstanceId)
    const records = await this.repo.listSubscriptions(userId, strategyInstanceId)
    return records.map(record => this.toSubscriptionResponse(record))
  }

  async rotateSubscription(
    userId: string,
    subscriptionId: string,
  ): Promise<ExternalSignalWebhookSubscriptionSecretResponseDto> {
    const subscription = await this.repo.findSubscriptionForOwner(subscriptionId, userId)
    if (!subscription) {
      throw new DomainException('external_signal.subscription_not_found', {
        code: ErrorCode.EXTERNAL_SIGNAL_WEBHOOK_SUBSCRIPTION_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { subscriptionId },
      })
    }
    await this.assertOwner(userId, subscription.strategyInstanceId)

    const secret = this.generateSecret()
    const updated = await this.repo.rotateSubscription(
      subscriptionId,
      this.crypto.encryptConfig<SecretEnvelope>({ secret }),
    )
    return {
      ...this.toSubscriptionResponse(updated),
      secret,
    }
  }

  async acceptPublicWebhook(input: PublicWebhookInput): Promise<ExternalSignalWebhookAcceptedResponseDto> {
    const receivedAt = new Date()
    const rawBodySha256 = this.sha256(input.rawBody)
    const headers = this.sanitizeHeaders(input.request.headers)
    const remoteIp = input.request.ip
    const userAgent = this.readHeader(input.request.headers['user-agent'])
    const signalId = this.readSignalId(input.payload)
    const provider = this.readOptionalPayloadString(input.payload, 'provider')

    if (!signalId) {
      await this.auditRejected({
        strategyInstanceId: input.strategyInstanceId,
        provider,
        signalId: null,
        reason: 'missing_signal_id',
        headers,
        rawBodySha256,
        remoteIp,
        userAgent,
      })
      this.throwGenericPublicRejection()
    }

    const subscription = await this.repo.findActiveSubscription(input.strategyInstanceId, signalId)
    if (!subscription) {
      await this.auditRejected({
        strategyInstanceId: input.strategyInstanceId,
        provider,
        signalId,
        reason: 'no_active_subscription',
        headers,
        rawBodySha256,
        remoteIp,
        userAgent,
      })
      this.throwGenericPublicRejection()
    }

    const secret = this.decryptSecret(subscription)
    const verified = this.signatures.verify({
      secret,
      timestamp: input.timestamp,
      signature: input.signature,
      rawBody: input.rawBody,
    })
    if (!verified.ok) {
      await this.auditRejected({
        subscriptionId: subscription.id,
        strategyInstanceId: input.strategyInstanceId,
        provider: subscription.provider ?? provider,
        signalId,
        reason: verified.reason ?? 'signature_rejected',
        headers,
        rawBodySha256,
        remoteIp,
        userAgent,
      })
      this.throwGenericPublicRejection()
    }

    const dedupeKey = this.buildDedupeKey(input.strategyInstanceId, signalId, input.timestamp, input.rawBody)
    let event: { id: string; receivedAt: Date }
    try {
      event = await this.txHost.withTransaction(async () => {
        const createdEvent = await this.repo.createEvent({
          subscriptionId: subscription.id,
          strategyInstanceId: input.strategyInstanceId,
          provider: subscription.provider ?? provider,
          signalId,
          dedupeKey,
          payload: this.toJsonObject(input.payload) ?? {},
          headers,
          rawBodySha256,
          sourceTimestamp: this.parseSourceTimestamp(input.timestamp),
        })

        await this.repo.markSubscriptionAccepted(subscription.id, receivedAt)
        await this.repo.createAudit({
          subscriptionId: subscription.id,
          eventId: createdEvent.id,
          strategyInstanceId: input.strategyInstanceId,
          provider: subscription.provider ?? provider,
          signalId,
          dedupeKey,
          signatureStatus: 'ACCEPTED',
          reason: 'accepted',
          requestHeaders: headers,
          rawBodySha256,
          remoteIp,
          userAgent,
        })
        await this.repo.createOutboxEnvelope({
          topic: TOPIC_EXTERNAL_SIGNAL_RECEIVED,
          type: TOPIC_EXTERNAL_SIGNAL_RECEIVED,
          dedupeKey,
          partitionKey: input.strategyInstanceId,
          payload: {
            eventId: createdEvent.id,
            subscriptionId: subscription.id,
            strategyInstanceId: input.strategyInstanceId,
            userId: subscription.userId,
            provider: subscription.provider ?? provider ?? null,
            signalId,
            receivedAt: createdEvent.receivedAt.toISOString(),
          },
        })

        return createdEvent
      })
    }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existingEvent = await this.repo.findEventByDedupeKey(dedupeKey)
        if (existingEvent) {
          await this.repo.createAudit({
            subscriptionId: subscription.id,
            eventId: existingEvent.id,
            strategyInstanceId: input.strategyInstanceId,
            provider: subscription.provider ?? provider,
            signalId,
            dedupeKey,
            signatureStatus: 'ACCEPTED',
            reason: 'duplicate_event',
            requestHeaders: headers,
            rawBodySha256,
            remoteIp,
            userAgent,
          })
          return { accepted: true, eventId: existingEvent.id }
        }

        await this.auditRejected({
          subscriptionId: subscription.id,
          strategyInstanceId: input.strategyInstanceId,
          provider: subscription.provider ?? provider,
          signalId,
          dedupeKey,
          reason: 'duplicate_event',
          headers,
          rawBodySha256,
          remoteIp,
          userAgent,
        })
        this.throwGenericPublicRejection()
      }
      throw error
    }

    return { accepted: true, eventId: event.id }
  }

  private async assertOwner(userId: string, strategyInstanceId: string): Promise<void> {
    const strategy = await this.repo.findStrategyOwner(strategyInstanceId)
    if (!strategy) {
      throw new DomainException('external_signal.strategy_instance_not_found', {
        code: ErrorCode.STRATEGY_INSTANCE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { strategyInstanceId },
      })
    }
    if (strategy.createdBy !== userId) {
      throw new DomainException('external_signal.owner_only', {
        code: ErrorCode.EXTERNAL_SIGNAL_WEBHOOK_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
        args: { strategyInstanceId },
      })
    }
  }

  private async auditRejected(input: {
    subscriptionId?: string | null
    strategyInstanceId?: string | null
    provider?: string | null
    signalId?: string | null
    dedupeKey?: string | null
    reason: string
    headers: Prisma.InputJsonValue
    rawBodySha256: string
    remoteIp?: string | null
    userAgent?: string | null
  }): Promise<void> {
    await this.repo.createAudit({
      subscriptionId: input.subscriptionId ?? null,
      strategyInstanceId: input.strategyInstanceId ?? null,
      provider: input.provider ?? null,
      signalId: input.signalId ?? null,
      dedupeKey: input.dedupeKey ?? null,
      signatureStatus: 'REJECTED',
      reason: input.reason,
      requestHeaders: input.headers,
      rawBodySha256: input.rawBodySha256,
      remoteIp: input.remoteIp ?? null,
      userAgent: input.userAgent ?? null,
    })
  }

  private buildDedupeKey(strategyInstanceId: string, signalId: string, timestamp: string | undefined, rawBody: Buffer): string {
    return this.sha256(Buffer.concat([
      Buffer.from(`${strategyInstanceId}.${signalId}.${timestamp ?? ''}.`, 'utf8'),
      rawBody,
    ]))
  }

  private decryptSecret(subscription: WebhookSignalSubscription): string {
    const envelope = this.crypto.decryptConfig<SecretEnvelope>(subscription.secretCiphertext)
    if (!envelope.secret) {
      throw new DomainException('external_signal.invalid_secret_envelope', {
        code: ErrorCode.CRYPTO_CONFIG_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      })
    }
    return envelope.secret
  }

  private generateSecret(): string {
    return randomBytes(32).toString('base64url')
  }

  private normalizeOptionalString(value: string | undefined): string | null {
    const normalized = value?.trim()
    return normalized ? normalized : null
  }

  private readSignalId(payload: unknown): string | null {
    return this.readOptionalPayloadString(payload, 'signalId')
  }

  private readOptionalPayloadString(payload: unknown, key: string): string | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null
    }
    const value = (payload as Record<string, unknown>)[key]
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  private toJsonObject(value: unknown): Prisma.InputJsonObject | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    return value as Prisma.InputJsonObject
  }

  private sanitizeHeaders(headers: Request['headers']): Prisma.InputJsonObject {
    const sanitized: Record<string, string> = {}
    for (const [key, rawValue] of Object.entries(headers)) {
      const value = this.readHeader(rawValue)
      if (value === null) {
        continue
      }
      const normalizedKey = key.toLowerCase()
      sanitized[normalizedKey] = this.isSensitiveHeader(normalizedKey) ? '[redacted]' : value
    }
    return sanitized
  }

  private isSensitiveHeader(key: string): boolean {
    return key.includes('signature')
      || key === 'authorization'
      || key === 'cookie'
      || key === 'set-cookie'
      || key === 'x-api-key'
      || key === 'x-auth-token'
      || key === 'x-access-token'
  }

  private readHeader(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) {
      return value.join(',')
    }
    return value?.trim() || null
  }

  private parseSourceTimestamp(timestamp: string | undefined): Date | null {
    const value = timestamp?.trim()
    if (!value) {
      return null
    }
    const parsedMs = /^\d+$/.test(value)
      ? Number(value.length <= 10 ? Number(value) * 1000 : value)
      : Date.parse(value)
    return Number.isFinite(parsedMs) ? new Date(parsedMs) : null
  }

  private sha256(value: Buffer): string {
    return createHash('sha256').update(value).digest('hex')
  }

  private toSubscriptionResponse(record: WebhookSignalSubscription): ExternalSignalWebhookSubscriptionResponseDto {
    return {
      id: record.id,
      userId: record.userId,
      strategyInstanceId: record.strategyInstanceId,
      provider: record.provider,
      signalId: record.signalId,
      secretVersion: record.secretVersion,
      status: record.status,
      lastAcceptedAt: record.lastAcceptedAt?.toISOString() ?? null,
      rotatedAt: record.rotatedAt?.toISOString() ?? null,
      metadata: this.toResponseMetadata(record.metadata),
      webhookUrl: `/api/v1/webhook/strategy/${record.strategyInstanceId}/signal`,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }
  }

  private toResponseMetadata(value: Prisma.JsonValue): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    return value as Record<string, unknown>
  }

  private throwGenericPublicRejection(): never {
    throw new DomainException('external_signal.webhook_rejected', {
      code: ErrorCode.EXTERNAL_SIGNAL_WEBHOOK_REJECTED,
      status: HttpStatus.BAD_REQUEST,
    })
  }
}
