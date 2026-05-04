import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { ClosePositionDto, ClosePositionResponseDto } from './dto/close-position.dto'
import type { PositionResponseDto } from './dto/position.response.dto'
import type { PositionsQueryDto } from './dto/positions-query.dto'
import type { RecordTradeDto } from './dto/record-trade.dto'
import type { TradeResponseDto } from './dto/trade.response.dto'
import type { ExchangeId, MarketType, UnifiedOrder } from '@/modules/trading/core/types'
import type { OrderIntent, TradingExecutionResult } from '@/modules/trading-execution/types/trading-execution.types'
import type { Position, Trade, PrismaClient } from '@/prisma/prisma.types'
import { randomUUID } from 'node:crypto'
import { ErrorCode, LedgerEntryType, PositionSide, PositionStatus, TradeSide } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'
import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { AccountsService } from '@/modules/accounts/accounts.service'
import { StrategyAccountNotFoundException } from '@/modules/accounts/exceptions/strategy-account-not-found.exception'
import { normalizeExecutionSymbol } from '@/modules/trading/core/symbol-normalizer'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { TradingExecutionService } from '@/modules/trading-execution/services/trading-execution.service'
import { Prisma } from '@/prisma/prisma.types'
import { PositionInsufficientQuantityException } from './exceptions/position-insufficient-quantity.exception'
import { PositionNotFoundException } from './exceptions/position-not-found.exception'
import { TradeConflictException } from './exceptions/trade-conflict.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PositionsRepository } from './repositories/positions.repository'

// Prisma 7: 从 Prisma namespace 导出类型和值
/* eslint-disable no-redeclare, ts/no-redeclare */
type Decimal = Prisma.Decimal
const Decimal = Prisma.Decimal
/* eslint-enable no-redeclare, ts/no-redeclare */

@Injectable()
export class PositionsService {
  constructor(
    private readonly positionsRepository: PositionsRepository,
    private readonly accountsService: AccountsService,
    private readonly tradingExecution: TradingExecutionService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
  ) {}

  async recordTrade(dto: RecordTradeDto): Promise<TradeResponseDto> {
    const normalizedSymbol = dto.symbol.trim().toUpperCase()
    const price = new Decimal(dto.price)
    const quantity = new Decimal(dto.quantity)
    const fee = new Decimal(dto.fee ?? '0')
    const leverage = dto.leverage ? new Decimal(dto.leverage) : null
    const executedAt = new Date(dto.executedAt)

    const trade = await this.txHost.withTransaction(async () => {
      // 1. 校验账户与成交幂等
      await this.ensureAccountAndNoDuplicateTrade(dto)

      // 2. 加锁加载当前仓位
      const tradeMarket = this.parseTradeMarket(dto.market)
      const lockedPosition = await this.loadAndLockPosition(
        dto.userStrategyAccountId,
        normalizedSymbol,
        dto.positionSide,
        tradeMarket,
      )

      // 3. 根据方向调整仓位
      const isIncrease = this.isIncreaseTrade(dto.positionSide, dto.side)
      const {
        position,
        realizedPnlDelta,
        settlementDelta,
      } = isIncrease
        ? await this.applyIncrease({
            dto,
            normalizedSymbol,
            price,
            quantity,
            leverage,
            executedAt,
            existingPosition: lockedPosition,
          })
        : await this.applyDecrease({
            dto,
            normalizedSymbol,
            price,
            quantity,
            executedAt,
            existingPosition: lockedPosition,
          })

      const tradeRecord = await this.positionsRepository.createTrade({
        userStrategyAccountId: dto.userStrategyAccountId,
        positionId: position!.id,
        symbol: dto.symbol,
        market: dto.market,
        side: dto.side,
        positionSide: dto.positionSide,
        price,
        quantity,
        fee,
        feeCurrency: dto.feeCurrency,
        orderId: dto.orderId,
        externalTradeId: dto.externalTradeId,
        provider: dto.provider,
        executedAt,
        metadata: dto.metadata as Prisma.JsonValue | undefined,
      })

      if (!settlementDelta.isZero()) {
        await this.accountsService.applyLedgerDelta({
          accountId: dto.userStrategyAccountId,
          delta: settlementDelta,
          ledgerType: LedgerEntryType.ADJUSTMENT,
          positionId: position!.id,
          referenceId: `${tradeRecord.id}:settlement`,
          description: `Spot close settlement ${dto.symbol}`,
          occurredAt: executedAt,
        })
      }

      if (!realizedPnlDelta.isZero()) {
        await this.accountsService.applyLedgerDelta({
          accountId: dto.userStrategyAccountId,
          delta: realizedPnlDelta,
          ledgerType: LedgerEntryType.REALIZED_PNL,
          positionId: position!.id,
          referenceId: tradeRecord.id,
          description: `Realized PnL ${dto.symbol}`,
          occurredAt: executedAt,
        })
      }

      if (fee.gt(0)) {
        await this.accountsService.applyLedgerDelta({
          accountId: dto.userStrategyAccountId,
          delta: fee.neg(),
          ledgerType: LedgerEntryType.FEE,
          positionId: position!.id,
          referenceId: `${tradeRecord.id}:fee`,
          description: dto.feeCurrency ? `Fee (${dto.feeCurrency})` : 'Fee',
          occurredAt: executedAt,
        })
      }

      return tradeRecord
    })

    return this.toTradeResponse(trade)
  }

