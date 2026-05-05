import type { ExchangeId, MarketType, UnifiedInstrumentConstraints, UnifiedOrder, UnifiedOrderFill } from '@/modules/trading/core/types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { TradingService } from '@/modules/trading/trading.service'
import { PositionSide, TradeSide } from '@ai/shared'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@/prisma/prisma.types'
import type { GridOrderStatus } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { TradingExecutionService } from '@/modules/trading-execution/services/trading-execution.service'
import type { OrderIntent, TradingExecutionSubmitPreparedResult } from '@/modules/trading-execution/types/trading-execution.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { TransactionEventsService } from '@/common/services/transaction-events.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { PositionsService } from '@/modules/positions/positions.service'
import { normalizeLedgerSymbol } from '@/modules/trading/core/symbol-normalizer'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { GridRuntimeRepository } from '../repositories/grid-runtime.repository'
import type { GridOrderRole, GridOrderSide, GridRuntimeConfigSnapshot, GridRuntimeJsonValue } from '../types/grid-runtime.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { GridRuntimeStateMachineService } from './grid-runtime-state-machine.service'

interface DecimalLike {
  toString: () => string
}

interface RuntimeLevel {
  id: string
  levelIndex: number
  price: DecimalLike | string
}

interface RuntimeInstance {
  id: string
  userId: string
  exchangeAccountId: string
  exchangeId: string
  marketType: string
  symbol: string
  status?: string
  configSnapshot: unknown
  levels: RuntimeLevel[]
}

interface RuntimeOrder {
  id: string
  gridRuntimeInstanceId: string
  gridLevelId: string
  clientOrderId: string | null
  exchangeOrderId: string | null
  side: string
  role: string | null
  orderType: string
  timeInForce: string
  price: DecimalLike | string
  quantity: DecimalLike | string
  status: string
}

interface RetryableRateLimitInput {
  instance: RuntimeInstance
  order?: RuntimeOrder
  clientOrderId?: string | null
  exchangeId: ExchangeId
  marketType: MarketType
  reason: string
  error: unknown
}

interface RecordedGridFill {
  id: string
  exchangeFillId: string | null
  tradeId: string | null
}

interface GridSyncMismatch {
  reason: string
  gridOrderId: string
  clientOrderId: string | null
  exchangeOrderId: string
  local: JsonLike
  exchange: JsonLike
}

type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike }

const LOCAL_STATUSES_WITH_POSSIBLE_LIVE_EXCHANGE_ORDER = new Set<string>([
  'OPEN',
  'SUBMITTING',
  'PARTIALLY_FILLED',
  'CANCELING',
])

const GRID_ORDER_SUBMISSIONS_PER_SYNC_BY_EXCHANGE: Partial<Record<ExchangeId, number>> = {
  okx: 3,
}

@Injectable()
export class GridOrderSyncService {
  constructor(
    private readonly repository: GridRuntimeRepository,
    private readonly tradingService: TradingService,
    private readonly tradingExecution: TradingExecutionService,
    private readonly stateMachine: GridRuntimeStateMachineService,
    private readonly txEvents: TransactionEventsService,
    private readonly positionsService: PositionsService,
  ) {}

  async syncInstance(instanceId: string): Promise<void> {
    const snapshot = await this.loadSyncSnapshot(instanceId)
    if (!snapshot) return

    const { instance, config, orders } = snapshot
    if (!instance) return

    const exchangeId = instance.exchangeId as ExchangeId
    const marketType = instance.marketType as MarketType
    const strategyControlsEnabled = instance.status !== 'RECONCILE_REQUIRED'
    if (strategyControlsEnabled) {
      const openOrdersBeforeSubmit = await this.tradingService.getOpenOrders(
        instance.userId,
        exchangeId,
        marketType,
        instance.symbol,
        instance.exchangeAccountId,
      )
      if (await this.stopForBoundaryBreak(instance, config, orders, openOrdersBeforeSubmit)) return
    }

    const openOrdersTask = strategyControlsEnabled
      ? this.submitPlannedOrders(instance, orders, exchangeId, marketType).then(() =>
          this.tradingService.getOpenOrders(instance.userId, exchangeId, marketType, instance.symbol, instance.exchangeAccountId),
        )
      : this.tradingService.getOpenOrders(instance.userId, exchangeId, marketType, instance.symbol, instance.exchangeAccountId)

    const [openOrders, closedOrders] = await Promise.all([
      openOrdersTask,
      this.tradingService.getClosedOrders(instance.userId, exchangeId, marketType, instance.symbol, instance.exchangeAccountId),
    ])

    await this.txEvents.withAfterCommit(async () => {
      const exchangeOrdersByClientId = this.indexExchangeOrders([...openOrders, ...closedOrders])
      const mismatches: GridSyncMismatch[] = []
      for (const order of orders) {
        if (!order.clientOrderId) continue

        const exchangeOrder = exchangeOrdersByClientId.get(order.clientOrderId)
        if (!exchangeOrder) continue

        if (!this.matchesLocalOrder(order, exchangeOrder, instance)) {
          mismatches.push(this.buildOrderMismatch(order, exchangeOrder))
          continue
        }

        await this.repository.updateOrderFromExchange({
          id: order.id,
          exchangeOrderId: exchangeOrder.id,
          status: this.toGridOrderStatus(exchangeOrder.status),
          filledQuantity: String(exchangeOrder.filled),
          avgFillPrice: exchangeOrder.price == null ? null : String(exchangeOrder.price),
          rawPayload: this.toJsonValue(exchangeOrder.raw),
        })

        if (this.shouldRecordTerminalFill(exchangeOrder)) {
          const shouldPlanInverse = this.canPlanInverseOrders(instance)
          await this.recordOrderFillsAndPlanInverse(instance, config, order, exchangeOrder, shouldPlanInverse)
        }
      }

      if (mismatches.length > 0) {
        await this.stateMachine.markReconcileRequired(instance.id, 'exchange_mismatch', this.toJsonValue({
          source: 'grid_order_sync',
          mismatches,
        }))
      }

      await this.repository.updateInstanceLastSyncAt(instance.id)
    })
  }

