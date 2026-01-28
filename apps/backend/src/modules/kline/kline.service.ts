import type { MarketTimeframe, Prisma  } from '@prisma/client'
import type { KlineBarDto } from './dto/kline-bar.dto'
import { ErrorCode } from '@ai/shared'
import { Injectable, Logger } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
// Nest 注入需要运行时引用 RedisService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { RedisService } from '@/common/services/redis.service'
// Nest 注入需要运行时引用 PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class KlineService {
  private readonly logger = new Logger(KlineService.name)

  // 缓存配置
  private readonly CACHE_TTL_SECONDS = 30 // Redis 缓存过期时间（秒）

  // 查询配置
  private readonly DEFAULT_QUERY_LIMIT = 200 // 默认返回的 K线数量
  private readonly MIN_QUERY_LIMIT = 50 // 最小返回数量
  private readonly MAX_QUERY_LIMIT = 500 // 最大返回数量

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getKlineBars(params: {
    symbol: string
    interval: string
    from: number
    to: number
    exchange?: string
  }): Promise<KlineBarDto[]> {
    const { symbol, interval, from, to, exchange } = params

    // P2-3: 输入清理和验证
    // symbol: 只允许字母数字和常见分隔符
    const SYMBOL_PATTERN = /^[\w\-/]+$/
    const cleanSymbol = symbol?.trim().toUpperCase() || ''
    if (!cleanSymbol || !SYMBOL_PATTERN.test(cleanSymbol)) {
      this.logger.warn({
        message: 'Invalid symbol parameter',
        symbol,
      })
      throw new DomainException('Invalid symbol parameter', {
        code: ErrorCode.MARKET_INVALID_SYMBOL,
        args: { symbol },
      })
    }

    // interval: 白名单验证
    const VALID_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d']
    const cleanInterval = interval?.trim().toLowerCase() || ''
    if (!VALID_INTERVALS.includes(cleanInterval)) {
      this.logger.warn({
        message: 'Invalid interval parameter',
        interval,
        validIntervals: VALID_INTERVALS,
      })
      throw new DomainException('Invalid interval parameter', {
        code: ErrorCode.MARKET_INVALID_TIMEFRAME,
        args: { interval, validIntervals: VALID_INTERVALS },
      })
    }

    // 输入验证：exchange 参数白名单
    const VALID_EXCHANGES = ['BINANCE', 'OKX', 'BYBIT', 'BITGET', 'ALL']
    let normalizedExchange = exchange?.trim()
    let shouldAggregate = !normalizedExchange || normalizedExchange.toUpperCase() === 'ALL'

    // P2-2: 无效交易所强制降级为聚合模式
    if (normalizedExchange && normalizedExchange !== '') {
      const upperExchange = normalizedExchange.toUpperCase()
      if (!VALID_EXCHANGES.includes(upperExchange)) {
        this.logger.warn({
          message: 'Invalid exchange parameter, falling back to aggregation mode',
          exchange: normalizedExchange,
          validExchanges: VALID_EXCHANGES,
        })
        // 强制使用聚合模式
        shouldAggregate = true
        normalizedExchange = undefined
      }
    }

    const cacheExchangeKey = shouldAggregate ? 'all' : normalizedExchange!.toUpperCase()

    // 使用清理后的参数构建缓存键
    const cacheKey = `kline:${cleanSymbol}:${cleanInterval}:${from}:${to}:${cacheExchangeKey}`
    const redisClient = this.redisService.getClient()

    // 尝试从缓存获取
    try {
      const cached = await redisClient.get(cacheKey)
      if (cached) {
        return JSON.parse(cached) as KlineBarDto[]
      }
    } catch (error) {
      this.logger.warn({
        message: 'Redis get failed',
        cacheKey,
        symbol,
        interval,
        from,
        to,
        exchange: exchange || 'all',
        error: (error as Error).message,
      })
    }

    // 映射前端 interval → Prisma 枚举
    const timeframe = this.mapIntervalToTimeframe(cleanInterval)

    // 构建查询条件（使用清理后的参数）
    const timeRange = {
      gte: new Date(from * 1000),
      lte: new Date(to * 1000),
    }
    const where = {
      symbol: cleanSymbol,
      interval: timeframe,
      timestamp: timeRange,
      ...(!shouldAggregate && { exchangeCode: normalizedExchange?.toUpperCase() }),
    }

    const client = this.prisma.getClient()

    // P2-4: 添加 try-catch 包裹聚合调用
    let result: KlineBarDto[]
    try {
      // 查询数据库（按时间升序，限制返回数量）
      result = shouldAggregate
        ? await this.aggregateKlineData(client, where)
        : (await client.futuresPriceHistory.findMany({
          where,
          orderBy: { timestamp: 'asc' },
          take: this.DEFAULT_QUERY_LIMIT,
        })).map((record) => ({
          time: record.timestamp.getTime(),
          open: record.open.toNumber(),
          high: record.high.toNumber(),
          low: record.low.toNumber(),
          close: record.close.toNumber(),
          volume: record.volumeUsd?.toNumber() ?? 0,
        }))
    } catch (error) {
      this.logger.error({
        message: shouldAggregate ? 'Kline aggregation failed' : 'Kline query failed',
        symbol: cleanSymbol,
        interval: cleanInterval,
        from,
        to,
        exchange: exchange || 'all',
        error: (error as Error).message,
        stack: (error as Error).stack,
      })
      // 返回空数组而非抛出异常，让前端能够优雅降级
      return []
    }

    // 缓存结果（异步，不阻塞响应）
    redisClient.setex(cacheKey, this.CACHE_TTL_SECONDS, JSON.stringify(result)).catch(cacheError => {
      this.logger.warn({
        message: 'Redis setex failed',
        cacheKey,
        symbol: cleanSymbol,
        interval: cleanInterval,
        from,
        to,
        exchange: exchange || 'all',
        resultCount: result.length,
        error: (cacheError as Error).message,
      })
    })

    return result
  }

  /**
   * 聚合多个交易所的 K 线数据
   *
   * P1-3: 使用数据库聚合替代内存聚合，避免一次性加载大量数据
   *
   * 聚合规则：
   * - open: 取第一个交易所的开盘价（按 exchangeCode 排序）
   * - high: 取所有交易所的最高价
   * - low: 取所有交易所的最低价
   * - close: 取最后一个交易所的收盘价（按 exchangeCode 排序）
   * - volume: 求和所有交易所的成交量
   */
  private async aggregateKlineData(
    client: ReturnType<typeof this.prisma.getClient>,
    where: Prisma.FuturesPriceHistoryWhereInput,
  ): Promise<KlineBarDto[]> {
    // 使用数据库聚合查询，避免加载大量原始数据到内存
    const aggregatedData = await client.futuresPriceHistory.groupBy({
      by: ['timestamp'],
      where,
      _max: { high: true },
      _min: { low: true, open: true },
      _sum: { volumeUsd: true },
      orderBy: { timestamp: 'asc' },
      take: this.DEFAULT_QUERY_LIMIT,
    })

    // 对于 open/close，需要单独查询（因为 groupBy 不支持 FIRST/LAST 聚合）
    // 使用子查询获取每个时间点的第一个和最后一个交易所的价格
    const timestamps = aggregatedData.map(d => d.timestamp)

    if (timestamps.length === 0) {
      return []
    }

    // 批量获取每个时间点的 open（第一个交易所）和 close（最后一个交易所）
    // PERF: 此查询依赖复合索引 (symbol, interval, timestamp) 以避免全表扫描
    // 索引定义见 prisma/schema/market_data.prisma: @@index([symbol, interval, timestamp])
    const openCloseData = await client.$queryRaw<Array<{
      timestamp: Date
      open: number
      close: number
    }>>`
      WITH ranked AS (
        SELECT
          timestamp,
          open,
          close,
          ROW_NUMBER() OVER (PARTITION BY timestamp ORDER BY exchange_code ASC) as rn_first,
          ROW_NUMBER() OVER (PARTITION BY timestamp ORDER BY exchange_code DESC) as rn_last
        FROM futures_price_history
        WHERE symbol = ${(where.symbol as string).toUpperCase()}
          AND interval = ${where.interval}::market_timeframe
          AND timestamp >= ${timestamps[0]}
          AND timestamp <= ${timestamps[timestamps.length - 1]}
        LIMIT ${Math.min(timestamps.length * 10, this.MAX_QUERY_LIMIT * 2)}
      )
      SELECT
        timestamp,
        MAX(CASE WHEN rn_first = 1 THEN open END) as open,
        MAX(CASE WHEN rn_last = 1 THEN close END) as close
      FROM ranked
      GROUP BY timestamp
      ORDER BY timestamp ASC
    `

    // 构建 timestamp -> open/close 映射
    const openCloseMap = new Map<number, { open: number; close: number }>()
    for (const row of openCloseData) {
      openCloseMap.set(row.timestamp.getTime(), {
        open: Number(row.open),
        close: Number(row.close),
      })
    }

    // 合并聚合结果
    return aggregatedData.map(row => {
      const timeKey = row.timestamp.getTime()
      const openClose = openCloseMap.get(timeKey)

      return {
        time: timeKey,
        open: openClose?.open ?? row._min.open?.toNumber() ?? 0,
        high: row._max.high?.toNumber() ?? 0,
        low: row._min.low?.toNumber() ?? 0,
        close: openClose?.close ?? row._min.open?.toNumber() ?? 0,
        volume: row._sum.volumeUsd?.toNumber() ?? 0,
      }
    })
  }

  private mapIntervalToTimeframe(interval: string): MarketTimeframe {
    // 前端传入的是数据库格式（'1m', '5m', '15m', '1h', '4h', '1d'）
    // 需要映射到 Prisma 枚举键名（m1, m5, m15, h1, h4, d1）
    const map: Record<string, MarketTimeframe> = {
      '1m': 'm1' as MarketTimeframe,
      '5m': 'm5' as MarketTimeframe,
      '15m': 'm15' as MarketTimeframe,
      '1h': 'h1' as MarketTimeframe,
      '4h': 'h4' as MarketTimeframe,
      '1d': 'd1' as MarketTimeframe,
    }

    const timeframe = map[interval]
    if (!timeframe) {
      this.logger.warn(`Invalid interval: ${interval}, fallback to m15`)
    }

    return timeframe ?? ('m15' as MarketTimeframe)
  }
}
