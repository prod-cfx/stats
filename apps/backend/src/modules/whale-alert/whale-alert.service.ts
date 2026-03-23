import type {
  QueryRealtimeWhaleAlertDto,
  RealtimeWhaleAlertDto,
} from './dto/realtime-whale-alert.dto'
import type { QueryWhaleTradeDto, WhaleTradeDto } from './dto/whale-trade.dto'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import type { WhaleNotificationOrchestratorService } from '@/modules/whale-notification/services/whale-notification-orchestrator.service'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { WhaleNotificationOrchestratorService as WhaleNotificationOrchestratorServiceToken } from '@/modules/whale-notification/services/whale-notification-orchestrator.service'
// Nest 注入需要运行时引用 PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'
import { Prisma } from '@/prisma/prisma.types'
import { WhaleAlertSide } from './dto/realtime-whale-alert.dto'
import { TradeSide } from './dto/whale-trade.dto'

@Injectable()
export class WhaleAlertService {
  private readonly logger = new Logger(WhaleAlertService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(WhaleNotificationOrchestratorServiceToken)
    private readonly whaleNotificationOrchestrator: WhaleNotificationOrchestratorService,
  ) {}

  /**
   * 获取 Hyperliquid 鲸鱼持仓预警的"实时"列表
   *
   * - 默认返回最近 24 小时、名义价值 >= 1000 USD 的记录
   * - 支持按 symbol 过滤
   * - 结果按 create_time 倒序排列
   */
  async getRealtimeAlerts(query: QueryRealtimeWhaleAlertDto): Promise<BasePaginationResponseDto<RealtimeWhaleAlertDto>> {
    const where: Prisma.HyperliquidWhaleAlertWhereInput = {}

    if (query.symbol) {
      where.symbol = query.symbol
    }

    const minValueUsd =
      typeof query.min_position_value_usd === 'number' ? query.min_position_value_usd : 1_000

    if (minValueUsd > 0) {
      where.positionValueUsd = {
        gte: new Prisma.Decimal(minValueUsd),
      }
    }

    const sinceRaw =
      query.since != null ? new Date(query.since) : new Date(Date.now() - 24 * 60 * 60 * 1000)

    let sinceForQuery: Date | null = null
    if (!Number.isNaN(sinceRaw.getTime())) {
      sinceForQuery = sinceRaw
      // 这里无需保留已有的 createTime 条件，统一使用 gte 作为时间下界
      where.createTime = {
        gte: sinceRaw,
      }
    }

    const limit = Math.min(query.limit ?? 50, 200)
    const page = query.page ?? 1
    const skip = (page - 1) * limit

    this.logger.debug(
      `Fetching realtime whale alerts with criteria: ${JSON.stringify({
        symbol: query.symbol,
        minValueUsd,
        since: sinceForQuery ? sinceForQuery.toISOString() : null,
        limit,
        page,
      })}`,
    )

    const [rows, total] = await Promise.all([
      this.prisma.hyperliquidWhaleAlert.findMany({
        where,
        orderBy: {
          createTime: 'desc',
        },
        take: limit,
        skip,
      }),
      this.prisma.hyperliquidWhaleAlert.count({ where }),
    ])

    const items = rows.map(row => {
      const positionSize = Number(row.positionSize)
      const entryPrice = Number(row.entryPrice)
      const liqPrice = Number(row.liquidationPrice)
      const positionValueUsd = Number(row.positionValueUsd)

      const side: WhaleAlertSide = positionSize >= 0 ? WhaleAlertSide.Long : WhaleAlertSide.Short

      const dto: RealtimeWhaleAlertDto = {
        user_address: row.userAddress,
        symbol: row.symbol,
        position_size: positionSize,
        entry_price: entryPrice,
        liq_price: liqPrice,
        position_value_usd: positionValueUsd,
        position_action: row.positionAction,
        create_time:
          row.createTime instanceof Date
            ? row.createTime.toISOString()
            : new Date(row.createTime as unknown as string).toISOString(),
        side,
      }

      return dto
    })

    return new BasePaginationResponseDto(total, page, limit, items)
  }

