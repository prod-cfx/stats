import type { DataPullJob, DataPullJobContext, JobRunResult } from '../contracts/data-pull-job'
import { LiquidationHeatmapModelType, ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
import { DomainException } from '@/common/exceptions/domain.exception'
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

  async run(ctx: DataPullJobContext): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)

    const modelType = cursor.modelType ?? LiquidationHeatmapModelType.MODEL3
    const modelSuffix =
      modelType === LiquidationHeatmapModelType.MODEL1 ? 'model1' : modelType === LiquidationHeatmapModelType.MODEL2 ? 'model2' : 'model3'

    const apiKey = this.configService.get<string>('COINGLASS_API_KEY')
    const rawEndpoint = this.configService.get<string>('COINGLASS_HEATMAP_ENDPOINT')
    // 使用 || 确保空字符串也回退到默认值；参考 Coinglass v4 文档
    const baseEndpoint =
      rawEndpoint?.trim() ||
      'https://open-api-v4.coinglass.com/api/futures/liquidation/heatmap'

    if (!apiKey) {
      // 不应”默默成功”，否则后台无法感知配置缺失
      throw new DomainException('data_sync.heatmap.config_missing', {
        code: ErrorCode.DATA_SYNC_CONFIG_MISSING,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: 'COINGLASS_API_KEY is not configured' },
      })
    }

    // 兼容旧版 liquidation-heatmap 路径（通过 model 查询参数区分模型），避免直接拼接 /modelX 导致 404
    const isLegacyEndpoint =
      /liquidation-heatmap/.test(baseEndpoint) && !/\/heatmap\/model\d+/.test(baseEndpoint)

    const url = new URL(
      isLegacyEndpoint
        ? baseEndpoint
        : (() => {
            // 规范化 endpoint，确保无论环境变量是否已包含 /modelX 或 /modelX/，最终路径与 cursor.modelType 一致
            const normalizedBase = baseEndpoint
              .replace(/\/model\d+\/?$/, '')
              .replace(/\/+$/, '')
            return normalizedBase.endsWith('/')
              ? `${normalizedBase}${modelSuffix}`
              : `${normalizedBase}/${modelSuffix}`
          })(),
    )

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
    if (isLegacyEndpoint) {
      // 旧版接口使用 model 查询参数区分模型，这里保持与历史行为一致
      url.searchParams.set('model', modelType)
    }

    this.logger.log(`Requesting Coinglass heatmap: ${url.toString()}`)

    const json = await this.fetchHeatmapJson(url, apiKey)

    if (json.code !== '0' || !json.data) {
      throw new DomainException('data_sync.heatmap.invalid_response', {
        code: ErrorCode.DATA_SYNC_INVALID_RESPONSE,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: `Coinglass API returned error: code=${json.code}, msg=${json.msg}` },
      })
    }

    const { y_axis, liquidation_leverage_data, price_candlesticks } = json.data

    const snapshot = await this.repo.createSnapshotWithData({
      source: 'COINGLASS',
      modelType: cursor.modelType ?? LiquidationHeatmapModelType.MODEL3,
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

          throw new DomainException('data_sync.heatmap.api_error', {
            code: ErrorCode.DATA_SYNC_API_ERROR,
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            args: { reason: `Coinglass heatmap request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} ${failure}` },
          })
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

        throw new DomainException('data_sync.heatmap.api_error', {
          code: ErrorCode.DATA_SYNC_API_ERROR,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          args: { reason: `Coinglass heatmap request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} error=${failure}` },
        })
      } finally {
        clearTimeout(timer)
      }
    }

    // 理论不可达，兜底
    throw new DomainException('data_sync.heatmap.api_error', {
      code: ErrorCode.DATA_SYNC_API_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      args: { reason: `Coinglass heatmap request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${lastFailure ?? 'unknown'}` },
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

  private parseCursor(currentCursor: string | null): CoinglassHeatmapCursor {
    if (!currentCursor) {
      return {
        symbol: 'BTC',
        modelType: LiquidationHeatmapModelType.MODEL3,
        interval: '15m',
      }
    }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<CoinglassHeatmapCursor>
      if (!parsed.symbol) {
        parsed.symbol = 'BTC'
      }
      if (parsed.modelType) {
        const normalized = String(parsed.modelType).trim().toUpperCase()
        const allowed: LiquidationHeatmapModelType[] = [LiquidationHeatmapModelType.MODEL1, LiquidationHeatmapModelType.MODEL2, LiquidationHeatmapModelType.MODEL3]
        if (!allowed.includes(normalized as LiquidationHeatmapModelType)) {
          throw new DomainException('data_sync.heatmap.invalid_model_type', {
            code: ErrorCode.DATA_SYNC_DATA_VALIDATION_FAILED,
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            args: { reason: `Invalid Coinglass heatmap modelType in cursor: ${String(parsed.modelType)}` },
          })
        }
        parsed.modelType = normalized as LiquidationHeatmapModelType
      } else {
        parsed.modelType = LiquidationHeatmapModelType.MODEL3
      }
      if (!parsed.interval) {
        parsed.interval = '15m'
      }
      return parsed as CoinglassHeatmapCursor
    } catch (error) {
      // 仅在 JSON 语法错误时回退默认值；字段取值非法等逻辑错误必须向上抛出
      const isSyntaxError =
        error instanceof SyntaxError ||
        (typeof error === 'object' && error !== null && 'name' in error && (error as any).name === 'SyntaxError')

      if (isSyntaxError) {
        this.logger.warn(`Failed to parse cursor JSON: ${currentCursor}, fallback to default`)
        return {
          symbol: 'BTC',
          modelType: LiquidationHeatmapModelType.MODEL3,
          interval: '15m',
        }
      }

      throw error
    }
  }
}


