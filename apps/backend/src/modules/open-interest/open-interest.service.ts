import type {
  CreateOpenInterestDto,
  QueryOpenInterestDto,
} from './dto/open-interest.dto'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PAGINATION_CONSTANTS } from '@/common/constants/pagination.constants'
// Nest 注入需要运行时引用 PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

/**
 * 持仓量数据服务
 */
@Injectable()
export class OpenInterestService {
  private readonly logger = new Logger(OpenInterestService.name)
  private static readonly MAX_STATS_RANGE_MS = 31 * 24 * 60 * 60 * 1000

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建或更新持仓量数据
   * @param data 持仓量数据
   */
  async upsert(data: CreateOpenInterestDto) {
    try {
      const result = await this.prisma.openInterest.upsert({
        where: {
          unique_oi_record: {
            exchange: data.exchange,
            symbol: data.symbol,
            dataTimestamp: new Date(data.data_timestamp),
          },
        },
        update: {
          openInterestUsd: data.open_interest_usd,
          openInterestQuantity: data.open_interest_quantity,
          openInterestByStableCoinMargin: data.open_interest_by_stable_coin_margin,
          openInterestByCoinMargin: data.open_interest_by_coin_margin,
          openInterestQuantityByCoinMargin: data.open_interest_quantity_by_coin_margin,
          openInterestQuantityByStableCoinMargin: data.open_interest_quantity_by_stable_coin_margin,
          openInterestChangePercent5m: data.open_interest_change_percent_5m,
          openInterestChangePercent15m: data.open_interest_change_percent_15m,
          openInterestChangePercent30m: data.open_interest_change_percent_30m,
          openInterestChangePercent1h: data.open_interest_change_percent_1h,
          openInterestChangePercent4h: data.open_interest_change_percent_4h,
          openInterestChangePercent24h: data.open_interest_change_percent_24h,
        },
        create: {
          exchange: data.exchange,
          symbol: data.symbol,
          openInterestUsd: data.open_interest_usd,
          openInterestQuantity: data.open_interest_quantity,
          openInterestByStableCoinMargin: data.open_interest_by_stable_coin_margin,
          openInterestByCoinMargin: data.open_interest_by_coin_margin,
          openInterestQuantityByCoinMargin: data.open_interest_quantity_by_coin_margin,
          openInterestQuantityByStableCoinMargin: data.open_interest_quantity_by_stable_coin_margin,
          openInterestChangePercent5m: data.open_interest_change_percent_5m,
          openInterestChangePercent15m: data.open_interest_change_percent_15m,
          openInterestChangePercent30m: data.open_interest_change_percent_30m,
          openInterestChangePercent1h: data.open_interest_change_percent_1h,
          openInterestChangePercent4h: data.open_interest_change_percent_4h,
          openInterestChangePercent24h: data.open_interest_change_percent_24h,
          dataTimestamp: new Date(data.data_timestamp),
        },
      })
      
      this.logger.log(`Upserted open interest data for ${data.exchange}:${data.symbol}`)
      return result
    } catch (error) {
      this.logger.error(`Failed to upsert open interest data: ${error.message}`, error.stack)
      throw error
    }
  }

  /**
   * 批量创建或更新持仓量数据
   * @param dataList 持仓量数据列表
   */
  async batchUpsert(dataList: CreateOpenInterestDto[]) {
    if (!dataList || dataList.length === 0) {
      this.logger.warn('Batch upsert called with empty data list')
      return []
    }

    try {
      // 使用事务批量处理，避免过多并发连接
      const batchSize = 50 // 每批处理 50 条
      const results = []

      for (let i = 0; i < dataList.length; i += batchSize) {
        const batch = dataList.slice(i, i + batchSize)
        const batchResults = await Promise.all(
          batch.map(data => this.upsert(data)),
        )
        results.push(...batchResults)
      }

      this.logger.log(
        `Batch upserted ${results.length} open interest records`,
      )
      return results
    } catch (error) {
      this.logger.error(
        `Failed to batch upsert open interest data: ${error.message}`,
        error.stack,
      )
      throw error
    }
  }