  private async ensureAccountAndNoDuplicateTrade(dto: RecordTradeDto) {
    const account = await this.positionsRepository.findAccountById(dto.userStrategyAccountId)
    if (!account) {
      throw new StrategyAccountNotFoundException({ accountId: dto.userStrategyAccountId })
    }

    if (!dto.externalTradeId) return

    const duplicated = await this.positionsRepository.findTradeByExternalTradeId(
      dto.userStrategyAccountId,
      dto.externalTradeId,
    )
    if (duplicated) {
      throw new TradeConflictException({ referenceId: dto.externalTradeId })
    }
  }

  private async loadAndLockPosition(
    accountId: string,
    normalizedSymbol: string,
    positionSide: PositionSide,
    market?: { exchangeId: string; marketType: string; market: string } | null,
  ): Promise<Position | null> {
    const lockedPositions = await this.positionsRepository.lockOpenPosition(
      accountId,
      normalizedSymbol,
      positionSide,
      market,
    )
    return lockedPositions[0] ?? null
  }

  private parseTradeMarket(market: string | undefined): { exchangeId: string; marketType: string; market: string } | null {
    if (!market) {
      return null
    }

    const [exchangeId, marketType] = market.split(':')
    if (!exchangeId || !marketType) {
      return null
    }

    return { exchangeId, marketType, market }
  }

  private async applyIncrease(
    params: {
      dto: RecordTradeDto
      normalizedSymbol: string
      price: Decimal
      quantity: Decimal
      leverage: Decimal | null
      executedAt: Date
      existingPosition: Position | null
    },
  ): Promise<{ position: Position; realizedPnlDelta: Decimal; settlementDelta: Decimal }> {
    const { dto, normalizedSymbol, price, quantity, leverage, executedAt } = params
    let { existingPosition } = params

    // 无仓位则尝试创建，处理并发唯一约束
    if (!existingPosition) {
      // 从 market 字段提取 exchangeId 和 marketType (格式: "exchangeId:marketType")
      let exchangeId: string | null = null
      let marketType: string | null = null
      if (dto.market) {
        const [exId, mType] = dto.market.split(':')
        exchangeId = exId || null
        marketType = mType || null
      }

      try {
        const created = await this.positionsRepository.createPosition({
          userStrategyAccountId: dto.userStrategyAccountId,
          symbol: normalizedSymbol,
          positionSide: dto.positionSide,
          leverage,
          quantity,
          avgEntryPrice: price,
          openedAt: executedAt,
          exchangeId,
          marketType,
          metadata: dto.metadata as Prisma.JsonValue | undefined,
        })
        return { position: created, realizedPnlDelta: new Decimal(0), settlementDelta: new Decimal(0) }
      }
      catch (error: any) {
        // P2002 = Unique constraint violation，说明另一事务刚好创建了同方向 OPEN 仓位
        if (error.code !== 'P2002') {
          throw error
        }
        // 重新加锁加载
        existingPosition = await this.loadAndLockPosition(
          dto.userStrategyAccountId,
          normalizedSymbol,
          dto.positionSide,
          this.parseTradeMarket(dto.market),
        )
        if (!existingPosition) {
          // 理论上不应出现（除非并发创建后又立即删除），保留原始错误
          throw error
        }
      }
    }

    // 有已有仓位（或并发重试后拿到），执行加仓逻辑
    const newQty = existingPosition.quantity.add(quantity)
    const weighted = existingPosition.avgEntryPrice.mul(existingPosition.quantity).add(price.mul(quantity))
    const newAvg = weighted.div(newQty)
    
    // 从本次成交补齐缺失的 exchangeId/marketType（为老仓位或迁移前数据补充信息）
    let exchangeId = existingPosition.exchangeId
    let marketType = existingPosition.marketType
    if ((!exchangeId || !marketType) && dto.market) {
      const [exId, mType] = dto.market.split(':')
      exchangeId = exchangeId || exId || null
      marketType = marketType || mType || null
    }
    
    const updated = await this.positionsRepository.updatePosition(existingPosition.id, {
      quantity: newQty,
      avgEntryPrice: newAvg,
      leverage: leverage ?? existingPosition.leverage,
      exchangeId,
      marketType,
      metadata: params.dto.metadata ? (params.dto.metadata as Prisma.JsonValue) : existingPosition.metadata,
      status: PositionStatus.OPEN,
    })

    return { position: updated, realizedPnlDelta: new Decimal(0), settlementDelta: new Decimal(0) }
  }

