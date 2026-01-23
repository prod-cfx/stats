import type { MarketTimeframe } from '@prisma/client'
import type { KlineBarDto } from './dto/kline-bar.dto'
import { Injectable, Logger } from '@nestjs/common'
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

    const cacheKey = `kline:${symbol}:${interval}:${from}:${to}:${exchange || 'all'}`
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
    const timeframe = this.mapIntervalToTimeframe(interval)

    // 构建查询条件
    const where = {
      symbol: symbol.toUpperCase(),
      interval: timeframe,
      timestamp: {
        gte: new Date(from * 1000),
        lte: new Date(to * 1000),
      },
      ...(exchange && { exchangeCode: exchange.toUpperCase() }),
    }

    const client = this.prisma.getClient()

    // 查询数据库（按时间升序，限制返回数量）
    const records = await client.futuresPriceHistory.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: this.DEFAULT_QUERY_LIMIT,
    })

    // 数据转换（Decimal → number，DateTime → 毫秒时间戳）
    const result: KlineBarDto[] = records.map(record => ({
      time: record.timestamp.getTime(),
      open: record.open.toNumber(),
      high: record.high.toNumber(),
      low: record.low.toNumber(),
      close: record.close.toNumber(),
      volume: record.volumeUsd?.toNumber() ?? 0,
    }))

    // 缓存结果（异步，不阻塞响应）
    redisClient.setex(cacheKey, this.CACHE_TTL_SECONDS, JSON.stringify(result)).catch(error => {
      this.logger.warn({
        message: 'Redis setex failed',
        cacheKey,
        symbol,
        interval,
        from,
        to,
        exchange: exchange || 'all',
        resultCount: result.length,
        error: (error as Error).message,
      })
    })

    return result
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
