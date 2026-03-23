import type {
  CreateOpenInterestDto,
  QueryOpenInterestDto,
} from './dto/open-interest.dto'
import type { Prisma } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { PAGINATION_CONSTANTS } from '@/common/constants/pagination.constants'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { OpenInterestRepository } from './open-interest.repository'

/**
 * 持仓量数据服务
 */
@Injectable()
export class OpenInterestService {
  private readonly logger = new Logger(OpenInterestService.name)
  private static readonly MAX_STATS_RANGE_MS = 31 * 24 * 60 * 60 * 1000

  constructor(private readonly openInterestRepository: OpenInterestRepository) {}

  /**
   * 创建或更新持仓量数据
   * @param data 持仓量数据
   */
  async upsert(data: CreateOpenInterestDto) {
    try {
      const result = await this.openInterestRepository.upsert(data)
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
      this.openInterestRepository.findMany(where, limit, offset),
      this.openInterestRepository.count(where),
    ])

    return new BasePaginationResponseDto(total, page, limit, data)
  }

  /**
   * 获取最新的持仓量数据
   * @param exchange 交易所
   * @param symbol 币种
   */
  async getLatest(exchange: string, symbol: string) {
    return this.openInterestRepository.findLatest(exchange, symbol)
  }

  /**
   * 获取指定时间段内的持仓量统计
   * @param symbol 币种
   * @param startTime 开始时间
   * @param endTime 结束时间
   */
  async getStats(symbol: string, startTime: Date, endTime: Date) {
    if (!symbol || !startTime || !endTime) {
      throw new DomainException('open_interest.invalid_params', { code: ErrorCode.OPEN_INTEREST_INVALID_PARAMS, status: HttpStatus.BAD_REQUEST, args: { reason: 'symbol, startTime, and endTime are required' } })
    }

    if (startTime >= endTime) {
      throw new DomainException('open_interest.invalid_params', { code: ErrorCode.OPEN_INTEREST_INVALID_PARAMS, status: HttpStatus.BAD_REQUEST, args: { reason: 'startTime must be before endTime' } })
    }

    const rangeMs = endTime.getTime() - startTime.getTime()
    if (rangeMs > OpenInterestService.MAX_STATS_RANGE_MS) {
      throw new DomainException('open_interest.range_exceeded', { code: ErrorCode.OPEN_INTEREST_RANGE_EXCEEDED, status: HttpStatus.BAD_REQUEST, args: { maxDays: 31 } })
    }

    const statsRows = await this.openInterestRepository.queryRawStats(symbol, startTime, endTime)

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
