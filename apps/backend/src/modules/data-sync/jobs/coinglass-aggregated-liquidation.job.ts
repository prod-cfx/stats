import type { MarketTimeframe } from '@ai/shared'
import type { DataPullJob, JobRunResult } from '../contracts/data-pull-job'
import { Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService/PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

interface AggregatedLiquidationCursor {
  /**
   * 币种基础资产，例如 BTC
   */
  symbol: string
  /**
   * 交易所代码，例如 Binance / OKX；对应 exchange_list 参数
   */
  exchangeCode?: string

  /**
   * 时间粒度，如 "1h" / "4h" / "1d"
   * 不传时使用默认值
   */
  interval?: string

  /**
   * 最新一次成功写入的数据点时间戳（毫秒）
   * 主要用于后续增量抓取
   */
  lastTimestamp?: number
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
export class CoinglassAggregatedLiquidationJob implements DataPullJob {
  readonly key = 'coinglass-aggregated-liquidation'
  private readonly logger = new Logger(CoinglassAggregatedLiquidationJob.name)
  private readonly requestTimeoutMs = 10_000
  private readonly maxAttempts = 2

  // 默认配置：BTC & 4h 粒度，如需更多币种/周期通过任务 cursor 配置
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

  async run(currentCursor: string | null): Promise<JobRunResult> {
    const cursor = this.parseCursor(currentCursor)

    const apiKey = this.configService.get<string>('COINGLASS_API_KEY')
    const endpoint =
      this.configService.get<string>('COINGLASS_AGG_LIQUIDATION_ENDPOINT') ??
      // v4 官方文档路径，如有变更可通过环境变量覆盖
      'https://open-api-v4.coinglass.com/api/futures/liquidation/aggregated-history'

    if (!apiKey) {
      // 不应“默默成功”，否则后台无法感知配置缺失
      throw new Error('COINGLASS_API_KEY is not configured')
    }

    const interval = cursor.interval ?? this.defaultInterval

    const url = new URL(endpoint)
    url.searchParams.set('symbol', cursor.symbol)
    url.searchParams.set('interval', interval)
    url.searchParams.set('limit', this.defaultLimit.toString())

    const exchange = this.normalizeExchangeCode(cursor.exchangeCode)
    if (exchange !== this.aggregatedExchangeCode) {
      // v4 文档中的参数名：exchange_list，以逗号分隔多交易所
      url.searchParams.set('exchange_list', exchange)
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
          symbol: cursor.symbol,
          note: 'No aggregated liquidation data returned from API',
        },
      }
    }

    const client = this.prisma.getClient()

    // 将返回的时间戳转换为 Date，并以字符串形式存储 Decimal 字段
    const prismaInterval = mapTimeframe(interval as MarketTimeframe)

    const rows = json.data.map(point => ({
      symbol: cursor.symbol,
      exchangeCode: exchange,
      interval: prismaInterval,
      timestamp: new Date(point.time),
      longLiquidationUsd: point.aggregated_long_liquidation_usd.toString(),
      shortLiquidationUsd: point.aggregated_short_liquidation_usd.toString(),
    }))

    const result = await client.aggregatedLiquidationHistory.createMany({
      data: rows,
      skipDuplicates: true,
    })

    const latestPoint = json.data.reduce((max, cur) => (cur.time > max.time ? cur : max), json.data[0])

    const newCursor: AggregatedLiquidationCursor = {
      symbol: cursor.symbol,
      exchangeCode: exchange,
      interval,
      lastTimestamp: latestPoint.time,
    }

    return {
      fetchedCount: result.count,
      newCursor: JSON.stringify(newCursor),
      meta: {
        symbol: cursor.symbol,
        interval,
        exchangeCode: exchange,
        latestTime: new Date(latestPoint.time).toISOString(),
        lastTimestamp: latestPoint.time,
        apiDataCount: json.data.length,
        insertedCount: result.count,
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

  private parseCursor(currentCursor: string | null): AggregatedLiquidationCursor {
    if (!currentCursor) {
      return {
        symbol: this.defaultSymbol,
        exchangeCode: this.normalizeExchangeCode(undefined),
        interval: this.defaultInterval,
        lastTimestamp: undefined,
      }
    }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<AggregatedLiquidationCursor>
      if (!parsed.symbol) {
        parsed.symbol = this.defaultSymbol
      }
      parsed.exchangeCode = this.normalizeExchangeCode(parsed.exchangeCode)
      if (!parsed.interval) {
        parsed.interval = this.defaultInterval
      }
      if (typeof parsed.lastTimestamp !== 'number') {
        delete parsed.lastTimestamp
      }
      return parsed as AggregatedLiquidationCursor
    } catch {
      this.logger.warn(`Failed to parse cursor: ${currentCursor}, fallback to default`)
      return {
        symbol: this.defaultSymbol,
        exchangeCode: this.normalizeExchangeCode(undefined),
        interval: this.defaultInterval,
        lastTimestamp: undefined,
      }
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

