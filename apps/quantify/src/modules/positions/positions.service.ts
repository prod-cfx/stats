import type { Position, Trade } from '@/prisma/prisma.types'
import type { ClosePositionDto, ClosePositionResponseDto } from './dto/close-position.dto'
import type { PositionResponseDto } from './dto/position.response.dto'
import type { PositionsQueryDto } from './dto/positions-query.dto'
import type { RecordTradeDto } from './dto/record-trade.dto'
import type { TradeResponseDto } from './dto/trade.response.dto'
import type { ExchangeId, MarketType } from '@/modules/trading/core/types'
import { Injectable } from '@nestjs/common'
import { LedgerEntryType, PositionSide, PositionStatus, Prisma, TradeSide } from '@/prisma/prisma.types'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { AccountsService } from '@/modules/accounts/accounts.service'
import { StrategyAccountNotFoundException } from '@/modules/accounts/exceptions/strategy-account-not-found.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { TradingService } from '@/modules/trading/trading.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PrismaService } from '@/prisma/prisma.service'
import { PositionInsufficientQuantityException } from './exceptions/position-insufficient-quantity.exception'
import { PositionNotFoundException } from './exceptions/position-not-found.exception'
import { TradeConflictException } from './exceptions/trade-conflict.exception'

// Prisma 7: 从 Prisma namespace 导出类型和值
/* eslint-disable no-redeclare, ts/no-redeclare */
type Decimal = Prisma.Decimal
const Decimal = Prisma.Decimal
/* eslint-enable no-redeclare, ts/no-redeclare */

@Injectable()
export class PositionsService {
  constructor(
    public readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly tradingService: TradingService,
  ) {}