  async stopAndCancelInstance(instanceId: string, reason: string): Promise<void> {
    const snapshot = await this.loadSyncSnapshot(instanceId)
    if (!snapshot) return
    const { instance, orders } = snapshot
    const exchangeId = instance.exchangeId as ExchangeId
    const marketType = instance.marketType as MarketType
    const openOrders = await this.tradingService.getOpenOrders(
      instance.userId,
      exchangeId,
      marketType,
      instance.symbol,
      instance.exchangeAccountId,
    )
    const ownOpenOrders = this.filterOwnOpenOrders(orders, openOrders)
    const hasPendingLocalSubmission = this.hasPendingLocalSubmission(orders, ownOpenOrders)

    await this.txEvents.withAfterCommit(async () => this.stateMachine.stop(instance.id, reason))
    try {
      await this.cancelOwnOpenOrdersAndMarkLocalCanceled(instance, orders, ownOpenOrders, reason)
      if (hasPendingLocalSubmission) {
        await this.txEvents.withAfterCommit(async () => this.stateMachine.markReconcileRequired(instance.id, 'stop_pending_submit'))
        return
      }
      await this.txEvents.withAfterCommit(async () => this.stateMachine.markStopped(instance.id, reason))
    } catch {
      await this.txEvents.withAfterCommit(async () => this.stateMachine.markReconcileRequired(instance.id, 'stop_cancel_failed'))
    }
  }

  private async loadSyncSnapshot(instanceId: string): Promise<{
    instance: RuntimeInstance
    config: GridRuntimeConfigSnapshot
    orders: RuntimeOrder[]
  } | null> {
    return this.txEvents.withAfterCommit(async () => {
      const instance = await this.repository.findInstanceForSync(instanceId) as RuntimeInstance | null
      if (!instance) return null

      return {
        instance,
        config: this.parseConfig(instance.configSnapshot),
        orders: await this.repository.listOrders(instanceId) as RuntimeOrder[],
      }
    })
  }

