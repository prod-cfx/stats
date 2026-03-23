import type { MarketTimeframe } from '@ai/shared'
import type { DataPullJob, DataPullJobContext, JobRunResult } from '../contracts/data-pull-job'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService/PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
import { DomainException } from '@/common/exceptions/domain.exception'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

interface LongShortRatioCursor {
  /**
   * 交易对配置 ID（来自 @ai/shared 中的 TradingPairConfig.id）
   * 例如：BTCUSDT.BINANCE.PERP
   */
  tradingPairId: string
  /**
   * 交易所名称（Coinglass 需要）
   */
  exchange?: string
  /**
   * Coinglass 接口使用的基础资产或交易对符号
   * 例如：BTC 或 BTCUSDT
   */
  symbol: string
  /**
   * 时间粒度，例如 "4h"
   */
  interval: MarketTimeframe
  /**
   * 最新一次成功写入的数据点时间戳（毫秒）
   * 主要用于后续增量抓取
   */
  lastTimestamp?: number
}

interface CoinglassLongShortRatioPoint {
  time: number
  /**
   * 全市场多头账户占比（百分比数值，例如 73.88）
   */
  global_account_long_percent?: number
  /**
   * 全市场空头账户占比（百分比数值，例如 26.12）
   */
  global_account_short_percent?: number
  /**
   * 全市场多空账户比（多/空），例如 2.83
   */
  global_account_long_short_ratio?: number
}

interface CoinglassLongShortRatioApiResponse {
  code: string
  msg: string
  data?: CoinglassLongShortRatioPoint[]
}

@Injectable()
export class CoinglassLongShortRatioJob implements DataPullJob {
  readonly key = 'coinglass-long-short-ratio'
  private readonly logger = new Logger(CoinglassLongShortRatioJob.name)
  private readonly requestTimeoutMs = 10_000
  private readonly maxAttempts = 2

