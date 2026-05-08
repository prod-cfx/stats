import type { AiSignalPayload, SignalSourceType, SignalStatus } from '@ai/shared'
import type { TransactionHost } from '@nestjs-cls/transactional'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { EventEmitter2 } from '@nestjs/event-emitter'
import type { RuntimeCooldownScope, SignalGeneratorRepository } from '../repositories/signal-generator.repository'
import type { StrategySignalStateRepository } from '../repositories/strategy-signal-state.repository'
import type { TradingSignalRepository } from '../repositories/trading-signal.repository'
import type { StrategySignalsRuntimeConfig } from '../types/strategy-signals-config.type'
import type { IndicatorGroup } from './signal-generation-candidate.stage'
import type { SignalTelemetryService } from './signal-telemetry.service'
import type { StrategyExecutionConfig } from '@/modules/strategy-templates/types/strategy-template.types'
import type { ExchangeId, MarketType } from '@/modules/trading/core/types'
import type { PrismaClient, StrategyInstance, StrategyTemplate, Symbol, Prisma } from '@/prisma/prisma.types'
import { Logger } from '@nestjs/common'
import { reverseMapTimeframe } from '@/common/utils/prisma-enum-mappers'
import { timeframeToMinutes } from '@/modules/strategy-templates/types/strategy-template.types'
import { normalizeLedgerSymbol } from '@/modules/trading/core/symbol-normalizer'
import { StrategySignalEvents } from '../constants/strategy-signal.constants'
import { TradingSignalCreatedEvent } from '../events/strategy-signal.events'
import { PositionAdmissionService, type PortfolioAdmissionConstraints } from './position-admission.service'

type StrategyInstanceWithTemplate = StrategyInstance & { strategyTemplate?: StrategyTemplate | null }

export class SignalGenerationPersistenceStage {
  private readonly logger: Logger

  constructor(
    private readonly generatorRepository: SignalGeneratorRepository,
    private readonly tradingSignalRepository: TradingSignalRepository,
    private readonly stateRepository: StrategySignalStateRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly telemetry: SignalTelemetryService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
    logger?: Logger,
    private readonly positionAdmissionService: PositionAdmissionService = new PositionAdmissionService(),
  ) {
    this.logger = logger ?? new Logger(SignalGenerationPersistenceStage.name)
  }

  async handleStrategyFailure(
    strategyInstanceId: string,
    config: StrategySignalsRuntimeConfig,
  ) {
    const state = await this.stateRepository.findByStrategyInstanceId(strategyInstanceId)
    const nextFailures = (state?.consecutiveFailures ?? 0) + 1

    if (nextFailures >= config.ai.maxFailuresBeforeCooldown) {
      const lockedUntil = new Date(Date.now() + config.ai.failureCooldownMinutes * 60 * 1000)
      await this.stateRepository.incrementFailure(strategyInstanceId, { lockedUntil, reset: true })
      this.logger.warn(
        `Strategy instance ${strategyInstanceId} entered cooldown until ${lockedUntil.toISOString()}`,
      )
      return
    }

    await this.stateRepository.incrementFailure(strategyInstanceId)
  }

  async resetStrategyFailure(strategyInstanceId: string) {
    await this.stateRepository.reset(strategyInstanceId)
  }