  private async applyDecrease(
    params: {
      dto: RecordTradeDto
      normalizedSymbol: string
      price: Decimal
      quantity: Decimal
      executedAt: Date
      existingPosition: Position | null
    },
  ): Promise<{ position: Position; realizedPnlDelta: Decimal; settlementDelta: Decimal }> {
    const { dto, normalizedSymbol, price, quantity, executedAt, existingPosition } = params

    if (!existingPosition || existingPosition.status !== PositionStatus.OPEN) {
      throw new PositionNotFoundException({
        accountId: dto.userStrategyAccountId,
        symbol: normalizedSymbol,
        positionSide: dto.positionSide,
      })
    }
    if (existingPosition.quantity.lt(quantity)) {
      throw new PositionInsufficientQuantityException({
        positionId: existingPosition.id,
        available: existingPosition.quantity.toString(),
        requested: quantity.toString(),
      })
    }

    const remainingQty = existingPosition.quantity.sub(quantity)
    const realizedPnlDelta = this.calculateRealizedPnl(
      dto.positionSide,
      existingPosition.avgEntryPrice,
      price,
      quantity,
    )

    const isFullClose = remainingQty.isZero()
    const settlementDelta = this.calculateSettlementDelta(
      dto.market,
      dto.positionSide,
      dto.side,
      existingPosition.avgEntryPrice,
      quantity,
    )
    const updated = await this.positionsRepository.updatePosition(existingPosition.id, {
      quantity: remainingQty,
      realizedPnl: existingPosition.realizedPnl.add(realizedPnlDelta),
      // 平仓后该部分的未实现盈亏应当归零
      unrealizedPnl: isFullClose ? new Decimal(0) : existingPosition.unrealizedPnl,
      status: isFullClose ? PositionStatus.CLOSED : PositionStatus.OPEN,
      closedAt: isFullClose ? executedAt : existingPosition.closedAt,
    })

    await this.recalculateUnrealizedAndEquity(dto.userStrategyAccountId)

    return { position: updated, realizedPnlDelta, settlementDelta }
  }

  private async recalculateUnrealizedAndEquity(accountId: string): Promise<void> {
    // 重新聚合该账户的未实现盈亏，确保 equity = balance + totalUnrealizedPnl 不依赖后续行情推送
    const totalUnrealized = await this.positionsRepository.aggregateOpenPositionUnrealizedPnl(accountId) ?? new Decimal(0)

    // 🔒 并发安全：用数据库最新余额 + 聚合浮盈，避免覆盖其它事务（入金/出金/手续费）对 balance 的修改
    // 使用 $queryRaw 原子读 + 写，不依赖事务开头的快照 account.balance
    await this.positionsRepository.refreshAccountEquityFromBalance(accountId, totalUnrealized)
  }

