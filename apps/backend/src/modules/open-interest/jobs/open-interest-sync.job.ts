import type {
  DataPullJob,
  JobRunResult,
} from '../../data-sync/contracts/data-pull-job'
import type { CreateOpenInterestDto } from '../dto/open-interest.dto'
import { Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService 和 OpenInterestService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
// eslint-disable-next-line ts/consistent-type-imports
import { OpenInterestService } from '../open-interest.service'

interface CoinglassOiCursor {
  symbol: string
  exchange?: string
}

interface CoinglassOiItem {
  exchange: string
  symbol: string
  openInterest: number
  openInterestAmount: number
  openInterestByCoinMargin?: number
  openInterestByStableCoinMargin?: number
  openInterestAmountByCoinMargin?: number
  openInterestAmountByStableCoinMargin?: number
  openInterestChangePercent5m?: number
  openInterestChangePercent15m?: number
  openInterestChangePercent30m?: number
  openInterestChangePercent1h?: number
  openInterestChangePercent4h?: number
  openInterestChangePercent24h?: number
}

interface CoinglassOiApiResponse {
  code: string
  msg: string
  data?: CoinglassOiItem[]
}

/**
 * 持仓量数据同步任务
 *
 * 该任务负责从外部数据源拉取持仓量数据并存储到数据库
 */
@Injectable()
export class OpenInterestSyncJob implements DataPullJob {
  readonly key = 'open-interest-sync'
  private readonly logger = new Logger(OpenInterestSyncJob.name)

  private readonly requestTimeoutMs = 10_000
  private readonly maxAttempts = 2

  constructor(
    private readonly openInterestService: OpenInterestService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 执行数据拉取任务
   * @param currentCursor 当前保存的游标位置
   * @returns 任务执行结果
   */
  async run(currentCursor: string | null): Promise<JobRunResult> {
    const cursor = this.parseCursor(currentCursor)

    const apiKey = this.configService.get<string>('COINGLASS_API_KEY')
    const endpoint =
      this.configService.get<string>('COINGLASS_OI_ENDPOINT') ??
      'https://open-api.coinglass.com/api/pro/v4/futures/oi-exchange-list'

    if (!apiKey) {
      throw new Error('COINGLASS_API_KEY is not configured')
    }

    const url = new URL(endpoint)
    url.searchParams.set('symbol', cursor.symbol)
    // exchange 为空时通常表示汇总（All），不传则由 Coinglass 侧决定默认行为
    if (cursor.exchange && cursor.exchange !== 'All') {
      url.searchParams.set('exchange', cursor.exchange)
    }

    this.logger.log(
      `Requesting Coinglass open interest: ${url.toString()} (cursor: ${currentCursor})`,
    )

    try {
      const json = await this.fetchOiJson(url, apiKey)

      if (json.code !== '0' || !json.data || json.data.length === 0) {
        this.logger.warn(
          `Coinglass OI API returned no data: code=${json.code}, msg=${json.msg}`,
        )
        return {
          fetchedCount: 0,
          newCursor: currentCursor,
          meta: {
            symbol: cursor.symbol,
            exchange: cursor.exchange ?? 'All',
          },
        }
      }

      const nowIso = new Date().toISOString()
      const items: CreateOpenInterestDto[] = json.data.map(item => ({
        exchange: item.exchange || 'All',
        symbol: item.symbol,
        open_interest_usd: item.openInterest,
        open_interest_quantity: item.openInterestAmount,
        open_interest_by_coin_margin:
          item.openInterestByCoinMargin ?? undefined,
        open_interest_by_stable_coin_margin:
          item.openInterestByStableCoinMargin ?? undefined,
        open_interest_quantity_by_coin_margin:
          item.openInterestAmountByCoinMargin ?? undefined,
        open_interest_quantity_by_stable_coin_margin:
          item.openInterestAmountByStableCoinMargin ?? undefined,
        open_interest_change_percent_5m:
          item.openInterestChangePercent5m ?? undefined,
        open_interest_change_percent_15m:
          item.openInterestChangePercent15m ?? undefined,
        open_interest_change_percent_30m:
          item.openInterestChangePercent30m ?? undefined,
        open_interest_change_percent_1h:
          item.openInterestChangePercent1h ?? undefined,
        open_interest_change_percent_4h:
          item.openInterestChangePercent4h ?? undefined,
        open_interest_change_percent_24h:
          item.openInterestChangePercent24h ?? undefined,
        data_timestamp: nowIso,
      }))

      const results = await this.openInterestService.batchUpsert(items)

      const newCursor = JSON.stringify(cursor)

      this.logger.log(
        `Successfully synced ${results.length} open interest records from Coinglass`,
      )

      return {
        fetchedCount: results.length,
        newCursor,
        meta: {
          symbol: cursor.symbol,
          exchange: cursor.exchange ?? 'All',
          count: results.length,
        },
      }
    } catch (error) {
      this.logger.error(
        `Failed to sync open interest data: ${error.message}`,
        error.stack,
      )
      throw error
    }
  }

  /**
   * 从 Coinglass OI 接口获取持仓量数据
   */
  private async fetchOiJson(
    url: URL,
    apiKey: string,
  ): Promise<CoinglassOiApiResponse> {
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
              `Coinglass OI request failed (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
            )
            continue
          }

          throw new Error(
            `Coinglass OI request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} ${failure}`,
          )
        }

        return (await response.json()) as CoinglassOiApiResponse
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
            `Coinglass OI request error (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
          )
          continue
        }

        throw new Error(
          `Coinglass OI request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} error=${failure}`,
        )
      } finally {
        clearTimeout(timer)
      }
    }

    throw new Error(
      `Coinglass OI request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${lastFailure ?? 'unknown'}`,
    )
  }

  /**
   * 将外部 API 数据转换为内部数据格式（当前未使用，预留扩展）
   */
  private transformData(_externalData: any[]): CreateOpenInterestDto[] {
    // TODO: 实现数据转换逻辑
    return []
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

  private parseCursor(currentCursor: string | null): CoinglassOiCursor {
    if (!currentCursor) {
      return {
        symbol: 'BTC',
        exchange: 'All',
      }
    }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<CoinglassOiCursor>
      if (!parsed.symbol) {
        parsed.symbol = 'BTC'
      }
      if (!parsed.exchange) {
        parsed.exchange = 'All'
      }
      return parsed as CoinglassOiCursor
    } catch {
      this.logger.warn(
        `Failed to parse OpenInterest cursor: ${currentCursor}, fallback to default`,
      )
      return {
        symbol: 'BTC',
        exchange: 'All',
      }
    }
  }
}