  async createSignalWithCooldownAndLock(
    instance: StrategyInstanceWithTemplate,
    strategy: StrategyTemplate,
    group: IndicatorGroup,
    config: StrategySignalsRuntimeConfig,
    indicatorValues: Record<string, number>,
    latestIndicatorTime: Date | undefined,
    aiPayload: AiSignalPayload & { rawResponse: string },
    runtimeProvenance: Prisma.JsonObject,
    skipCooldown = false,
    onCreatedInTransaction?: (signalId: string) => Promise<void>,
    telemetryMeta?: {
      runtimePhase?: 'consumed'
      cooldownConsumesRuntimeState?: boolean
    },
  ): Promise<{ created: boolean; signalId: string | null }> {
    const cooldownSince = new Date(Date.now() - config.cooldownMinutes * 60 * 1000)

    const result = await this.txHost.withTransaction(async () => {
      await this.generatorRepository.lockStrategyInstance(instance.id)

      if (this.shouldApplyEntryAdmission(aiPayload)) {
        const admission = await this.evaluateEntryAdmission(instance, strategy, group.symbol, aiPayload.direction, runtimeProvenance)
        if (admission.ok === false) {
          return { created: false as const, signalId: null as string | null, reason: admission.reason }
        }
      }

      if (!skipCooldown && this.shouldApplyCooldown(aiPayload)) {
        const existingCount = await this.generatorRepository.countRecentSignals({
          strategyId: strategy.id,
          symbolId: group.symbol.id,
          since: cooldownSince,
          signalType: aiPayload.signalType,
          direction: aiPayload.direction,
          runtimeScope: this.resolveRuntimeCooldownScope(instance.id, runtimeProvenance),
        })

        if (existingCount > 0) {
          return { created: false as const, signalId: null as string | null, reason: 'COOLDOWN' }
        }
      }

      const signal = await this.tradingSignalRepository.create({
        strategy: { connect: { id: strategy.id } },
        strategyInstance: { connect: { id: instance.id } },
        symbol: { connect: { id: group.symbol.id } },
        sourceType: 'AI_GENERATED' satisfies SignalSourceType,
        signalType: aiPayload.signalType,
        direction: aiPayload.direction,
        status: 'PENDING' satisfies SignalStatus,
        confidence: aiPayload.confidence,
        entryPrice: aiPayload.entryPrice,
        stopLoss: aiPayload.stopLoss,
        takeProfit: aiPayload.takeProfit,
        positionSizeQuote: aiPayload.positionSizeQuote,
        positionSizeRatio: aiPayload.positionSizeRatio,
        aiModel: instance.llmModel ?? null,
        aiReasoning: aiPayload.reasoning,
        aiRawResponse: aiPayload.rawResponse,
        marketContext: {
          timeframe: reverseMapTimeframe(group.timeframe),
          indicatorTimestamp: latestIndicatorTime?.toISOString() ?? null,
          indicators: indicatorValues,
        } satisfies Prisma.JsonValue,
        metadata: {
          generatorVersion: 'v1',
          runtimeProvenance: {
            ...runtimeProvenance,
            timeframe: reverseMapTimeframe(group.timeframe),
          },
        },
      })

      if (onCreatedInTransaction) {
        await onCreatedInTransaction(signal.id)
      }

      return { created: true as const, signalId: signal.id }
    })

    if (!result.created || !result.signalId) {
      this.logger.debug(
        `Signal generation skipped for strategy ${strategy.id} on ${group.symbol.code}: ${result.reason ?? 'UNKNOWN'}`,
      )
      this.telemetry.recordGeneration({
        strategyId: strategy.id,
        symbolCode: group.symbol.code,
        success: telemetryMeta?.cooldownConsumesRuntimeState === true,
        reason: telemetryMeta?.cooldownConsumesRuntimeState === true
          ? 'COOLDOWN_CONSUMED'
          : (result.reason ?? 'UNKNOWN'),
        runtimePhase: telemetryMeta?.cooldownConsumesRuntimeState === true
          ? (telemetryMeta.runtimePhase ?? 'consumed')
          : undefined,
      })
      return result
    }

    this.logger.log(
      `Generated signal ${result.signalId} for strategy ${strategy.id} on ${group.symbol.code}`,
    )
    this.telemetry.recordGeneration({
      strategyId: strategy.id,
      symbolCode: group.symbol.code,
      success: true,
      runtimePhase: telemetryMeta?.runtimePhase,
    })
    this.eventEmitter.emit(
      StrategySignalEvents.CREATED,
      new TradingSignalCreatedEvent(result.signalId),
    )

    return result
  }

