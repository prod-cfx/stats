import type {
  AggregatedLiquidationSummaryDto,
  ExchangeLiquidationResponseDto,
  ExchangeLiquidationRowDto,
  LiquidationSummaryItemDto,
  LiquidationTimeframe,
} from './dto/aggregated-liquidation.dto'
import { Injectable, NotFoundException } from '@nestjs/common'
// Nest 注入需要运行时引用 PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'
import { LIQUIDATION_TIMEFRAMES } from './dto/aggregated-liquidation.dto'
@Injectable()
export class AggregatedLiquidationService {
  private static readonly AGGREGATED_EXCHANGE_CODE = 'AGGREGATED'

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取指定 symbol 的多时间框爆仓汇总（用于前端顶部 summary 卡片）
   *
   * 约定：
   * - 使用 AggregatedLiquidationHistory 表
   * - 对每个 timeframe，从该 interval 最新的 timestamp 上汇总所有 exchange 的 long/short
   */
  async getSummary(symbol: string): Promise<AggregatedLiquidationSummaryDto> {
    const items: LiquidationSummaryItemDto[] = []

    for (const timeframe of LIQUIDATION_TIMEFRAMES) {
      const item = await this.getSingleTimeframeSummary(symbol, timeframe)
      if (item) {
        items.push(item)
      }
    }

    if (items.length === 0) {
      throw new NotFoundException(`No aggregated liquidation history found for symbol ${symbol}`)
    }

    return {
      symbol,
      items,
    }
  }

  /**
   * 获取指定 symbol + timeframe 下，按交易所拆分的最新爆仓数据
   *
   * - 先找到该 symbol+interval 的最新时间点 T
   * - 再取所有 timestamp=T 的记录，按 exchangeCode 聚合，并追加 TOTAL 行
   */
  async getExchangeBreakdown(
    symbol: string,
    timeframe: LiquidationTimeframe,
  ): Promise<ExchangeLiquidResponse> {
    const client = this.prisma.getClient()

    const latest = await client.aggregatedLiquidationHistory.findFirst({
      where: {
        symbol,
        interval: timeframe,
      },
      orderBy: {
        timestamp: 'desc',
      },
    })

    if (!latest) {
      throw new NotFoundException(
        `No aggregated liquidation history found for symbol ${symbol} and interval ${timeframe}`,
      )
    }

    const rows = await client.aggregatedLiquidationHistory.findMany({
      where: {
        symbol,
        interval: timeframe,
        timestamp: latest.timestamp,
      },
      orderBy: {
        exchangeCode: 'asc',
      },
    })

    const detailRows = rows.filter(
      row => row.exchangeCode !== AggregatedLiquidationService.AGGREGATED_EXCHANGE_CODE,
    )
    const aggregatedRows = rows.filter(
      row => row.exchangeCode === AggregatedLiquidationService.AGGREGATED_EXCHANGE_CODE,
    )

    // 如果同时存在聚合行和交易所明细行，只使用交易所明细行计算；
    // 若只有聚合行，则退化为以聚合行为明细行返回。
    const baseRows = detailRows.length > 0 ? detailRows : aggregatedRows

    // 对 baseRows 进行二次聚合，确保每个交易所只有一行（防止数据库中存在同一时间点的重复数据）
    const groupedMap = new Map<string, { longUsd: number; shortUsd: number }>()
    for (const row of baseRows) {
      const current = groupedMap.get(row.exchangeCode) || { longUsd: 0, shortUsd: 0 }
      groupedMap.set(row.exchangeCode, {
        longUsd: current.longUsd + Number(row.longLiquidationUsd),
        shortUsd: current.shortUsd + Number(row.shortLiquidationUsd),
      })
    }

    const perExchange: ExchangeLiquidationRowDto[] = Array.from(groupedMap.entries()).map(
      ([exchangeCode, data]) => {
        const longUsd = data.longUsd
        const shortUsd = data.shortUsd
        const amountUsd = longUsd + shortUsd
        const longShare = amountUsd > 0 ? longUsd / amountUsd : 0

        return {
          exchange: exchangeCode,
          symbol,
          timeframe,
          amountUsd,
          longUsd,
          shortUsd,
          longShare,
        }
      },
    )

    perExchange.sort((a, b) => b.amountUsd - a.amountUsd)

    const totalLong = perExchange.reduce((sum, row) => sum + row.longUsd, 0)
    const totalShort = perExchange.reduce((sum, row) => sum + row.shortUsd, 0)
    const totalAmount = totalLong + totalShort
    const totalLongShare = totalAmount > 0 ? totalLong / totalAmount : 0

    const totalRow: ExchangeLiquidationRowDto = {
      exchange: 'TOTAL',
      symbol,
      timeframe,
      amountUsd: totalAmount,
      longUsd: totalLong,
      shortUsd: totalShort,
      longShare: totalLongShare,
      isTotal: true,
    }

    return {
      symbol,
      timeframe,
      rows: [totalRow, ...perExchange],
    }
  }

  private async getSingleTimeframeSummary(
    symbol: string,
    timeframe: LiquidationTimeframe,
  ): Promise<LiquidationSummaryItemDto | null> {
    const client = this.prisma.getClient()

    try {
      const latest = await client.aggregatedLiquidationHistory.findFirst({
        where: {
          symbol,
          interval: timeframe,
        },
        orderBy: {
          timestamp: 'desc',
        },
      })

      if (!latest) {
        return null
      }

      const rows = await client.aggregatedLiquidationHistory.findMany({
        where: {
          symbol,
          interval: timeframe,
          timestamp: latest.timestamp,
        },
      })

      if (!rows.length) {
        return null
      }

      // 如果存在 AGGREGATED 行，则直接使用该行，避免重复汇总
      const aggregatedRow = rows.find(
        row => row.exchangeCode === AggregatedLiquidationService.AGGREGATED_EXCHANGE_CODE,
      )

      if (aggregatedRow) {
        const longUsd = Number(aggregatedRow.longLiquidationUsd)
        const shortUsd = Number(aggregatedRow.shortLiquidationUsd)

        return {
          timeframe,
          totalUsd: longUsd + shortUsd,
          longUsd,
          shortUsd,
        }
      }

      // 否则对同一 timestamp 的多交易所数据进行汇总
      const { longUsd, shortUsd } = rows.reduce(
        (acc, row) => {
          acc.longUsd += Number(row.longLiquidationUsd)
          acc.shortUsd += Number(row.shortLiquidationUsd)
          return acc
        },
        { longUsd: 0, shortUsd: 0 },
      )

      if (longUsd === 0 && shortUsd === 0) {
        return null
      }

      return {
        timeframe,
        totalUsd: longUsd + shortUsd,
        longUsd,
        shortUsd,
      }
    } catch (error) {
      // 兼容部分环境中 MarketTimeframe 枚举尚未包含某些 interval（例如 12h/24h）导致的枚举错误，
      // 在这种情况下跳过该 timeframe，而不是让整个聚合失败。
      if (
        error instanceof Error &&
        error.message.includes('invalid input value for enum "MarketTimeframe"')
      ) {
        return null
      }
      throw error
    }
  }
}

type ExchangeLiquidResponse = ExchangeLiquidationResponseDto







