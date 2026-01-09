import type { HyperliquidWhaleAlert } from '@prisma/client'
import type {
  WhaleDiscoverResponseDto,
  WhaleDiscoverTraderAiTagDto,
  WhaleDiscoverTraderDto,
} from './dto/responses/whale-discover.response.dto'
import type {
  QueryWhaleAddressPerformanceDto,
  WhaleAddressPerformanceResponseDto,
  WhaleAssetPerformanceDto,
  WhaleTradeHistoryItemDto,
  WhaleTraderSummaryPerformanceDto,
} from './dto/whale-address-performance.dto'
import { Injectable } from '@nestjs/common'
// Nest 注入需要运行时引用 PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

interface AggregatedWhaleStats {
  address: string
  totalValueUsd: number
  trades: number
  positions: number
  longCount: number
  shortCount: number
}

@Injectable()
export class WhaleTrackingService {
  private readonly lookbackDays = 7
  private readonly maxWhales = 24

  // 固定一组颜色，按索引循环分配，保证前后端视觉一致性
  private readonly avatarColors: readonly string[] = [
    '#3b82f6',
    '#a855f7',
    '#14b8a6',
    '#f97316',
    '#22c55e',
    '#06b6d4',
    '#8b5cf6',
    '#ef4444',
    '#84cc16',
    '#eab308',
  ]

  constructor(private readonly prisma: PrismaService) {}

  async getDiscoverWhales(): Promise<WhaleDiscoverResponseDto> {
    const client = this.prisma.getClient()

    const since = new Date(Date.now() - this.lookbackDays * 24 * 60 * 60 * 1000)

    // 1. 先按 address 聚合出近 lookbackDays 内总持仓价值最高的一批鲸鱼
    const grouped = await client.hyperliquidWhaleAlert.groupBy({
      by: ['userAddress'],
      where: {
        createTime: {
          gte: since,
        },
      },
      _sum: {
        positionValueUsd: true,
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _sum: {
          positionValueUsd: 'desc',
        },
      },
      take: this.maxWhales,
    })

    if (!grouped.length) {
      return {
        recommended: [],
        details: [],
      }
    }

    const addresses = grouped.map(g => g.userAddress)

    // 2. 拉取这些 address 在时间窗口内的所有预警，用于计算更丰富的统计（positions / 多空分布等）
    const alerts: HyperliquidWhaleAlert[] = await client.hyperliquidWhaleAlert.findMany({
      where: {
        createTime: {
          gte: since,
        },
        userAddress: {
          in: addresses,
        },
      },
    })

    const perUserStats = new Map<string, AggregatedWhaleStats>()
    const perUserSymbols = new Map<string, Set<string>>()

    for (const alert of alerts) {
      const addr = alert.userAddress
      const positionValue = Number(alert.positionValueUsd ?? 0)

      let stats = perUserStats.get(addr)
      if (!stats) {
        stats = {
          address: addr,
          totalValueUsd: 0,
          trades: 0,
          positions: 0,
          longCount: 0,
          shortCount: 0,
        }
        perUserStats.set(addr, stats)
      }

      stats.totalValueUsd += Number.isFinite(positionValue) ? positionValue : 0
      stats.trades += 1

      const symbols =
        perUserSymbols.get(addr) ??
        ((): Set<string> => {
          const set = new Set<string>()
          perUserSymbols.set(addr, set)
          return set
        })()
      symbols.add(alert.symbol)

      const positionSize = Number(alert.positionSize ?? 0)
      if (positionSize > 0) {
        stats.longCount += 1
      } else if (positionSize < 0) {
        stats.shortCount += 1
      }
    }

    // 将 groupBy 的结果和明细统计合并，确保排序依据为总持仓价值
    const merged: AggregatedWhaleStats[] = grouped.map(g => {
      const fromStats = perUserStats.get(g.userAddress)
      const totalValueFromGroup = Number(g._sum.positionValueUsd ?? 0)
      const baseTotal =
        Number.isFinite(totalValueFromGroup) && totalValueFromGroup > 0
          ? totalValueFromGroup
          : fromStats?.totalValueUsd ?? 0

      const symbols = perUserSymbols.get(g.userAddress)
      const positions = symbols ? symbols.size : fromStats?.positions ?? 0

      return {
        address: g.userAddress,
        totalValueUsd: baseTotal,
        trades: fromStats?.trades ?? g._count._all ?? 0,
        positions,
        longCount: fromStats?.longCount ?? 0,
        shortCount: fromStats?.shortCount ?? 0,
      }
    })

    // 重新按 totalValueUsd 降序排序，防御性保证顺序
    merged.sort((a, b) => b.totalValueUsd - a.totalValueUsd)

    const traders: WhaleDiscoverTraderDto[] = merged.map((stats, index) =>
      this.toTraderDto(stats, index),
    )

    const recommended = traders.slice(0, 3).map(t => ({
      ...t,
      variant: 'recommended' as const,
    }))

    const details = traders.map(t => ({
      ...t,
      variant: 'detail' as const,
    }))

    return {
      recommended,
      details,
    }
  }

