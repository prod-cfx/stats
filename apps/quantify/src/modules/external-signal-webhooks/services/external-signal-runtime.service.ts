import { ErrorCode, parseAiSignalResponse } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires value import with emitDecoratorMetadata
import { TransactionEventsService } from '@/common/services/transaction-events.service'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { SignalExecutorService } from '@/modules/strategy-signals/services/signal-executor.service'
import { Prisma } from '@/prisma/prisma.types'
import { ExternalSignalWebhooksRepository } from '../repositories/external-signal-webhooks.repository'

export interface ExternalSignalReceivedPayload {
  eventId: string
  subscriptionId: string
  strategyInstanceId: string
  userId: string
  provider?: string | null
  signalId: string
  receivedAt: string
}

export interface ExternalSignalRuntimeResult {
  executed: boolean
  signalId?: string
  skippedReason?: string
}

@Injectable()
export class ExternalSignalRuntimeService {
  private readonly logger = new Logger(ExternalSignalRuntimeService.name)

  constructor(
    private readonly repo: ExternalSignalWebhooksRepository,
    private readonly signalExecutor: SignalExecutorService,
    private readonly txEvents: TransactionEventsService,
  ) {}

  async handleReceived(payload: ExternalSignalReceivedPayload): Promise<ExternalSignalRuntimeResult> {
    this.assertPayload(payload)

    const event = await this.repo.findAcceptedEventForRuntime(payload.eventId)
    if (!event || event.signatureStatus !== 'ACCEPTED') {
      return this.skip('EVENT_NOT_FOUND_OR_NOT_ACCEPTED', payload)
    }
    if (
      event.subscriptionId !== payload.subscriptionId
      || event.strategyInstanceId !== payload.strategyInstanceId
      || event.signalId !== payload.signalId
    ) {
      return this.skip('ENVELOPE_EVENT_MISMATCH', payload)
    }
    if (
      event.subscription.status !== 'ACTIVE'
      || event.subscription.userId !== payload.userId
      || event.subscription.strategyInstanceId !== payload.strategyInstanceId
      || event.subscription.signalId !== payload.signalId
    ) {
      return this.skip('SUBSCRIPTION_NOT_ACTIVE_OR_MISMATCHED', payload)
    }

    const strategyInstance = event.strategyInstance
    if (
      strategyInstance.status !== 'running'
      || (strategyInstance.mode !== 'LIVE' && strategyInstance.mode !== 'TESTNET')
      || strategyInstance.strategyTemplate.status !== 'live'
    ) {
      return this.skip('STRATEGY_INSTANCE_NOT_RUNTIME_READY', payload)
    }

    const normalizedSignal = this.normalizeSignalPayload(event.payload)
    if (!normalizedSignal) {
      return this.skip('PAYLOAD_NOT_EXECUTABLE_SIGNAL', payload)
    }

    const symbol = await this.repo.findSymbolByCode(normalizedSignal.symbol)
    if (!symbol) {
      return this.skip('SYMBOL_NOT_FOUND', payload)
    }

    const signalId = this.buildTradingSignalId(event.id)
    const existingSignal = await this.repo.findTradingSignalById(signalId)
    if (existingSignal) {
      return { executed: false, signalId, skippedReason: 'DUPLICATE_SIGNAL' }
    }

    try {
      await this.repo.createExternalSignalTradingSignal({
        id: signalId,
        strategy: { connect: { id: strategyInstance.strategyTemplateId } },
        strategyInstance: { connect: { id: strategyInstance.id } },
        symbol: { connect: { id: symbol.id } },
        sourceType: 'SYSTEM',
        signalType: normalizedSignal.signalType,
        direction: normalizedSignal.direction,
        confidence: normalizedSignal.confidence,
        entryPrice: normalizedSignal.entryPrice,
        stopLoss: normalizedSignal.stopLoss,
        takeProfit: normalizedSignal.takeProfit,
        positionSizeQuote: normalizedSignal.positionSizeQuote,
        positionSizeRatio: normalizedSignal.positionSizeRatio,
        aiReasoning: normalizedSignal.reasoning,
        aiRawResponse: event.payload,
        metadata: {
          source: 'external_signal_webhook',
          externalSignal: {
            eventId: event.id,
            subscriptionId: event.subscriptionId,
            provider: event.provider,
            signalId: event.signalId,
            dedupeKey: event.dedupeKey,
            receivedAt: event.receivedAt.toISOString(),
          },
        } satisfies Prisma.JsonObject,
      })
    }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { executed: false, signalId, skippedReason: 'DUPLICATE_SIGNAL' }
      }
      throw error
    }

    await this.txEvents.withAfterCommit(async () => {
      await this.signalExecutor.executeSignalForSubscribedUsers(signalId)
    })

    return { executed: true, signalId }
  }

  private assertPayload(payload: ExternalSignalReceivedPayload): void {
    if (
      !payload
      || typeof payload.eventId !== 'string'
      || typeof payload.subscriptionId !== 'string'
      || typeof payload.strategyInstanceId !== 'string'
      || typeof payload.userId !== 'string'
      || typeof payload.signalId !== 'string'
    ) {
      throw new DomainException('external_signal.invalid_runtime_payload', {
        code: ErrorCode.STRATEGY_SIGNAL_GENERATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
      })
    }
  }

  private normalizeSignalPayload(payload: Prisma.JsonValue): (NonNullable<ReturnType<typeof parseAiSignalResponse>> & { symbol: string }) | null {
    const record = this.readRecord(payload)
    if (!record) return null

    const symbol = this.readString(record.symbol ?? record.symbolCode ?? record.ticker)
    if (!symbol) return null

    const parseInput = {
      ...record,
      direction: record.direction ?? record.action ?? record.side,
      action: record.action ?? record.direction ?? record.side,
    }
    const signal = parseAiSignalResponse(JSON.stringify(parseInput), this.readNumber(record.entryPrice ?? record.price) ?? undefined)
    if (!signal) return null

    return { ...signal, symbol }
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  private readNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  }

  private buildTradingSignalId(eventId: string): string {
    return `external-webhook:${eventId}`
  }

  private skip(reason: string, payload: Pick<ExternalSignalReceivedPayload, 'eventId' | 'strategyInstanceId'>): ExternalSignalRuntimeResult {
    this.logger.warn(
      `Skipping external signal event ${payload.eventId} for strategy instance ${payload.strategyInstanceId}: ${reason}`,
    )
    return { executed: false, skippedReason: reason }
  }
}
