import type { MarketTimeframe } from '@ai/shared'
import type {
  DataPullJob,
  DataPullJobContext,
  JobMetaSchema,
  JobRunResult,
} from '../../data-sync/contracts/data-pull-job'
import { Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService/PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

interface OiOhlcAggregatedMeta {
  symbol: string
  interval?: string
}

interface OiOhlcAggregatedCursor {
  lastTimestamp?: number
}

interface OiOhlcDataPoint {
  t: number
  o: string
  h: string
  l: string
  c: string
}

interface OiOhlcApiResponse {
  code: string
  msg: string
  data?: OiOhlcDataPoint[]
}

@Injectable()
export class CoinglassOiOhlcAggregatedJob implements DataPullJob<OiOhlcAggregatedMeta> {
  // Job key 作为前缀匹配，实际任务 key 格式为: coinglass-oi-ohlc-aggregated:${symbol}-${interval}
  readonly key = 'coinglass-oi-ohlc-aggregated'
  readonly name = 'Coinglass 聚合持仓量 OHLC 数据'
  readonly metaSchema: JobMetaSchema = {
    description: '从 Coinglass 拉取指定币种的聚合持仓量 OHLC 历史数据',
    fields: [
      {
        name: 'symbol',
        type: 'string',
        required: true,
        description: '币种符号',
        options: ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'MATIC'],
        defaultValue: 'BTC',
      },
      {
        name: 'interval',
        type: 'string',
        required: false,
        description: '时间粒度（当前仅启用 1h 和 4h）',
        options: ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '6h', '8h', '12h', '1d', '1w'],
        defaultValue: '1h',
      },
    ],
    example: {
      symbol: 'BTC',
      interval: '1h',
    },
  }

  private readonly logger = new Logger(CoinglassOiOhlcAggregatedJob.name)
  private readonly requestTimeoutMs = 10_000
  private readonly maxAttempts = 2
  private readonly defaultSymbol = 'BTC'
  private readonly defaultInterval: MarketTimeframe = '1h'
  private readonly defaultLimit = 1000
  private readonly backfillDays = 30

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async run(ctx: DataPullJobContext<OiOhlcAggregatedMeta>): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)

    const apiKey = this.configService.get<string>('COINGLASS_API_KEY')
    const endpoint =
      this.configService.get<string>('COINGLASS_OI_OHLC_ENDPOINT') ??
      'https://open-api-v4.coinglass.com/api/futures/open-interest/aggregated-history'

    if (!apiKey) {
      throw new Error('COINGLASS_API_KEY is not configured')
    }

    const symbol = ctx.meta?.symbol || this.defaultSymbol
    const interval = (ctx.meta?.interval as MarketTimeframe | undefined) || this.defaultInterval
    const lastTimestampMs = cursor.lastTimestamp ?? null

    const url = new URL(endpoint)
    url.searchParams.set('symbol', symbol)
    url.searchParams.set('interval', interval)
    url.searchParams.set('limit', this.defaultLimit.toString())

    if (typeof lastTimestampMs === 'number') {
      // Coinglass v4 文档示例：start_time 以毫秒为单位
      url.searchParams.set('start_time', Math.floor(lastTimestampMs).toString())
    } else if (!ctx.cursor) {
      const backfillStart = Date.now() - this.backfillDays * 24 * 60 * 60 * 1000
      // Coinglass v4 文档示例：start_time 以毫秒为单位
      url.searchParams.set('start_time', Math.floor(backfillStart).toString())
    }

    this.logger.log(
      `Requesting Coinglass aggregated OI OHLC history: symbol=${symbol}, interval=${interval}, cursor=${ctx.cursor ?? 'null'}`,
    )

    const json = await this.fetchJson(url, apiKey)

    if (json.code !== '0' || !json.data) {
      throw new Error(`Coinglass OI OHLC API returned error: code=${json.code}, msg=${json.msg}`)
    }

    if (json.data.length === 0) {
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify(cursor),
        meta: {
          symbol,
          interval,
          note: 'No aggregated OI OHLC data returned from API',
        },
      }
    }

    const client = this.prisma.getClient()
    const prismaInterval = mapTimeframe(interval)

    const pointsWithTimestamps = json.data.map(point => ({
      ...point,
      timestampMs: point.t * 1000,
    }))

    const incrementalPoints = lastTimestampMs
      ? pointsWithTimestamps.filter(point => point.timestampMs > lastTimestampMs)
      : pointsWithTimestamps

    let insertedCount = 0
    if (incrementalPoints.length > 0) {
      const rows = incrementalPoints.map(point => ({
        symbol,
        interval: prismaInterval,
        timestamp: new Date(point.timestampMs),
        open: point.o.toString(),
        high: point.h.toString(),
        low: point.l.toString(),
        close: point.c.toString(),
      }))

      const result = await client.openInterestOhlcHistory.createMany({
        data: rows,
        skipDuplicates: true,
      })
      insertedCount = result.count
    }

    // API 数据按时间升序排列，直接取最后一条的时间戳
    const latestTimestampMs =
      pointsWithTimestamps.length > 0
        ? pointsWithTimestamps[pointsWithTimestamps.length - 1].timestampMs
        : (lastTimestampMs ?? undefined)

    const newCursor: OiOhlcAggregatedCursor = {
      lastTimestamp: latestTimestampMs,
    }

    return {
      fetchedCount: insertedCount,
      newCursor: JSON.stringify(newCursor),
      meta: {
        symbol,
        interval,
        latestTime: latestTimestampMs ? new Date(latestTimestampMs).toISOString() : null,
        lastTimestamp: latestTimestampMs ?? null,
        apiDataCount: json.data.length,
        insertedCount,
      },
    }
  }

  private async fetchJson(url: URL, apiKey: string): Promise<OiOhlcApiResponse> {
    const requestInit: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
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
              `Coinglass OI OHLC request failed (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
            )
            continue
          }

          throw new Error(
            `Coinglass OI OHLC request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} ${failure}`,
          )
        }

        return (await response.json()) as OiOhlcApiResponse
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
            `Coinglass OI OHLC request error (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
          )
          continue
        }

        throw new Error(
          `Coinglass OI OHLC request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} error=${failure}`,
        )
      } finally {
        clearTimeout(timer)
      }
    }

    throw new Error(
      `Coinglass OI OHLC request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${
        lastFailure ?? 'unknown'
      }`,
    )
  }

  private parseCursor(currentCursor: string | null): OiOhlcAggregatedCursor {
    if (!currentCursor) {
      return { lastTimestamp: undefined }
    }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<OiOhlcAggregatedCursor>
      return {
        lastTimestamp: typeof parsed.lastTimestamp === 'number' ? parsed.lastTimestamp : undefined,
      }
    } catch {
      this.logger.warn(`Failed to parse cursor: ${currentCursor}, fallback to default`)
      return { lastTimestamp: undefined }
    }
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
}
