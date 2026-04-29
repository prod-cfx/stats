import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { GridRuntimeRepository } from '../repositories/grid-runtime.repository'
import type { GridRuntimeConfigSnapshot, GridRuntimeJsonValue, GridRuntimeMode } from '../types/grid-runtime.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { GridOrderPlannerService } from './grid-order-planner.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { GridOrderSyncService } from './grid-order-sync.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { GridRuntimeStateMachineService } from './grid-runtime-state-machine.service'

export interface CreateGridRuntimeFromDeploymentInput {
  strategyInstanceId: string
  publishedSnapshotId: string
  userId: string
  exchangeAccountId: string
  exchangeId: string
  marketType: string
  symbol: string
  astSnapshot: unknown
  currentPrice?: string | number | null
}

@Injectable()
export class GridRuntimeService {
  constructor(
    private readonly repository: GridRuntimeRepository,
    private readonly planner: GridOrderPlannerService,
    private readonly orderSync: GridOrderSyncService,
    private readonly stateMachine: GridRuntimeStateMachineService,
  ) {}

  async createFromDeployment(input: CreateGridRuntimeFromDeploymentInput) {
    const config = this.buildConfigFromAst(input.astSnapshot, input.symbol)
    const plan = this.planner.planInitialOrders({
      config,
      currentPrice: this.resolveCurrentPrice(input.currentPrice, config),
    })

    const instance = await this.repository.createInstanceWithPlan({
      strategyInstanceId: input.strategyInstanceId,
      publishedSnapshotId: input.publishedSnapshotId,
      userId: input.userId,
      exchangeAccountId: input.exchangeAccountId,
      exchangeId: input.exchangeId,
      marketType: input.marketType,
      symbol: input.symbol,
      mode: config.mode,
      configSnapshot: config as unknown as GridRuntimeJsonValue,
      levels: plan.levels,
      plannedOrders: plan.orders.map(order => ({
        levelIndex: order.levelIndex,
        clientOrderId: null,
        side: order.side,
        role: order.role,
        orderType: order.orderType,
        timeInForce: order.timeInForce,
        price: order.price,
        quantity: order.quantity,
        rawPayload: { source: 'deployment', quoteBudget: order.quoteBudget },
      })),
    })
    await this.stateMachine.initialize(instance.id)
    await this.stateMachine.markRunning(instance.id)
    return instance
  }

  syncInstance(instanceId: string): Promise<void> {
    return this.orderSync.syncInstance(instanceId)
  }