  async listPositions(
    query: PositionsQueryDto,
    ownerUserId?: string,
  ): Promise<BasePaginationResponseDto<PositionResponseDto>> {
    const where: Prisma.PositionWhereInput = {}
    if (query.accountId) where.userStrategyAccountId = query.accountId
    if (query.symbol) where.symbol = query.symbol.trim().toUpperCase()
    if (query.positionSide) where.positionSide = query.positionSide
    if (query.status) where.status = query.status

    if (ownerUserId) {
      where.account = { userId: ownerUserId }
    } else if (query.userId) {
      where.account = { userId: query.userId }
    }

    // 确保分页参数有效值
    const page = query.page || 1
    const limit = query.limit || 20
    const skip = (page - 1) * limit
    
    const [items, total] = await this.positionsRepository.findManyPaginated(where, skip, limit)

    const data = items.map(item => this.toPositionResponse(item))
    return new BasePaginationResponseDto<PositionResponseDto>(total, page, limit, data)
  }

  private isIncreaseTrade(positionSide: PositionSide, tradeSide: TradeSide) {
    if (positionSide === PositionSide.LONG) {
      return tradeSide === TradeSide.BUY
    }
    return tradeSide === TradeSide.SELL
  }

  private calculateRealizedPnl(
    positionSide: PositionSide,
    entryPrice: Prisma.Decimal,
    exitPrice: Prisma.Decimal,
    quantity: Prisma.Decimal,
  ) {
    const diff = exitPrice.sub(entryPrice)
    return diff.mul(quantity).mul(positionSide === PositionSide.LONG ? 1 : -1)
  }

  private calculateSettlementDelta(
    market: string | undefined,
    positionSide: PositionSide,
    tradeSide: TradeSide,
    entryPrice: Prisma.Decimal,
    quantity: Prisma.Decimal,
  ) {
    const normalizedMarket = (market ?? '').toLowerCase()
    const isSpot = normalizedMarket.endsWith(':spot')
    const isLongClose = positionSide === PositionSide.LONG && tradeSide === TradeSide.SELL

    if (!isSpot || !isLongClose) {
      return new Decimal(0)
    }

    return entryPrice.mul(quantity)
  }

  private toPositionResponse(
    position: Position,
  ): PositionResponseDto {
    return {
      id: position.id,
      userStrategyAccountId: position.userStrategyAccountId,
      symbol: position.symbol,
      positionSide: position.positionSide as PositionSide,
      leverage: position.leverage ? position.leverage.toString() : null,
      quantity: (position.quantity as Prisma.Decimal).toString(),
      avgEntryPrice: (position.avgEntryPrice as Prisma.Decimal).toString(),
      realizedPnl: (position.realizedPnl as Prisma.Decimal).toString(),
      unrealizedPnl: (position.unrealizedPnl as Prisma.Decimal).toString(),
      status: position.status as PositionStatus,
      openedAt: (position.openedAt as Date).toISOString(),
      closedAt: position.closedAt ? (position.closedAt as Date).toISOString() : null,
      exchangeId: position.exchangeId ?? null,
      marketType: position.marketType ?? null,
    }
  }

