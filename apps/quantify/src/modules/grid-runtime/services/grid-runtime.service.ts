import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { Prisma } from '@/prisma/prisma.types'
import type { ExchangeId, MarketType, UnifiedInstrumentConstraints } from '@/modules/trading/core/types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { TradingService } from '@/modules/trading/trading.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { GridRuntimeRepository } from '../repositories/grid-runtime.repository'
import type { GridRuntimeConfigSnapshot, GridRuntimeJsonValue, GridRuntimeMode } from '../types/grid-runtime.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { GridOrderPlannerService } from './grid-order-planner.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { GridOrderSyncService } from './grid-order-sync.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime class
import { GridRuntimeStateMachineService } from './grid-runtime-state-machine.service'

interface GridRuntimeFundingSnapshot {
  asset?: string | null
  buyingPower?: number | string | null
  executionCapital?: number | string | null
  totalEquity?: number | string | null
}

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
  fundingSnapshot?: GridRuntimeFundingSnapshot | null
}

@Injectable()
export class GridRuntimeService {
  constructor(
    private readonly repository: GridRuntimeRepository,
    private readonly planner: GridOrderPlannerService,
    private readonly orderSync: GridOrderSyncService,
    private readonly stateMachine: GridRuntimeStateMachineService,
    private readonly tradingService: TradingService,
  ) {}

