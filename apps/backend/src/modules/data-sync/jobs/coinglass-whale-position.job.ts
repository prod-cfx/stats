import type { DataPullJob, DataPullJobContext, JobRunResult } from '../contracts/data-pull-job'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService/PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

interface WhalePositionCursor {
  /**
   * 最新一次成功同步的时间戳（毫秒）
   * 仅用于观测/调试
   */
  lastSyncTime?: number
}

/**
 * Coinglass Hyperliquid 鲸鱼持仓 API 返回的单条数据
 * 参考文档：https://docs.coinglass.com/v4.0-zh/reference/hyperliquid-whale-position
 */
interface WhalePositionDataPoint {
  /** 鲸鱼地址 */
  user: string
  /** 币种符号，如 BTC / ETH */
  symbol: string
  /** 持仓大小（正数=多头，负数=空头） */
  position_size: number
  /** 入场价格 */
  entry_price: number
  /** 当前标记价格 */
  mark_price: number
  /** 清算价格 */
  liq_price: number | null
  /** 杠杆倍数 */
  leverage: number
  /** 保证金余额（USD） */
  margin_balance: number
  /** 持仓价值（USD） */
  position_value_usd: number
  /** 未实现盈亏（USD） */
  unrealized_pnl: number
  /** 资金费（USD） */
  funding_fee: number
  /** 保证金模式 (cross / isolated) */
  margin_mode: string
  /** 开仓时间（毫秒时间戳） */
  create_time: number
  /** 最后更新时间（毫秒时间戳） */
  update_time: number
}

interface WhalePositionApiResponse {
  code: string
  msg: string
  data?: WhalePositionDataPoint[]
}

@Injectable()
export class CoinglassWhalePositionJob implements DataPullJob {
  readonly key = 'coinglass-hyperliquid-whale-position'
  private readonly logger = new Logger(CoinglassWhalePositionJob.name)
  private readonly requestTimeoutMs = 15_000
  private readonly maxAttempts = 2
  /** 单次事务最大操作数，防止大数据量时事务超时 */
  private readonly batchSize = 100

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async run(_ctx: DataPullJobContext): Promise<JobRunResult> {
    // 快照模式：不使用游标做增量过滤，每次全量 upsert

    const apiKey = this.configService.get<string>('COINGLASS_API_KEY')
    const endpoint =
      this.configService.get<string>('COINGLASS_WHALE_POSITION_ENDPOINT') ??
      // 参考文档：https://docs.coinglass.com/v4.0-zh/reference/hyperliquid-whale-position
      // v4 统一使用 /api 前缀
      'https://open-api-v4.coinglass.com/api/hyperliquid/whale-position'

    if (!apiKey) {
      throw new DomainException('data_sync.whale_position.config_missing', {
        code: ErrorCode.DATA_SYNC_CONFIG_MISSING,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: 'COINGLASS_API_KEY is not configured' },
      })
    }

    const url = new URL(endpoint)
    // 注意：Whale Position API 不支持分页参数
    // API 返回当前所有价值超过 100 万美元的持仓

    this.logger.log(`Requesting Coinglass Hyperliquid whale position: ${url.toString()}`)

    const json = await this.fetchWhalePositionJson(url, apiKey)

