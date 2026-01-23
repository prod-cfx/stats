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
   */
  contractType?: string
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

  // 默认配置：BTCUSDT.BINANCE.PERP & 4h 粒度
  private readonly defaultSymbol = 'BTCUSDT'
  private readonly defaultExchangeCode = 'BINANCE'
  private readonly defaultContractType: string | null = 'PERPETUAL'
  private readonly defaultInterval: MarketTimeframe = '4h'
  private readonly defaultLimit = 1000

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async run(ctx: DataPullJobContext): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)

    const apiKey = this.configService.get<string>('COINGLASS_API_KEY')

    // 根据 contractType 动态选择 endpoint
    // contractType 为 null 时使用现货 API，否则使用期货 API
    const isSpot = cursor.contractType === null || cursor.contractType === undefined
    const endpoint = isSpot
      ? 'https://open-api-v4.coinglass.com/api/spot/price/history'
      : 'https://open-api-v4.coinglass.com/api/futures/price/history'

    if (!apiKey) {
      // 不应"默默成功"，否则后台无法感知配置缺失
      throw new Error('COINGLASS_API_KEY is not configured')
    }

    const interval = cursor.interval ?? this.defaultInterval
    const lastTimestampMs = cursor.lastTimestamp ?? null

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
          contractType: cursor.contractType ?? this.defaultContractType,
          interval,
          note: 'No futures price history data returned from API',
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

      const result = await client.futuresPriceHistory.createMany({
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

    const newCursor: FuturesPriceCursor = {
      symbol: cursor.symbol,
      exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
      contractType: cursor.contractType ?? this.defaultContractType ?? undefined,
      interval,
      lastTimestamp: latestTimestampMs,
    }

    return {
      fetchedCount: insertedCount,
      newCursor: JSON.stringify(newCursor),
      meta: {
        symbol: cursor.symbol,
        exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
        contractType: cursor.contractType ?? this.defaultContractType,
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

        const failure =
          isAbort
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

  private parseCursor(currentCursor: string | null): FuturesPriceCursor {
    if (!currentCursor) {
      return {
        symbol: this.defaultSymbol,
        exchangeCode: this.defaultExchangeCode,
        contractType: this.defaultContractType ?? undefined,
        interval: this.defaultInterval,
        lastTimestamp: undefined,
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
      if (!parsed.contractType && this.defaultContractType) {
        parsed.contractType = this.defaultContractType
      }
      if (!parsed.interval) {
        parsed.interval = this.defaultInterval
      }
      if (typeof parsed.lastTimestamp !== 'number') {
        delete parsed.lastTimestamp
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
      }
    }
  }
}