  /**
   * 用户主动平仓（市价单全平或部分平仓）
   * 
   * @param dto - 平仓请求参数
   * @returns 平仓结果
   * @throws PositionNotFoundException - 仓位不存在或已关闭
   * @throws PositionInsufficientQuantityException - 平仓数量超过持仓数量
   * @throws StrategyAccountNotFoundException - 账户不存在
   */
  async closePosition(dto: ClosePositionDto): Promise<ClosePositionResponseDto> {
    // 1. 验证仓位并获取相关账户信息（一次查询优化性能）
    const position = await this.positionsRepository.findUniqueWithAccount(dto.positionId)

    if (!position) {
      throw new PositionNotFoundException({ 
        accountId: dto.userStrategyAccountId, 
        symbol: '',
        positionSide: '',
      })
    }

    // 验证账户归属
    if (position.userStrategyAccountId !== dto.userStrategyAccountId) {
      throw new PositionNotFoundException({ 
        accountId: dto.userStrategyAccountId, 
        symbol: position.symbol,
        positionSide: position.positionSide,
      })
    }

    // 验证仓位状态
    if (position.status !== PositionStatus.OPEN) {
      throw new PositionNotFoundException({ 
        accountId: dto.userStrategyAccountId, 
        symbol: position.symbol,
        positionSide: position.positionSide,
      })
    }

    // 2. 验证平仓数量
    const closeQuantity = new Decimal(dto.quantity)
    const currentQuantity = new Decimal(position.quantity)

    if (closeQuantity.lte(0)) {
      throw new PositionInsufficientQuantityException({
        positionId: dto.positionId,
        requested: closeQuantity.toString(),
        available: currentQuantity.toString(),
      })
    }

    if (closeQuantity.gt(currentQuantity)) {
      throw new PositionInsufficientQuantityException({
        positionId: dto.positionId,
        requested: closeQuantity.toString(),
        available: currentQuantity.toString(),
      })
    }

    // 3. 验证并使用数据库中存储的 exchangeId/marketType（安全性：不信任客户端传参）
    if (!position.exchangeId || !position.marketType) {
      throw new DomainException('position.close_missing_exchange_info', { code: ErrorCode.PORTFOLIO_POSITION_CLOSE_ERROR, args: { positionId: dto.positionId } })
    }

    const exchangeId = position.exchangeId as ExchangeId
    const marketType = position.marketType as MarketType
    const executionSymbol = normalizeExecutionSymbol(position.symbol, marketType, exchangeId)

    // 4. 确定订单方向：平多单需要卖出，平空单需要买入
    const orderSide = position.positionSide === PositionSide.LONG ? 'sell' : 'buy'
    const isPerp = marketType === 'perp'
    const intent: OrderIntent = {
      source: 'position_tool',
      sourceId: this.createClosePositionSourceId(dto.positionId, closeQuantity),
      userId: position.account.userId,
      exchangeId,
      marketType,
      symbol: executionSymbol,
      side: orderSide,
      type: 'market',
      amount: closeQuantity.toNumber(),
      role: this.resolveClosePositionRole(marketType, orderSide, position.positionSide),
      ...(isPerp ? { reduceOnly: true, tdMode: 'cross' as const } : {}),
      metadata: {
        positionId: dto.positionId,
        userStrategyAccountId: dto.userStrategyAccountId,
        note: dto.note ?? null,
      },
    }

    // 5. 通过通用执行内核完成 clientOrderId、约束、数量标准化与 reduceOnly/posSide gate
    const executionResult = await this.executeClosePositionIntent(intent, dto.positionId)
    if (executionResult.status !== 'submitted') {
      throw this.toClosePositionExecutionException(dto.positionId, executionResult)
    }
    const { order } = executionResult
    const filledQuantity =
      typeof order.filled === 'number' && Number.isFinite(order.filled) && order.filled > 0
        ? order.filled
        : closeQuantity.toNumber()
    const tradePrice =
      typeof order.price === 'number' && Number.isFinite(order.price) && order.price > 0
        ? order.price
        : Number(position.avgEntryPrice)
    const { amount: feeAmount, currency: feeCurrency } = this.extractOrderFee(order)

    // 6. 下单成功后立即落地本地成交，避免仓位状态长期漂移
    await this.recordTrade({
      userStrategyAccountId: dto.userStrategyAccountId,
      symbol: position.symbol,
      market: `${exchangeId}:${marketType}`,
      side: orderSide === 'buy' ? TradeSide.BUY : TradeSide.SELL,
      positionSide: position.positionSide,
      price: tradePrice.toString(),
      quantity: filledQuantity.toString(),
      fee: feeAmount > 0 ? feeAmount.toString() : '0',
      feeCurrency: feeCurrency ?? undefined,
      orderId: order.id,
      externalTradeId: order.id,
      provider: exchangeId,
      executedAt: new Date(order.createdAt).toISOString(),
      metadata: {
        source: 'manual-close-position',
        positionId: dto.positionId,
        note: dto.note ?? null,
        tradingExecution: {
          status: executionResult.status,
          clientOrderId: executionResult.normalized.clientOrderId,
          normalizedAmount: executionResult.normalized.normalizedAmount,
          exchangeSize: executionResult.normalized.exchangeSize,
          normalizedRequest: this.toJsonSafe(executionResult.normalized.request),
        },
      },
    })

    // 7. 返回平仓结果
    return {
      success: true,
      orderId: order.id,
      positionId: dto.positionId,
      filledQuantity: filledQuantity.toString(),
      averagePrice: tradePrice.toString(),
      message: dto.note || '市价平仓成功',
    }
  }

