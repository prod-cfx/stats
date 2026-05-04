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
    const config = this.buildConfigFromAst(input.astSnapshot, input.symbol, input.currentPrice)
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

  private buildConfigFromAst(
    astSnapshot: unknown,
    symbol: string,
    currentPrice?: string | number | null,
  ): GridRuntimeConfigSnapshot {
    const ast = this.readRecord(astSnapshot)
    const orderPrograms = Array.isArray(ast?.orderPrograms) ? ast.orderPrograms : []
    const program = orderPrograms
      .map(item => this.readRecord(this.readRecord(item)?.payload))
      .find(item => item?.kind === 'LIMIT_LADDER' && item.priceSource === 'level_set')
    if (!program) throw new Error('grid_runtime_order_program_missing')

    const levelSet = this.findLevelSet(ast, this.readString(program, 'levelSetRef'))
    const bounds = this.resolveLevelSetBounds(ast, levelSet, currentPrice)
    const quantity = this.readRecord(program.quantity)
    const perOrderQuote = this.readNumber(quantity, 'value')
    const quoteAsset = this.readString(quantity, 'asset')
    const gridCount = this.readNumber(program, 'maxWorkingOrders')

    if (!bounds || perOrderQuote === null || !quoteAsset || gridCount === null) {
      throw new Error('grid_runtime_invalid_order_program')
    }

    return {
      mode: this.mapMode(this.readString(program, 'sidePolicy')),
      lowerPrice: this.formatNumber(bounds.lower),
      upperPrice: this.formatNumber(bounds.upper),
      gridCount: Math.max(2, Math.floor(gridCount)),
      perOrderQuote: this.formatNumber(perOrderQuote),
      quoteAsset,
      baseAsset: this.resolveBaseAsset(symbol, quoteAsset),
      orderType: 'limit',
      timeInForce: 'gtc',
      spacingMode: levelSet?.kind === 'GEOMETRIC_LEVEL_SET' ? 'geometric' : 'arithmetic',
      spacingValue: this.readSpacingValue(levelSet),
      pairingPolicy: this.readString(program, 'pairingPolicy') === 'adjacent_level' ? 'adjacent_level' : undefined,
      activeWhen: this.readString(program, 'activeWhen'),
    }
  }

  private resolveLevelSetBounds(
    ast: Record<string, unknown> | null,
    levelSet: Record<string, unknown> | null,
    currentPrice?: string | number | null,
  ): { lower: number, upper: number } | null {
    const hardBounds = this.readRecord(levelSet?.hardBounds)
    const hardLower = this.readConstSeriesValue(ast, this.readString(hardBounds, 'lowerRef'))
    const hardUpper = this.readConstSeriesValue(ast, this.readString(hardBounds, 'upperRef'))
    if (hardLower !== null && hardUpper !== null) {
      return hardUpper > hardLower ? { lower: hardLower, upper: hardUpper } : null
    }

    const levels = this.evaluateLevelSet(ast, levelSet, currentPrice)
    if (levels.length < 2) return null

    return {
      lower: Math.min(...levels),
      upper: Math.max(...levels),
    }
  }

  private evaluateLevelSet(
    ast: Record<string, unknown> | null,
    levelSet: Record<string, unknown> | null,
    currentPrice?: string | number | null,
  ): number[] {
    const anchor = this.resolveLevelSetAnchor(ast, levelSet, currentPrice)
    const spacing = this.readRecord(levelSet?.spacing)
    const spacingMode = this.readString(spacing, 'mode')
    const spacingValue = this.readNumber(spacing, 'value')
    const levelsPerSide = this.readRecord(levelSet?.levelsPerSide)
    const downLevels = this.readNumber(levelsPerSide, 'down') ?? 0
    const upLevels = this.readNumber(levelsPerSide, 'up') ?? 0
    if (
      anchor === null
      || spacingValue === null
      || spacingValue <= 0
      || downLevels < 0
      || upLevels < 0
    ) {
      return []
    }

    const levels: number[] = []
    for (let index = -Math.floor(downLevels); index <= Math.floor(upLevels); index += 1) {
      levels.push(spacingMode === 'pct'
        ? anchor * Math.pow(1 + spacingValue / 100, index)
        : anchor + spacingValue * index)
    }
    return levels.filter(level => Number.isFinite(level) && level > 0)
  }

  private resolveLevelSetAnchor(
    ast: Record<string, unknown> | null,
    levelSet: Record<string, unknown> | null,
    currentPrice?: string | number | null,
  ): number | null {
    const anchorRef = this.readString(levelSet, 'anchorRef')
    const anchor = this.readSeriesValue(ast, anchorRef, currentPrice)
    if (anchor !== null) return anchor

    const current = this.toPositiveNumber(currentPrice)
    return current
  }

  private readSpacingValue(levelSet: Record<string, unknown> | null): string | null {
    const spacing = this.readRecord(levelSet?.spacing)
    const value = this.readNumber(spacing, 'value')
    return value === null ? null : this.formatNumber(value)
  }

  private findLevelSet(ast: Record<string, unknown> | null, levelSetRef: string | null): Record<string, unknown> | null {
    if (!ast || !levelSetRef || !Array.isArray(ast.exprPool)) return null
    for (const expr of ast.exprPool) {
      const record = this.readRecord(expr)
      const payload = this.readRecord(record.payload)
      if (!this.exprMatchesRef(record, payload, levelSetRef)) continue
      return payload
    }
    return null
  }

  private readConstSeriesValue(ast: Record<string, unknown> | null, seriesRef: string | null): number | null {
    if (!ast || !seriesRef || !Array.isArray(ast.exprPool)) return null
    for (const expr of ast.exprPool) {
      const record = this.readRecord(expr)
      const payload = this.readRecord(record.payload)
      if (!this.exprMatchesRef(record, payload, seriesRef)) continue
      return payload?.kind === 'CONST' ? this.readNumber(payload, 'value') : null
    }
    return null
  }

  private readSeriesValue(
    ast: Record<string, unknown> | null,
    seriesRef: string | null,
    currentPrice?: string | number | null,
  ): number | null {
    if (!ast || !seriesRef || !Array.isArray(ast.exprPool)) return null
    for (const expr of ast.exprPool) {
      const record = this.readRecord(expr)
      const payload = this.readRecord(record.payload)
      if (!this.exprMatchesRef(record, payload, seriesRef)) continue
      if (payload?.kind === 'CONST') return this.readNumber(payload, 'value')
      if (payload?.kind === 'DEPLOYMENT_PRICE') return this.toPositiveNumber(currentPrice)
    }
    return null
  }

  private exprMatchesRef(
    record: Record<string, unknown> | null,
    payload: Record<string, unknown> | null,
    ref: string,
  ): boolean {
    return record?.id === ref || record?.sourceRef === ref || payload?.id === ref
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

  private toPositiveNumber(value: string | number | null | undefined): number | null {
    const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null
  }

  private formatNumber(value: number): string {
    return new Prisma.Decimal(value).toFixed()
  }
}
