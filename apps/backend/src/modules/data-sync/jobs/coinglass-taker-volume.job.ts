import type { DataPullJob, DataPullJobContext, JobRunResult } from '../contracts/data-pull-job'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
// eslint-disable-next-line ts/consistent-type-imports
import { TakerBuySellVolumeRepository } from '@/modules/markets/repositories/taker-buy-sell-volume.repository'

interface TakerVolumeCursor {
  /**
   * 币种符号，例如 BTC / ETH
   */
  symbol: string
  /**
   * 时间范围，例如 24h / 1d / 1
   */
  range: string
  /**
   * 最新一次成功写入的数据时间戳（毫秒）
   */
  lastTimestamp?: number
}

interface CoinglassExchangeTakerData {
  exchange: string
  buy_ratio: number
  sell_ratio: number
  buy_vol_usd: number
  sell_vol_usd: number
}

interface CoinglassTakerVolumeApiResponse {
  code: string
  msg: string
  success?: boolean
  data?: {
    symbol: string
    buy_ratio: number
    sell_ratio: number
    buy_vol_usd: number
    sell_vol_usd: number
    exchange_list: CoinglassExchangeTakerData[]
  }
}

@Injectable()
export class CoinglassTakerVolumeJob implements DataPullJob {
  readonly key = 'coinglass-taker-volume'
  private readonly logger = new Logger(CoinglassTakerVolumeJob.name)
  private readonly requestTimeoutMs = 10_000
  private readonly maxAttempts = 2

  constructor(
    private readonly configService: ConfigService,
    private readonly takerVolumeRepo: TakerBuySellVolumeRepository,
  ) {}

  async run(ctx: DataPullJobContext): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)
    const apiKey = this.configService.get<string>('COINGLASS_API_KEY')

    if (!apiKey) {
      throw new Error('COINGLASS_API_KEY is not configured')
    }

    const url = new URL(
      'https://open-api-v4.coinglass.com/api/futures/taker-buy-sell-volume/exchange-list',
    )
    url.searchParams.set('symbol', cursor.symbol)
    url.searchParams.set('range', cursor.range)

    this.logger.log(
      `Fetching Coinglass Taker Buy/Sell Volume: ${cursor.symbol} ${cursor.range}`,
    )

    const json = await this.fetchTakerVolumeJson(url, apiKey)

    if (json.code !== '0' || !json.data || !json.data.exchange_list) {
      throw new Error(
        `Coinglass taker volume API returned error: code=${json.code}, msg=${json.msg}`,
      )
    }

    if (json.data.exchange_list.length === 0) {
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify(cursor),
        meta: {
          symbol: cursor.symbol,
          range: cursor.range,
          note: 'No exchange data returned from API',
        },
      }
    }

    // 使用当前时间作为数据时间戳（Coinglass 该端点不返回时间戳）
    const timestamp = new Date()

    // 转换并存储数据
    const dataToUpsert = json.data.exchange_list.map(item => ({
      exchange: item.exchange,
      symbol: cursor.symbol,
      range: cursor.range,
      timestamp,
      buyRatio: item.buy_ratio,
      sellRatio: item.sell_ratio,
      buyVolUsd: item.buy_vol_usd,
      sellVolUsd: item.sell_vol_usd,
    }))

    const upsertedCount = await this.takerVolumeRepo.upsertMany(dataToUpsert)

    this.logger.log(
      `Upserted ${upsertedCount} taker volume records for ${cursor.symbol} ${cursor.range}`,
    )

    return {
      fetchedCount: upsertedCount,
      newCursor: JSON.stringify({
        ...cursor,
        lastTimestamp: timestamp.getTime(),
      } satisfies TakerVolumeCursor),
      meta: {
        symbol: cursor.symbol,
        range: cursor.range,
        exchanges: json.data.exchange_list.length,
        timestamp: timestamp.toISOString(),
      },
    }
  }

  private async fetchTakerVolumeJson(
    url: URL,
    apiKey: string,
  ): Promise<CoinglassTakerVolumeApiResponse> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs)

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'CG-API-KEY': apiKey,
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private parseCursor(cursorJson: string | null): TakerVolumeCursor {
    if (!cursorJson) {
      return { symbol: 'BTC', range: '24h' }
    }

    try {
      const parsed = JSON.parse(cursorJson) as TakerVolumeCursor
      return {
        symbol: parsed.symbol ?? 'BTC',
        range: parsed.range ?? '24h',
        lastTimestamp: parsed.lastTimestamp,
      }
    } catch {
      this.logger.warn(`Invalid cursor JSON: ${cursorJson}, using defaults`)
      return { symbol: 'BTC', range: '24h' }
    }
  }
}