  async getInstanceForUser(userId: string, instanceId: string) {
    const instance = await this.repository.findInstanceForUser({ id: instanceId, userId })
    if (!instance) {
      throw new DomainException('grid_runtime.instance_not_found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { instanceId },
      })
    }
    return instance
  }

  async listOrdersForUser(userId: string, instanceId: string) {
    await this.getInstanceForUser(userId, instanceId)
    return this.repository.listOrders(instanceId)
  }

  async listFillsForUser(userId: string, instanceId: string) {
    await this.getInstanceForUser(userId, instanceId)
    return this.repository.listFills(instanceId)
  }

  async pauseForUser(userId: string, instanceId: string) {
    await this.getInstanceForUser(userId, instanceId)
    await this.pause(instanceId)
    return this.getInstanceForUser(userId, instanceId)
  }

  async resumeForUser(userId: string, instanceId: string) {
    await this.getInstanceForUser(userId, instanceId)
    await this.resume(instanceId)
    return this.getInstanceForUser(userId, instanceId)
  }

  async stopForUser(userId: string, instanceId: string, reason: string) {
    await this.getInstanceForUser(userId, instanceId)
    await this.stop(instanceId, reason)
    return this.getInstanceForUser(userId, instanceId)
  }

  async markReconcileRequiredForUser(userId: string, instanceId: string, reason: string) {
    await this.getInstanceForUser(userId, instanceId)
    await this.stateMachine.markReconcileRequired(instanceId, reason)
    return this.getInstanceForUser(userId, instanceId)
  }

  initialize(instanceId: string) {
    return this.stateMachine.initialize(instanceId)
  }

  markRunning(instanceId: string) {
    return this.stateMachine.markRunning(instanceId)
  }

  pause(instanceId: string) {
    return this.stateMachine.pause(instanceId)
  }

  resume(instanceId: string) {
    return this.stateMachine.resume(instanceId)
  }

  stop(instanceId: string, reason: string) {
    return this.orderSync.stopAndCancelInstance(instanceId, reason)
  }

  private buildConfigFromAst(astSnapshot: unknown, symbol: string): GridRuntimeConfigSnapshot {
    const ast = this.readRecord(astSnapshot)
    const orderPrograms = Array.isArray(ast?.orderPrograms) ? ast.orderPrograms : []
    const program = orderPrograms
      .map(item => this.readRecord(this.readRecord(item)?.payload))
      .find(item => item?.kind === 'LIMIT_LADDER' && item.priceSource === 'level_set')
    if (!program) throw new Error('grid_runtime_order_program_missing')

    const levelSet = this.findLevelSet(ast, this.readString(program, 'levelSetRef'))
    const hardBounds = this.readRecord(levelSet?.hardBounds)
    const lower = this.readConstSeriesValue(ast, this.readString(hardBounds, 'lowerRef'))
    const upper = this.readConstSeriesValue(ast, this.readString(hardBounds, 'upperRef'))
    const quantity = this.readRecord(program.quantity)
    const perOrderQuote = this.readNumber(quantity, 'value')
    const quoteAsset = this.readString(quantity, 'asset')
    const gridCount = this.readNumber(program, 'maxWorkingOrders')

    if (lower === null || upper === null || perOrderQuote === null || !quoteAsset || gridCount === null) {
      throw new Error('grid_runtime_invalid_order_program')
    }

    return {
      mode: this.mapMode(this.readString(program, 'sidePolicy')),
      lowerPrice: this.formatNumber(lower),
      upperPrice: this.formatNumber(upper),
      gridCount: Math.max(2, Math.floor(gridCount)),
      perOrderQuote: this.formatNumber(perOrderQuote),
      quoteAsset,
      baseAsset: this.resolveBaseAsset(symbol, quoteAsset),
      orderType: 'limit',
      timeInForce: 'gtc',
    }
  }

  private findLevelSet(ast: Record<string, unknown> | null, levelSetRef: string | null): Record<string, unknown> | null {
    if (!ast || !levelSetRef || !Array.isArray(ast.exprPool)) return null
    for (const expr of ast.exprPool) {
      const record = this.readRecord(expr)
      if (record?.id !== levelSetRef) continue
      const payload = this.readRecord(record.payload)
      if (payload?.id === levelSetRef) return payload
    }
    return null
  }

  private readConstSeriesValue(ast: Record<string, unknown> | null, seriesRef: string | null): number | null {
    if (!ast || !seriesRef || !Array.isArray(ast.exprPool)) return null
    for (const expr of ast.exprPool) {
      const record = this.readRecord(expr)
      if (record?.id !== seriesRef) continue
      const payload = this.readRecord(record.payload)
      return payload?.kind === 'CONST' ? this.readNumber(payload, 'value') : null
    }
    return null
  }

  private mapMode(sidePolicy: string | null): GridRuntimeMode {
    if (sidePolicy === 'perp_long' || sidePolicy === 'perp_short' || sidePolicy === 'perp_neutral') {
      return sidePolicy
    }
    return 'spot'
  }

  private resolveCurrentPrice(value: string | number | null | undefined, config: GridRuntimeConfigSnapshot): string {
    const price = value == null ? null : new Prisma.Decimal(value)
    if (price?.isPositive()) return price.toFixed()
    return new Prisma.Decimal(config.lowerPrice).plus(config.upperPrice).div(2).toFixed()
  }

  private resolveBaseAsset(symbol: string, quoteAsset: string): string {
    const normalizedSymbol = symbol.trim().toUpperCase().replace(/[-_/]/g, '')
    const normalizedQuote = quoteAsset.trim().toUpperCase()
    return normalizedSymbol.endsWith(normalizedQuote)
      ? normalizedSymbol.slice(0, -normalizedQuote.length)
      : normalizedSymbol
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null
  }

  private readString(source: Record<string, unknown> | null | undefined, key: string): string | null {
    const value = source?.[key]
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  private readNumber(source: Record<string, unknown> | null | undefined, key: string): number | null {
    const value = source?.[key]
    const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
    return Number.isFinite(numeric) ? numeric : null
  }

  private formatNumber(value: number): string {
    return new Prisma.Decimal(value).toFixed()
  }
}
