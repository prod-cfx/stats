import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { DataPullJob, DataPullJobContext, JobRunResult } from '../contracts/data-pull-job'
import { ErrorCode } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService/PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionEventsService } from '@/common/services/transaction-events.service'

interface PairsMarketsCursor {
  /**
   * 币种符号，例如 BTC / ETH
   */
  symbol: string
  /**
   * 最新快照时间（可选，仅用于观测）
   */
  lastSnapshotTime?: string
}

interface PairsMarketsDataPoint {
  instrument_id: string
  exchange_name: string
  symbol: string
  current_price: number
  index_price?: number
  price_change_percent_24h?: number
  volume_usd: number
  volume_usd_change_percent_24h?: number
  long_volume_usd?: number
  short_volume_usd?: number
  long_volume_quantity?: number
  short_volume_quantity?: number
  open_interest_quantity?: number
  open_interest_usd?: number
  open_interest_change_percent_24h?: number
  long_liquidation_usd_24h?: number
  short_liquidation_usd_24h?: number
  funding_rate?: number
  next_funding_time?: number
  open_interest_volume_radio?: number
  oi_vol_ratio_change_percent_24h?: number
}

interface PairsMarketsApiResponse {
  code: string
  msg: string
  data?: PairsMarketsDataPoint[]
}

@Injectable()
export class CoinglassPairsMarketsJob implements DataPullJob {
  readonly key = 'coinglass-pairs-markets'
  private readonly logger = new Logger(CoinglassPairsMarketsJob.name)
  private readonly requestTimeoutMs = 15_000
  private readonly maxAttempts = 2
  private readonly defaultSymbol = 'BTC'

  constructor(
    private readonly configService: ConfigService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly txEvents: TransactionEventsService,
  ) {}

  async run(ctx: DataPullJobContext): Promise<JobRunResult> {
    return this.txEvents.withAfterCommit(() => this.execute(ctx))
  }

