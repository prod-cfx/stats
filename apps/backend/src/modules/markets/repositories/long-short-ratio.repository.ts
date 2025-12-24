import type { LongShortRatio as LongShortRatioModel, Prisma } from '@prisma/client'
import { Injectable } from '@nestjs/common'
// Nest 注入需要运行时引用 PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

export type LongShortRatio = LongShortRatioModel

export interface LongShortRatioQuery {
  tradingPairId: string
  interval: string
  from?: Date
  to?: Date
  limit?: number
}

export interface LongShortRatioUpsertInput {
  tradingPairId: string
  interval: string
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
    const client = this.getClient()
    const { tradingPairId, interval, from, to, limit = 500 } = query

    const where: Prisma.LongShortRatioWhereInput = {
      tradingPairId,
    }
    // interval 在 DB 侧已由 ENUM 约束，且请求 DTO 也限制了取值范围
    // 这里使用 any 以兼容 Prisma Client 未导出 enum 类型的场景
    where.interval = interval as any

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

    return client.longShortRatio.upsert({
      where: {
        tradingPairId_interval_timestamp: {
          tradingPairId,
          interval,
          timestamp,
        },
      },
      create: {
        tradingPairId,
        interval,
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


