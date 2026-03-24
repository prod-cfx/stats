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

interface CoinsPriceChangeCursor {
  /**
   * 最新快照时间（可选，仅用于观测）
   */
  lastSnapshotTime?: string
}

interface CoinsPriceChangeDataPoint {
  symbol: string
  current_price: number
  price_change_percent_5m: number | null
  price_change_percent_15m: number | null
  price_change_percent_30m: number | null
  price_change_percent_1h: number | null
  price_change_percent_4h: number | null
  price_change_percent_12h: number | null
  price_change_percent_24h: number | null
  price_amplitude_percent_5m: number | null
  price_amplitude_percent_15m: number | null
  price_amplitude_percent_30m: number | null
  price_amplitude_percent_1h: number | null
  price_amplitude_percent_4h: number | null
  price_amplitude_percent_12h: number | null
  price_amplitude_percent_24h: number | null
}

interface CoinsPriceChangeApiResponse {
  code: string
  msg: string
  data?: CoinsPriceChangeDataPoint[]
}

@Injectable()
export class CoinglassCoinsPriceChangeJob implements DataPullJob {
  readonly key = 'coinglass-coins-price-change'
  private readonly logger = new Logger(CoinglassCoinsPriceChangeJob.name)
  private readonly requestTimeoutMs = 15_000
  private readonly maxAttempts = 2

  constructor(
    private readonly configService: ConfigService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly txEvents: TransactionEventsService,
  ) {}

  /**
   * 将 API 数据点映射为数据库字段
   * 处理 null 值，使用 '0' 作为默认值
   */
  private mapDataPoint(point: CoinsPriceChangeDataPoint, now: Date) {
    return {
      currentPrice: point.current_price.toString(),
      priceChangePercent5m: point.price_change_percent_5m?.toString() ?? null,
      priceChangePercent15m: point.price_change_percent_15m?.toString() ?? null,
      priceChangePercent30m: point.price_change_percent_30m?.toString() ?? null,
      priceChangePercent1h: point.price_change_percent_1h?.toString() ?? null,
      priceChangePercent4h: point.price_change_percent_4h?.toString() ?? null,
      priceChangePercent12h: point.price_change_percent_12h?.toString() ?? null,
      priceChangePercent24h: point.price_change_percent_24h?.toString() ?? null,
      priceAmplitudePercent5m: point.price_amplitude_percent_5m?.toString() ?? null,
      priceAmplitudePercent15m: point.price_amplitude_percent_15m?.toString() ?? null,
      priceAmplitudePercent30m: point.price_amplitude_percent_30m?.toString() ?? null,
      priceAmplitudePercent1h: point.price_amplitude_percent_1h?.toString() ?? null,
      priceAmplitudePercent4h: point.price_amplitude_percent_4h?.toString() ?? null,
      priceAmplitudePercent12h: point.price_amplitude_percent_12h?.toString() ?? null,
      priceAmplitudePercent24h: point.price_amplitude_percent_24h?.toString() ?? null,
      dataTimestamp: now,
    }
  }

  async run(ctx: DataPullJobContext): Promise<JobRunResult> {
    return this.txEvents.withAfterCommit(() => this.execute(ctx))
  }

  private async execute(ctx: DataPullJobContext): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)

    const apiKey = this.configService.get<string>('COINGLASS_API_KEY')
    const endpoint =
      this.configService.get<string>('COINGLASS_COINS_PRICE_CHANGE_ENDPOINT') ??
      'https://open-api-v4.coinglass.com/api/futures/coins-price-change'

    if (!apiKey) {
      throw new DomainException('data_sync.coins_price_change.config_missing', {
        code: ErrorCode.DATA_SYNC_CONFIG_MISSING,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: 'COINGLASS_API_KEY is not configured' },
      })
    }

    const url = new URL(endpoint)

    this.logger.log(`Requesting Coinglass coins-price-change: ${url.toString()}`)

    const json = await this.fetchCoinsPriceChangeJson(url, apiKey)

    if (json.code !== '0' || !json.data) {
      throw new DomainException('data_sync.coins_price_change.invalid_response', {
        code: ErrorCode.DATA_SYNC_INVALID_RESPONSE,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: `Coinglass coins-price-change API returned error: code=${json.code}, msg=${json.msg}` },
      })
    }

    if (json.data.length === 0) {
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify(cursor),
        meta: {
          note: 'No coins-price-change data returned from API',
        },
      }
    }

    const client = this.txHost.tx
    const now = new Date()

    // 过滤无效数据点（必需字段校验）
    const validDataPoints = json.data.filter((point) => {
      if (!point.symbol) {
        this.logger.warn(`Skipping invalid data point: missing symbol`)
        return false
      }
      if (point.current_price == null) {
        this.logger.warn(`Skipping invalid data point: missing current_price (symbol=${point.symbol})`)
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
          const dataMapping = this.mapDataPoint(point, now)
          await client.coinsPriceChange.upsert({
            where: {
              symbol_source: {
                symbol: point.symbol.toUpperCase(),
                source: 'COINGLASS',
              },
            },
            update: {
              ...dataMapping,
              updatedAt: now,
            },
            create: {
              symbol: point.symbol.toUpperCase(),
              source: 'COINGLASS',
              ...dataMapping,
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
          this.logger.warn(`Failed to upsert coins-price-change record: ${result.reason}`)
          this.logger.warn(`Failed data point: ${JSON.stringify(failedPoint)}`)
        }
      }
    }

    if (failedCount > 0) {
      this.logger.warn(
        `Batch upsert completed with ${failedCount} failures out of ${validDataPoints.length} records`,
      )
    }

    const newCursor: CoinsPriceChangeCursor = {
      lastSnapshotTime: now.toISOString(),
    }

    const skippedCount = json.data.length - validDataPoints.length

    return {
      fetchedCount: upsertedCount,
      newCursor: JSON.stringify(newCursor),
      meta: {
        snapshotTime: now.toISOString(),
        apiDataCount: json.data.length,
        validDataCount: validDataPoints.length,
        skippedCount,
        upsertedCount,
        failedCount,
      },
    }
  }

  private async fetchCoinsPriceChangeJson(
    url: URL,
    apiKey: string,
  ): Promise<CoinsPriceChangeApiResponse> {
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
              `Coinglass coins-price-change request failed (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
            )
            continue
          }

          throw new DomainException('data_sync.coins_price_change.api_error', {
            code: ErrorCode.DATA_SYNC_API_ERROR,
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            args: { reason: `Coinglass coins-price-change request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} ${failure}` },
          })
        }

        return (await response.json()) as CoinsPriceChangeApiResponse
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
            `Coinglass coins-price-change request error (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
          )
          continue
        }

        throw new DomainException('data_sync.coins_price_change.api_error', {
          code: ErrorCode.DATA_SYNC_API_ERROR,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          args: { reason: `Coinglass coins-price-change request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} error=${failure}` },
        })
      } finally {
        clearTimeout(timer)
      }
    }

    // 理论不可达，兜底
    throw new DomainException('data_sync.coins_price_change.api_error', {
      code: ErrorCode.DATA_SYNC_API_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      args: { reason: `Coinglass coins-price-change request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${lastFailure ?? 'unknown'}` },
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

  private parseCursor(currentCursor: string | null): CoinsPriceChangeCursor {
    if (!currentCursor) {
      return {}
    }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<CoinsPriceChangeCursor>
      return {
        lastSnapshotTime: parsed.lastSnapshotTime,
      }
    } catch {
      this.logger.warn(`Failed to parse cursor: ${currentCursor}, fallback to default`)
      return {}
    }
  }
}