  private async submitPlannedOrders(
    instance: RuntimeInstance,
    orders: RuntimeOrder[],
    exchangeId: ExchangeId,
    marketType: MarketType,
  ): Promise<void> {
    const plannedOrders = this.filterSubmittablePlannedOrders(orders)
    if (plannedOrders.length === 0) return

    const submissionLimit = this.resolveSubmissionLimit(exchangeId)
    const constraints = await this.loadSubmissionConstraints(instance, exchangeId, marketType)
    if (!constraints) return

    let submittedOrderCount = 0
    for (const order of plannedOrders) {
      if (submissionLimit != null && submittedOrderCount >= submissionLimit) break

      const intent = this.buildOrderIntent(instance, exchangeId, marketType, order)
      const prepared = await this.tradingExecution.prepareIntent(intent, { constraints })
      if (prepared.status !== 'prepared') {
        const error = 'error' in prepared ? prepared.error : null
        if (this.isRetryableRateLimitFailure(exchangeId, error, prepared.reason)) {
          await this.handleRetryableRateLimit({
            instance,
            order,
            clientOrderId: null,
            exchangeId,
            marketType,
            reason: prepared.reason,
            error,
          })
          return
        }
        await this.txEvents.withAfterCommit(async () =>
          this.stateMachine.markReconcileRequired(instance.id, 'order_submit_failed', {
            orderId: order.id,
            status: prepared.status,
            reason: prepared.reason,
            normalized: 'normalized' in prepared ? this.toJsonValue(prepared.normalized) : null,
            error: 'error' in prepared ? this.serializeError(prepared.error) : null,
          }))
        return
      }

      const clientOrderId = prepared.normalized.clientOrderId
      const markedSubmitting = await this.txEvents.withAfterCommit(async () => {
        return this.repository.markOrderSubmitting({
          id: order.id,
          clientOrderId,
          rawPayload: this.toJsonValue({
            source: 'grid_order_sync',
            execution: {
              status: 'prepared',
              clientOrderId,
              normalized: prepared.normalized,
            },
          }),
        })
      })
      if (!markedSubmitting) continue

      const submitted = await this.tradingExecution.submitPrepared(prepared)
      if (submitted.status === 'waiting_position') {
        const markedPlanned = await this.txEvents.withAfterCommit(async () =>
          this.repository.markOrderPlanned({
            id: order.id,
            rawPayload: this.executionPayload(submitted),
          }))
        if (!markedPlanned) {
          await this.txEvents.withAfterCommit(async () =>
            this.stateMachine.markReconcileRequired(instance.id, 'order_waiting_position_state_race', {
              orderId: order.id,
              clientOrderId,
              status: submitted.status,
              reason: submitted.reason,
              normalized: this.toJsonValue(submitted.normalized),
              error: 'error' in submitted ? this.serializeError(submitted.error) : null,
            }))
          return
        }
        continue
      }

      if (submitted.status !== 'submitted') {
        const error = 'error' in submitted ? submitted.error : null
        if (this.isRetryableRateLimitFailure(exchangeId, error, submitted.reason)) {
          await this.handleRetryableRateLimit({
            instance,
            order,
            clientOrderId,
            exchangeId,
            marketType,
            reason: submitted.reason,
            error,
          })
          return
        }
        await this.txEvents.withAfterCommit(async () =>
          this.stateMachine.markReconcileRequired(instance.id, 'order_submit_failed', {
            orderId: order.id,
            clientOrderId,
            exchangeId,
            marketType,
            symbol: instance.symbol,
            price: this.decimalToString(order.price),
            quantity: this.decimalToString(order.quantity),
            status: submitted.status,
            reason: submitted.reason,
            normalized: 'normalized' in submitted ? this.toJsonValue(submitted.normalized) : null,
            error: 'error' in submitted ? this.serializeError(submitted.error) : null,
          }))
        return
      }

      const markedOpen = await this.txEvents.withAfterCommit(async () => {
        return this.repository.markOrderOpen({
          id: order.id,
          exchangeOrderId: submitted.order.id,
          price: submitted.order.price == null ? submitted.normalized.normalizedPrice ?? null : String(submitted.order.price),
          quantity: Number.isFinite(submitted.order.amount) ? String(submitted.order.amount) : submitted.normalized.normalizedAmount,
          rawPayload: this.executionPayload(submitted),
        })
      })
      if (markedOpen) {
        submittedOrderCount += 1
        continue
      }

      try {
        await this.tradingService.cancelOrder(
          instance.userId,
          exchangeId,
          marketType,
          submitted.order.id,
          instance.symbol,
          instance.exchangeAccountId,
        )
      } catch {
        await this.txEvents.withAfterCommit(async () => this.stateMachine.markReconcileRequired(instance.id, 'order_submit_race_cancel_failed'))
        return
      }
      await this.txEvents.withAfterCommit(async () => this.stateMachine.markReconcileRequired(instance.id, 'order_submit_race'))
      return
    }
  }

  private filterSubmittablePlannedOrders(orders: RuntimeOrder[]): RuntimeOrder[] {
    return orders.filter(order => order.status === 'PLANNED')
  }

  private resolveSubmissionLimit(exchangeId: ExchangeId): number | null {
    return GRID_ORDER_SUBMISSIONS_PER_SYNC_BY_EXCHANGE[exchangeId] ?? null
  }

  private async loadSubmissionConstraints(
    instance: RuntimeInstance,
    exchangeId: ExchangeId,
    marketType: MarketType,
  ): Promise<UnifiedInstrumentConstraints | null> {
    try {
      return await this.tradingService.getInstrumentConstraints(
        instance.userId,
        exchangeId,
        marketType,
        instance.symbol,
        instance.exchangeAccountId,
      )
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      if (this.isRetryableRateLimitFailure(exchangeId, error, reason)) {
        await this.handleRetryableRateLimit({
          instance,
          exchangeId,
          marketType,
          reason,
          error,
        })
        return null
      }
      await this.txEvents.withAfterCommit(async () =>
        this.stateMachine.markReconcileRequired(instance.id, 'order_constraints_unavailable', {
          exchangeId,
          marketType,
          symbol: instance.symbol,
          error: this.serializeError(error),
        }))
      return null
    }
  }

  private isRetryableRateLimitFailure(exchangeId: ExchangeId, error: unknown, reason?: string): boolean {
    if (exchangeId !== 'okx') return false

    const candidates = [
      reason,
      error instanceof Error ? error.message : null,
      this.getErrorText(error, 'code'),
      this.getErrorText(error, 'name'),
      this.getNestedErrorText(error, ['args', 'reason']),
      this.getNestedErrorText(error, ['args', 'code']),
      this.getNestedErrorText(error, ['response', 'args', 'reason']),
      this.getNestedErrorText(error, ['response', 'args', 'code']),
      this.getHttpResponseText(error, ['args', 'reason']),
      this.getHttpResponseText(error, ['args', 'code']),
    ].filter((value): value is string => typeof value === 'string' && value.length > 0)

    return candidates.some((value) => {
      const normalized = value.toLowerCase()
      const compact = normalized.replace(/[^a-z0-9]/g, '')
      return normalized.includes('50011')
        || normalized.includes('too many requests')
        || normalized.includes('rate limit')
        || compact.includes('ratelimit')
    })
  }

