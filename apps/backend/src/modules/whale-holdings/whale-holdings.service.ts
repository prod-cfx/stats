import type { QueryWhaleHoldingsDto, WhaleHoldingDto } from './dto/whale-holdings.dto'
import { Injectable, Logger } from '@nestjs/common'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
// Nest 注入需要运行时引用 PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class WhaleHoldingsService {
  private readonly logger = new Logger(WhaleHoldingsService.name)

  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  /**
   * 基于 HyperliquidWhalePosition 数据获取当前鲸鱼持仓列表：
   * - 使用 (userAddress, symbol) 联合唯一约束，每个用户+币种只有最新快照
   * - 可按 symbol / 名义价值过滤，并按名义价值倒序
   */
  async getCurrentHoldings(query: QueryWhaleHoldingsDto): Promise<BasePaginationResponseDto<WhaleHoldingDto>> {
    const minPositionValueUsd = query.minPositionValueUsd ?? 1_000_000
    const limit = query.limit ?? 100
    const page = query.page ?? 1
    const skip = (page - 1) * limit

    this.logger.log(
      `Fetching whale holdings from HyperliquidWhalePosition: symbol=${
        query.symbol ?? '*'
      }, minValueUsd=${minPositionValueUsd}, limit=${limit}, page=${page}`,
    )

    const client = this.getClient()

    const where = {
      positionValueUsd: {
        gte: minPositionValueUsd,
      },
      ...(query.symbol && { symbol: query.symbol }),
    }

    const orderBy = { positionValueUsd: 'desc' as const }

    const [rows, total] = await Promise.all([
      client.hyperliquidWhalePosition.findMany({
        where,
        orderBy,
        take: limit,
        skip,
      }),
      client.hyperliquidWhalePosition.count({ where }),
    ])

    const items = rows.map(row => {
      const rawPositionSize = Number(row.positionSize)
      const positionSize = Math.abs(rawPositionSize)
      const positionValueUsd = Number(row.positionValueUsd)
      const entryPrice = Number(row.entryPrice)
      const liquidationPrice = row.liquidationPrice ? Number(row.liquidationPrice) : null
      const pnl = row.pnl ? Number(row.pnl) : null
      const roe = row.roe ? Number(row.roe) : null

      const side: 'LONG' | 'SHORT' = rawPositionSize < 0 ? 'SHORT' : 'LONG'

      const dto: WhaleHoldingDto = {
        userAddress: row.userAddress,
        symbol: row.symbol,
        side,
        positionSize,
        positionValueUsd,
        entryPrice,
        liquidationPrice,
        pnl,
        roe,
        leverage: row.leverage ? Number(row.leverage) : null,
        snapshotTime: row.snapshotTime.toISOString(),
      }

      return dto
    })

    return new BasePaginationResponseDto(total, page, limit, items)
  }
}
