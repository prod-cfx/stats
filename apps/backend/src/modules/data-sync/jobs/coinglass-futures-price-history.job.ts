import type { MarketTimeframe } from '@ai/shared'
import type { DataPullJob, DataPullJobContext, JobRunResult } from '../contracts/data-pull-job'
import { Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService/PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

interface FuturesPriceCursor {
  /**
   * 币种基础资产或交易对符号，例如 BTC / BTCUSDT
   */
  symbol: string
  /**
   * 交易所代码，例如 BINANCE / OKX
   * 对应 Coinglass 文档中的 exchange 参数
   */
  exchangeCode?: string
  /**
   * 合约类型，例如 PERPETUAL / CURRENT_QUARTER 等
   * 对应 Coinglass 文档中的 contractType 参数
   *
   * 约定：
   * - null：表示现货（spot）
   * - undefined：表示未指定（将使用默认期货合约类型）
   */
  contractType?: string | null
  /**
   * 时间粒度，例如 "4h"
   */
  interval: MarketTimeframe
  /**
   * 最新一次成功写入的数据点时间戳（毫秒）
   * 主要用于后续增量抓取
   */
  lastTimestamp?: number
  /**
   * 回填是否完成
   */
  backfillCompleted?: boolean
  /**
   * 回填完成时间戳（毫秒）
   */
  backfillCompletedAt?: number
}

interface CoinglassFuturesPricePoint {
  time: number
  open: string
  high: string
  low: string
  close: string
  volume_usd?: string
}

interface CoinglassFuturesPriceApiResponse {
  code: string
  msg: string
  data?: CoinglassFuturesPricePoint[]
}

@Injectable()
export class CoinglassFuturesPriceHistoryJob implements DataPullJob {
  readonly key = 'coinglass-futures-price-history'
  private readonly logger = new Logger(CoinglassFuturesPriceHistoryJob.name)
  private readonly requestTimeoutMs = 10_000
  private readonly maxAttempts = 2
  private readonly BATCH_INSERT_SIZE = 500
  // 回填完成后的复查间隔（90 天）
  private readonly BACKFILL_RECHECK_WINDOW_MS = 90 * 24 * 60 * 60 * 1000

  // 默认配置：BTCUSDT.BINANCE.PERP & 4h 粒度
  private readonly defaultSymbol = 'BTCUSDT'
  private readonly defaultExchangeCode = 'BINANCE'
  private readonly defaultContractType: string | null = 'PERPETUAL'
  private readonly defaultInterval: MarketTimeframe = '4h'
  private readonly defaultLimit = 1000

  private readonly allowedIntervals = [
    '1m',
    '3m',
    '5m',
    '15m',
    '30m',
    '1h',
    '4h',
    '6h',
    '8h',
    '12h',
    '1d',
    '1w',
  ] as const satisfies readonly MarketTimeframe[]

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async run(ctx: DataPullJobContext): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)

    // 首次运行时（cursor 为空）允许用 task.meta 填充参数，避免 seed 配置不生效。
    // 注意：只在没有 cursor 时合并，避免覆盖已有增量游标。
    if (!ctx.cursor) {
      this.applyMetaDefaults(cursor, ctx.meta)
    }

    const apiKey = this.configService.get<string>('COINGLASS_API_KEY')

    // 根据 contractType 动态选择 endpoint
    // contractType 为 null 时使用现货 API，否则使用期货 API
    const isSpot = cursor.contractType === null
    const endpoint = isSpot
      ? 'https://open-api-v4.coinglass.com/api/spot/price/history'
      : 'https://open-api-v4.coinglass.com/api/futures/price/history'

    if (!apiKey) {
      // 不应"默默成功"，否则后台无法感知配置缺失
      throw new Error('COINGLASS_API_KEY is not configured')
    }

    const interval = cursor.interval ?? this.defaultInterval
    const lastTimestampMs = cursor.lastTimestamp ?? null
    const contractType = isSpot ? null : (cursor.contractType ?? this.defaultContractType)
    const shouldSkipBackfillCheck =
      cursor.backfillCompleted &&
      typeof cursor.backfillCompletedAt === 'number' &&
      Date.now() - cursor.backfillCompletedAt < this.BACKFILL_RECHECK_WINDOW_MS

    const dbClient = this.prisma.getClient()
    const prismaInterval = mapTimeframe(interval as MarketTimeframe)

    if (!shouldSkipBackfillCheck) {
      // 检查数据库中最早的记录，如果存在历史数据缺口则优先回填
      const earliestRecord = await dbClient.futuresPriceHistory.findFirst({
        where: {
          symbol: cursor.symbol,
          exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
          interval: prismaInterval,
          source: 'COINGLASS',
          contractType,
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
            cursor,
            endpoint,
            apiKey,
            earliestMs,
            backfillTargetMs,
            prismaInterval,
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
    url.searchParams.set('limit', this.defaultLimit.toString())
    if (cursor.exchangeCode) {
      url.searchParams.set('exchange', cursor.exchangeCode)
    }
    // 仅在期货模式下设置 contractType 参数
    if (!isSpot && (cursor.contractType ?? this.defaultContractType)) {
      url.searchParams.set('contractType', cursor.contractType ?? this.defaultContractType!)
    }
    if (typeof lastTimestampMs === 'number') {
      // Coinglass 文档示例：start_time 以毫秒为单位
      url.searchParams.set('start_time', Math.floor(lastTimestampMs).toString())
    } else {
      // 空库首次拉取时，如果不传任何时间参数，Coinglass 可能返回 time error。
      // 使用与回填深度一致的窗口作为初始 start_time。
      url.searchParams.set('start_time', this.getBackfillTarget(interval).toString())
    }

    this.logger.log(
      `Requesting Coinglass futures price history: ${url.toString()} (cursor: ${ctx.cursor ?? 'null'})`,
    )

    const json = await this.fetchFuturesPriceJson(url, apiKey)

    if (json.code !== '0' || !json.data) {
      throw new Error(
        `Coinglass futures price history API returned error: code=${json.code}, msg=${json.msg}`,
      )
    }

    if (json.data.length === 0) {
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify(cursor),
        meta: {
          symbol: cursor.symbol,
          exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
          contractType:
            cursor.contractType === undefined ? this.defaultContractType : cursor.contractType,
          interval,
          note: 'No futures price history data returned from API',
        },
      }
    }

    const client = this.prisma.getClient()

    const pointsWithTimestamps = json.data.map(point => {
      const timestampMs = point.time >= 1_000_000_000_000 ? point.time : point.time * 1000
      return {
        ...point,
        timestampMs,
      }
    })

    const incrementalPoints = lastTimestampMs
      ? pointsWithTimestamps.filter(point => point.timestampMs > lastTimestampMs)
      : pointsWithTimestamps

    let insertedCount = 0
    if (incrementalPoints.length > 0) {
      const rows = incrementalPoints.map(point => ({
        symbol: cursor.symbol,
        exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
        contractType: cursor.contractType ?? this.defaultContractType,
        interval: prismaInterval,
        timestamp: new Date(point.timestampMs),
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        volumeUsd: point.volume_usd ?? null,
        source: 'COINGLASS',
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

    const latestTimestampCandidates: number[] = []
    if (pointsWithTimestamps.length > 0) {
      for (const point of pointsWithTimestamps) {
        latestTimestampCandidates.push(point.timestampMs)
      }
    }
    if (typeof lastTimestampMs === 'number') {
      latestTimestampCandidates.push(lastTimestampMs)
    }
    const latestTimestampMs =
      latestTimestampCandidates.length > 0 ? Math.max(...latestTimestampCandidates) : undefined

    const newCursor: FuturesPriceCursor = {
      symbol: cursor.symbol,
      exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
      contractType:
        cursor.contractType === undefined ? this.defaultContractType : cursor.contractType,
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
        exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
        contractType:
          cursor.contractType === undefined ? this.defaultContractType : cursor.contractType,
        interval,
        latestTime: latestTimestampMs ? new Date(latestTimestampMs).toISOString() : null,
        lastTimestamp: latestTimestampMs ?? null,
        apiDataCount: json.data.length,
        insertedCount,
      },
    }
  }

  private async fetchFuturesPriceJson(
    url: URL,
    apiKey: string,
  ): Promise<CoinglassFuturesPriceApiResponse> {
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
              `Coinglass futures price history request failed (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
            )
            continue
          }

          throw new Error(
            `Coinglass futures price history request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} ${failure}`,
          )
        }

        return (await response.json()) as CoinglassFuturesPriceApiResponse
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
            `Coinglass futures price history request error (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
          )
          continue
        }

        throw new Error(
          `Coinglass futures price history request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${failure}`,
        )
      } finally {
        clearTimeout(timer)
      }
    }

    // 理论不可达，兜底
    throw new Error(
      `Coinglass futures price history request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${lastFailure ?? 'unknown'}`,
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
    } catch {
      return ''
    }
  }

  private async runBackfill(
    cursor: FuturesPriceCursor,
    endpoint: string,
    apiKey: string,
    earliestMs: number,
    targetMs: number,
    prismaInterval: string,
  ): Promise<JobRunResult> {
    const isSpot = cursor.contractType === null
    const contractType = isSpot ? null : (cursor.contractType ?? this.defaultContractType)

    const url = new URL(endpoint)
    url.searchParams.set('symbol', cursor.symbol)
    url.searchParams.set('interval', cursor.interval)
    url.searchParams.set('limit', this.defaultLimit.toString())
    if (cursor.exchangeCode) {
      url.searchParams.set('exchange', cursor.exchangeCode)
    }
    if (!isSpot && (cursor.contractType ?? this.defaultContractType)) {
      url.searchParams.set('contractType', cursor.contractType ?? this.defaultContractType!)
    }
    const backfillEndTimeMs = Math.max(earliestMs - 1000, 0)
    url.searchParams.set('end_time', Math.floor(backfillEndTimeMs).toString())

    this.logger.log(`Backfill request: ${url.toString()}`)

    const json = await this.fetchFuturesPriceJson(url, apiKey)

    const hasNoData = json.code === '0' && (!json.data || json.data.length === 0)
    if (json.code !== '0' || !json.data || json.data.length === 0) {
      const backfillCompleted = hasNoData ? true : cursor.backfillCompleted
      const backfillCompletedAt = hasNoData ? Date.now() : cursor.backfillCompletedAt
      const newCursor: FuturesPriceCursor = {
        symbol: cursor.symbol,
        exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
        contractType: cursor.contractType,
        interval: cursor.interval,
        lastTimestamp: cursor.lastTimestamp,
        backfillCompleted,
        backfillCompletedAt,
      }
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify(newCursor),
        meta: {
          symbol: cursor.symbol,
          exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
          contractType:
            cursor.contractType === undefined ? this.defaultContractType : cursor.contractType,
          interval: cursor.interval,
          note: 'Backfill complete - no more historical data',
        },
      }
    }

    const dbClient = this.prisma.getClient()

    const pointsWithTimestamps = json.data.map(point => {
      const timestampMs = point.time >= 1_000_000_000_000 ? point.time : point.time * 1000
      return {
        ...point,
        timestampMs,
      }
    })

    const filteredPoints = pointsWithTimestamps.filter(point => point.timestampMs < earliestMs)
    const rows = filteredPoints.map(point => ({
      symbol: cursor.symbol,
      exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
      contractType,
      interval: prismaInterval,
      timestamp: new Date(point.timestampMs),
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volumeUsd: point.volume_usd ?? null,
      source: 'COINGLASS',
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
      filteredPoints.length > 0 ? Math.min(...filteredPoints.map(p => p.timestampMs)) : earliestMs

    const backfillCompleted = oldestFetched <= targetMs
    const backfillCompletedAt = backfillCompleted ? Date.now() : cursor.backfillCompletedAt

    const denominator = earliestMs - targetMs
    const backfillProgress =
      denominator === 0 ? 100 : Math.round(((earliestMs - oldestFetched) / denominator) * 100)

    const newCursor: FuturesPriceCursor = {
      symbol: cursor.symbol,
      exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
      contractType: cursor.contractType,
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
        exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
        contractType:
          cursor.contractType === undefined ? this.defaultContractType : cursor.contractType,
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

  private applyMetaDefaults(cursor: FuturesPriceCursor, meta: unknown): void {
    if (!this.isRecord(meta)) return

    const symbol = this.getNonEmptyString(meta.symbol)
    if (symbol) {
      cursor.symbol = symbol
    }

    const exchangeCode = this.getNonEmptyString(meta.exchangeCode)
    if (exchangeCode) {
      cursor.exchangeCode = exchangeCode
    }

    const contractType = meta.contractType
    if (typeof contractType === 'string') {
      cursor.contractType = contractType.trim()
    } else if (contractType === null) {
      cursor.contractType = null
    }

    const interval = this.getNonEmptyString(meta.interval)
    if (interval && this.isAllowedInterval(interval)) {
      cursor.interval = interval
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  private getNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  private isAllowedInterval(value: string): value is MarketTimeframe {
    return (this.allowedIntervals as readonly string[]).includes(value)
  }

  private parseCursor(currentCursor: string | null): FuturesPriceCursor {
    if (!currentCursor) {
      return {
        symbol: this.defaultSymbol,
        exchangeCode: this.defaultExchangeCode,
        contractType: this.defaultContractType ?? undefined,
        interval: this.defaultInterval,
        lastTimestamp: undefined,
        backfillCompleted: false,
        backfillCompletedAt: undefined,
      }
    }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<FuturesPriceCursor>
      if (!parsed.symbol) {
        parsed.symbol = this.defaultSymbol
      }
      if (!parsed.exchangeCode) {
        parsed.exchangeCode = this.defaultExchangeCode
      }
      // contractType 约定：null=spot；undefined=使用默认期货合约
      if (parsed.contractType === undefined && this.defaultContractType) {
        parsed.contractType = this.defaultContractType
      }

      if (!parsed.interval || !this.isAllowedInterval(parsed.interval as string)) {
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
      return parsed as FuturesPriceCursor
    } catch {
      this.logger.warn(`Failed to parse cursor: ${currentCursor}, fallback to default`)
      return {
        symbol: this.defaultSymbol,
        exchangeCode: this.defaultExchangeCode,
        contractType: this.defaultContractType ?? undefined,
        interval: this.defaultInterval,
        lastTimestamp: undefined,
        backfillCompleted: false,
        backfillCompletedAt: undefined,
      }
    }
  }
}
