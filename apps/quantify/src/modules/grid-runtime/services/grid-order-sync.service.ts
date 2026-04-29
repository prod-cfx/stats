import type { ExchangeId, MarketType, UnifiedOrder } from '@/modules/trading/core/types'
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

@Injectable()
export class GridOrderSyncService {
  constructor(
    private readonly repository: GridRuntimeRepository,
    private readonly tradingService: TradingService,
    private readonly stateMachine: GridRuntimeStateMachineService,
    private readonly txEvents: TransactionEventsService,
  ) {}

  async syncInstance(instanceId: string): Promise<void> {
    const snapshot = await this.txEvents.withAfterCommit(async () => {
      const instance = await this.repository.findInstanceForSync(instanceId) as RuntimeInstance | null
      if (!instance) return null

      return {
        instance,
        config: this.parseConfig(instance.configSnapshot),
        orders: await this.repository.listOrders(instanceId) as RuntimeOrder[],
      }
    })
    if (!snapshot) return

    const { instance, config, orders } = snapshot
    if (!instance) return

    const exchangeId = instance.exchangeId as ExchangeId
    const marketType = instance.marketType as MarketType
    const [openOrders, closedOrders] = await Promise.all([
      this.tradingService.getOpenOrders(instance.userId, exchangeId, marketType, instance.symbol, instance.exchangeAccountId),
      this.tradingService.getClosedOrders(instance.userId, exchangeId, marketType, instance.symbol, instance.exchangeAccountId),
    ])

    if (await this.stopForBoundaryBreak(instance, config, orders, openOrders)) return

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

        if (exchangeOrder.status === 'closed' && exchangeOrder.filled > 0) {
          await this.recordFillAndPlanInverse(instance, config, order, exchangeOrder)
        }
      }

      await this.repository.updateInstanceLastSyncAt(instance.id)
    })
  }

  private async stopForBoundaryBreak(
    instance: RuntimeInstance,
    config: GridRuntimeConfigSnapshot,
    orders: RuntimeOrder[],
    openOrders: UnifiedOrder[],
  ): Promise<boolean> {
    const lower = this.decimal(config.lowerPrice)
    const upper = this.decimal(config.upperPrice)
    const ownOpenOrders = this.filterOwnOpenOrders(orders, openOrders)
    const outsideBoundary = ownOpenOrders.some((order) => {
      if (order.price == null) return false
      const price = this.decimal(String(order.price))
      return price.lt(lower) || price.gt(upper)
    })

    if (!outsideBoundary) return false

    await this.txEvents.withAfterCommit(async () => this.stateMachine.stop(instance.id, 'boundary_break'))

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
    return true
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

    const level = instance.levels.find(item => item.id === order.gridLevelId)
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
      quantity: this.decimalToString(order.quantity),
      rawPayload: { source: 'grid_order_sync', pairedFromOrderId: order.id },
    })
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
        .filter(order => order.status === 'OPEN' && order.exchangeOrderId)
        .map(order => order.exchangeOrderId as string),
    )
    const ownClientOrderIds = new Set(
      localOrders
        .filter(order => order.status === 'OPEN' && order.clientOrderId)
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
    const delta = this.decimal(String(left)).minus(this.decimal(this.decimalToString(right))).abs()
    return delta.lte('0.000000000001')
  }

  private toJsonValue(value: unknown): GridRuntimeJsonValue {
    return this.toJsonCompatible(value) as GridRuntimeJsonValue
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