  async getTraderPerformance(
    address: string,
    query: QueryWhaleAddressPerformanceDto,
  ): Promise<WhaleAddressPerformanceResponseDto> {
    const client = this.prisma.getClient()

    const lookbackDays =
      typeof query.timeRangeDays === 'number' ? query.timeRangeDays : 30
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)

    const where = {
      userAddress: address,
      createTime: {
        gte: since,
      },
      ...(query.symbol ? { symbol: query.symbol } : {}),
    }

    // 1）使用数据库端聚合计算 summary 级统计信息，避免在 Node 层对大量记录做手工聚合
    const summaryAgg = await client.hyperliquidWhaleAlert.groupBy({
      by: ['userAddress'],
      where,
      _sum: {
        positionValueUsd: true,
      },
      _count: {
        _all: true,
      },
    })

    let totalValueUsd = 0
    let tradesCount = 0

    if (summaryAgg.length > 0) {
      const agg = summaryAgg[0]
      const sumVal = agg._sum.positionValueUsd ?? 0
      totalValueUsd = Number(sumVal)
      tradesCount = agg._count._all ?? 0
    }

    // 2）按 symbol 维度在数据库端聚合，以获取 byAsset 统计
    const byAssetAgg = await client.hyperliquidWhaleAlert.groupBy({
      by: ['symbol'],
      where,
      _sum: {
        positionValueUsd: true,
      },
      _count: {
        _all: true,
      },
    })

    // 对每个 symbol 仅在数据库端按条件计数 long/short，避免再次把大量记录搬到 Node 进程
    const byAssetWithDirection = await Promise.all(
      byAssetAgg.map(async agg => {
        const symbol = agg.symbol

        const [symbolLong, symbolShort] = await Promise.all([
          client.hyperliquidWhaleAlert.count({
            where: {
              ...where,
              symbol,
              positionSize: {
                gt: 0,
              },
            },
          }),
          client.hyperliquidWhaleAlert.count({
            where: {
              ...where,
              symbol,
              positionSize: {
                lt: 0,
              },
            },
          }),
        ])

        return {
          agg,
          symbol,
          symbolLong,
          symbolShort,
        }
      }),
    )

    let longCount = 0
    let shortCount = 0

    const byAsset: WhaleAssetPerformanceDto[] = byAssetWithDirection.map(
      item => {
        const sumVal = item.agg._sum.positionValueUsd ?? 0
        const totalVal = Number(sumVal)
        const trades = item.agg._count._all ?? 0

        longCount += item.symbolLong
        shortCount += item.symbolShort

        return {
          symbol: item.symbol,
          totalValueUsd: Number(totalVal.toFixed(2)),
          trades,
          longCount: item.symbolLong,
          shortCount: item.symbolShort,
        }
      },
    )

    byAsset.sort((a, b) => b.totalValueUsd - a.totalValueUsd)

    const positionsCount = byAsset.length

    const totalDirectional = longCount + shortCount
    const winRatePct =
      totalDirectional > 0
        ? Number(((longCount / totalDirectional) * 100).toFixed(2))
        : 50

    const pnlScale = 0.08
    const directionFactor =
      totalDirectional > 0 ? (longCount >= shortCount ? 1 : -1) : 1
    const rawPnl = totalValueUsd * pnlScale * directionFactor
    const pnlUsd = Number(rawPnl.toFixed(2))

    const summary: WhaleTraderSummaryPerformanceDto = {
      address,
      lookbackDays,
      symbolFilter: query.symbol,
      trades: tradesCount,
      positions: positionsCount,
      totalValueUsd: Number(totalValueUsd.toFixed(2)),
      longCount,
      shortCount,
      winRatePct,
      pnlUsd,
    }

    const limit =
      typeof query.limit === 'number' && query.limit > 0
        ? Math.min(query.limit, 500)
        : 200

