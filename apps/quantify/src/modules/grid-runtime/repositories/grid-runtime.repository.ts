import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@/prisma/prisma.types'
import type { GridRuntimeJsonValue, GridRuntimeMode, GridOrderSide } from '../types/grid-runtime.types'

export interface CreateGridRuntimeLevelInput {
  levelIndex: number
  price: string
  side: GridOrderSide | 'neutral'
  role?: string | null
  baseQuantity?: string | null
  quoteBudget?: string | null
  status: string
}

export interface CreateGridRuntimeInstanceWithLevelsInput {
  strategyInstanceId: string
  publishedSnapshotId: string
  userId: string
  exchangeAccountId: string
  exchangeId: string
  marketType: string
  symbol: string
  mode: GridRuntimeMode
  configSnapshot: GridRuntimeJsonValue
  levels: CreateGridRuntimeLevelInput[]
}

export interface FindGridRuntimeInstanceForUserInput {
  id: string
  userId: string
}

export interface CreatePlannedGridOrderInput {
  gridRuntimeInstanceId: string
  gridLevelId: string
  clientOrderId?: string | null
  side: GridOrderSide
  orderType: 'limit'
  timeInForce: 'gtc'
  price: string
  quantity: string
  rawPayload?: GridRuntimeJsonValue
}

export interface MarkGridOrderSubmittingInput {
  id: string
  clientOrderId: string
  rawPayload?: GridRuntimeJsonValue
}

export interface MarkGridOrderOpenInput {
  id: string
  exchangeOrderId: string
  rawPayload?: GridRuntimeJsonValue
}

export interface RecordGridFillOnceInput {
  gridRuntimeInstanceId: string
  gridOrderId: string
  exchangeFillId: string
  tradeId?: string | null
  side: GridOrderSide
  price: string
  quantity: string
  fee?: string | null
  feeCurrency?: string | null
  filledAt: Date
  rawPayload?: GridRuntimeJsonValue
}

export interface AppendGridRuntimeEventInput {
  gridRuntimeInstanceId: string
  eventType: string
  severity: string
  status?: string | null
  message?: string | null
  payload?: GridRuntimeJsonValue
}

@Injectable()
export class GridRuntimeRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  createInstanceWithLevels(input: CreateGridRuntimeInstanceWithLevelsInput) {
    return this.txHost.tx.gridRuntimeInstance.create({
      data: {
        strategyInstanceId: input.strategyInstanceId,
        publishedSnapshotId: input.publishedSnapshotId,
        userId: input.userId,
        exchangeAccountId: input.exchangeAccountId,
        exchangeId: input.exchangeId,
        marketType: input.marketType,
        symbol: input.symbol,
        mode: input.mode,
        configSnapshot: input.configSnapshot,
        levels: {
          create: input.levels.map(level => ({
            levelIndex: level.levelIndex,
            price: this.decimal(level.price),
            side: level.side,
            role: level.role ?? null,
            baseQuantity: level.baseQuantity == null ? null : this.decimal(level.baseQuantity),
            quoteBudget: level.quoteBudget == null ? null : this.decimal(level.quoteBudget),
            status: level.status,
          })),
        },
      },
      include: { levels: { orderBy: { levelIndex: 'asc' } } },
    })
  }

  findInstanceForUser(input: FindGridRuntimeInstanceForUserInput) {
    return this.txHost.tx.gridRuntimeInstance.findFirst({
      where: {
        id: input.id,
        userId: input.userId,
      },
      include: { levels: { orderBy: { levelIndex: 'asc' } } },
    })
  }

  listOrders(instanceId: string) {
    return this.txHost.tx.gridOrder.findMany({
      where: { gridRuntimeInstanceId: instanceId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
  }

  createPlannedOrder(input: CreatePlannedGridOrderInput) {
    return this.txHost.tx.gridOrder.create({
      data: {
        gridRuntimeInstanceId: input.gridRuntimeInstanceId,
        gridLevelId: input.gridLevelId,
        clientOrderId: input.clientOrderId ?? null,
        side: input.side,
        orderType: input.orderType,
        timeInForce: input.timeInForce,
        price: this.decimal(input.price),
        quantity: this.decimal(input.quantity),
        status: 'PLANNED',
        rawPayload: input.rawPayload,
      },
    })
  }

  markOrderSubmitting(input: MarkGridOrderSubmittingInput) {
    return this.txHost.tx.gridOrder.update({
      where: { id: input.id },
      data: {
        clientOrderId: input.clientOrderId,
        status: 'SUBMITTING',
        rawPayload: input.rawPayload,
      },
    })
  }

  markOrderOpen(input: MarkGridOrderOpenInput) {
    return this.txHost.tx.gridOrder.update({
      where: { id: input.id },
      data: {
        exchangeOrderId: input.exchangeOrderId,
        status: 'OPEN',
        rawPayload: input.rawPayload,
      },
    })
  }

  async recordFillOnce(input: RecordGridFillOnceInput) {
    const existing = await this.txHost.tx.gridFill.findUnique({
      where: {
        gridRuntimeInstanceId_exchangeFillId: {
          gridRuntimeInstanceId: input.gridRuntimeInstanceId,
          exchangeFillId: input.exchangeFillId,
        },
      },
    })

    if (existing) return existing

    return this.txHost.tx.gridFill.create({
      data: {
        gridRuntimeInstanceId: input.gridRuntimeInstanceId,
        gridOrderId: input.gridOrderId,
        exchangeFillId: input.exchangeFillId,
        tradeId: input.tradeId ?? null,
        side: input.side,
        price: this.decimal(input.price),
        quantity: this.decimal(input.quantity),
        fee: input.fee == null ? null : this.decimal(input.fee),
        feeCurrency: input.feeCurrency ?? null,
        filledAt: input.filledAt,
        rawPayload: input.rawPayload,
      },
    })
  }

  appendEvent(input: AppendGridRuntimeEventInput) {
    return this.txHost.tx.gridRuntimeEvent.create({
      data: {
        gridRuntimeInstanceId: input.gridRuntimeInstanceId,
        eventType: input.eventType,
        severity: input.severity,
        status: input.status ?? null,
        message: input.message ?? null,
        payload: input.payload,
      },
    })
  }

  private decimal(value: string): Prisma.Decimal {
    return new Prisma.Decimal(value)
  }
}