  async createMultiLegSignal(
    instance: StrategyInstanceWithTemplate,
    strategy: StrategyTemplate,
    primarySymbol: Symbol,
    execution: Pick<StrategyExecutionConfig, 'timeframe' | 'cooldownMinutes'>,
    indicators: Record<string, any>,
    aiPayload: AiSignalPayload & { rawResponse: string },
    config: StrategySignalsRuntimeConfig,
    runtimeProvenance: Prisma.JsonObject,
    skipCooldown = false,
  ): Promise<{ created: boolean; signalId: string | null; reason?: string }> {
    const configuredCooldown = execution.cooldownMinutes ?? config.cooldownMinutes
    const minimumCooldown = timeframeToMinutes(execution.timeframe)
    const cooldownMinutes = Math.max(configuredCooldown, minimumCooldown)
    const cooldownSince = new Date(Date.now() - cooldownMinutes * 60 * 1000)

    const result = await this.txHost.withTransaction(async () => {
      await this.generatorRepository.lockStrategyInstance(instance.id)

      if (!skipCooldown && this.shouldApplyCooldown(aiPayload)) {
        const recentSignal = await this.generatorRepository.findRecentSignalForCooldown({
          strategyId: strategy.id,
          symbolId: primarySymbol.id,
          instanceId: instance.id,
          cooldownSince,
          signalType: aiPayload.signalType,
          direction: aiPayload.direction,
        })

        if (recentSignal) {
          return { created: false as const, signalId: null, reason: 'COOLDOWN' }
        }
      }

      const newSignal = await this.tradingSignalRepository.create({
        strategy: { connect: { id: strategy.id } },
        strategyInstance: { connect: { id: instance.id } },
        symbol: { connect: { id: primarySymbol.id } },
        sourceType: 'AI_GENERATED' satisfies SignalSourceType,
        direction: aiPayload.direction,
        signalType: aiPayload.signalType,
        status: 'PENDING' satisfies SignalStatus,
        confidence: aiPayload.confidence,
        entryPrice: aiPayload.entryPrice,
        stopLoss: aiPayload.stopLoss,
        takeProfit: aiPayload.takeProfit,
        positionSizeQuote: aiPayload.positionSizeQuote,
        positionSizeRatio: aiPayload.positionSizeRatio,
        aiModel: instance.llmModel ?? null,
        aiReasoning: aiPayload.reasoning,
        aiRawResponse: aiPayload.rawResponse,
        marketContext: this.toJsonSafe({
          ...indicators,
          timeframe: execution.timeframe,
        }) satisfies Prisma.JsonValue,
        metadata: {
          generatorVersion: 'v2-multi-leg',
          runtimeProvenance: {
            ...runtimeProvenance,
            timeframe: execution.timeframe,
          },
        },
      })

      return { created: true as const, signalId: newSignal.id }
    })

    if (result.created && result.signalId) {
      this.eventEmitter.emit(
        StrategySignalEvents.CREATED,
        new TradingSignalCreatedEvent(result.signalId),
      )
    }

    return result
  }

  private shouldApplyCooldown(payload: Pick<AiSignalPayload, 'signalType'>): boolean {
    return payload.signalType !== 'EXIT'
  }

  private shouldApplyEntryAdmission(payload: Pick<AiSignalPayload, 'signalType' | 'direction'>): boolean {
    return payload.signalType === 'ENTRY' && (payload.direction === 'BUY' || payload.direction === 'SELL')
  }

  private async evaluateEntryAdmission(
    instance: StrategyInstanceWithTemplate,
    strategy: StrategyTemplate,
    symbol: Symbol,
    direction: AiSignalPayload['direction'],
    runtimeProvenance: Prisma.JsonObject,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const identity = this.resolvePositionAdmissionIdentity(symbol, runtimeProvenance)
    if (!identity) {
      return { ok: true }
    }

    const [openPositions, hasPendingReconciliation] = await Promise.all([
      this.generatorRepository.findOpenPositionsForAdmission({
        strategyId: strategy.id,
        strategyInstanceId: instance.id,
        exchangeId: identity.exchangeId,
        marketType: identity.marketType,
        symbol: identity.symbol,
      }),
      this.generatorRepository.hasPendingReconcileRequiredEntryExecution({
        strategyId: strategy.id,
        strategyInstanceId: instance.id,
      }),
    ])

    return this.positionAdmissionService.evaluateEntry({
      direction,
      constraints: this.readPortfolioAdmissionConstraints(runtimeProvenance),
      openPositions,
      hasPendingReconciliation,
    })
  }

