import type { LiquidationHeatmapModelType } from '@prisma/client'
import type { DataPullJob, JobRunResult } from '../contracts/data-pull-job'
import { Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
// eslint-disable-next-line ts/consistent-type-imports
import { LiquidationHeatmapRepository } from '@/modules/liquidation-heatmap/liquidation-heatmap.repository'

interface CoinglassHeatmapCursor {
  symbol: string
  exchangeCode?: string
  contractType?: string
  modelType?: LiquidationHeatmapModelType
  interval?: string
}

interface CoinglassHeatmapApiResponse {
  code: string
  msg: string
  data?: {
    y_axis: number[]
    liquidation_leverage_data: [number, number, number][]
    price_candlesticks: [number, string, string, string, string, string][]
  }
}

@Injectable()
export class CoinglassHeatmapJob implements DataPullJob {
  readonly key = 'coinglass-liquidation-heatmap'
  private readonly logger = new Logger(CoinglassHeatmapJob.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly repo: LiquidationHeatmapRepository,
  ) {}

  async run(currentCursor: string | null): Promise<JobRunResult> {
    const cursor = this.parseCursor(currentCursor)

    const apiKey = this.configService.get<string>('COINGLASS_API_KEY')
    const endpoint =
      this.configService.get<string>('COINGLASS_HEATMAP_ENDPOINT') ??
      'https://open-api.coinglass.com/api/pro/v4/futures/liquidation-heatmap'

    if (!apiKey) {
      this.logger.error('COINGLASS_API_KEY is not configured, skip job')
      return { fetchedCount: 0, newCursor: currentCursor }
    }

    const url = new URL(endpoint)
    url.searchParams.set('symbol', cursor.symbol)
    if (cursor.interval) {
      url.searchParams.set('interval', cursor.interval)
    }
    if (cursor.exchangeCode) {
      url.searchParams.set('exchange', cursor.exchangeCode)
    }
    if (cursor.contractType) {
      url.searchParams.set('contractType', cursor.contractType)
    }

    this.logger.log(`Requesting Coinglass heatmap: ${url.toString()}`)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // 具体 header 名称以 Coinglass 文档为准
        'CG-API-KEY': apiKey,
      },
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Coinglass API request failed: ${response.status} ${response.statusText} - ${text}`)
    }

    const json = (await response.json()) as CoinglassHeatmapApiResponse

    if (json.code !== '0' || !json.data) {
      throw new Error(`Coinglass API returned error: code=${json.code}, msg=${json.msg}`)
    }

    const { y_axis, liquidation_leverage_data, price_candlesticks } = json.data

    const snapshot = await this.repo.createSnapshotWithData({
      source: 'COINGLASS',
      modelType: cursor.modelType ?? 'MODEL3',
      exchangeCode: cursor.exchangeCode ?? null,
      symbol: cursor.symbol,
      tradingPair: null,
      contractType: cursor.contractType ?? null,
      timeInterval: cursor.interval ?? null,
      valueCurrency: 'USD',
      effectiveFrom: null,
      effectiveTo: null,
      rawPayload: json,
      payload: {
        yAxis: y_axis,
        liquidationLeverageData: liquidation_leverage_data,
        priceCandlesticks: price_candlesticks,
      },
    })

    const newCursor: CoinglassHeatmapCursor = {
      ...cursor,
    }

    return {
      fetchedCount: snapshot.cells.length,
      newCursor: JSON.stringify(newCursor),
      meta: {
        snapshotId: snapshot.snapshot.id,
        symbol: snapshot.snapshot.symbol,
        exchangeCode: snapshot.snapshot.exchangeCode,
        contractType: snapshot.snapshot.contractType,
        modelType: snapshot.snapshot.modelType,
      },
    }
  }

  private parseCursor(currentCursor: string | null): CoinglassHeatmapCursor {
    if (!currentCursor) {
      return {
        symbol: 'BTC',
        modelType: 'MODEL3',
        interval: '15m',
      }
    }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<CoinglassHeatmapCursor>
      if (!parsed.symbol) {
        parsed.symbol = 'BTC'
      }
      if (!parsed.modelType) {
        parsed.modelType = 'MODEL3'
      }
      if (!parsed.interval) {
        parsed.interval = '15m'
      }
      return parsed as CoinglassHeatmapCursor
    } catch {
      this.logger.warn(`Failed to parse cursor: ${currentCursor}, fallback to default`)
      return {
        symbol: 'BTC',
        modelType: 'MODEL3',
        interval: '15m',
      }
    }
  }
}