  private getErrorText(error: unknown, key: string): string | null {
    if (typeof error !== 'object' || error === null || !(key in error)) return null
    const value = (error as Record<string, unknown>)[key]
    if (typeof value === 'string' || typeof value === 'number') return String(value)
    return null
  }

  private getNestedErrorText(error: unknown, path: string[]): string | null {
    const value = this.readNestedValue(error, path)
    if (typeof value === 'string' || typeof value === 'number') return String(value)
    return null
  }

  private getHttpResponseText(error: unknown, path: string[]): string | null {
    if (typeof error !== 'object' || error === null || !('getResponse' in error)) return null
    const getResponse = (error as { getResponse?: unknown }).getResponse
    if (typeof getResponse !== 'function') return null
    const value = this.readNestedValue(getResponse.call(error), path)
    if (typeof value === 'string' || typeof value === 'number') return String(value)
    return null
  }

  private readNestedValue(source: unknown, path: string[]): unknown {
    let current = source
    for (const key of path) {
      if (typeof current !== 'object' || current === null || !(key in current)) return null
      current = (current as Record<string, unknown>)[key]
    }
    return current
  }

  private async handleRetryableRateLimit(input: RetryableRateLimitInput): Promise<boolean> {
    const serializedError = input.error == null ? null : this.serializeError(input.error)
    const payloadInput = {
      source: 'grid_order_sync',
      orderId: input.order?.id ?? null,
      clientOrderId: input.clientOrderId ?? null,
      status: 'rate_limited',
      exchangeId: input.exchangeId,
      marketType: input.marketType,
      symbol: input.instance.symbol,
      reason: input.reason,
      error: serializedError,
      execution: {
        status: 'rate_limited',
        clientOrderId: input.clientOrderId ?? null,
        reason: input.reason,
        error: serializedError,
      },
    }
    const payload = this.toJsonValue(payloadInput)

    if (input.order && input.clientOrderId) {
      const order = input.order
      const restored = await this.txEvents.withAfterCommit(async () =>
        this.repository.markOrderPlanned({
          id: order.id,
          rawPayload: payload,
        }))
      if (!restored) {
        await this.txEvents.withAfterCommit(async () =>
          this.stateMachine.markReconcileRequired(input.instance.id, 'order_rate_limit_restore_state_race', payload))
        return false
      }
    }
    await this.txEvents.withAfterCommit(async () =>
      this.repository.appendEvent({
        gridRuntimeInstanceId: input.instance.id,
        eventType: 'runtime_rate_limited',
        severity: 'warn',
        status: 'RUNNING',
        message: input.reason,
        payload,
      }))
    return true
  }

  private buildOrderIntent(
    instance: RuntimeInstance,
    exchangeId: ExchangeId,
    marketType: MarketType,
    order: RuntimeOrder,
  ): OrderIntent {
    return {
      source: 'grid',
      sourceId: order.id,
      userId: instance.userId,
      exchangeAccountId: instance.exchangeAccountId,
      exchangeId,
      symbol: instance.symbol,
      marketType,
      side: order.side as OrderIntent['side'],
      type: 'limit',
      amount: Number(this.decimalToString(order.quantity)),
      price: Number(this.decimalToString(order.price)),
      timeInForce: 'GTC',
      role: order.role as OrderIntent['role'],
      tdMode: marketType === 'perp' ? 'cross' : undefined,
      metadata: {
        gridRuntimeInstanceId: instance.id,
        gridOrderId: order.id,
        gridLevelId: order.gridLevelId,
      },
    }
  }

  private async stopForBoundaryBreak(
    instance: RuntimeInstance,
    config: GridRuntimeConfigSnapshot,
    orders: RuntimeOrder[],
    openOrders: UnifiedOrder[],
  ): Promise<boolean> {
    const lower = this.decimal(config.lowerPrice)
    const upper = this.decimal(config.upperPrice)
    const ticker = await this.tradingService.getTicker(
      instance.userId,
      instance.exchangeId as ExchangeId,
      instance.marketType as MarketType,
      instance.symbol,
      instance.exchangeAccountId,
    )
    const marketPrice = this.decimal(String(ticker.last))
    if (marketPrice.gte(lower) && marketPrice.lte(upper)) return false

    const ownOpenOrders = this.filterOwnOpenOrders(orders, openOrders)
    const hasPendingLocalSubmission = this.hasPendingLocalSubmission(orders, ownOpenOrders)
    await this.txEvents.withAfterCommit(async () => this.stateMachine.stop(instance.id, 'boundary_break'))

    try {
      await this.cancelOwnOpenOrdersAndMarkLocalCanceled(instance, orders, ownOpenOrders, 'boundary_break')
    } catch {
      await this.txEvents.withAfterCommit(async () => this.stateMachine.markReconcileRequired(instance.id, 'boundary_cancel_failed'))
      return true
    }
    if (hasPendingLocalSubmission) {
      await this.txEvents.withAfterCommit(async () => this.stateMachine.markReconcileRequired(instance.id, 'boundary_pending_submit'))
      return true
    }

    await this.txEvents.withAfterCommit(async () => this.stateMachine.markStopped(instance.id, 'boundary_break'))
    return true
  }

