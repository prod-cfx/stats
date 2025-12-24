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
  private readonly requestTimeoutMs = 10_000
  private readonly maxAttempts = 2

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
    if (cursor.modelType) {
      // Coinglass API 通常用 model 或 modelType 参数区分 MODEL1/MODEL2/MODEL3
      url.searchParams.set('model', cursor.modelType)
    }

    this.logger.log(`Requesting Coinglass heatmap: ${url.toString()}`)

    const json = await this.fetchHeatmapJson(url, apiKey)

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

  private async fetchHeatmapJson(url: URL, apiKey: string): Promise<CoinglassHeatmapApiResponse> {
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

          const failure = `status=${response.status} ${response.statusText}${snippet ? ` body=${JSON.stringify(snippet)}` : ''}`
          lastFailure = failure

          const retryable = response.status >= 500 || response.status === 429
          if (retryable && attempt < this.maxAttempts) {
            this.logger.warn(
              `Coinglass heatmap request failed (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
            )
            continue
          }

          throw new Error(
            `Coinglass heatmap request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} ${failure}`,
          )
        }

        return (await response.json()) as CoinglassHeatmapApiResponse
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
            `Coinglass heatmap request error (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
          )
          continue
        }

        throw new Error(
          `Coinglass heatmap request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} error=${failure}`,
        )
      } finally {
        clearTimeout(timer)
      }
    }

    // 理论不可达，兜底
    throw new Error(
      `Coinglass heatmap request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${lastFailure ?? 'unknown'}`,
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