  private async execute(ctx: DataPullJobContext): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)

    const apiKey = this.configService.get<string>('COINGLASS_API_KEY')
    const endpoint =
      this.configService.get<string>('COINGLASS_PAIRS_MARKETS_ENDPOINT') ??
      'https://open-api-v4.coinglass.com/api/futures/pairs-markets'

    if (!apiKey) {
      throw new DomainException('data_sync.pairs_markets.config_missing', {
        code: ErrorCode.DATA_SYNC_CONFIG_MISSING,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: 'COINGLASS_API_KEY is not configured' },
      })
    }

    const url = new URL(endpoint)
    url.searchParams.set('symbol', cursor.symbol)

    this.logger.log(`Requesting Coinglass pairs-markets: ${url.toString()}`)

    const json = await this.fetchPairsMarketsJson(url, apiKey)

    if (json.code !== '0' || !json.data) {
      throw new DomainException('data_sync.pairs_markets.invalid_response', {
        code: ErrorCode.DATA_SYNC_INVALID_RESPONSE,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: `Coinglass pairs-markets API returned error: code=${json.code}, msg=${json.msg}` },
      })
    }

    if (json.data.length === 0) {
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify(cursor),
        meta: {
          symbol: cursor.symbol,
          note: 'No pairs-markets data returned from API',
        },
      }
    }

    const client = this.txHost.tx
    const now = new Date()

    // 过滤无效数据点（必需字段校验）
    const validDataPoints = json.data.filter((point) => {
      if (!point.instrument_id || !point.exchange_name || !point.symbol) {
        this.logger.warn(
          `Skipping invalid data point: missing required fields (instrument_id=${point.instrument_id}, exchange_name=${point.exchange_name}, symbol=${point.symbol})`,
        )
        return false
      }
      if (point.current_price == null || point.volume_usd == null) {
        this.logger.warn(
          `Skipping invalid data point: missing price/volume (symbol=${point.symbol}, exchange=${point.exchange_name})`,
        )
        return false
      }
      return true
    })

    // 批量 upsert（限制并发数为 10 以避免连接池耗尽）
    let upsertedCount = 0
    let failedCount = 0
    const batchSize = 10
    for (let i = 0; i < validDataPoints.length; i += batchSize) {
      const batch = validDataPoints.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(async (point) => {
          await client.futuresPairsMarket.upsert({
            where: {
              symbol_exchangeName_instrumentId: {
                symbol: point.symbol,
                exchangeName: point.exchange_name,
                instrumentId: point.instrument_id,
              },
            },
            update: {
              currentPrice: point.current_price.toString(),
              indexPrice: point.index_price?.toString(),
              priceChangePercent24h: point.price_change_percent_24h?.toString(),
              volumeUsd: point.volume_usd.toString(),
              volumeUsdChangePercent24h: point.volume_usd_change_percent_24h?.toString(),
              longVolumeUsd: point.long_volume_usd?.toString(),
              shortVolumeUsd: point.short_volume_usd?.toString(),
              longVolumeQuantity: point.long_volume_quantity?.toString(),
              shortVolumeQuantity: point.short_volume_quantity?.toString(),
              openInterestQuantity: point.open_interest_quantity?.toString(),
              openInterestUsd: point.open_interest_usd?.toString(),
              openInterestChangePercent24h: point.open_interest_change_percent_24h?.toString(),
              longLiquidationUsd24h: point.long_liquidation_usd_24h?.toString(),
              shortLiquidationUsd24h: point.short_liquidation_usd_24h?.toString(),
              fundingRate: point.funding_rate?.toString(),
              nextFundingTime: point.next_funding_time ? BigInt(point.next_funding_time) : null,
              openInterestVolumeRatio: point.open_interest_volume_radio?.toString(),
              oiVolRatioChangePercent24h: point.oi_vol_ratio_change_percent_24h?.toString(),
              updatedAt: now,
            },
            create: {
              exchangeName: point.exchange_name,
              instrumentId: point.instrument_id,
              symbol: point.symbol,
              currentPrice: point.current_price.toString(),
              indexPrice: point.index_price?.toString(),
              priceChangePercent24h: point.price_change_percent_24h?.toString(),
              volumeUsd: point.volume_usd.toString(),
              volumeUsdChangePercent24h: point.volume_usd_change_percent_24h?.toString(),
              longVolumeUsd: point.long_volume_usd?.toString(),
              shortVolumeUsd: point.short_volume_usd?.toString(),
              longVolumeQuantity: point.long_volume_quantity?.toString(),
              shortVolumeQuantity: point.short_volume_quantity?.toString(),
              openInterestQuantity: point.open_interest_quantity?.toString(),
              openInterestUsd: point.open_interest_usd?.toString(),
              openInterestChangePercent24h: point.open_interest_change_percent_24h?.toString(),
              longLiquidationUsd24h: point.long_liquidation_usd_24h?.toString(),
              shortLiquidationUsd24h: point.short_liquidation_usd_24h?.toString(),
              fundingRate: point.funding_rate?.toString(),
              nextFundingTime: point.next_funding_time ? BigInt(point.next_funding_time) : null,
              openInterestVolumeRatio: point.open_interest_volume_radio?.toString(),
              oiVolRatioChangePercent24h: point.oi_vol_ratio_change_percent_24h?.toString(),
              source: 'COINGLASS',
            },
          })
          return point
        }),
      )

      for (let j = 0; j < results.length; j++) {
        const result = results[j]
        if (result.status === 'fulfilled') {
          upsertedCount += 1
        } else {
          failedCount += 1
          const failedPoint = batch[j]
          this.logger.warn(`Failed to upsert pairs-market record: ${result.reason}`)
          this.logger.warn(`Failed data point: ${JSON.stringify(failedPoint)}`)
        }
      }
    }

    if (failedCount > 0) {
      this.logger.warn(
        `Batch upsert completed with ${failedCount} failures out of ${validDataPoints.length} records`,
      )
    }

    const newCursor: PairsMarketsCursor = {
      symbol: cursor.symbol,
      lastSnapshotTime: now.toISOString(),
    }

    const skippedCount = json.data.length - validDataPoints.length

    return {
      fetchedCount: upsertedCount,
      newCursor: JSON.stringify(newCursor),
      meta: {
        symbol: cursor.symbol,
        snapshotTime: now.toISOString(),
        apiDataCount: json.data.length,
        validDataCount: validDataPoints.length,
        skippedCount,
        upsertedCount,
        failedCount,
      },
    }
  }

  private async fetchPairsMarketsJson(url: URL, apiKey: string): Promise<PairsMarketsApiResponse> {
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
              `Coinglass pairs-markets request failed (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
            )
            continue
          }

          throw new DomainException('data_sync.pairs_markets.api_error', {
            code: ErrorCode.DATA_SYNC_API_ERROR,
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            args: { reason: `Coinglass pairs-markets request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} ${failure}` },
          })
        }

        return (await response.json()) as PairsMarketsApiResponse
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
            `Coinglass pairs-markets request error (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
          )
          continue
        }

        throw new DomainException('data_sync.pairs_markets.api_error', {
          code: ErrorCode.DATA_SYNC_API_ERROR,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          args: { reason: `Coinglass pairs-markets request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} error=${failure}` },
        })
      } finally {
        clearTimeout(timer)
      }
    }

    // 理论不可达，兜底
    throw new DomainException('data_sync.pairs_markets.api_error', {
      code: ErrorCode.DATA_SYNC_API_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      args: { reason: `Coinglass pairs-markets request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${lastFailure ?? 'unknown'}` },
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

  private parseCursor(currentCursor: string | null): PairsMarketsCursor {
    if (!currentCursor) {
      return {
        symbol: this.defaultSymbol,
      }
    }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<PairsMarketsCursor>
      return {
        symbol: parsed.symbol || this.defaultSymbol,
        lastSnapshotTime: parsed.lastSnapshotTime,
      }
    } catch {
      this.logger.warn(`Failed to parse cursor: ${currentCursor}, fallback to default`)
      return {
        symbol: this.defaultSymbol,
      }
    }
  }
}
