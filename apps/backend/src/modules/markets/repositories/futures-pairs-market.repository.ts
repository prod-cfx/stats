import type { Prisma } from '@prisma/client'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

export interface VolumeByExchange {
  exchange: string
  volumeUsd: string
}

export interface FindVolumesBySymbolResult {
  data: VolumeByExchange[]
  total: number
}

interface GroupByItem {
  exchangeName: string
  _sum: {
    volumeUsd: Prisma.Decimal | null
  }
}

@Injectable()
export class FuturesPairsMarketRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查询指定币种的各交易所聚合交易量
   *
   * @param params - 查询参数
   * @param params.symbol - 币种符号
   * @param params.limit - 每页数量
   * @param params.offset - 偏移量
   * @returns 分页的交易量数据
   */
  async findVolumesBySymbol(params: {
    symbol: string
    limit: number
    offset: number
  }): Promise<FindVolumesBySymbolResult> {
    const { symbol, limit, offset } = params
    const client = this.prisma.getClient()

    // 构建 where 条件
    const where: Prisma.FuturesPairsMarketWhereInput = {
      symbol: {
        contains: symbol,
        mode: 'insensitive',
      },
    }

    // 先获取总数（所有交易所数量）
    const totalCount = await client.futuresPairsMarket.groupBy({
      by: ['exchangeName'],
      where,
    })

    // 按交易所分组，聚合交易量（带分页）
    const groupedData = await client.futuresPairsMarket.groupBy({
      by: ['exchangeName'],
      where,
      _sum: {
        volumeUsd: true,
      },
      orderBy: {
        _sum: {
          volumeUsd: 'desc',
        },
      },
      skip: offset,
      take: limit,
    })

    // 转换为统一格式
    const data = (groupedData as GroupByItem[])
      .filter(item => item._sum.volumeUsd != null)
      .map(item => ({
        exchange: item.exchangeName,
        volumeUsd: item._sum.volumeUsd!.toString(),
      }))

    return {
      data,
      total: totalCount.length,
    }
  }
}