  async recordTrade(dto: RecordTradeDto): Promise<TradeResponseDto> {
    const normalizedSymbol = dto.symbol.trim().toUpperCase()
    const price = new Decimal(dto.price)
    const quantity = new Decimal(dto.quantity)
    const fee = new Decimal(dto.fee ?? '0')
    const leverage = dto.leverage ? new Decimal(dto.leverage) : null
    const executedAt = new Date(dto.executedAt)

    const trade = await this.prisma.runInTransaction(async prisma => {
      // 1. 校验账户与成交幂等
      await this.ensureAccountAndNoDuplicateTrade(prisma, dto)

      // 2. 加锁加载当前仓位
      const lockedPosition = await this.loadAndLockPosition(
        prisma,
        dto.userStrategyAccountId,
        normalizedSymbol,
        dto.positionSide,
      )

      // 3. 根据方向调整仓位
      const isIncrease = this.isIncreaseTrade(dto.positionSide, dto.side)
      const {
        position,
        realizedPnlDelta,
      } = isIncrease
        ? await this.applyIncrease(prisma, {
            dto,
            normalizedSymbol,
            price,
            quantity,
            leverage,
            executedAt,
            existingPosition: lockedPosition,
          })
        : await this.applyDecrease(prisma, {
            dto,
            normalizedSymbol,
            price,
            quantity,
            executedAt,
            existingPosition: lockedPosition,
          })

      const tradeRecord = await prisma.trade.create({
        data: {
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
        },
      })

      if (!realizedPnlDelta.isZero()) {
        await this.accountsService.applyLedgerDeltaWithClient(prisma, {
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
        await this.accountsService.applyLedgerDeltaWithClient(prisma, {
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

  private async ensureAccountAndNoDuplicateTrade(prisma: Prisma.TransactionClient, dto: RecordTradeDto) {
    const account = await prisma.userStrategyAccount.findUnique({
      where: { id: dto.userStrategyAccountId },
    })
    if (!account) {
      throw new StrategyAccountNotFoundException({ accountId: dto.userStrategyAccountId })
    }

    if (!dto.externalTradeId) return

    const duplicated = await prisma.trade.findFirst({
      where: {
        userStrategyAccountId: dto.userStrategyAccountId,
        externalTradeId: dto.externalTradeId,
      },
    })
    if (duplicated) {
      throw new TradeConflictException({ referenceId: dto.externalTradeId })
    }
  }

  private async loadAndLockPosition(
    prisma: Prisma.TransactionClient,
    accountId: string,
    normalizedSymbol: string,
    positionSide: PositionSide,
  ): Promise<Position | null> {
    const lockedPositions = await prisma.$queryRaw<Position[]>`
      SELECT *
      FROM "positions"
      WHERE "user_strategy_account_id" = ${accountId}
        AND "symbol" = ${normalizedSymbol}
        AND "position_side" = ${positionSide}
        AND "status" = ${PositionStatus.OPEN}
      FOR UPDATE
    `
    return lockedPositions[0] ?? null
  }

  private async applyIncrease(
    prisma: Prisma.TransactionClient,
    params: {
      dto: RecordTradeDto
      normalizedSymbol: string
      price: Decimal
      quantity: Decimal
      leverage: Decimal | null
      executedAt: Date
      existingPosition: Position | null
    },
  ): Promise<{ position: Position; realizedPnlDelta: Decimal }> {
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
        const created = await prisma.position.create({
          data: {
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
          },
        })
        return { position: created, realizedPnlDelta: new Decimal(0) }
      }
      catch (error: any) {
        // P2002 = Unique constraint violation，说明另一事务刚好创建了同方向 OPEN 仓位
        if (error.code !== 'P2002') {
          throw error
        }
        // 重新加锁加载
        existingPosition = await this.loadAndLockPosition(
          prisma,
          dto.userStrategyAccountId,
          normalizedSymbol,
          dto.positionSide,
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
    
    const updated = await prisma.position.update({
      where: { id: existingPosition.id },
      data: {
        quantity: newQty,
        avgEntryPrice: newAvg,
        leverage: leverage ?? existingPosition.leverage,
        exchangeId,
        marketType,
        metadata: params.dto.metadata ? (params.dto.metadata as Prisma.JsonValue) : existingPosition.metadata,
        status: PositionStatus.OPEN,
      },
    })

    return { position: updated, realizedPnlDelta: new Decimal(0) }
  }

  private async applyDecrease(
    prisma: Prisma.TransactionClient,
    params: {
      dto: RecordTradeDto
      normalizedSymbol: string
      price: Decimal
      quantity: Decimal
      executedAt: Date
      existingPosition: Position | null
    },
  ): Promise<{ position: Position; realizedPnlDelta: Decimal }> {
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
    const updated = await prisma.position.update({
      where: { id: existingPosition.id },
      data: {
        quantity: remainingQty,
        realizedPnl: existingPosition.realizedPnl.add(realizedPnlDelta),
        // 平仓后该部分的未实现盈亏应当归零
        unrealizedPnl: isFullClose ? new Decimal(0) : existingPosition.unrealizedPnl,
        status: isFullClose ? PositionStatus.CLOSED : PositionStatus.OPEN,
        closedAt: isFullClose ? executedAt : existingPosition.closedAt,
      },
    })

    await this.recalculateUnrealizedAndEquity(prisma, dto.userStrategyAccountId)

    return { position: updated, realizedPnlDelta }
  }

  private async recalculateUnrealizedAndEquity(prisma: Prisma.TransactionClient, accountId: string): Promise<void> {
    // 重新聚合该账户的未实现盈亏，确保 equity = balance + totalUnrealizedPnl 不依赖后续行情推送
    const aggregate = await prisma.position.aggregate({
      where: { userStrategyAccountId: accountId, status: PositionStatus.OPEN },
      _sum: { unrealizedPnl: true },
    })
    const totalUnrealized = aggregate._sum.unrealizedPnl ?? new Decimal(0)

    // 🔒 并发安全：用数据库最新余额 + 聚合浮盈，避免覆盖其它事务（入金/出金/手续费）对 balance 的修改
    // 使用 $queryRaw 原子读 + 写，不依赖事务开头的快照 account.balance
    await prisma.$executeRaw`
      UPDATE "user_strategy_accounts"
      SET "total_unrealized_pnl" = ${totalUnrealized},
          "equity" = "balance" + ${totalUnrealized},
          "updated_at" = NOW()
      WHERE "id" = ${accountId}
    `
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
    
    const [items, total] = await Promise.all([
      this.prisma.position.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.position.count({ where }),
    ])

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
    const position = await this.prisma.position.findUnique({
      where: { id: dto.positionId },
      include: {
        account: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    })

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
      throw new Error(`仓位 ${dto.positionId} 缺少交易所信息，无法执行平仓操作`)
    }
    
    const exchangeId = position.exchangeId as ExchangeId
    const marketType = position.marketType as MarketType
    
    // 4. 确定订单方向：平多单需要卖出，平空单需要买入
    const orderSide = position.positionSide === PositionSide.LONG ? 'sell' : 'buy'

    // 5. 调用交易服务下市价平仓单
    try {
      const order = await this.tradingService.placeOrder(
        position.account.userId,
        exchangeId,
        marketType,
        {
          symbol: position.symbol,
          marketType,
          side: orderSide,
          type: 'market',
          amount: closeQuantity.toNumber(),
          reduceOnly: true, // 平仓单设置为 reduceOnly
        },
      )

      // 6. 返回平仓结果
      return {
        success: true,
        orderId: order.id,
        positionId: dto.positionId,
        filledQuantity: order.filled.toString(),
        averagePrice: order.price?.toString(),
        message: dto.note || '市价平仓成功',
      }
    } catch (error) {
      // 记录交易所错误并转换为业务异常
      console.error('交易所平仓失败', {
        positionId: dto.positionId,
        symbol: position.symbol,
        exchangeId,
        error,
      })
      throw error // 重新抛出让上层处理
    }
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
}