  async createFromDeployment(input: CreateGridRuntimeFromDeploymentInput) {
    const marketType = this.normalizeMarketType(input.marketType)
    const configFromAst = this.buildConfigFromAst(input.astSnapshot, input.symbol, input.currentPrice, input.fundingSnapshot)
    const constraints = await this.loadInstrumentConstraints(input, marketType)
    const config = constraints
      ? this.applyExchangeConstraints(configFromAst, constraints)
      : this.applyAstExecutionConstraints(configFromAst)
    let plan: ReturnType<GridOrderPlannerService['planInitialOrders']>
    try {
      plan = this.planner.planInitialOrders({
        config,
        currentPrice: this.resolveCurrentPrice(input.currentPrice, config),
      })
    }
    catch (error) {
      if (error instanceof Error && error.message.startsWith('grid_runtime_')) {
        throw this.invalidGridRuntimeConfig(error.message)
      }
      throw error
    }
    if (plan.orders.length === 0) {
      throw this.invalidGridRuntimeConfig('grid_runtime_no_submittable_orders_after_normalization')
    }

    const instance = await this.repository.createInstanceWithPlan({
      strategyInstanceId: input.strategyInstanceId,
      publishedSnapshotId: input.publishedSnapshotId,
      userId: input.userId,
      exchangeAccountId: input.exchangeAccountId,
      exchangeId: input.exchangeId,
      marketType,
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
    fundingSnapshot?: GridRuntimeFundingSnapshot | null,
  ): GridRuntimeConfigSnapshot {
    const ast = this.readRecord(astSnapshot)
    const orderPrograms = Array.isArray(ast?.orderPrograms) ? ast.orderPrograms : []
    const program = orderPrograms
      .map(item => this.readRecord(this.readRecord(item)?.payload))
      .find(item => item?.kind === 'LIMIT_LADDER' && item.priceSource === 'level_set')
    if (!program) {
      throw this.invalidGridRuntimeConfig('grid_runtime_order_program_missing')
    }

    const levelSet = this.findLevelSet(ast, this.readString(program, 'levelSetRef'))
    const executionModel = this.readRecord(ast?.executionModel)
    const bounds = this.resolveLevelSetBounds(ast, levelSet, currentPrice)
    const quantity = this.readRecord(program.quantity)
    const sizing = this.resolvePerOrderQuoteSizing(quantity, symbol, fundingSnapshot)
    const gridCount = this.readNumber(program, 'maxWorkingOrders')
    const pricePointCount = this.resolveLevelSetPricePointCount(levelSet) ?? gridCount

    if (!bounds || !sizing || gridCount === null) {
      throw this.invalidGridRuntimeConfig('grid_runtime_invalid_order_program')
    }

    return {
      mode: this.mapMode(this.readString(program, 'sidePolicy')),
      lowerPrice: this.formatNumber(bounds.lower),
      upperPrice: this.formatNumber(bounds.upper),
      gridCount: Math.max(2, Math.floor(gridCount)),
      ...(pricePointCount !== null ? { pricePointCount } : {}),
      perOrderQuote: this.formatNumber(sizing.perOrderQuote),
      quoteAsset: sizing.quoteAsset,
      baseAsset: this.resolveBaseAsset(symbol, sizing.quoteAsset),
      orderType: 'limit',
      timeInForce: 'gtc',
      spacingMode: levelSet?.kind === 'GEOMETRIC_LEVEL_SET' ? 'geometric' : 'arithmetic',
      spacingValue: this.readSpacingValue(levelSet),
      pairingPolicy: this.readString(program, 'pairingPolicy') === 'adjacent_level' ? 'adjacent_level' : undefined,
      activeWhen: this.readString(program, 'activeWhen'),
      tickSize: this.formatOptionalNumber(this.readNumber(executionModel, 'tickSize')),
      lotSize: this.resolveLotSize(executionModel),
      minQuantity: this.formatOptionalNumber(this.readNumber(executionModel, 'minQuantity')),
      pricePrecision: this.readInteger(executionModel, 'pricePrecision'),
      quantityPrecision: this.readInteger(executionModel, 'quantityPrecision'),
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

  private resolveLevelSetPricePointCount(levelSet: Record<string, unknown> | null): number | null {
    if (!levelSet || !('levelsPerSide' in levelSet)) {
      return null
    }

    const levelsPerSide = this.readRecord(levelSet?.levelsPerSide)
    if (!levelsPerSide) {
      throw this.invalidGridRuntimeConfig('grid_runtime_invalid_order_program')
    }

    const downLevels = this.readNumber(levelsPerSide, 'down')
    const upLevels = this.readNumber(levelsPerSide, 'up')
    if (
      downLevels === null
      || upLevels === null
      || !Number.isInteger(downLevels)
      || !Number.isInteger(upLevels)
      || downLevels < 0
      || upLevels < 0
    ) {
      throw this.invalidGridRuntimeConfig('grid_runtime_invalid_order_program')
    }

    const pricePointCount = downLevels + upLevels + 1
    if (pricePointCount < 2) {
      throw this.invalidGridRuntimeConfig('grid_runtime_invalid_order_program')
    }

    return pricePointCount
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
    const normalizedSymbol = symbol
      .trim()
      .toUpperCase()
      .replace(/:(PERP|SPOT|SWAP|FUTURES?)$/u, '')
      .replace(/-SWAP$/u, '')
      .replace(/[-_/]/g, '')
    const normalizedQuote = quoteAsset.trim().toUpperCase()
    return normalizedSymbol.endsWith(normalizedQuote)
      ? normalizedSymbol.slice(0, -normalizedQuote.length)
      : normalizedSymbol
  }

  private async loadInstrumentConstraints(
    input: CreateGridRuntimeFromDeploymentInput,
    marketType: MarketType,
  ): Promise<UnifiedInstrumentConstraints | null> {
    let constraints: UnifiedInstrumentConstraints
    try {
      constraints = await this.tradingService.getInstrumentConstraints(
        input.userId,
        input.exchangeId as ExchangeId,
        marketType,
        input.symbol,
        input.exchangeAccountId,
      )
    }
    catch {
      if (this.normalizeExchangeId(input.exchangeId) === 'okx') {
        throw this.invalidGridRuntimeConfig('grid_runtime_instrument_constraints_unavailable')
      }
      return null
    }
    if (
      constraints.exchangeId !== input.exchangeId
      || constraints.marketType !== marketType
      || this.normalizeInstrumentSymbol(constraints.symbol) !== this.normalizeInstrumentSymbol(input.symbol)
    ) {
      throw this.invalidGridRuntimeConfig('grid_runtime_instrument_constraints_mismatch')
    }
    return constraints
  }

  private applyExchangeConstraints(
    config: GridRuntimeConfigSnapshot,
    constraints: UnifiedInstrumentConstraints,
  ): GridRuntimeConfigSnapshot {
    const tickSize = this.positiveDecimalToString(constraints.priceTickSize, 'grid_runtime_missing_price_tick')
    const quantityStep = this.positiveDecimal(constraints.quantityStepSize, 'grid_runtime_missing_quantity_step')
    const minQuantity = this.positiveDecimal(constraints.minQuantity, 'grid_runtime_missing_min_quantity')

    if (constraints.marketType === 'perp') {
      const contractValue = this.positiveDecimal(constraints.contractValue, 'grid_runtime_missing_contract_value')
      return {
        ...config,
        tickSize,
        lotSize: quantityStep.mul(contractValue).toFixed(),
        minQuantity: minQuantity.mul(contractValue).toFixed(),
        constraintsSource: 'exchange',
      }
    }

    return {
      ...config,
      tickSize,
      lotSize: quantityStep.toFixed(),
      minQuantity: minQuantity.toFixed(),
      constraintsSource: 'exchange',
    }
  }

  private applyAstExecutionConstraints(config: GridRuntimeConfigSnapshot): GridRuntimeConfigSnapshot {
    const tickSize = this.positiveDecimalToString(config.tickSize, 'grid_runtime_missing_price_tick')
    const lotSize = this.positiveDecimalToString(config.lotSize, 'grid_runtime_missing_quantity_step')
    const minQuantity = this.positiveDecimalToString(config.minQuantity, 'grid_runtime_missing_min_quantity')

    return {
      ...config,
      tickSize,
      lotSize,
      minQuantity,
      constraintsSource: 'ast',
    }
  }

  private resolvePerOrderQuoteSizing(
    quantity: Record<string, unknown> | null,
    symbol: string,
    fundingSnapshot?: GridRuntimeFundingSnapshot | null,
  ): { perOrderQuote: number, quoteAsset: string } | null {
    const mode = this.readString(quantity, 'mode')
    const value = this.readNumber(quantity, 'value')
    if (value === null || value <= 0) return null

    const quoteAsset = this.resolveQuoteAsset(quantity, symbol, fundingSnapshot)
    if (!quoteAsset) return null

    if (mode === 'fixed_quote') {
      return { perOrderQuote: value, quoteAsset }
    }

    if (mode === 'pct_equity') {
      const fundingBase = this.resolveFundingBase(fundingSnapshot)
      if (fundingBase === null || fundingBase <= 0) return null
      return { perOrderQuote: fundingBase * value / 100, quoteAsset }
    }

    return null
  }

  private resolveFundingBase(fundingSnapshot?: GridRuntimeFundingSnapshot | null): number | null {
    const buyingPower = this.toPositiveNumber(fundingSnapshot?.buyingPower)
    if (buyingPower !== null) return buyingPower

    const executionCapital = this.toPositiveNumber(fundingSnapshot?.executionCapital)
    if (executionCapital !== null) return executionCapital

    return this.toPositiveNumber(fundingSnapshot?.totalEquity)
  }

  private resolveQuoteAsset(
    quantity: Record<string, unknown> | null,
    symbol: string,
    fundingSnapshot?: GridRuntimeFundingSnapshot | null,
  ): string | null {
    return this.readString(quantity, 'asset')
      ?? this.normalizeAsset(fundingSnapshot?.asset)
      ?? this.inferQuoteAsset(symbol)
      ?? null
  }

  private inferQuoteAsset(symbol: string): string | null {
    const normalized = symbol.trim().toUpperCase()
    const separated = normalized.match(/^[A-Z0-9]+[-_/]([A-Z0-9]+)(?::[A-Z0-9]+)?$/u)
    if (separated?.[1]) return separated[1].replace(/-SWAP$/u, '')

    const compact = normalized
      .replace(/:(PERP|SPOT|SWAP|FUTURES?)$/u, '')
      .replace(/-SWAP$/u, '')
      .replace(/[-_/]/g, '')
    const knownQuotes = ['USDT', 'USDC', 'USD', 'BTC', 'ETH']
    return knownQuotes.find(asset => compact.endsWith(asset)) ?? null
  }

  private normalizeAsset(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : null
  }

  private normalizeInstrumentSymbol(value: string): string {
    return value
      .trim()
      .toUpperCase()
      .replace(/:(PERP|SPOT|SWAP|FUTURES?)$/u, '')
      .replace(/-SWAP$/u, '')
      .replace(/[-_/]/g, '')
  }

  private invalidGridRuntimeConfig(message: string): DomainException {
    return new DomainException(message, {
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
    })
  }

  private normalizeMarketType(value: string): MarketType {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'spot') return 'spot'
    if (normalized === 'perp' || normalized === 'swap' || normalized === 'futures' || normalized === 'future' || normalized === 'perpetual') {
      return 'perp'
    }
    throw this.invalidGridRuntimeConfig('grid_runtime_invalid_market_type')
  }

  private normalizeExchangeId(value: string): string {
    return value.trim().toLowerCase()
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

  private readInteger(source: Record<string, unknown> | null | undefined, key: string): number | null {
    const numeric = this.readNumber(source, key)
    return numeric !== null && Number.isInteger(numeric) && numeric >= 0 ? numeric : null
  }

  private resolveLotSize(executionModel: Record<string, unknown> | null): string | null {
    const lotSize = this.readNumber(executionModel, 'lotSize')
    if (lotSize !== null && lotSize > 0) return this.formatNumber(lotSize)

    const quantityPrecision = this.readInteger(executionModel, 'quantityPrecision')
    return quantityPrecision === null
      ? null
      : new Prisma.Decimal(10).pow(-quantityPrecision).toFixed()
  }

  private toPositiveNumber(value: string | number | null | undefined): number | null {
    const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null
  }

  private positiveDecimalToString(value: string | null | undefined, message: string): string {
    return this.positiveDecimal(value, message).toFixed()
  }

  private positiveDecimal(value: string | null | undefined, message: string): Prisma.Decimal {
    if (!value) throw this.invalidGridRuntimeConfig(message)
    const decimal = new Prisma.Decimal(value)
    if (!decimal.isPositive()) throw this.invalidGridRuntimeConfig(message)
    return decimal
  }

  private formatNumber(value: number): string {
    return new Prisma.Decimal(value).toFixed()
  }

  private formatOptionalNumber(value: number | null): string | null {
    return value === null || value <= 0 ? null : this.formatNumber(value)
  }
}