  private async cancelOwnOpenOrdersAndMarkLocalCanceled(
    instance: RuntimeInstance,
    localOrders: RuntimeOrder[],
    openOrders: UnifiedOrder[],
    reason: string,
  ): Promise<void> {
    for (const order of openOrders) {
      await this.tradingService.cancelOrder(
        instance.userId,
        instance.exchangeId as ExchangeId,
        instance.marketType as MarketType,
        order.id,
        instance.symbol,
        instance.exchangeAccountId,
      )
    }

    const canceledLocalOrderIds = this.findLocalOrderIdsForExchangeOrders(localOrders, openOrders)
    if (canceledLocalOrderIds.length === 0) return

    await this.txEvents.withAfterCommit(async () =>
      this.repository.markOrdersCanceled({
        ids: canceledLocalOrderIds,
        rawPayload: this.toJsonValue({
          source: 'grid_order_sync',
          reason,
          exchangeOrders: openOrders.map(order => ({
            id: order.id,
            clientOrderId: order.clientOrderId,
            status: order.status,
          })),
        }),
      }))
  }

  private hasPendingLocalSubmission(orders: RuntimeOrder[], openOrders: UnifiedOrder[]): boolean {
    const openOrderIds = new Set(openOrders.map(order => order.id))
    const openClientOrderIds = new Set(openOrders.map(order => order.clientOrderId).filter(Boolean))
    return orders.some((order) => {
      if (order.status !== 'SUBMITTING') return false
      if (order.exchangeOrderId && openOrderIds.has(order.exchangeOrderId)) return false
      if (order.clientOrderId && openClientOrderIds.has(order.clientOrderId)) return false
      return true
    })
  }

  private async recordOrderFillsAndPlanInverse(
    instance: RuntimeInstance,
    config: GridRuntimeConfigSnapshot,
    order: RuntimeOrder,
    exchangeOrder: UnifiedOrder,
    shouldPlanInverse: boolean,
  ): Promise<void> {
    const fills = await this.loadExchangeFills(instance, order, exchangeOrder)
    for (const fill of fills) {
      await this.recordFillAndPlanInverse(instance, config, order, exchangeOrder, fill, shouldPlanInverse)
    }
  }

  private async recordFillAndPlanInverse(
    instance: RuntimeInstance,
    config: GridRuntimeConfigSnapshot,
    order: RuntimeOrder,
    exchangeOrder: UnifiedOrder,
    fill: UnifiedOrderFill,
    shouldPlanInverse: boolean,
  ): Promise<void> {
    const exchangeFillId = fill.id
    const recorded = await this.repository.recordFillOnce({
      gridRuntimeInstanceId: instance.id,
      gridOrderId: order.id,
      exchangeFillId,
      tradeId: fill.tradeId ?? null,
      side: order.side as GridOrderSide,
      price: String(fill.price),
      quantity: String(fill.amount),
      fee: fill.fee == null ? null : String(fill.fee),
      feeCurrency: fill.feeCurrency ?? null,
      filledAt: new Date(fill.executedAt),
      rawPayload: this.toJsonValue(fill.raw),
    })
    const mirrored = await this.mirrorFillToStrategyLedger(instance, order, exchangeOrder, fill, recorded.fill as RecordedGridFill, exchangeFillId)
    if (!mirrored) return
    if (!recorded.newlyRecorded || !shouldPlanInverse) return

    const level = this.findInverseLevel(instance, order)
    if (!level) {
      await this.stateMachine.markReconcileRequired(instance.id, 'exchange_mismatch')
      return
    }

    await this.repository.createPlannedOrder({
      gridRuntimeInstanceId: instance.id,
      gridLevelId: level.id,
      clientOrderId: null,
      side: this.inverseSide(order.side),
      role: this.inverseRole(order.role),
      orderType: config.orderType,
      timeInForce: config.timeInForce,
      price: this.decimalToString(level.price),
      quantity: String(fill.amount),
      rawPayload: { source: 'grid_order_sync', pairedFromOrderId: order.id },
    })
  }

