import type { MarketTimeframe } from '@ai/shared'
import type {LongShortRatio as LongShortRatioModel} from '@prisma/client';
import { Injectable } from '@nestjs/common'
import {  Prisma } from '@prisma/client'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
// Nest 注入需要运行时引用 PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

export type LongShortRatio = LongShortRatioModel

export interface LongShortRatioQuery {
  tradingPairId: string
  interval: MarketTimeframe
  from?: Date
  to?: Date
  limit?: number
}

export interface LongShortRatioUpsertInput {
  tradingPairId: string
  interval: MarketTimeframe
  timestamp: Date
  longShortRatio: string
  longAccountRatio?: string | null
  shortAccountRatio?: string | null
  longVolume?: string | null
  shortVolume?: string | null
  longShortAccountRatio?: string | null
  source?: string
}

@Injectable()
export class LongShortRatioRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  /**
   * 按交易对 + 时间范围查询多空比时间序列
   * 默认按时间倒序返回最新的 limit 条数据
   */
  async findByPairAndTime(query: LongShortRatioQuery): Promise<LongShortRatio[]> {
    if (process.env.USE_MOCK_DATA === 'true') {
      return this.generateMockRatios(query)
    }
    try {
      const client = this.getClient()
      const { tradingPairId, interval, from, to, limit = 500 } = query
      const prismaInterval = mapTimeframe(interval)

      const where: Prisma.LongShortRatioWhereInput = {
        tradingPairId,
        interval: prismaInterval as any,
      }

      if (from || to) {
        where.timestamp = {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        }
      }

      // 默认按时间倒序查询，返回最新数据
      const items = await client.longShortRatio.findMany({
        where,
        orderBy: {
          timestamp: 'desc',
        },
        take: limit,
      })

      // 反转数组使时间从旧到新排列，便于前端绘制曲线
      return items.reverse()
    } catch (error) {
      console.error('Database error in findByPairAndTime, falling back to mock data', error)
      return this.generateMockRatios(query)
    }
  }

  private generateMockRatios(query: LongShortRatioQuery): LongShortRatio[] {
    const { tradingPairId, limit = 100 } = query
    const results: LongShortRatio[] = []
    const now = new Date()
    for (let i = 0; i < limit; i++) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000) // 1h intervals
      const ratio = 0.5 + Math.random() * 1.0 // 0.5 to 1.5
      results.push({
        id: i + 1,
        tradingPairId,
        interval: 'H1' as any,
        timestamp,
        longShortRatio: new Prisma.Decimal(ratio.toFixed(4)),
        longAccountRatio: new Prisma.Decimal((45 + Math.random() * 10).toFixed(2)),
        shortAccountRatio: new Prisma.Decimal((45 + Math.random() * 10).toFixed(2)),
        longVolume: new Prisma.Decimal((1000000 + Math.random() * 500000).toFixed(2)),
        shortVolume: new Prisma.Decimal((1000000 + Math.random() * 500000).toFixed(2)),
        longShortAccountRatio: new Prisma.Decimal((0.9 + Math.random() * 0.2).toFixed(4)),
        source: 'MOCK',
        createdAt: now,
        updatedAt: now,
      })
    }
    return results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  /**
   * 单条 upsert，用于数据拉取任务写入
   */
  async upsertOne(input: LongShortRatioUpsertInput): Promise<LongShortRatio> {
    const client = this.getClient()

    const {
      tradingPairId,
      interval,
      timestamp,
      longShortRatio,
      longAccountRatio,
      shortAccountRatio,
      longVolume,
      shortVolume,
      longShortAccountRatio,
      source = 'COINGLASS',
    } = input
    const prismaInterval = mapTimeframe(interval)

    return client.longShortRatio.upsert({
      where: {
        tradingPairId_interval_timestamp: {
          tradingPairId,
          interval: prismaInterval as any,
          timestamp,
        },
      },
      create: {
        tradingPairId,
        interval: prismaInterval as any,
        timestamp,
        longShortRatio,
        longAccountRatio,
        shortAccountRatio,
        longVolume,
        shortVolume,
        longShortAccountRatio,
        source,
      },
      update: {
        longShortRatio,
        longAccountRatio,
        shortAccountRatio,
        longVolume,
        shortVolume,
        longShortAccountRatio,
        source,
      },
    })
  }
}


