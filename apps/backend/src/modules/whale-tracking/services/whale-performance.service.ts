import type { HyperliquidWhaleAlert } from '@/prisma/prisma.types'
import type {
  QueryWhaleAddressPerformanceDto,
  WhaleAddressPerformanceResponseDto,
  WhaleAssetPerformanceDto,
  WhaleTradeHistoryItemDto,
  WhaleTraderSummaryPerformanceDto,
} from '../dto/whale-address-performance.dto'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { WhaleTrackingRepository } from '../whale-tracking.repository'

@Injectable()
export class WhalePerformanceService {
  constructor(private readonly whaleTrackingRepository: WhaleTrackingRepository) {}

  async getTraderPerformance(
    address: string,
    query: QueryWhaleAddressPerformanceDto,
  ): Promise<WhaleAddressPerformanceResponseDto> {
    const lookbackDays = typeof query.timeRangeDays === 'number' ? query.timeRangeDays : 30
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)

    const where = {
      userAddress: address,
      createTime: {
        gte: since,
      },
      ...(query.symbol ? { symbol: query.symbol } : {}),
    }

    const summaryAgg = await this.whaleTrackingRepository.groupAlertsByAddressForSummary(where)

    let totalValueUsd = 0
    let tradesCount = 0

    if (summaryAgg.length > 0) {
      const agg = summaryAgg[0]
      const sumVal = agg._sum.positionValueUsd ?? 0
      totalValueUsd = Number(sumVal)
      tradesCount = agg._count._all ?? 0
    }

    const byAssetAgg = await this.whaleTrackingRepository.groupAlertsBySymbol(where)

    const [longAgg, shortAgg] = await Promise.all([
      this.whaleTrackingRepository.groupAlertsBySymbolWithPositionFilter({
        ...where,
        positionSize: { gt: 0 },
      }),
      this.whaleTrackingRepository.groupAlertsBySymbolWithPositionFilter({
        ...where,
        positionSize: { lt: 0 },
      }),
    ])

    const longCountMap = new Map<string, number>()
    const shortCountMap = new Map<string, number>()

    for (const item of longAgg) {
      longCountMap.set(item.symbol, item._count._all)
    }

    for (const item of shortAgg) {
      shortCountMap.set(item.symbol, item._count._all)
    }

    const byAssetWithDirection = byAssetAgg.map((agg: (typeof byAssetAgg)[number]) => {
      const symbol = agg.symbol
      const symbolLong = longCountMap.get(symbol) ?? 0
      const symbolShort = shortCountMap.get(symbol) ?? 0

      return {
        agg,
        symbol,
        symbolLong,
        symbolShort,
      }
    })

    let longCount = 0
    let shortCount = 0

    const byAsset: WhaleAssetPerformanceDto[] = byAssetWithDirection.map(
      (item: (typeof byAssetWithDirection)[number]) => {
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
      totalDirectional > 0 ? Number(((longCount / totalDirectional) * 100).toFixed(2)) : 50

    const pnlScale = 0.08
    const directionFactor = totalDirectional > 0 ? (longCount >= shortCount ? 1 : -1) : 1
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
      typeof query.limit === 'number' && query.limit > 0 ? Math.min(query.limit, 500) : 200

    const tradesSource: HyperliquidWhaleAlert[] =
      await this.whaleTrackingRepository.findManyAlertsWithLimit(where, limit)

    const trades: WhaleTradeHistoryItemDto[] = tradesSource.map(a => {
      const positionSize = Number(a.positionSize ?? 0)
      const side: 'LONG' | 'SHORT' = positionSize >= 0 ? 'LONG' : 'SHORT'

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
}