  private resolvePositionAdmissionIdentity(
    symbol: Symbol,
    runtimeProvenance: Prisma.JsonObject,
  ): { exchangeId: ExchangeId; marketType: MarketType; symbol: string } | null {
    const exchangeId = this.normalizeExchangeId(symbol.exchange)
    const marketType = this.readRuntimeMarketType(runtimeProvenance) ?? this.normalizeMarketType(symbol.instrumentType)
    if (!exchangeId || !marketType || !symbol.code) {
      return null
    }

    return {
      exchangeId,
      marketType,
      symbol: normalizeLedgerSymbol(symbol.code),
    }
  }

  private readPortfolioAdmissionConstraints(runtimeProvenance: Prisma.JsonObject): PortfolioAdmissionConstraints | null {
    const raw = runtimeProvenance.portfolio ?? runtimeProvenance.portfolioConstraints
    if (!raw || Array.isArray(raw) || typeof raw !== 'object') {
      return null
    }

    const value = raw as Prisma.JsonObject
    return {
      positionMode: this.readPortfolioPositionMode(value.positionMode),
      maxConcurrentPositions: this.readPositiveInteger(value.maxConcurrentPositions),
      allowPyramiding: typeof value.allowPyramiding === 'boolean' ? value.allowPyramiding : null,
    }
  }

  private readPortfolioPositionMode(value: Prisma.JsonValue | undefined) {
    if (value === 'long_only' || value === 'short_only' || value === 'long_short') {
      return value
    }
    return null
  }

  private readPositiveInteger(value: Prisma.JsonValue | undefined): number | null {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      return null
    }
    return value
  }

  private readRuntimeMarketType(runtimeProvenance: Prisma.JsonObject): MarketType | null {
    const raw = runtimeProvenance.marketType
    if (raw === 'spot' || raw === 'perp') return raw
    return null
  }

  private normalizeExchangeId(exchange?: string | null): ExchangeId | null {
    if (!exchange) return null
    const normalized = exchange.trim().toLowerCase()
    if (normalized.includes('binance')) return 'binance'
    if (normalized.includes('okx')) return 'okx'
    if (normalized.includes('hyperliquid')) return 'hyperliquid'
    return null
  }

  private normalizeMarketType(instrumentType: Symbol['instrumentType']): MarketType | null {
    if (instrumentType === 'SPOT') return 'spot'
    if (instrumentType === 'PERPETUAL' || instrumentType === 'FUTURE') return 'perp'
    return null
  }

  private toJsonSafe(value: any): any {
    if (value === null || value === undefined) {
      return null
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return String(value)
      return value
    }
    if (typeof value === 'string' || typeof value === 'boolean') {
      return value
    }
    if (value instanceof Date) {
      return value.toISOString()
    }
    if (Array.isArray(value)) {
      return value.map(item => this.toJsonSafe(item))
    }
    if (typeof value === 'object') {
      const result: Record<string, any> = {}
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          result[key] = this.toJsonSafe(value[key])
        }
      }
      return result
    }
    return String(value)
  }

  private resolveRuntimeCooldownScope(
    strategyInstanceId: string,
    runtimeProvenance: Prisma.JsonObject,
  ): RuntimeCooldownScope | undefined {
    const executionContentSource = typeof runtimeProvenance.executionContentSource === 'string'
      ? runtimeProvenance.executionContentSource
      : null
    const publishedSnapshotId = typeof runtimeProvenance.publishedSnapshotId === 'string'
      ? runtimeProvenance.publishedSnapshotId.trim()
      : ''
    const executionSemanticKey = typeof runtimeProvenance.executionSemanticKey === 'string'
      ? runtimeProvenance.executionSemanticKey.trim()
      : ''

    if (executionContentSource !== 'PUBLISHED_SNAPSHOT' || !publishedSnapshotId || !executionSemanticKey) {
      return undefined
    }

    return {
      strategyInstanceId,
      publishedSnapshotId,
      executionSemanticKey,
    }
  }
}