  /**
   * 查询持仓量数据
   * @param query 查询条件
   */
  async query(query: QueryOpenInterestDto) {
    const where: Prisma.OpenInterestWhereInput = {}

    if (query.exchange) {
      where.exchange = query.exchange
    }

    if (query.symbol) {
      where.symbol = query.symbol
    }

    if (query.startTime || query.endTime) {
      where.dataTimestamp = {}
      if (query.startTime) {
        where.dataTimestamp.gte = new Date(query.startTime)
      }
      if (query.endTime) {
        where.dataTimestamp.lte = new Date(query.endTime)
      }
    }

    // 统一分页逻辑：复用 BasePaginationRequestDto 中的 page/limit
    const limit = query.limit ?? PAGINATION_CONSTANTS.DEFAULT_PAGE_SIZE
    const page = query.page ?? 1
    const offset = (page - 1) * limit

    const [data, total] = await Promise.all([
      this.prisma.openInterest.findMany({
        where,
        orderBy: { dataTimestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.openInterest.count({ where }),
    ])

    return {
      data,
      total,
      limit,
      offset,
    }
  }

  /**
   * 获取最新的持仓量数据
   * @param exchange 交易所
   * @param symbol 币种
   */
  async getLatest(exchange: string, symbol: string) {
    return this.prisma.openInterest.findFirst({
      where: { exchange, symbol },
      orderBy: { dataTimestamp: 'desc' },
    })
  }

  /**
   * 获取指定时间段内的持仓量统计
   * @param symbol 币种
   * @param startTime 开始时间
   * @param endTime 结束时间
   */
  async getStats(symbol: string, startTime: Date, endTime: Date) {
    if (!symbol || !startTime || !endTime) {
      throw new Error('Symbol, startTime, and endTime are required')
    }

    if (startTime >= endTime) {
      throw new Error('startTime must be before endTime')
    }

    const rangeMs = endTime.getTime() - startTime.getTime()
    if (rangeMs > OpenInterestService.MAX_STATS_RANGE_MS) {
      throw new BadRequestException('Time range cannot exceed 31 days')
    }

    interface StatsRow {
      min: Prisma.Decimal | null
      max: Prisma.Decimal | null
      avg: Prisma.Decimal | null
      data_points: bigint | null
      earliest: Prisma.Decimal | null
      latest: Prisma.Decimal | null
    }

    const statsRows = (await this.prisma.$queryRaw(
      Prisma.sql`
      WITH aggregated AS (
        SELECT
          data_timestamp,
          SUM(open_interest_usd)::numeric AS total_value
        FROM open_interest
        WHERE symbol = ${symbol}
          AND data_timestamp BETWEEN ${startTime} AND ${endTime}
        GROUP BY data_timestamp
      )
      SELECT
        MIN(total_value) AS min,
        MAX(total_value) AS max,
        AVG(total_value) AS avg,
        COUNT(*) AS data_points,
        (ARRAY_AGG(total_value ORDER BY data_timestamp ASC))[1] AS earliest,
        (ARRAY_AGG(total_value ORDER BY data_timestamp DESC))[1] AS latest
      FROM aggregated;
    `,
    )) as StatsRow[]

    const stats = statsRows[0]
    if (!stats || !stats.data_points || Number(stats.data_points) === 0) {
      return null
    }

    const max = Number(stats.max ?? 0)
    const min = Number(stats.min ?? 0)
    const avg = Number(stats.avg ?? 0)
    const earliest = Number(stats.earliest ?? 0)
    const latest = Number(stats.latest ?? 0)
    const change = latest - earliest
    const changePercent = earliest !== 0 ? (change / earliest) * 100 : 0

    return {
      symbol,
      startTime,
      endTime,
      dataPoints: Number(stats.data_points),
      max,
      min,
      avg,
      latest,
      earliest,
      change,
      changePercent,
    }
  }
}
