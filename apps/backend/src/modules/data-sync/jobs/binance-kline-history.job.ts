import type { MarketTimeframe } from '@ai/shared'
import type {
  DataPullJob,
  DataPullJobContext,
  JobMetaSchema,
  JobRunResult,
} from '../contracts/data-pull-job'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { defaultEnvAccessor } from '@/common/env/env.accessor'
import { DomainException } from '@/common/exceptions/domain.exception'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

/**
 * Binance K 线数据游标
 */
interface BinanceKlineCursor {
  /**
   * 交易对符号，例如 BTCUSDT, ETHUSDT
   */
  symbol: string
  /**
   * 市场类型：PERPETUAL（永续合约）或 SPOT（现货）
   */
  marketType: 'PERPETUAL' | 'SPOT'
  /**
   * 时间粒度，例如 1m, 5m, 15m, 1h, 4h, 1d
   */
  interval: MarketTimeframe
  /**
   * 最新一次成功写入的数据点时间戳（毫秒）
   * 用于增量拉取
   */
  lastTimestamp?: number
  /**
   * 是否已完成历史回填
   */
  backfillCompleted?: boolean
  /**
   * 回填完成时间戳（毫秒），用于定期复查
   */
  backfillCompletedAt?: number
}

/**
 * Binance K 线数据点（API 返回数组格式）
 * [
 *   openTime,
 *   open,
 *   high,
 *   low,
 *   close,
 *   volume,
 *   closeTime,
 *   quoteAssetVolume,  // USDT 成交额
 *   numberOfTrades,
 *   takerBuyBaseAssetVolume,
 *   takerBuyQuoteAssetVolume,
 *   ignore
 * ]
 */
type BinanceKlinePoint = [
  number, // openTime
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // closeTime
  string, // quoteAssetVolume (USDT)
  number, // numberOfTrades
  string, // takerBuyBaseAssetVolume
  string, // takerBuyQuoteAssetVolume
  string, // ignore
]

@Injectable()
export class BinanceKlineHistoryJob implements DataPullJob {
  // Job key 作为前缀匹配 seed 中的任务 key（格式：binance-kline-history:SYMBOL:MARKET:INTERVAL）
  readonly key = 'binance-kline-history'

  // metaSchema 用于后台管理界面展示游标字段说明
  readonly metaSchema: JobMetaSchema = {
    description: 'Binance K 线数据拉取任务的游标配置',
    fields: [
      { name: 'symbol', type: 'string', required: true, description: '交易对符号，如 BTCUSDT' },
      {
        name: 'marketType',
        type: 'string',
        required: true,
        description: '市场类型',
        options: ['PERPETUAL', 'SPOT'],
      },
      {
        name: 'interval',
        type: 'string',
        required: true,
        description: '时间粒度',
        options: ['1m', '5m', '15m', '30m', '1h', '4h', '1d'],
      },
      {
        name: 'lastTimestamp',
        type: 'number',
        required: false,
        description: '最后同步的时间戳（毫秒）',
      },
    ],
    example: {
      symbol: 'BTCUSDT',
      marketType: 'PERPETUAL',
      interval: '5m',
      lastTimestamp: 1704067200000,
    },
  }

  private readonly logger = new Logger(BinanceKlineHistoryJob.name)
  private readonly requestTimeoutMs = 10_000
  private readonly maxAttempts = 2
  // Binance 增量拉取使用毫秒级递增，避免重复拉取最后一条
  private readonly TIMESTAMP_INCREMENT_MS = 1
  // 批量插入单次上限，控制单次写入规模
  private readonly BATCH_INSERT_SIZE = 500
  // 回填完成后的复查间隔（默认 90 天，可通过 BACKFILL_RECHECK_WINDOW_DAYS 覆盖）
  private readonly BACKFILL_RECHECK_WINDOW_DAYS = this.parseBackfillRecheckWindowDays()
  private readonly BACKFILL_RECHECK_WINDOW_MS =
    this.BACKFILL_RECHECK_WINDOW_DAYS * 24 * 60 * 60 * 1000

  // 默认配置
  private readonly defaultSymbol = 'BTCUSDT'
  private readonly defaultMarketType: 'PERPETUAL' | 'SPOT' = 'PERPETUAL'
  private readonly defaultInterval: MarketTimeframe = '5m'

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 根据市场类型返回 API limit 上限
   * 永续合约 API 支持最大 1500，现货 API 支持最大 1000
   */
  private getMaxLimit(marketType: 'PERPETUAL' | 'SPOT'): number {
    return marketType === 'PERPETUAL' ? 1500 : 1000
  }

