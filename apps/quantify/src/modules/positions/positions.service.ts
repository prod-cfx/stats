import type { Position, Trade } from '@prisma/client'
import type { ClosePositionDto, ClosePositionResponseDto } from './dto/close-position.dto'
import type { PositionResponseDto } from './dto/position.response.dto'
import type { PositionsQueryDto } from './dto/positions-query.dto'
import type { RecordTradeDto } from './dto/record-trade.dto'
import type { TradeResponseDto } from './dto/trade.response.dto'
import type { ExchangeId, MarketType } from '@/modules/trading/core/types'
import { Injectable } from '@nestjs/common'
import { LedgerEntryType, PositionSide, PositionStatus, Prisma, TradeSide } from '@prisma/client'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { AccountsService } from '@/modules/accounts/accounts.service'
import { StrategyAccountNotFoundException } from '@/modules/accounts/exceptions/strategy-account-not-found.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { TradingService } from '@/modules/trading/trading.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { PrismaService } from '@/prisma/prisma.service'
import { PositionInsufficientQuantityException } from './exceptions/position-insufficient-quantity.exception'
import { PositionNotFoundException } from './exceptions/position-not-found.exception'
import { TradeConflictException } from './exceptions/trade-conflict.exception'

// Prisma 7: 浠?Prisma namespace 瀵煎嚭绫诲瀷鍜屽€?
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
      // 1. 鏍￠獙璐︽埛涓庢垚浜ゅ箓绛?
      await this.ensureAccountAndNoDuplicateTrade(prisma, dto)

      // 2. 鍔犻攣鍔犺浇褰撳墠浠撲綅
      const lockedPosition = await this.loadAndLockPosition(
        prisma,
        dto.userStrategyAccountId,
        normalizedSymbol,
        dto.positionSide,
      )

      // 3. 鏍规嵁鏂瑰悜璋冩暣浠撲綅
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

    // 鏃犱粨浣嶅垯灏濊瘯鍒涘缓锛屽鐞嗗苟鍙戝敮涓€绾︽潫
    if (!existingPosition) {
      // 浠?market 瀛楁鎻愬彇 exchangeId 鍜?marketType (鏍煎紡: "exchangeId:marketType")
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
        // P2002 = Unique constraint violation锛岃鏄庡彟涓€浜嬪姟鍒氬ソ鍒涘缓浜嗗悓鏂瑰悜 OPEN 浠撲綅
        if (error.code !== 'P2002') {
          throw error
        }
        // 閲嶆柊鍔犻攣鍔犺浇
        existingPosition = await this.loadAndLockPosition(
          prisma,
          dto.userStrategyAccountId,
          normalizedSymbol,
          dto.positionSide,
        )
        if (!existingPosition) {
          // 鐞嗚涓婁笉搴斿嚭鐜帮紙闄ら潪骞跺彂鍒涘缓鍚庡張绔嬪嵆鍒犻櫎锛夛紝淇濈暀鍘熷閿欒
          throw error
        }
      }
    }

    // 鏈夊凡鏈変粨浣嶏紙鎴栧苟鍙戦噸璇曞悗鎷垮埌锛夛紝鎵ц鍔犱粨閫昏緫
    const newQty = existingPosition.quantity.add(quantity)
    const weighted = existingPosition.avgEntryPrice.mul(existingPosition.quantity).add(price.mul(quantity))
    const newAvg = weighted.div(newQty)

    // 浠庢湰娆℃垚浜よˉ榻愮己澶辩殑 exchangeId/marketType锛堜负鑰佷粨浣嶆垨杩佺Щ鍓嶆暟鎹ˉ鍏呬俊鎭級
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
        // 骞充粨鍚庤閮ㄥ垎鐨勬湭瀹炵幇鐩堜簭搴斿綋褰掗浂
        unrealizedPnl: isFullClose ? new Decimal(0) : existingPosition.unrealizedPnl,
        status: isFullClose ? PositionStatus.CLOSED : PositionStatus.OPEN,
        closedAt: isFullClose ? executedAt : existingPosition.closedAt,
      },
    })

    await this.recalculateUnrealizedAndEquity(prisma, dto.userStrategyAccountId)

    return { position: updated, realizedPnlDelta }
  }

  private async recalculateUnrealizedAndEquity(prisma: Prisma.TransactionClient, accountId: string): Promise<void> {
    // 閲嶆柊鑱氬悎璇ヨ处鎴风殑鏈疄鐜扮泩浜忥紝纭繚 equity = balance + totalUnrealizedPnl 涓嶄緷璧栧悗缁鎯呮帹閫?
    const aggregate = await prisma.position.aggregate({
      where: { userStrategyAccountId: accountId, status: PositionStatus.OPEN },
      _sum: { unrealizedPnl: true },
    })
    const totalUnrealized = aggregate._sum.unrealizedPnl ?? new Decimal(0)

    // 馃敀 骞跺彂瀹夊叏锛氱敤鏁版嵁搴撴渶鏂颁綑棰?+ 鑱氬悎娴泩锛岄伩鍏嶈鐩栧叾瀹冧簨鍔★紙鍏ラ噾/鍑洪噾/鎵嬬画璐癸級瀵?balance 鐨勪慨鏀?
    // 浣跨敤 $queryRaw 鍘熷瓙璇?+ 鍐欙紝涓嶄緷璧栦簨鍔″紑澶寸殑蹇収 account.balance
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

    // 纭繚鍒嗛〉鍙傛暟鏈夋晥鍊?
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
   * 鐢ㄦ埛涓诲姩骞充粨锛堝競浠峰崟鍏ㄥ钩鎴栭儴鍒嗗钩浠擄級
   *
   * @param dto - 骞充粨璇锋眰鍙傛暟
   * @returns 骞充粨缁撴灉
   * @throws PositionNotFoundException - 浠撲綅涓嶅瓨鍦ㄦ垨宸插叧闂?
   * @throws PositionInsufficientQuantityException - 骞充粨鏁伴噺瓒呰繃鎸佷粨鏁伴噺
   * @throws StrategyAccountNotFoundException - 璐︽埛涓嶅瓨鍦?
   */
  async closePosition(dto: ClosePositionDto): Promise<ClosePositionResponseDto> {
    // 1. 楠岃瘉浠撲綅骞惰幏鍙栫浉鍏宠处鎴蜂俊鎭紙涓€娆℃煡璇紭鍖栨€ц兘锛?
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

    // 楠岃瘉璐︽埛褰掑睘
    if (position.userStrategyAccountId !== dto.userStrategyAccountId) {
      throw new PositionNotFoundException({
        accountId: dto.userStrategyAccountId,
        symbol: position.symbol,
        positionSide: position.positionSide,
      })
    }

    // 楠岃瘉浠撲綅鐘舵€?
    if (position.status !== PositionStatus.OPEN) {
      throw new PositionNotFoundException({
        accountId: dto.userStrategyAccountId,
        symbol: position.symbol,
        positionSide: position.positionSide,
      })
    }

    // 2. 楠岃瘉骞充粨鏁伴噺
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

    // 3. 楠岃瘉骞朵娇鐢ㄦ暟鎹簱涓瓨鍌ㄧ殑 exchangeId/marketType锛堝畨鍏ㄦ€э細涓嶄俊浠诲鎴风浼犲弬锛?
    if (!position.exchangeId || !position.marketType) {
      throw new Error(`浠撲綅 ${dto.positionId} 缂哄皯浜ゆ槗鎵€淇℃伅锛屾棤娉曟墽琛屽钩浠撴搷浣渀)
    }

    const exchangeId = position.exchangeId as ExchangeId
    const marketType = position.marketType as MarketType

    // 4. 纭畾璁㈠崟鏂瑰悜锛氬钩澶氬崟闇€瑕佸崠鍑猴紝骞崇┖鍗曢渶瑕佷拱鍏?
    const orderSide = position.positionSide === PositionSide.LONG ? 'sell' : 'buy'

    // 5. 璋冪敤浜ゆ槗鏈嶅姟涓嬪競浠峰钩浠撳崟
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
          reduceOnly: true, // 骞充粨鍗曡缃负 reduceOnly
        },
      )

      // 6. 杩斿洖骞充粨缁撴灉
      return {
        success: true,
        orderId: order.id,
        positionId: dto.positionId,
        filledQuantity: order.filled.toString(),
        averagePrice: order.price?.toString(),
        message: dto.note || '甯備环骞充粨鎴愬姛',
      }
    } catch (error) {
      // 璁板綍浜ゆ槗鎵€閿欒骞惰浆鎹负涓氬姟寮傚父
      console.error('浜ゆ槗鎵€骞充粨澶辫触', {
        positionId: dto.positionId,
        symbol: position.symbol,
        exchangeId,
        error,
      })
      throw error // 閲嶆柊鎶涘嚭璁╀笂灞傚鐞?
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