  /**
   * 获取 Hyperliquid 鲸鱼交易记录
   *
   * - 默认返回最近 24 小时、交易价值 >= 1000 USD 的记录
   * - 支持按 symbol 过滤
   * - 结果按 trade_time 倒序排列
   */
  async getWhaleTrades(query: QueryWhaleTradeDto): Promise<BasePaginationResponseDto<WhaleTradeDto>> {
    const where: Prisma.HyperliquidWhaleTradeWhereInput = {}

    if (query.symbol) {
      where.symbol = query.symbol
    }

    const minValueUsd =
      typeof query.min_trade_value_usd === 'number' ? query.min_trade_value_usd : 1_000

    if (minValueUsd > 0) {
      where.tradeValueUsd = {
        gte: new Prisma.Decimal(minValueUsd),
      }
    }

    const sinceRaw =
      query.since != null ? new Date(query.since) : new Date(Date.now() - 24 * 60 * 60 * 1000)

    let sinceForQuery: Date | null = null
    if (!Number.isNaN(sinceRaw.getTime())) {
      sinceForQuery = sinceRaw
      where.tradeTime = {
        gte: sinceRaw,
      }
    }

    const limit = Math.min(query.limit ?? 50, 200)
    const page = query.page ?? 1
    const skip = (page - 1) * limit

    this.logger.debug(
      `Fetching whale trades with criteria: ${JSON.stringify({
        symbol: query.symbol,
        minValueUsd,
        since: sinceForQuery ? sinceForQuery.toISOString() : null,
        limit,
        page,
      })}`,
    )

    const [rows, total] = await Promise.all([
      this.prisma.hyperliquidWhaleTrade.findMany({
        where,
        orderBy: {
          tradeTime: 'desc',
        },
        take: limit,
        skip,
      }),
      this.prisma.hyperliquidWhaleTrade.count({ where }),
    ])

    const items = rows.map(row => {
      const tradeSize = Number(row.tradeSize)
      const price = Number(row.price)
      const tradeValueUsd = Number(row.tradeValueUsd)
      const side: TradeSide = row.side === TradeSide.Short ? TradeSide.Short : TradeSide.Long

      const dto: WhaleTradeDto = {
        user_address: row.userAddress,
        symbol: row.symbol,
        side,
        trade_size: tradeSize,
        price,
        trade_value_usd: tradeValueUsd,
        trade_time:
          row.tradeTime instanceof Date
            ? row.tradeTime.toISOString()
            : new Date(row.tradeTime as unknown as string).toISOString(),
      }

      return dto
    })

    return new BasePaginationResponseDto(total, page, limit, items)
  }

  /**
   * 获取所有活跃鲸鱼地址(用于 Adapter 订阅)
   */
  async getActiveWhaleAddresses(): Promise<string[]> {
    const rows = await this.prisma.hyperliquidWhaleAlert.findMany({
      select: { userAddress: true },
      distinct: ['userAddress'],
    })

    const addresses: string[] = []
    for (const row of rows) {
      const address = row.userAddress?.trim().toLowerCase()
      if (!address) continue
      addresses.push(address)
    }

    return addresses
  }

  /**
   * 记录鲸鱼交易(用于 Adapter 写入数据)
   */
  async recordWhaleTrade(data: {
    whaleAddress: string
    coin: string
    side: string
    tradeSize: number
    price: number
    tradeValueUsd: number
    tradeTime: Date
  }): Promise<void> {
    const { whaleAddress, coin, side, tradeSize, price, tradeValueUsd, tradeTime } = data

    const insertResult = await this.prisma.hyperliquidWhaleTrade.createMany({
      data: [{
        userAddress: whaleAddress,
        symbol: coin,
        side,
        tradeSize,
        price,
        tradeValueUsd,
        tradeTime,
      }],
      skipDuplicates: true,
    })

    if (insertResult.count === 0) {
      return
    }

    // 仅在首次插入成交时触发编排，避免重放历史成交产生重复通知
    await this.whaleNotificationOrchestrator.processTradeEvent({
      whaleAddress,
      symbol: coin,
      side,
      tradeValueUsd,
      tradeTime,
    })
  }
}