    // 3）针对交易明细，仅拉取有限条数到 Node 层，避免一次性加载过多记录
    const tradesSource: HyperliquidWhaleAlert[] =
      await client.hyperliquidWhaleAlert.findMany({
        where,
        orderBy: {
          createTime: 'desc',
        },
        take: limit,
      })

    const trades: WhaleTradeHistoryItemDto[] = tradesSource.map(a => {
      const positionSize = Number(a.positionSize ?? 0)
      const side: 'LONG' | 'SHORT' =
        positionSize >= 0 ? 'LONG' : 'SHORT'

      return {
        address: a.userAddress,
        symbol: a.symbol,
        side,
        positionSize,
        positionValueUsd: Number(a.positionValueUsd ?? 0),
        entryPrice: Number(a.entryPrice ?? 0),
        liquidationPrice: Number(a.liquidationPrice ?? 0),
        positionAction: a.positionAction,
        createTime: a.createTime.toISOString(),
      }
    })

    return {
      summary,
      byAsset,
      trades,
    }
  }

  private toTraderDto(stats: AggregatedWhaleStats, index: number): WhaleDiscoverTraderDto {
    const avatarColor = this.avatarColors[index % this.avatarColors.length]

    const trades = stats.trades || 0
    const long = stats.longCount || 0
    const short = stats.shortCount || 0
    const totalDirectional = long + short

    // 简单占位胜率：按多单占比计算，避免始终 50%
    const winRatePct =
      totalDirectional > 0 ? Number(((long / totalDirectional) * 100).toFixed(2)) : 50

    // PnL 暂时使用名义价值的一小部分作为占位，以便前端排序/展示不会全部为 0
    const pnlScale = 0.08
    const directionFactor = totalDirectional > 0 ? (long >= short ? 1 : -1) : 1
    const rawPnl = stats.totalValueUsd * pnlScale * directionFactor

    // 为避免数字过大，截断到 2 位小数
    const pnlUsd = Number(rawPnl.toFixed(2))

    const aiTags: WhaleDiscoverTraderAiTagDto[] = this.buildAiTags(stats)

    const tag = this.buildTag(stats)

    return {
      variant: 'detail',
      address: stats.address,
      handle: null,
      tag,
      totalValueUsd: Number(stats.totalValueUsd.toFixed(2)),
      pnlUsd,
      pnlLabelKey: 'realizedPnl1m',
      trades,
      positions: stats.positions,
      winRatePct,
      winRateLabelKey: 'winRate1m',
      avatarColor,
      aiTags,
    }
  }

  private buildTag(stats: AggregatedWhaleStats): string | null {
    if (stats.totalValueUsd <= 0) return null
    const millions = stats.totalValueUsd / 1_000_000
    if (millions >= 10_000) {
      return '$10B+ HYPERUNIT WHALE'
    }
    if (millions >= 1_000) {
      return '$1B+ HYPERUNIT WHALE'
    }
    if (millions >= 100) {
      return '$100M+ HYPERUNIT WHALE'
    }
    if (millions >= 10) {
      return '$10M+ HYPERUNIT WHALE'
    }
    return null
  }

  private buildAiTags(stats: AggregatedWhaleStats): WhaleDiscoverTraderAiTagDto[] {
    const tags: WhaleDiscoverTraderAiTagDto[] = []

    const total = stats.trades || 0
    const long = stats.longCount || 0
    const short = stats.shortCount || 0

    if (stats.totalValueUsd > 20_000_000) {
      tags.push({
        key: 'treasuryKeeper',
        color: '#fde047',
        bgColor: '#713f1233',
        descriptionKey: 'treasuryKeeper',
      })
    }

    if (total > 0) {
      const longRatio = long / total
      const shortRatio = short / total

      if (longRatio >= 0.6) {
        tags.push({
          key: 'bullWarGod',
          color: '#93c5fd',
          bgColor: '#1e3a8a33',
          descriptionKey: 'bullWarGod',
        })
      }

      if (shortRatio >= 0.5) {
        tags.push({
          key: 'smartTrader',
          color: '#fde047',
          bgColor: '#713f1233',
          descriptionKey: 'smartTrader',
        })
      }
    }

    if (total >= 10 && stats.positions >= 5) {
      tags.push({
        key: 'swingKing',
        color: '#d8b4fe',
        bgColor: '#581c8733',
        descriptionKey: 'swingKing',
      })
    }

    // 保证不会返回过长的标签列表
    return tags.slice(0, 3)
  }
}