  private async loadExchangeFills(
    instance: RuntimeInstance,
    order: RuntimeOrder,
    exchangeOrder: UnifiedOrder,
  ): Promise<UnifiedOrderFill[]> {
    const fills = await this.tradingService.getOrderFills(
      instance.userId,
      instance.exchangeId as ExchangeId,
      instance.marketType as MarketType,
      {
        symbol: instance.symbol,
        orderId: exchangeOrder.id,
        clientOrderId: order.clientOrderId ?? undefined,
      },
      instance.exchangeAccountId,
    )
    if (fills.length > 0) return fills

    const fee = this.extractOrderFee(exchangeOrder)
    const parsedFee = fee.fee == null ? undefined : Number(fee.fee)
    return [{
      id: this.extractExchangeFillId(exchangeOrder),
      tradeId: this.getRawString(exchangeOrder.raw, 'tradeId') ?? undefined,
      orderId: exchangeOrder.id,
      clientOrderId: exchangeOrder.clientOrderId,
      symbol: exchangeOrder.symbol,
      marketType: exchangeOrder.marketType,
      side: exchangeOrder.side,
      price: exchangeOrder.price ?? Number(this.decimalToString(order.price)),
      amount: exchangeOrder.filled,
      fee: Number.isFinite(parsedFee) ? parsedFee : undefined,
      feeCurrency: fee.feeCurrency ?? undefined,
      executedAt: exchangeOrder.updatedAt ?? exchangeOrder.createdAt,
      raw: exchangeOrder.raw,
    }]
  }

  private async mirrorFillToStrategyLedger(
    instance: RuntimeInstance,
    order: RuntimeOrder,
    exchangeOrder: UnifiedOrder,
    exchangeFill: UnifiedOrderFill,
    fill: RecordedGridFill,
    exchangeFillId: string,
  ): Promise<boolean> {
    const account = await this.repository.findStrategyAccountForRuntime(instance.id)
    if (!account) {
      await this.stateMachine.markReconcileRequired(instance.id, 'strategy_account_missing_for_grid_fill', {
        gridFillId: fill.id,
        exchangeFillId,
      })
      return false
    }

    const externalTradeId = `grid:${fill.exchangeFillId ?? exchangeFillId}`
    const existingTrade = await this.repository.findTradeByExternalTradeId(account.id, externalTradeId)
    if (existingTrade) return true

    try {
      await this.positionsService.recordTrade({
        userStrategyAccountId: account.id,
        symbol: normalizeLedgerSymbol(instance.symbol),
        market: `${instance.exchangeId}:${instance.marketType}`,
        side: order.side === 'buy' ? TradeSide.BUY : TradeSide.SELL,
        positionSide: this.resolvePositionSide(instance, order),
        price: String(exchangeFill.price),
        quantity: String(exchangeFill.amount),
        fee: exchangeFill.fee == null ? '0' : String(exchangeFill.fee),
        feeCurrency: exchangeFill.feeCurrency ?? undefined,
        orderId: exchangeOrder.id,
        externalTradeId,
        provider: instance.exchangeId,
        executedAt: new Date(exchangeFill.executedAt).toISOString(),
        metadata: {
          source: 'grid-runtime',
          gridRuntimeInstanceId: instance.id,
          gridOrderId: order.id,
          gridFillId: fill.id,
          exchangeFillId,
          exchangeAccountId: instance.exchangeAccountId,
          clientOrderId: order.clientOrderId,
          exchangeOrderId: exchangeOrder.id,
          gridOrderRole: order.role,
        },
      })
      return true
    } catch (error) {
      await this.stateMachine.markReconcileRequired(instance.id, 'grid_fill_ledger_mirror_failed', {
        gridFillId: fill.id,
        exchangeFillId,
        externalTradeId,
        error: this.serializeError(error),
      })
      return false
    }
  }

  private resolvePositionSide(instance: RuntimeInstance, order: RuntimeOrder): PositionSide {
    if (instance.marketType === 'spot') return PositionSide.LONG
    if (order.role === 'open_short' || order.role === 'close_short') return PositionSide.SHORT
    if (order.role === 'open_long' || order.role === 'close_long') return PositionSide.LONG
    return order.side === 'sell' ? PositionSide.SHORT : PositionSide.LONG
  }

  private findInverseLevel(instance: RuntimeInstance, order: RuntimeOrder): RuntimeLevel | null {
    const currentLevel = instance.levels.find(item => item.id === order.gridLevelId)
    if (!currentLevel) return null
    const targetIndex = order.side === 'buy'
      ? currentLevel.levelIndex + 1
      : currentLevel.levelIndex - 1
    return instance.levels.find(item => item.levelIndex === targetIndex) ?? null
  }

  private shouldRecordTerminalFill(exchangeOrder: UnifiedOrder): boolean {
    return exchangeOrder.filled > 0 && (exchangeOrder.status === 'closed' || exchangeOrder.status === 'canceled')
  }

  private canPlanInverseOrders(instance: RuntimeInstance): boolean {
    return instance.status == null || instance.status === 'INITIALIZING' || instance.status === 'RUNNING'
  }

  private indexExchangeOrders(orders: UnifiedOrder[]): Map<string, UnifiedOrder> {
    const result = new Map<string, UnifiedOrder>()
    for (const order of orders) {
      if (order.clientOrderId) result.set(order.clientOrderId, order)
    }
    return result
  }

