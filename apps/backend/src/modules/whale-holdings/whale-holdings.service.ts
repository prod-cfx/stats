import type { QueryWhaleHoldingsDto, WhaleHoldingDto } from './dto/whale-holdings.dto'
import { Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
// Nest 注入需要运行时引用 PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

interface RawWhaleHoldingRow {
  user_address: string
  symbol: string
  position_size: Prisma.Decimal
  entry_price: Prisma.Decimal
  liquidation_price: Prisma.Decimal
  position_value_usd: Prisma.Decimal
  position_action: number
  create_time: Date
}

@Injectable()
export class WhaleHoldingsService {
  private readonly logger = new Logger(WhaleHoldingsService.name)

  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  /**
   * 基于 Hyperliquid Whale Alert 数据，近实时估算“当前鲸鱼持仓”列表：
   * - 以 (user_address, symbol) 为维度，取最新一条记录
   * - 仅保留 position_action = 1（开仓）的记录
   * - 可按 symbol / 名义价值 / 时间范围过滤，并按名义价值倒序
   */
  async getCurrentHoldings(query: QueryWhaleHoldingsDto): Promise<WhaleHoldingDto[]> {
    const timeRangeHours = query.timeRangeHours ?? 24
    const minPositionValueUsd = query.minPositionValueUsd ?? 1_000_000
    const limit = query.limit ?? 100

    const now = new Date()
    const from = new Date(now.getTime() - timeRangeHours * 60 * 60 * 1000)

    this.logger.log(
      `Fetching whale holdings from HyperliquidWhaleAlert: symbol=${
        query.symbol ?? '*'
      }, minValueUsd=${minPositionValueUsd}, from=${from.toISOString()}, limit=${limit}`,
    )

    const client = this.getClient()

    // 使用 DISTINCT ON (PostgreSQL) 为每个 (user_address, symbol) 选出最新一条记录
    const symbolCondition = query.symbol
      ? Prisma.sql`AND symbol = ${query.symbol}`
      : Prisma.sql``

    const rows = (await client.$queryRaw(Prisma.sql`
      WITH latest_positions AS (
        SELECT DISTINCT ON (user_address, symbol)
          user_address,
          symbol,
          position_size,
          entry_price,
          liquidation_price,
          position_value_usd,
          position_action,
          create_time
        FROM hyperliquid_whale_alerts
        WHERE create_time >= ${from}
          ${symbolCondition}
        ORDER BY user_address, symbol, create_time DESC
      )
      SELECT *
      FROM latest_positions
      WHERE position_action = 1
        AND position_value_usd >= ${minPositionValueUsd}
      ORDER BY position_value_usd DESC
      LIMIT ${limit};
    `)) as RawWhaleHoldingRow[]

    return rows.map(row => {
      const positionSize = Number(row.position_size)
      const positionValueUsd = Number(row.position_value_usd)
      const entryPrice = Number(row.entry_price)
      const liquidationPrice = Number(row.liquidation_price)

      const side: 'LONG' | 'SHORT' = positionSize >= 0 ? 'LONG' : 'SHORT'

      const dto: WhaleHoldingDto = {
        userAddress: row.user_address,
        symbol: row.symbol,
        side,
        positionSize,
        positionValueUsd,
        entryPrice,
        liquidationPrice,
        createTime: row.create_time.toISOString(),
      }

      return dto
    })
  }
}


