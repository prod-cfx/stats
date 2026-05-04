import type { CreateOrderInput, ExchangeId, MarketType, UnifiedOrder } from '@/modules/trading/core/types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { TradingService } from '@/modules/trading/trading.service'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@/prisma/prisma.types'
import type { GridOrderStatus } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { TransactionEventsService } from '@/common/services/transaction-events.service'
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

type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike }

const LOCAL_STATUSES_WITH_POSSIBLE_LIVE_EXCHANGE_ORDER = new Set<string>([
  'OPEN',
  'SUBMITTING',
  'PARTIALLY_FILLED',
  'CANCELING',
])
const OKX_CLIENT_ORDER_ID_MAX_LENGTH = 32

@Injectable()
export class GridOrderSyncService {
  constructor(
    private readonly repository: GridRuntimeRepository,
    private readonly tradingService: TradingService,
    private readonly stateMachine: GridRuntimeStateMachineService,
    private readonly txEvents: TransactionEventsService,
  ) {}

  async syncInstance(instanceId: string): Promise<void> {
    const snapshot = await this.loadSyncSnapshot(instanceId)
    if (!snapshot) return

    const { instance, config, orders } = snapshot
    if (!instance) return

    const exchangeId = instance.exchangeId as ExchangeId
    const marketType = instance.marketType as MarketType
    const openOrdersBeforeSubmit = await this.tradingService.getOpenOrders(
      instance.userId,
      exchangeId,
      marketType,
      instance.symbol,
      instance.exchangeAccountId,
    )
    if (await this.stopForBoundaryBreak(instance, config, orders, openOrdersBeforeSubmit)) return

    const [openOrders, closedOrders] = await Promise.all([
      this.submitPlannedOrders(instance, orders, exchangeId, marketType).then(() =>
        this.tradingService.getOpenOrders(instance.userId, exchangeId, marketType, instance.symbol, instance.exchangeAccountId),
      ),
      this.tradingService.getClosedOrders(instance.userId, exchangeId, marketType, instance.symbol, instance.exchangeAccountId),
    ])

    await this.txEvents.withAfterCommit(async () => {
      const exchangeOrdersByClientId = this.indexExchangeOrders([...openOrders, ...closedOrders])
      for (const order of orders) {
        if (!order.clientOrderId) continue

        const exchangeOrder = exchangeOrdersByClientId.get(order.clientOrderId)
        if (!exchangeOrder) continue

        if (!this.matchesLocalOrder(order, exchangeOrder, instance)) {
          await this.stateMachine.markReconcileRequired(instance.id, 'exchange_mismatch')
          return
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
          await this.recordFillAndPlanInverse(instance, config, order, exchangeOrder)
        }
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
      for (const order of ownOpenOrders) {
        await this.tradingService.cancelOrder(
          instance.userId,
          exchangeId,
          marketType,
          order.id,
          instance.symbol,
          instance.exchangeAccountId,
        )
      }
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
    const plannedOrders = orders.filter(order => order.status === 'PLANNED')
    for (const order of plannedOrders) {
      const clientOrderId = this.buildClientOrderId(instance.id, order)
      const markedSubmitting = await this.txEvents.withAfterCommit(async () => {
        return this.repository.markOrderSubmitting({
          id: order.id,
          clientOrderId,
          rawPayload: { source: 'grid_order_sync' },
        })
      })
      if (!markedSubmitting) continue

      let exchangeOrder: UnifiedOrder
      try {
        exchangeOrder = await this.tradingService.placeOrder(
          instance.userId,
          exchangeId,
          marketType,
          this.buildCreateOrderInput(instance, marketType, order, clientOrderId),
          instance.exchangeAccountId,
        )
      } catch (error) {
        await this.txEvents.withAfterCommit(async () =>
          this.stateMachine.markReconcileRequired(instance.id, 'order_submit_failed', {
            orderId: order.id,
            clientOrderId,
            exchangeId,
            marketType,
            symbol: instance.symbol,
            price: this.decimalToString(order.price),
            quantity: this.decimalToString(order.quantity),
            error: this.serializeError(error),
          }))
        return
      }

      const markedOpen = await this.txEvents.withAfterCommit(async () => {
        return this.repository.markOrderOpen({
          id: order.id,
          exchangeOrderId: exchangeOrder.id,
          rawPayload: this.toJsonValue(exchangeOrder.raw),
        })
      })
      if (markedOpen) continue

      try {
        await this.tradingService.cancelOrder(
          instance.userId,
          exchangeId,
          marketType,
          exchangeOrder.id,
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

  private buildClientOrderId(_instanceId: string, order: RuntimeOrder): string {
    const sanitizedOrderId = order.id.replace(/[^a-z0-9]/gi, '')
    return `g${sanitizedOrderId}`.slice(0, OKX_CLIENT_ORDER_ID_MAX_LENGTH)
  }

  private buildCreateOrderInput(
    instance: RuntimeInstance,
    marketType: MarketType,
    order: RuntimeOrder,
    clientOrderId: string,
  ): CreateOrderInput {
    const input: CreateOrderInput = {
      symbol: instance.symbol,
      marketType,
      side: order.side as GridOrderSide,
      type: 'limit',
      amount: Number(this.decimalToString(order.quantity)),
      price: Number(this.decimalToString(order.price)),
      timeInForce: 'GTC',
      clientOrderId,
    }

    if (marketType === 'perp') {
      input.tdMode = 'cross'
      if (order.role === 'close_long' || order.role === 'close_short') {
        input.reduceOnly = true
      }
    }

    return input
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
      for (const order of ownOpenOrders) {
        await this.tradingService.cancelOrder(
          instance.userId,
          instance.exchangeId as ExchangeId,
          instance.marketType as MarketType,
          order.id,
          instance.symbol,
          instance.exchangeAccountId,
        )
      }
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

  private async recordFillAndPlanInverse(
    instance: RuntimeInstance,
    config: GridRuntimeConfigSnapshot,
    order: RuntimeOrder,
    exchangeOrder: UnifiedOrder,
  ): Promise<void> {
    const exchangeFillId = this.extractExchangeFillId(exchangeOrder)
    const recorded = await this.repository.recordFillOnce({
      gridRuntimeInstanceId: instance.id,
      gridOrderId: order.id,
      exchangeFillId,
      side: order.side as GridOrderSide,
      price: exchangeOrder.price == null ? this.decimalToString(order.price) : String(exchangeOrder.price),
      quantity: String(exchangeOrder.filled),
      filledAt: new Date(exchangeOrder.updatedAt ?? exchangeOrder.createdAt),
      rawPayload: this.toJsonValue(exchangeOrder.raw),
    })
    if (!recorded.newlyRecorded) return

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
      quantity: String(exchangeOrder.filled),
      rawPayload: { source: 'grid_order_sync', pairedFromOrderId: order.id },
    })
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
      && exchangeOrder.symbol === instance.symbol
      && exchangeOrder.marketType === instance.marketType
      && exchangeOrder.side === order.side
      && exchangeOrder.type === order.orderType
      && this.decimalEquals(exchangeOrder.price, order.price)
      && this.decimalEquals(exchangeOrder.amount, order.quantity)
    )
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

  private getRawString(raw: unknown, key: string): string | null {
    if (typeof raw !== 'object' || raw === null || !(key in raw)) return null
    const value = (raw as Record<string, unknown>)[key]
    return typeof value === 'string' && value.length > 0 ? value : null
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