    if (json.code !== '0' || !json.data) {
      throw new DomainException('data_sync.whale_position.invalid_response', {
        code: ErrorCode.DATA_SYNC_INVALID_RESPONSE,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: `Coinglass whale position API returned error: code=${json.code}, msg=${json.msg}` },
      })
    }

    if (json.data.length === 0) {
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify({ lastSyncTime: Date.now() }),
        meta: {
          note: 'No whale position data returned from API',
        },
      }
    }

    const client = this.prisma.getClient()
    const now = new Date()

    // 使用 upsert 模式：同一用户+币种的持仓会被更新
    // 分批执行事务，避免大数据量时事务超时（Prisma P2028）
    const operations = json.data.flatMap(point => {
      // 空值保护：外部 API 可能返回意外的 null/undefined
      const hasValidMarginBalance =
        Number.isFinite(point.margin_balance) && point.margin_balance !== 0
      const hasValidUnrealizedPnl = Number.isFinite(point.unrealized_pnl)
      const hasValidRequiredNumbers =
        Number.isFinite(point.position_size) &&
        Number.isFinite(point.entry_price) &&
        Number.isFinite(point.position_value_usd)

      if (!hasValidRequiredNumbers) {
        this.logger.warn(
          `Skip invalid whale position payload: user=${point.user}, symbol=${point.symbol}`,
        )
        return []
      }

      const commonData = {
        positionSize: point.position_size.toString(),
        entryPrice: point.entry_price.toString(),
        liquidationPrice: point.liq_price?.toString() ?? null,
        positionValueUsd: point.position_value_usd.toString(),
        pnl: hasValidUnrealizedPnl ? point.unrealized_pnl.toString() : null,
        // 计算 ROE: unrealized_pnl / margin_balance (收益率 = 未实现盈亏 / 保证金余额)
        roe: (() => {
          if (!hasValidMarginBalance || !hasValidUnrealizedPnl) {
            return null
          }

          const roeValue = point.unrealized_pnl / point.margin_balance
          return Number.isFinite(roeValue) ? roeValue.toString() : null
        })(),
        // 杠杆倍数
        leverage: (() => {
          if (point.leverage == null) return null
          if (!Number.isFinite(point.leverage)) {
            this.logger.warn(
              `Invalid leverage value: user=${point.user}, symbol=${point.symbol}, leverage=${point.leverage}`,
            )
            return null
          }
          return point.leverage.toString()
        })(),
        snapshotTime: now,
        source: 'COINGLASS' as const,
      }

      return [
        client.hyperliquidWhalePosition.upsert({
          where: {
            userAddress_symbol: {
              userAddress: point.user,
              symbol: point.symbol,
            },
          },
          update: commonData,
          create: {
            userAddress: point.user,
            symbol: point.symbol,
            ...commonData,
          },
        }),
      ]
    })

    // 分批提交事务
    for (let i = 0; i < operations.length; i += this.batchSize) {
      const batch = operations.slice(i, i + this.batchSize)
      await client.$transaction(batch)
    }
    const upsertedCount = operations.length

    const newCursor: WhalePositionCursor = {
      lastSyncTime: now.getTime(),
    }

    // 统计所有 API 返回的数据
    const longPositions = json.data.filter(p => p.position_size > 0).length
    const shortPositions = json.data.filter(p => p.position_size < 0).length
    const totalValueUsd = json.data.reduce((sum, p) => sum + p.position_value_usd, 0)

    return {
      fetchedCount: upsertedCount,
      newCursor: JSON.stringify(newCursor),
      meta: {
        snapshotTime: now.toISOString(),
        apiDataCount: json.data.length,
        upsertedCount,
        stats: {
          longPositions,
          shortPositions,
          totalValueUsd: Math.round(totalValueUsd),
        },
      },
    }
  }

  private async fetchWhalePositionJson(
    url: URL,
    apiKey: string,
  ): Promise<WhalePositionApiResponse> {
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
              `Coinglass whale position request failed (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
            )
            continue
          }

          throw new DomainException('data_sync.whale_position.api_error', {
            code: ErrorCode.DATA_SYNC_API_ERROR,
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            args: { reason: `Coinglass whale position request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} ${failure}` },
          })
        }

        return (await response.json()) as WhalePositionApiResponse
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
            `Coinglass whale position request error (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
          )
          continue
        }

        throw new DomainException('data_sync.whale_position.api_error', {
          code: ErrorCode.DATA_SYNC_API_ERROR,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          args: { reason: `Coinglass whale position request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} error=${failure}` },
        })
      } finally {
        clearTimeout(timer)
      }
    }

    // 理论不可达，兜底
    throw new DomainException('data_sync.whale_position.api_error', {
      code: ErrorCode.DATA_SYNC_API_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      args: { reason: `Coinglass whale position request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${lastFailure ?? 'unknown'}` },
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
}