  private matchesLocalOrder(order: RuntimeOrder, exchangeOrder: UnifiedOrder, instance: RuntimeInstance): boolean {
    return (
      exchangeOrder.clientOrderId === order.clientOrderId
      && this.normalizeSymbol(exchangeOrder.symbol) === this.normalizeSymbol(instance.symbol)
      && this.normalizeMarketType(exchangeOrder.marketType) === this.normalizeMarketType(instance.marketType)
      && exchangeOrder.side === order.side
      && exchangeOrder.type === order.orderType
      && this.decimalEquals(exchangeOrder.price, order.price)
      && this.decimalEquals(exchangeOrder.amount, order.quantity)
    )
  }

  private buildOrderMismatch(order: RuntimeOrder, exchangeOrder: UnifiedOrder): GridSyncMismatch {
    return {
      reason: 'order_contract_mismatch',
      gridOrderId: order.id,
      clientOrderId: order.clientOrderId,
      exchangeOrderId: exchangeOrder.id,
      local: this.toJsonCompatible({
        side: order.side,
        type: order.orderType,
        price: this.decimalToString(order.price),
        quantity: this.decimalToString(order.quantity),
      }),
      exchange: this.toJsonCompatible({
        side: exchangeOrder.side,
        type: exchangeOrder.type,
        price: exchangeOrder.price,
        amount: exchangeOrder.amount,
        filled: exchangeOrder.filled,
        status: exchangeOrder.status,
      }),
    }
  }

  private normalizeSymbol(symbol: string): string {
    return symbol
      .trim()
      .toUpperCase()
      .replace(/:(PERP|SPOT|SWAP|FUTURES?)$/u, '')
      .replace(/-SWAP$/u, '')
      .replace(/[-_/]/g, '')
  }

  private normalizeMarketType(marketType: string): MarketType | string {
    const normalized = marketType.trim().toLowerCase()
    if (normalized === 'spot') return 'spot'
    if (normalized === 'perp' || normalized === 'swap' || normalized === 'futures' || normalized === 'future' || normalized === 'perpetual') {
      return 'perp'
    }
    return normalized
  }

  private toGridOrderStatus(status: UnifiedOrder['status']): GridOrderStatus {
    const statusMap: Record<UnifiedOrder['status'], GridOrderStatus> = {
      open: 'OPEN',
      closed: 'FILLED',
      canceled: 'CANCELED',
      rejected: 'REJECTED',
      partially_filled: 'PARTIALLY_FILLED',
    }
    return statusMap[status]
  }

  private extractExchangeFillId(order: UnifiedOrder): string {
    const rawFillId = this.getRawString(order.raw, 'fillId') ?? this.getRawString(order.raw, 'tradeId')
    return rawFillId ?? `${order.id}:${order.updatedAt ?? order.createdAt}:${order.filled}`
  }

  private extractOrderFee(order: UnifiedOrder): { fee?: string | null; feeCurrency?: string | null } {
    const rawFee = this.getRawNumber(order.raw, 'fee') ?? this.getRawString(order.raw, 'fee')
    const fee = rawFee == null ? null : String(rawFee)
    const feeCurrency =
      this.getRawString(order.raw, 'feeCurrency')
      ?? this.getRawString(order.raw, 'feeCcy')
      ?? this.getRawString(order.raw, 'commissionAsset')
    if (fee != null) return { fee, feeCurrency }

    const firstFill = this.getRawArrayItem(order.raw, 'fills', 0)
    if (!firstFill) return {}
    const fillFee = this.getRawNumber(firstFill, 'commission') ?? this.getRawString(firstFill, 'commission')
    return {
      fee: fillFee == null ? null : String(fillFee),
      feeCurrency: this.getRawString(firstFill, 'commissionAsset'),
    }
  }

  private executionPayload(result: TradingExecutionSubmitPreparedResult): GridRuntimeJsonValue {
    return this.toJsonValue({
      source: 'grid_order_sync',
      exchange: result.status === 'submitted' ? result.order.raw : null,
      execution: {
        status: result.status,
        reason: 'reason' in result ? result.reason : null,
        error: 'error' in result ? this.serializeError(result.error) : null,
        clientOrderId: 'normalized' in result ? result.normalized.clientOrderId : null,
        normalized: 'normalized' in result ? result.normalized : null,
        order: result.status === 'submitted'
          ? {
              id: result.order.id,
              clientOrderId: result.order.clientOrderId,
              status: result.order.status,
              price: result.order.price,
              amount: result.order.amount,
              filled: result.order.filled,
            }
          : null,
      },
    })
  }

  private getRawString(raw: unknown, key: string): string | null {
    if (typeof raw !== 'object' || raw === null || !(key in raw)) return null
    const value = (raw as Record<string, unknown>)[key]
    return typeof value === 'string' && value.length > 0 ? value : null
  }