  private createClosePositionSourceId(positionId: string, closeQuantity: Decimal): string {
    return `${positionId}:${closeQuantity.toString()}:${Date.now()}:${randomUUID()}`
  }

  private resolveClosePositionRole(
    marketType: MarketType,
    orderSide: 'buy' | 'sell',
    positionSide: PositionSide,
  ): OrderIntent['role'] {
    if (marketType === 'spot') {
      return orderSide === 'sell' ? 'spot_sell' : 'spot_buy'
    }
    return positionSide === PositionSide.LONG ? 'close_long' : 'close_short'
  }

  private async executeClosePositionIntent(intent: OrderIntent, positionId: string): Promise<TradingExecutionResult> {
    try {
      return await this.tradingExecution.executeIntent(intent)
    }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new DomainException(`position.close_execution_error reason=${reason}`, {
        code: ErrorCode.PORTFOLIO_POSITION_CLOSE_ERROR,
        args: {
          positionId,
          status: 'execution_error',
          reason,
        },
      })
    }
  }

  private toClosePositionExecutionException(
    positionId: string,
    result: Exclude<TradingExecutionResult, { status: 'submitted' }>,
  ): DomainException {
    const normalized = 'normalized' in result ? result.normalized : undefined
    const clientOrderId = normalized?.clientOrderId
    const reasonParts = [
      `position.close_${result.status}`,
      `reason=${result.reason}`,
      clientOrderId ? `clientOrderId=${clientOrderId}` : null,
    ].filter(Boolean)

    return new DomainException(reasonParts.join(' '), {
      code: ErrorCode.PORTFOLIO_POSITION_CLOSE_ERROR,
      args: {
        positionId,
        status: result.status,
        reason: result.reason,
        clientOrderId,
        normalizedAmount: normalized?.normalizedAmount,
        exchangeSize: normalized?.exchangeSize,
        normalizedRequest: normalized?.request,
      },
    })
  }

  private toJsonSafe(value: unknown): Prisma.JsonValue | undefined {
    if (value === undefined) return undefined
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value as Prisma.JsonValue
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (Array.isArray(value)) {
      return value
        .map(item => this.toJsonSafe(item))
        .filter((item): item is Prisma.JsonValue => item !== undefined)
    }
    if (typeof value === 'object') {
      const jsonObject: Prisma.JsonObject = {}
      for (const [key, item] of Object.entries(value)) {
        const safeItem = this.toJsonSafe(item)
        if (safeItem !== undefined) {
          jsonObject[key] = safeItem
        }
      }
      return jsonObject
    }
    return String(value)
  }

  private toTradeResponse(trade: Trade): TradeResponseDto {
    return {
      id: trade.id,
      userStrategyAccountId: trade.userStrategyAccountId,
      positionId: trade.positionId ?? null,
      symbol: trade.symbol,
      side: trade.side,
      positionSide: trade.positionSide,
      price: trade.price.toString(),
      quantity: trade.quantity.toString(),
      fee: trade.fee.toString(),
      feeCurrency: trade.feeCurrency,
      orderId: trade.orderId,
      externalTradeId: trade.externalTradeId,
      provider: trade.provider,
      executedAt: trade.executedAt.toISOString(),
    }
  }

  private extractOrderFee(order: UnifiedOrder): { amount: number; currency: string | null } {
    const raw = order.raw as any
    if (typeof raw?.fee === 'number' && Number.isFinite(raw.fee)) {
      const currency = typeof raw?.feeCurrency === 'string' ? raw.feeCurrency : null
      return { amount: raw.fee, currency }
    }

    if (Array.isArray(raw?.fills) && raw.fills.length > 0) {
      const amount = raw.fills.reduce((sum: number, fill: any) => {
        const fee = Number(fill?.commission ?? 0)
        return Number.isFinite(fee) ? sum + fee : sum
      }, 0)
      const currency =
        typeof raw.fills[0]?.commissionAsset === 'string'
          ? raw.fills[0].commissionAsset
          : null
      return { amount, currency }
    }

    return { amount: 0, currency: null }
  }

  async findUserStrategyAccountById(accountId: string) {
    return this.positionsRepository.findUserStrategyAccountById(accountId)
  }
}