  // 默认配置：BTCUSDT.BINANCE.PERP & 4h 粒度
  private readonly defaultTradingPairId = 'BTCUSDT.BINANCE.PERP'
  private readonly defaultExchange = 'Binance'
  private readonly defaultSymbol = 'BTCUSDT'
  private readonly defaultInterval: MarketTimeframe = '4h'
  private readonly defaultLimit = 1000
  private readonly intervalFormatCache = new Map<MarketTimeframe, string>()

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async run(ctx: DataPullJobContext): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)

    const apiKey = this.configService.get<string>('COINGLASS_API_KEY')
    const endpoint =
      this.configService.get<string>('COINGLASS_LONG_SHORT_RATIO_ENDPOINT') ??
      // 参考 Coinglass 文档：全局多空账户比历史
      'https://open-api-v4.coinglass.com/api/futures/global-long-short-account-ratio/history'

    if (!apiKey) {
      // 不应”默默成功”，否则后台无法感知配置缺失
      throw new DomainException('data_sync.long_short_ratio.config_missing', {
        code: ErrorCode.DATA_SYNC_CONFIG_MISSING,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: 'COINGLASS_API_KEY is not configured' },
      })
    }

    const interval = cursor.interval ?? this.defaultInterval
    const exchange = cursor.exchange ?? this.defaultExchange
    const lastTimestampMs = cursor.lastTimestamp ?? null

    const url = new URL(endpoint)
    url.searchParams.set('exchange', exchange)
    url.searchParams.set('symbol', cursor.symbol)
    url.searchParams.set('interval', this.convertIntervalToCoinglassFormat(interval))
    url.searchParams.set('limit', this.defaultLimit.toString())

    this.logger.log(
      `Requesting Coinglass global long/short account ratio: ${url.toString()} (cursor: ${
        ctx.cursor ?? 'null'
      })`,
    )

    const json = await this.fetchLongShortJson(url, apiKey)

    if (json.code !== '0' || !json.data) {
      throw new DomainException('data_sync.long_short_ratio.invalid_response', {
        code: ErrorCode.DATA_SYNC_INVALID_RESPONSE,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: `Coinglass long/short ratio API returned error: code=${json.code}, msg=${json.msg}` },
      })
    }

    if (json.data.length === 0) {
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify(cursor),
        meta: {
          tradingPairId: cursor.tradingPairId,
          exchange,
          symbol: cursor.symbol,
          interval,
          note: 'No long/short ratio data returned from API',
        },
      }
    }

    const client = this.prisma.getClient()

    const prismaInterval = mapTimeframe(interval as MarketTimeframe)

    const pointsWithTimestamps = json.data.map(point => {
      const timestampMs = point.time >= 1_000_000_000_000 ? point.time : point.time * 1000
      return {
        ...point,
        timestampMs,
      }
    })
    const validPoints = pointsWithTimestamps.filter(
      point => typeof point.global_account_long_short_ratio === 'number',
    )

    const incrementalPoints = lastTimestampMs
      ? validPoints.filter(point => point.timestampMs > lastTimestampMs)
      : validPoints

    let insertedCount = 0
    if (incrementalPoints.length > 0) {
      const rows = incrementalPoints.map(point => ({
        tradingPairId: cursor.tradingPairId,
        interval: prismaInterval as any,
        timestamp: new Date(point.timestampMs),
        longShortRatio: point.global_account_long_short_ratio!.toString(),
        longAccountRatio:
          point.global_account_long_percent != null
            ? point.global_account_long_percent.toString()
            : null,
        shortAccountRatio:
          point.global_account_short_percent != null
            ? point.global_account_short_percent.toString()
            : null,
        longVolume: null,
        shortVolume: null,
        longShortAccountRatio: null,
        source: 'COINGLASS',
      }))

      const result = await client.longShortRatio.createMany({
        data: rows,
        skipDuplicates: true,
      })
      insertedCount = result.count
    }

    const latestTimestampCandidates: number[] = []
    if (validPoints.length > 0) {
      for (const point of validPoints) {
        latestTimestampCandidates.push(point.timestampMs)
      }
    }
    if (typeof lastTimestampMs === 'number') {
      latestTimestampCandidates.push(lastTimestampMs)
    }
    const latestTimestampMs =
      latestTimestampCandidates.length > 0 ? Math.max(...latestTimestampCandidates) : undefined

    const newCursor: LongShortRatioCursor = {
      tradingPairId: cursor.tradingPairId,
      exchange,
      symbol: cursor.symbol,
      interval,
      lastTimestamp: latestTimestampMs,
    }

    return {
      fetchedCount: insertedCount,
      newCursor: JSON.stringify(newCursor),
      meta: {
        tradingPairId: cursor.tradingPairId,
        exchange,
        symbol: cursor.symbol,
        interval,
        latestTime: latestTimestampMs ? new Date(latestTimestampMs).toISOString() : null,
        lastTimestamp: latestTimestampMs ?? null,
        apiDataCount: json.data.length,
        insertedCount,
      },
    }
  }

  private async fetchLongShortJson(
    url: URL,
    apiKey: string,
  ): Promise<CoinglassLongShortRatioApiResponse> {
    const requestInit: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // 具体 header 名称以 Coinglass 文档为准
        'CG-API-KEY': apiKey,
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

          const retryable = response.status >= 500 || response.status === 429
          if (retryable && attempt < this.maxAttempts) {
            this.logger.warn(
              `Coinglass long/short ratio request failed (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
            )
            continue
          }

          throw new DomainException('data_sync.long_short_ratio.api_error', {
            code: ErrorCode.DATA_SYNC_API_ERROR,
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            args: { reason: `Coinglass long/short ratio request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} ${failure}` },
          })
        }

        return (await response.json()) as CoinglassLongShortRatioApiResponse
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
            `Coinglass long/short ratio request error (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
          )
          continue
        }

        throw new DomainException('data_sync.long_short_ratio.api_error', {
          code: ErrorCode.DATA_SYNC_API_ERROR,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          args: { reason: `Coinglass long/short ratio request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} error=${failure}` },
        })
      } finally {
        clearTimeout(timer)
      }
    }

    // 理论不可达，兜底
    throw new DomainException('data_sync.long_short_ratio.api_error', {
      code: ErrorCode.DATA_SYNC_API_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      args: { reason: `Coinglass long/short ratio request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${lastFailure ?? 'unknown'}` },
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

  private parseCursor(currentCursor: string | null): LongShortRatioCursor {
    if (!currentCursor) {
      return {
        tradingPairId: this.defaultTradingPairId,
        exchange: this.defaultExchange,
        symbol: this.defaultSymbol,
        interval: this.defaultInterval,
        lastTimestamp: undefined,
      }
    }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<LongShortRatioCursor>
      if (!parsed.tradingPairId) {
        parsed.tradingPairId = this.defaultTradingPairId
      }
      if (!parsed.exchange) {
        parsed.exchange = this.defaultExchange
      }
      if (!parsed.symbol) {
        parsed.symbol = this.defaultSymbol
      }
      if (!parsed.interval) {
        parsed.interval = this.defaultInterval
      }
      if (typeof parsed.lastTimestamp !== 'number') {
        delete parsed.lastTimestamp
      }
      return parsed as LongShortRatioCursor
    } catch {
      this.logger.warn(`Failed to parse cursor: ${currentCursor}, fallback to default`)
      return {
        tradingPairId: this.defaultTradingPairId,
        exchange: this.defaultExchange,
        symbol: this.defaultSymbol,
        interval: this.defaultInterval,
        lastTimestamp: undefined,
      }
    }
  }

  /**
   * 将内部时间粒度转换为 Coinglass API 的 interval 格式。
   * 格式规则：前缀 + 数字，例如 m1=1分钟、h4=4小时、d1=1天、w1=1周。
   */
  private convertIntervalToCoinglassFormat(interval: MarketTimeframe): string {
    if (this.intervalFormatCache.has(interval)) {
      return this.intervalFormatCache.get(interval) ?? interval
    }

    let converted: string
    switch (interval) {
      case '1m':
        converted = 'm1'
        break
      case '3m':
        converted = 'm3'
        break
      case '5m':
        converted = 'm5'
        break
      case '15m':
        converted = 'm15'
        break
      case '30m':
        converted = 'm30'
        break
      case '1h':
        converted = 'h1'
        break
      case '4h':
        converted = 'h4'
        break
      case '6h':
        converted = 'h6'
        break
      case '8h':
        converted = 'h8'
        break
      case '12h':
        converted = 'h12'
        break
      case '1d':
        converted = 'd1'
        break
      case '1w':
        converted = 'w1'
        break
      default:
        this.logger.warn(`Unknown interval "${interval}" for Coinglass API, using raw value`)
        converted = interval
        break
    }

    this.intervalFormatCache.set(interval, converted)
    return converted
  }
}