  private getRawNumber(raw: unknown, key: string): number | null {
    if (typeof raw !== 'object' || raw === null || !(key in raw)) return null
    const value = (raw as Record<string, unknown>)[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private getRawArrayItem(raw: unknown, key: string, index: number): unknown | null {
    if (typeof raw !== 'object' || raw === null || !(key in raw)) return null
    const value = (raw as Record<string, unknown>)[key]
    return Array.isArray(value) ? value[index] ?? null : null
  }

  private inverseSide(side: string): GridOrderSide {
    return side === 'buy' ? 'sell' : 'buy'
  }

  private inverseRole(role: string | null): GridOrderRole | null {
    const roleMap: Record<GridOrderRole, GridOrderRole> = {
      spot_buy: 'spot_sell',
      spot_sell: 'spot_buy',
      open_long: 'close_long',
      close_long: 'open_long',
      open_short: 'close_short',
      close_short: 'open_short',
    }
    return role == null || !(role in roleMap) ? null : roleMap[role as GridOrderRole]
  }

  private filterOwnOpenOrders(localOrders: RuntimeOrder[], openOrders: UnifiedOrder[]): UnifiedOrder[] {
    const ownExchangeOrderIds = new Set(
      localOrders
        .filter(order => LOCAL_STATUSES_WITH_POSSIBLE_LIVE_EXCHANGE_ORDER.has(order.status) && order.exchangeOrderId)
        .map(order => order.exchangeOrderId as string),
    )
    const ownClientOrderIds = new Set(
      localOrders
        .filter(order => LOCAL_STATUSES_WITH_POSSIBLE_LIVE_EXCHANGE_ORDER.has(order.status) && order.clientOrderId)
        .map(order => order.clientOrderId as string),
    )

    return openOrders.filter(order => ownExchangeOrderIds.has(order.id) || (order.clientOrderId != null && ownClientOrderIds.has(order.clientOrderId)))
  }

  private findLocalOrderIdsForExchangeOrders(localOrders: RuntimeOrder[], openOrders: UnifiedOrder[]): string[] {
    const ids = new Set<string>()
    for (const exchangeOrder of openOrders) {
      for (const localOrder of localOrders) {
        if (!LOCAL_STATUSES_WITH_POSSIBLE_LIVE_EXCHANGE_ORDER.has(localOrder.status)) continue
        if (localOrder.exchangeOrderId === exchangeOrder.id) {
          ids.add(localOrder.id)
          continue
        }
        if (localOrder.clientOrderId != null && localOrder.clientOrderId === exchangeOrder.clientOrderId) {
          ids.add(localOrder.id)
        }
      }
    }
    return [...ids]
  }

  private parseConfig(value: unknown): GridRuntimeConfigSnapshot {
    const config = value as Partial<GridRuntimeConfigSnapshot>
    if (
      typeof config.lowerPrice !== 'string'
      || typeof config.upperPrice !== 'string'
      || typeof config.orderType !== 'string'
      || typeof config.timeInForce !== 'string'
    ) {
      throw new Error('grid_runtime_invalid_config_snapshot')
    }
    return config as GridRuntimeConfigSnapshot
  }

  private decimal(value: string): Prisma.Decimal {
    return new Prisma.Decimal(value)
  }

  private decimalToString(value: DecimalLike | string): string {
    return typeof value === 'string' ? value : value.toString()
  }

  private decimalEquals(left: number | undefined, right: DecimalLike | string): boolean {
    if (left == null) return false
    const actual = this.decimal(String(left))
    const expected = this.decimal(this.decimalToString(right))
    if (actual.eq(expected)) return true

    const relativeTolerance = this.decimal('0.0000000001')
    const absoluteFloor = this.decimal('0.000000000001')
    const actualTolerance = actual.abs().mul(relativeTolerance)
    const expectedTolerance = expected.abs().mul(relativeTolerance)
    let tolerance = actualTolerance.gt(expectedTolerance) ? actualTolerance : expectedTolerance
    if (absoluteFloor.gt(tolerance)) tolerance = absoluteFloor

    return actual.minus(expected).abs().lte(tolerance)
  }

  private toJsonValue(value: unknown): GridRuntimeJsonValue {
    return this.toJsonCompatible(value) as GridRuntimeJsonValue
  }

  private serializeError(error: unknown): GridRuntimeJsonValue {
    if (!(error instanceof Error)) {
      return this.toJsonValue({ message: String(error) })
    }

    const record = error as Error & { code?: unknown, args?: unknown, response?: unknown }
    return this.toJsonValue({
      name: error.name,
      message: error.message,
      code: record.code,
      args: record.args,
      response: record.response,
    })
  }

  private toJsonCompatible(value: unknown): JsonLike {
    if (value === null) return null
    if (typeof value === 'string') return value
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (Array.isArray(value)) return value.map(item => this.toJsonCompatible(item))
    if (!this.isPlainObject(value)) return null

    const result: { [key: string]: JsonLike } = {}
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) result[key] = this.toJsonCompatible(item)
    }
    return result
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  }
}
