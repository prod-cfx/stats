import { Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'
import type { QueryRealtimeWhaleAlertDto, RealtimeWhaleAlertDto } from './dto/realtime-whale-alert.dto'
import { WhaleAlertSide } from './dto/realtime-whale-alert.dto'
import { Prisma } from '@prisma/client'

@Injectable()
export class WhaleAlertService {
  private readonly logger = new Logger(WhaleAlertService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取 Hyperliquid 鲸鱼持仓预警的“实时”列表
   *
   * - 默认返回最近 24 小时、名义价值 >= 100 万 USD 的记录
   * - 支持按 symbol 过滤
   * - 结果按 create_time 倒序排列
   */
  async getRealtimeAlerts(query: QueryRealtimeWhaleAlertDto): Promise<RealtimeWhaleAlertDto[]> {
    const where: Prisma.HyperliquidWhaleAlertWhereInput = {}

    if (query.symbol) {
      where.symbol = query.symbol
    }

    const minValueUsd =
      typeof query.min_position_value_usd === 'number' ? query.min_position_value_usd : 1_000_000

    if (minValueUsd > 0) {
      where.positionValueUsd = {
        gte: new Prisma.Decimal(minValueUsd),
      }
    }

    const since =
      query.since != null
        ? new Date(query.since)
        : new Date(Date.now() - 24 * 60 * 60 * 1000)

    if (!Number.isNaN(since.getTime())) {
      // 这里无需保留已有的 createTime 条件，统一使用 gte 作为时间下界
      where.createTime = {
        gte: since,
      }
    }

    const limit = Math.min(query.limit ?? 50, 200)

    this.logger.debug(
      `Fetching realtime whale alerts with criteria: ${JSON.stringify({
        symbol: query.symbol,
        minValueUsd,
        since: since.toISOString(),
        limit,
      })}`,
    )

    const rows = await this.prisma.hyperliquidWhaleAlert.findMany({
      where,
      orderBy: {
        createTime: 'desc',
      },
      take: limit,
    })

    return rows.map(row => {
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
  }
}







