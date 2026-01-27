import type { MarketTimeframe } from '@ai/shared'
import type { DataPullJob, DataPullJobContext, JobMetaSchema, JobRunResult } from '../contracts/data-pull-job'
import { Injectable, Logger } from '@nestjs/common'
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
      { name: 'marketType', type: 'string', required: true, description: '市场类型', options: ['PERPETUAL', 'SPOT'] },
      { name: 'interval', type: 'string', required: true, description: '时间粒度', options: ['1m', '5m', '15m', '30m', '1h', '4h', '1d'] },
      { name: 'lastTimestamp', type: 'number', required: false, description: '最后同步的时间戳（毫秒）' },
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

    // 根据市场类型选择 API 端点
    const endpoint = cursor.marketType === 'PERPETUAL'
      ? 'https://fapi.binance.com/fapi/v1/klines' // 永续合约
      : 'https://api.binance.com/api/v3/klines' // 现货

    const interval = cursor.interval ?? this.defaultInterval
    const lastTimestampMs = cursor.lastTimestamp ?? null

    // 构建请求 URL
    const url = new URL(endpoint)
    url.searchParams.set('symbol', cursor.symbol)
    url.searchParams.set('interval', interval)
    url.searchParams.set('limit', this.getMaxLimit(cursor.marketType).toString())

    // 增量拉取：从上次时间戳之后开始
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

    const client = this.prisma.getClient()
    const prismaInterval = mapTimeframe(interval as MarketTimeframe)

    // 转换数据格式并过滤增量数据
    const pointsWithTimestamps = klineData.map(point => ({
      openTime: point[0],
      open: point[1],
      high: point[2],
      low: point[3],
      close: point[4],
      volume: point[5],
      closeTime: point[6],
      quoteAssetVolume: point[7], // USDT 成交额
    }))

    // 客户端二次过滤：虽然 API 已通过 startTime 过滤，但保留此逻辑以防 API 行为不一致
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
        volumeUsd: point.quoteAssetVolume, // 使用 USDT 成交额
        source: 'BINANCE',
      }))

      for (let start = 0; start < rows.length; start += this.BATCH_INSERT_SIZE) {
        const batch = rows.slice(start, start + this.BATCH_INSERT_SIZE)
        const result = await client.futuresPriceHistory.createMany({
          data: batch,
          skipDuplicates: true,
        })
        insertedCount += result.count
      }
    }

    // 计算最新时间戳（使用 reduce 避免大数组 spread 导致栈溢出）
    let latestTimestampMs: number | undefined
    if (pointsWithTimestamps.length > 0) {
      const maxOpenTime = pointsWithTimestamps.reduce(
        (max, point) => Math.max(max, point.openTime),
        0,
      )
      latestTimestampMs = typeof lastTimestampMs === 'number'
        ? Math.max(maxOpenTime, lastTimestampMs)
        : maxOpenTime
    }
    else {
      latestTimestampMs = typeof lastTimestampMs === 'number' ? lastTimestampMs : undefined
    }

    const newCursor: BinanceKlineCursor = {
      symbol: cursor.symbol,
      marketType: cursor.marketType,
      interval,
      lastTimestamp: latestTimestampMs,
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

          throw new Error(
            `Binance kline request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} ${failure}`,
          )
        }

        // 验证响应格式
        const data = await response.json()
        if (!Array.isArray(data)) {
          throw new TypeError(`Invalid response format: expected array, got ${typeof data}`)
        }

        return data as BinanceKlinePoint[]
      }
      catch (error) {
        const isAbort = this.isAbortError(error)

        const failure =
          isAbort
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

        throw new Error(
          `Binance kline request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${failure}`,
        )
      }
      finally {
        clearTimeout(timer)
      }
    }

    // 理论不可达，兜底
    throw new Error(
      `Binance kline request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${lastFailure ?? 'unknown'}`,
    )
  }

  private isAbortError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false
    if (!('name' in error)) return false
    return (error as { name?: unknown }).name === 'AbortError'
  }

  private async safeReadText(response: Response): Promise<string> {
    try {
      return await response.text()
    }
    catch {
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
      return parsed as BinanceKlineCursor
    }
    catch {
      this.logger.warn(`Failed to parse cursor: ${currentCursor}, fallback to default`)
      return {
        symbol: this.defaultSymbol,
        marketType: this.defaultMarketType,
        interval: this.defaultInterval,
        lastTimestamp: undefined,
      }
    }
  }
}