  async run(ctx: DataPullJobContext): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)

    const endpoint =
      cursor.marketType === 'PERPETUAL'
        ? 'https://fapi.binance.com/fapi/v1/klines'
        : 'https://api.binance.com/api/v3/klines'

    const interval = cursor.interval ?? this.defaultInterval
    const lastTimestampMs = cursor.lastTimestamp ?? null
    const shouldSkipBackfillCheck =
      cursor.backfillCompleted &&
      typeof cursor.backfillCompletedAt === 'number' &&
      Date.now() - cursor.backfillCompletedAt < this.BACKFILL_RECHECK_WINDOW_MS

    const dbClient = this.prisma.getClient()
    const prismaInterval = mapTimeframe(interval as MarketTimeframe)

    if (!shouldSkipBackfillCheck) {
      const earliestRecord = await dbClient.futuresPriceHistory.findFirst({
        where: {
          symbol: cursor.symbol,
          exchangeCode: 'BINANCE',
          contractType: cursor.marketType === 'PERPETUAL' ? 'PERPETUAL' : null,
          interval: prismaInterval,
        },
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true },
      })

      if (earliestRecord) {
        const earliestMs = earliestRecord.timestamp.getTime()
        const backfillTargetMs = this.getBackfillTarget(interval)

        if (earliestMs > backfillTargetMs) {
          this.logger.log(
            `Backfilling history for ${cursor.symbol} ${interval}: from ${new Date(backfillTargetMs).toISOString()} to ${new Date(earliestMs).toISOString()}`,
          )
          return await this.runBackfill(
            ctx,
            cursor,
            endpoint,
            earliestMs,
            backfillTargetMs,
            interval,
          )
        }

        if (!cursor.backfillCompleted) {
          cursor.backfillCompleted = true
          cursor.backfillCompletedAt = Date.now()
        }
      }
    }

    const url = new URL(endpoint)
    url.searchParams.set('symbol', cursor.symbol)
    url.searchParams.set('interval', interval)
    url.searchParams.set('limit', this.getMaxLimit(cursor.marketType).toString())

    if (typeof lastTimestampMs === 'number') {
      url.searchParams.set('startTime', (lastTimestampMs + this.TIMESTAMP_INCREMENT_MS).toString())
    }

    this.logger.log(
      `Requesting Binance kline history: ${url.toString()} (cursor: ${ctx.cursor ?? 'null'})`,
    )

    const klineData = await this.fetchKlineJson(url)

    if (klineData.length === 0) {
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify(cursor),
        meta: {
          symbol: cursor.symbol,
          marketType: cursor.marketType,
          interval,
          note: 'No kline data returned from Binance API',
        },
      }
    }

    const pointsWithTimestamps = klineData.map(point => ({
      openTime: point[0],
      open: point[1],
      high: point[2],
      low: point[3],
      close: point[4],
      volume: point[5],
      closeTime: point[6],
      quoteAssetVolume: point[7],
    }))

    const incrementalPoints = lastTimestampMs
      ? pointsWithTimestamps.filter(point => point.openTime > lastTimestampMs)
      : pointsWithTimestamps

    let insertedCount = 0
    if (incrementalPoints.length > 0) {
      const rows = incrementalPoints.map(point => ({
        symbol: cursor.symbol,
        exchangeCode: 'BINANCE',
        contractType: cursor.marketType === 'PERPETUAL' ? 'PERPETUAL' : null,
        interval: prismaInterval,
        timestamp: new Date(point.openTime),
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        volumeUsd: point.quoteAssetVolume,
        source: 'BINANCE',
      }))

      for (let start = 0; start < rows.length; start += this.BATCH_INSERT_SIZE) {
        const batch = rows.slice(start, start + this.BATCH_INSERT_SIZE)
        const result = await dbClient.futuresPriceHistory.createMany({
          data: batch,
          skipDuplicates: true,
        })
        insertedCount += result.count
      }
    }

    let latestTimestampMs: number | undefined
    if (pointsWithTimestamps.length > 0) {
      const maxOpenTime = pointsWithTimestamps.reduce(
        (max, point) => Math.max(max, point.openTime),
        0,
      )
      latestTimestampMs =
        typeof lastTimestampMs === 'number' ? Math.max(maxOpenTime, lastTimestampMs) : maxOpenTime
    } else {
      latestTimestampMs = typeof lastTimestampMs === 'number' ? lastTimestampMs : undefined
    }

    const newCursor: BinanceKlineCursor = {
      symbol: cursor.symbol,
      marketType: cursor.marketType,
      interval,
      lastTimestamp: latestTimestampMs,
      backfillCompleted: cursor.backfillCompleted,
      backfillCompletedAt: cursor.backfillCompletedAt,
    }

    return {
      fetchedCount: insertedCount,
      newCursor: JSON.stringify(newCursor),
      meta: {
        symbol: cursor.symbol,
        marketType: cursor.marketType,
        interval,
        latestTime: latestTimestampMs ? new Date(latestTimestampMs).toISOString() : null,
        lastTimestamp: latestTimestampMs ?? null,
        apiDataCount: klineData.length,
        insertedCount,
      },
    }
  }

  private async runBackfill(
    ctx: DataPullJobContext,
    cursor: BinanceKlineCursor,
    endpoint: string,
    earliestMs: number,
    targetMs: number,
    interval: string,
  ): Promise<JobRunResult> {
    const url = new URL(endpoint)
    url.searchParams.set('symbol', cursor.symbol)
    url.searchParams.set('interval', cursor.interval)
    url.searchParams.set('limit', this.getMaxLimit(cursor.marketType).toString())
    // Binance API 文档说明 endTime 为闭区间
    // 向前错开 1s 避免边界重叠，粗粒度周期通过后续轮次补齐缺口
    const backfillEndTimeMs = Math.max(earliestMs - 1000, 0)
    url.searchParams.set('endTime', backfillEndTimeMs.toString())

    this.logger.log(`Backfill request: ${url.toString()}`)

    const klineData = await this.fetchKlineJson(url)

    if (klineData.length === 0) {
      const backfillCompletedAt = Date.now()
      const newCursor: BinanceKlineCursor = {
        symbol: cursor.symbol,
        marketType: cursor.marketType,
        interval: cursor.interval,
        lastTimestamp: cursor.lastTimestamp,
        backfillCompleted: true,
        backfillCompletedAt,
      }
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify(newCursor),
        meta: {
          symbol: cursor.symbol,
          marketType: cursor.marketType,
          interval: cursor.interval,
          note: 'Backfill complete - no more historical data',
        },
      }
    }

    const dbClient = this.prisma.getClient()
    const prismaInterval = mapTimeframe(interval as MarketTimeframe)
    const pointsWithTimestamps = klineData.map(point => ({
      openTime: point[0],
      open: point[1],
      high: point[2],
      low: point[3],
      close: point[4],
      volume: point[5],
      closeTime: point[6],
      quoteAssetVolume: point[7],
    }))

    const filteredPoints = pointsWithTimestamps.filter(point => point.openTime < earliestMs)

    const rows = filteredPoints.map(point => ({
      symbol: cursor.symbol,
      exchangeCode: 'BINANCE',
      contractType: cursor.marketType === 'PERPETUAL' ? 'PERPETUAL' : null,
      interval: prismaInterval,
      timestamp: new Date(point.openTime),
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volumeUsd: point.quoteAssetVolume,
      source: 'BINANCE',
    }))

    let insertedCount = 0
    for (let start = 0; start < rows.length; start += this.BATCH_INSERT_SIZE) {
      const batch = rows.slice(start, start + this.BATCH_INSERT_SIZE)
      const result = await dbClient.futuresPriceHistory.createMany({
        data: batch,
        skipDuplicates: true,
      })
      insertedCount += result.count
    }

    const oldestFetched =
      filteredPoints.length > 0
        ? filteredPoints.reduce((min, point) => Math.min(min, point.openTime), Infinity)
        : earliestMs

    const backfillCompleted = oldestFetched <= targetMs
    const backfillCompletedAt = backfillCompleted ? Date.now() : cursor.backfillCompletedAt

    const denominator = earliestMs - targetMs
    const backfillProgress =
      denominator === 0 ? 100 : Math.round(((earliestMs - oldestFetched) / denominator) * 100)

    const newCursor: BinanceKlineCursor = {
      symbol: cursor.symbol,
      marketType: cursor.marketType,
      interval: cursor.interval,
      lastTimestamp: cursor.lastTimestamp,
      backfillCompleted: backfillCompleted ? true : cursor.backfillCompleted,
      backfillCompletedAt,
    }

    return {
      fetchedCount: insertedCount,
      newCursor: JSON.stringify(newCursor),
      meta: {
        symbol: cursor.symbol,
        marketType: cursor.marketType,
        interval: cursor.interval,
        mode: 'backfill',
        oldestFetched: new Date(oldestFetched).toISOString(),
        backfillProgress: `${backfillProgress}%`,
        insertedCount,
      },
    }
  }

  private getBackfillTarget(interval: string): number {
    const now = Date.now()
    const depthMap: Record<string, number> = {
      '1m': 7 * 24 * 60 * 60 * 1000,
      '5m': 30 * 24 * 60 * 60 * 1000,
      '15m': 90 * 24 * 60 * 60 * 1000,
      '30m': 180 * 24 * 60 * 60 * 1000,
      '1h': 365 * 24 * 60 * 60 * 1000,
      '4h': 2 * 365 * 24 * 60 * 60 * 1000,
      '1d': 5 * 365 * 24 * 60 * 60 * 1000,
    }
    const depth = depthMap[interval] ?? 90 * 24 * 60 * 60 * 1000
    return now - depth
  }

  private parseBackfillRecheckWindowDays(): number {
    const value = defaultEnvAccessor.int('BACKFILL_RECHECK_WINDOW_DAYS', 90)
    return Number.isFinite(value) && value > 0 ? value : 90
  }

  /**
   * 调用 Binance API 获取 K 线数据
   */
  private async fetchKlineJson(url: URL): Promise<BinanceKlinePoint[]> {
    const requestInit: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }

    let lastFailure: string | null = null

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs)

      try {
        const response = await fetch(url.toString(), {
          ...requestInit,
          signal: controller.signal,
        })

        if (!response.ok) {
          const body = await this.safeReadText(response)
          const snippet = body ? body.slice(0, 500) : ''

          const failure = `status=${response.status} ${response.statusText}${
            snippet ? ` body=${JSON.stringify(snippet)}` : ''
          }`
          lastFailure = failure

          // 5xx 或 429 错误可重试
          const retryable = response.status >= 500 || response.status === 429
          if (retryable && attempt < this.maxAttempts) {
            // 429 限流时添加退避延迟，避免持续触发限流
            const delayMs = response.status === 429 ? 1000 * attempt : 0
            if (delayMs > 0) {
              this.logger.warn(`Rate limited, waiting ${delayMs}ms before retry...`)
              await new Promise(r => setTimeout(r, delayMs))
            }

            this.logger.warn(
              `Binance kline request failed (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
            )
            continue
          }

          throw new DomainException('data_sync.binance_kline_history.api_error', {
            code: ErrorCode.DATA_SYNC_API_ERROR,
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            args: { reason: `Binance kline request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} ${failure}` },
          })
        }

        // 验证响应格式
        const data = await response.json()
        if (!Array.isArray(data)) {
          throw new TypeError(`Invalid response format: expected array, got ${typeof data}`)
        }

        return data as BinanceKlinePoint[]
      } catch (error) {
        const isAbort = this.isAbortError(error)

        const failure = isAbort
          ? `timeout after ${this.requestTimeoutMs}ms`
          : error instanceof Error
            ? error.message
            : String(error)

        lastFailure = failure

        if (attempt < this.maxAttempts) {
          this.logger.warn(
            `Binance kline request error (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
          )
          continue
        }

        throw new DomainException('data_sync.binance_kline_history.api_error', {
          code: ErrorCode.DATA_SYNC_API_ERROR,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          args: { reason: `Binance kline request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${failure}` },
        })
      } finally {
        clearTimeout(timer)
      }
    }

    // 理论不可达，兜底
    throw new DomainException('data_sync.binance_kline_history.api_error', {
      code: ErrorCode.DATA_SYNC_API_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      args: { reason: `Binance kline request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${lastFailure ?? 'unknown'}` },
    })
  }

  private isAbortError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false
    if (!('name' in error)) return false
    return (error as { name?: unknown }).name === 'AbortError'
  }

  private async safeReadText(response: Response): Promise<string> {
    try {
      return await response.text()
    } catch {
      return ''
    }
  }

  /**
   * 解析游标
   */
  private parseCursor(currentCursor: string | null): BinanceKlineCursor {
    if (!currentCursor) {
      return {
        symbol: this.defaultSymbol,
        marketType: this.defaultMarketType,
        interval: this.defaultInterval,
        lastTimestamp: undefined,
        backfillCompleted: false,
        backfillCompletedAt: undefined,
      }
    }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<BinanceKlineCursor>
      if (!parsed.symbol) {
        parsed.symbol = this.defaultSymbol
      }
      if (!parsed.marketType) {
        parsed.marketType = this.defaultMarketType
      }
      if (!parsed.interval) {
        parsed.interval = this.defaultInterval
      }
      if (typeof parsed.lastTimestamp !== 'number') {
        delete parsed.lastTimestamp
      }
      if (typeof parsed.backfillCompleted !== 'boolean') {
        delete parsed.backfillCompleted
      }
      if (typeof parsed.backfillCompletedAt !== 'number') {
        delete parsed.backfillCompletedAt
      }
      return parsed as BinanceKlineCursor
    } catch {
      this.logger.warn(`Failed to parse cursor: ${currentCursor}, fallback to default`)
      return {
        symbol: this.defaultSymbol,
        marketType: this.defaultMarketType,
        interval: this.defaultInterval,
        lastTimestamp: undefined,
        backfillCompleted: false,
        backfillCompletedAt: undefined,
      }
    }
  }
}
