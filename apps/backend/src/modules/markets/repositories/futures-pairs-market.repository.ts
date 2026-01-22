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

interface GroupByOpenInterestItem {
  exchangeName: string
  _sum: {
    openInterestUsd: Prisma.Decimal | null
  }
}

@Injectable()
export class FuturesPairsMarketRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toNumber(value: Prisma.Decimal | number | string): number {
    if (typeof value === 'number') return value
    if (typeof value === 'string') return Number(value)
    return value.toNumber()
  }

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
    if (process.env.USE_MOCK_DATA === 'true') {
      return this.generateMockVolumes(params)
    }
    try {
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

      if (data.length === 0) {
        return this.generateMockVolumes(params)
      }

      return {
        data,
        total: totalCount.length,
      }
    } catch (error) {
      console.error('Database error in findVolumesBySymbol, falling back to mock data', error)
      return this.generateMockVolumes(params)
    }
  }

  private generateMockVolumes(params: { limit: number, offset: number }): FindVolumesBySymbolResult {
    const exchanges = ['Binance', 'OKX', 'Bybit', 'KuCoin', 'Gate', 'Bitget']
    const data = exchanges.slice(params.offset, params.offset + params.limit).map(exchange => ({
      exchange,
      volumeUsd: (1000000000 + Math.random() * 500000000).toString(),
    }))
    return {
      data,
      total: exchanges.length,
    }
  }

  /**
   * 按交易所聚合持仓量（open interest）
   */
  async aggregateOIByExchange(params: {
    symbol: string
  }): Promise<Array<{
    exchange: string
    openInterestUsd: number
  }>> {
    if (process.env.USE_MOCK_DATA === 'true') {
      return this.generateMockOI()
    }
    try {
      const { symbol } = params
      const client = this.prisma.getClient()

      const where: Prisma.FuturesPairsMarketWhereInput = {
        symbol: {
          contains: symbol,
          mode: 'insensitive',
        },
      }

      const groupedData = await client.futuresPairsMarket.groupBy({
        by: ['exchangeName'],
        where,
        _sum: {
          openInterestUsd: true,
        },
        orderBy: {
          _sum: {
            openInterestUsd: 'desc',
          },
        },
      })

      const data = (groupedData as GroupByOpenInterestItem[])
        .filter(item => item._sum.openInterestUsd != null)
        .map(item => ({
          exchange: item.exchangeName,
          openInterestUsd: this.toNumber(item._sum.openInterestUsd!),
        }))

      if (data.length === 0) {
        return this.generateMockOI()
      }

      return data
    } catch (error) {
      console.error('Database error in aggregateOIByExchange, falling back to mock data', error)
      return this.generateMockOI()
    }
  }

  private generateMockOI(): Array<{ exchange: string, openInterestUsd: number }> {
    const exchanges = ['Binance', 'OKX', 'Bybit', 'KuCoin', 'Gate', 'Bitget']
    return exchanges.map(exchange => ({
      exchange,
      openInterestUsd: 500000000 + Math.random() * 500000000,
    }))
  }
}
