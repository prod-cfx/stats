import type {
  DataPullJob,
  DataPullJobContext,
  JobMetaSchema,
  JobRunResult,
} from '../contracts/data-pull-job'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
// eslint-disable-next-line ts/consistent-type-imports
import { TakerBuySellVolumeRepository } from '@/modules/markets/repositories/taker-buy-sell-volume.repository'

const SUPPORTED_RANGES = ['5m', '15m', '30m', '1h', '4h', '12h', '24h'] as const
type SupportedRange = (typeof SUPPORTED_RANGES)[number]

interface TakerVolumeMeta {
  symbol: string
  range: SupportedRange
}

interface TakerVolumeCursor {
  lastTimestamp?: number
}

interface CoinglassExchangeTakerData {
  exchange: string
  buy_ratio: number | null
  sell_ratio: number | null
  buy_vol_usd: number | null
  sell_vol_usd: number | null
}

interface CoinglassTakerVolumeApiResponse {
  code: string
  msg: string
  success?: boolean
  data?: {
    symbol: string
    buy_ratio: number | null
    sell_ratio: number | null
    buy_vol_usd: number | null
    sell_vol_usd: number | null
    exchange_list: CoinglassExchangeTakerData[]
  }
}

@Injectable()
export class CoinglassTakerVolumeJob implements DataPullJob<TakerVolumeMeta> {
  readonly key = 'coinglass-taker-volume'
  private readonly logger = new Logger(CoinglassTakerVolumeJob.name)
  private readonly requestTimeoutMs = 10_000

  readonly metaSchema: JobMetaSchema = {
    description: 'Coinglass Taker Buy/Sell Volume 任务配置',
    fields: [
      {
        name: 'symbol',
        type: 'string',
        required: true,
        description: '币种符号，例如 BTC / ETH / SOL',
      },
      {
        name: 'range',
        type: 'string',
        required: true,
        description: '时间范围',
        options: [...SUPPORTED_RANGES],
        defaultValue: '24h',
      },
    ],
    example: { symbol: 'BTC', range: '24h' },
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly takerVolumeRepo: TakerBuySellVolumeRepository,
  ) {}

  async run(ctx: DataPullJobContext<TakerVolumeMeta>): Promise<JobRunResult> {
    const { symbol, range } = this.parseMeta(ctx.meta)
    const apiKey = this.configService.get<string>('COINGLASS_API_KEY')

    if (!apiKey) {
      throw new Error('COINGLASS_API_KEY is not configured')
    }

    const url = new URL(
      'https://open-api-v4.coinglass.com/api/futures/taker-buy-sell-volume/exchange-list',
    )
    url.searchParams.set('symbol', symbol)
    url.searchParams.set('range', range)

    this.logger.log(`Fetching Coinglass Taker Buy/Sell Volume: ${symbol} ${range}`)

    const json = await this.fetchTakerVolumeJson(url, apiKey)

    if (json.code !== '0' || !json.data || !json.data.exchange_list) {
      throw new Error(
        `Coinglass taker volume API returned error: code=${json.code}, msg=${json.msg}`,
      )
    }

    if (json.data.exchange_list.length === 0) {
      return {
        fetchedCount: 0,
        newCursor: ctx.cursor,
        meta: {
          symbol,
          range,
          note: 'No exchange data returned from API',
        },
      }
    }

    const timestamp = new Date()

    const skippedExchanges: string[] = []
    const dataToUpsert = json.data.exchange_list.flatMap(item => {
      const hasNullMetrics =
        item.buy_ratio === null ||
        item.sell_ratio === null ||
        item.buy_vol_usd === null ||
        item.sell_vol_usd === null

      if (hasNullMetrics) {
        skippedExchanges.push(item.exchange)
        return []
      }

      return [
        {
          exchange: item.exchange,
          symbol,
          range,
          timestamp,
          buyRatio: item.buy_ratio,
          sellRatio: item.sell_ratio,
          buyVolUsd: item.buy_vol_usd,
          sellVolUsd: item.sell_vol_usd,
        },
      ]
    })

    if (skippedExchanges.length > 0) {
      this.logger.warn(
        `Skipped ${skippedExchanges.length} exchanges with null metrics: ${skippedExchanges.join(', ')}`,
      )
    }

    if (dataToUpsert.length === 0) {
      return {
        fetchedCount: 0,
        newCursor: ctx.cursor,
        meta: {
          symbol,
          range,
          note: 'All exchange records contain null metrics and were skipped',
        },
      }
    }

    const upsertedCount = await this.takerVolumeRepo.upsertMany(dataToUpsert)

    this.logger.log(`Upserted ${upsertedCount} taker volume records for ${symbol} ${range}`)

    return {
      fetchedCount: upsertedCount,
      newCursor: JSON.stringify({
        lastTimestamp: timestamp.getTime(),
      } satisfies TakerVolumeCursor),
      meta: {
        symbol,
        range,
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

  private parseMeta(meta: TakerVolumeMeta | null): TakerVolumeMeta {
    if (!meta || !meta.symbol || !meta.range) {
      throw new Error('meta.symbol and meta.range are required')
    }

    if (!SUPPORTED_RANGES.includes(meta.range)) {
      throw new Error(`Invalid range: ${meta.range}. Supported: ${SUPPORTED_RANGES.join(', ')}`)
    }

    return {
      symbol: meta.symbol.toUpperCase(),
      range: meta.range,
    }
  }
}
