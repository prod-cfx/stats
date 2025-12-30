import type { MarketTimeframe } from '@ai/shared'
import type { DataPullJob, DataPullJobContext, JobMetaSchema, JobRunResult } from '../contracts/data-pull-job'
import { Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService/PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

/**
 * 任务配置参数（存放在 data_pull_tasks.meta 中，创建后不变）
 */
interface AggregatedLiquidationMeta {
  /**
   * 币种基础资产，例如 BTC
   */
  symbol: string
  /**
   * 交易所代码，例如 Binance / OKX / AGGREGATED（全市场聚合）
   */
  exchangeCode?: string
  /**
   * 时间粒度，如 "1h" / "4h" / "1d"
   */
  interval?: string
}

/**
 * 运行时状态（存放在 data_pull_tasks.cursor 中，每次执行后更新）
 *
 * 兼容说明：
 * - 旧版本会在 cursor 中同时保存 symbol/exchangeCode/interval + lastTimestamp
 * - 新版本仅在 cursor 中保存 lastTimestamp，配置参数迁移到 meta
 * - 为兼容历史任务，这里仍保留旧字段的可选解析
 */
interface AggregatedLiquidationCursor {
  /**
   * 最新一次成功写入的数据点时间戳（毫秒）
   * 用于后续增量抓取
   */
  lastTimestamp?: number
  // 兼容历史 cursor：旧格式中保存的配置字段
  symbol?: string
  exchangeCode?: string | null
  interval?: string | null
}

interface AggregatedLiquidationPoint {
  time: number
  aggregated_long_liquidation_usd: number
  aggregated_short_liquidation_usd: number
}

interface AggregatedLiquidationApiResponse {
  code: string
  msg: string
  data?: AggregatedLiquidationPoint[]
}

@Injectable()
export class CoinglassAggregatedLiquidationJob implements DataPullJob<AggregatedLiquidationMeta> {
  readonly key = 'coinglass-aggregated-liquidation'
  readonly name = 'Coinglass 聚合清算数据'
  readonly metaSchema: JobMetaSchema = {
    description: '从 Coinglass 拉取指定币种的聚合清算历史数据',
    fields: [
      {
        name: 'symbol',
        type: 'string',
        required: true,
        description: '币种基础资产',
        options: ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'MATIC'],
        defaultValue: 'BTC',
      },
      {
        name: 'exchangeCode',
        type: 'string',
        required: false,
        description: '交易所代码，AGGREGATED 表示全市场聚合',
        options: ['Binance', 'OKX', 'Bybit', 'Bitget', 'dYdX', 'AGGREGATED'],
        defaultValue: 'Binance',
      },
      {
        name: 'interval',
        type: 'string',
        required: false,
        description:
          '时间粒度（Coinglass 支持：1m、3m、5m、15m、30m、1h、4h、6h、8h、12h、1d、1w；当前系统已全部支持）',
        options: ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '6h', '8h', '12h', '1d', '1w'],
        defaultValue: '4h',
      },
    ],
    example: {
      symbol: 'BTC',
      exchangeCode: 'Binance',
      interval: '1h',
    },
  }

  private readonly logger = new Logger(CoinglassAggregatedLiquidationJob.name)
  private readonly requestTimeoutMs = 10_000
  private readonly maxAttempts = 2

  // 默认配置：BTC & 4h 粒度，如需更多币种/周期通过任务 meta 配置
  private readonly defaultSymbol = 'BTC'
  // 不传时按文档默认 Binance
  private readonly defaultExchangeCode: string | null = 'Binance'
  // 显式聚合（全市场）的 Exchange 代号
  private readonly aggregatedExchangeCode = 'AGGREGATED' as const
  private readonly defaultInterval: MarketTimeframe = '4h'
  private readonly defaultLimit = 1000

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async run(ctx: DataPullJobContext<AggregatedLiquidationMeta>): Promise<JobRunResult> {
    // 先解析 cursor（可能包含历史格式中的 symbol/exchange/interval）
    const cursor = this.parseCursor(ctx.cursor)
    // 再从 meta 读取任务配置（不会被运行时修改），meta 为空时兼容从旧 cursor 中读取配置
    const config = this.parseConfig(ctx.meta, cursor)

    const apiKey = this.configService.get<string>('COINGLASS_API_KEY')
    const endpoint =
      this.configService.get<string>('COINGLASS_AGG_LIQUIDATION_ENDPOINT') ??
      // v4 官方文档路径，如有变更可通过环境变量覆盖
      'https://open-api-v4.coinglass.com/api/futures/liquidation/aggregated-history'

    if (!apiKey) {
      // 不应“默默成功”，否则后台无法感知配置缺失
      throw new Error('COINGLASS_API_KEY is not configured')
    }

    // 从 config（meta）读取任务配置
    const symbol = config.symbol
    const interval = config.interval ?? this.defaultInterval
    const exchange = this.normalizeExchangeCode(config.exchangeCode)

    // 从 cursor 读取运行时状态
    const lastTimestampMs = cursor.lastTimestamp ?? null

    const url = new URL(endpoint)
    url.searchParams.set('symbol', symbol)
    url.searchParams.set('interval', interval)
    url.searchParams.set('limit', this.defaultLimit.toString())

    if (exchange !== this.aggregatedExchangeCode) {
      // v4 文档中的参数名：exchange_list，以逗号分隔多交易所
      url.searchParams.set('exchange_list', exchange)
    }
    if (typeof lastTimestampMs === 'number') {
      // Coinglass 文档示例：start_time 以毫秒为单位
      url.searchParams.set('start_time', Math.floor(lastTimestampMs).toString())
    }

    this.logger.log(`Requesting Coinglass aggregated liquidation history: ${url.toString()}`)

    const json = await this.fetchAggregatedJson(url, apiKey)

    if (json.code !== '0' || !json.data) {
      throw new Error(
        `Coinglass aggregated liquidation API returned error: code=${json.code}, msg=${json.msg}`,
      )
    }

    if (json.data.length === 0) {
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify(cursor),
        meta: {
          symbol,
          note: 'No aggregated liquidation data returned from API',
        },
      }
    }

    const client = this.prisma.getClient()

    // 将返回的时间戳转换为毫秒，并以字符串形式存储 Decimal 字段

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
        symbol,
        exchangeCode: exchange,
        // 直接存储 Coinglass 时间粒度字符串（如 "4h" / "12h"）
        interval,
        timestamp: new Date(point.timestampMs),
        longLiquidationUsd: point.aggregated_long_liquidation_usd.toString(),
        shortLiquidationUsd: point.aggregated_short_liquidation_usd.toString(),
      }))

      const result = await client.aggregatedLiquidationHistory.createMany({
        data: rows,
        skipDuplicates: true,
      })
      insertedCount = result.count
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

    // newCursor 只保存运行时状态（lastTimestamp），配置参数在 meta 中
    const newCursor: AggregatedLiquidationCursor = {
      lastTimestamp: latestTimestampMs,
    }

    return {
      fetchedCount: insertedCount,
      newCursor: JSON.stringify(newCursor),
      meta: {
        symbol,
        interval,
        exchangeCode: exchange,
        latestTime: latestTimestampMs ? new Date(latestTimestampMs).toISOString() : null,
        lastTimestamp: latestTimestampMs ?? null,
        apiDataCount: json.data.length,
        insertedCount,
      },
    }
  }

  private async fetchAggregatedJson(
    url: URL,
    apiKey: string,
  ): Promise<AggregatedLiquidationApiResponse> {
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
              `Coinglass aggregated liquidation request failed (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
            )
            continue
          }

          throw new Error(
            `Coinglass aggregated liquidation request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} ${failure}`,
          )
        }

        return (await response.json()) as AggregatedLiquidationApiResponse
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
            `Coinglass aggregated liquidation request error (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
          )
          continue
        }

        throw new Error(
          `Coinglass aggregated liquidation request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} error=${failure}`,
        )
      } finally {
        clearTimeout(timer)
      }
    }

    // 理论不可达，兜底
    throw new Error(
      `Coinglass aggregated liquidation request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${lastFailure ?? 'unknown'}`,
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

  /**
   * 解析任务配置。
   *
   * 优先从 meta 中读取；如果 meta 为空，则尝试从旧版 cursor 中恢复 symbol/exchange/interval，
   * 以避免线上已有任务在升级后退回默认配置导致拉取错误数据。
   */
  private parseConfig(
    meta: AggregatedLiquidationMeta | null,
    legacyCursor: AggregatedLiquidationCursor | null,
  ): AggregatedLiquidationMeta {
    const legacySymbol = legacyCursor?.symbol
    const legacyExchangeCode = legacyCursor?.exchangeCode ?? undefined
    const legacyInterval = legacyCursor?.interval

    if (!meta) {
      return {
        symbol: legacySymbol || this.defaultSymbol,
        exchangeCode: this.normalizeExchangeCode(legacyExchangeCode),
        interval: (legacyInterval as MarketTimeframe | undefined) || this.defaultInterval,
      }
    }

    return {
      symbol: meta.symbol || legacySymbol || this.defaultSymbol,
      exchangeCode: this.normalizeExchangeCode(meta.exchangeCode ?? legacyExchangeCode),
      interval: (meta.interval as MarketTimeframe | undefined) || legacyInterval || this.defaultInterval,
    }
  }

  /**
   * 解析运行时状态（从 cursor 中读取）
   *
   * 兼容说明：
   * - 旧格式：{"symbol":"BTC","exchangeCode":"Binance","interval":"4h","lastTimestamp":...}
   * - 新格式：{"lastTimestamp":...}
   */
  private parseCursor(currentCursor: string | null): AggregatedLiquidationCursor {
    if (!currentCursor) {
      return { lastTimestamp: undefined }
    }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<AggregatedLiquidationCursor>
      return {
        lastTimestamp: typeof parsed.lastTimestamp === 'number' ? parsed.lastTimestamp : undefined,
        symbol: typeof parsed.symbol === 'string' ? parsed.symbol : undefined,
        exchangeCode:
          typeof parsed.exchangeCode === 'string' || parsed.exchangeCode === null
            ? parsed.exchangeCode
            : undefined,
        interval: typeof parsed.interval === 'string' ? parsed.interval : undefined,
      }
    } catch {
      this.logger.warn(`Failed to parse cursor: ${currentCursor}, fallback to default`)
      return { lastTimestamp: undefined }
    }
  }

  private normalizeExchangeCode(value: string | null | undefined): string {
    if (value === null || value === '' || value === this.aggregatedExchangeCode) {
      return this.aggregatedExchangeCode
    }
    if (typeof value === 'undefined') {
      return this.defaultExchangeCode ?? this.aggregatedExchangeCode
    }
    return value
  }
}

