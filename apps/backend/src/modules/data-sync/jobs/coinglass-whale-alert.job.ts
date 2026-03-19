import type { DataPullJob, DataPullJobContext, JobRunResult } from '../contracts/data-pull-job'
import { Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService/PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

interface WhaleAlertCursor {
  /**
   * 最新一次成功写入的数据点时间戳（毫秒）
   * 仅用于观测/调试，实际幂等由数据库唯一键 + skipDuplicates 保证
   */
  lastTimestamp?: number
}

interface WhaleAlertDataPoint {
  /**
   * 鲸鱼地址
   */
  user: string
  /**
   * 币种符号，如 BTC / ETH
   */
  symbol: string
  /**
   * 持仓大小（正数=多头，负数=空头）
   * Coinglass 文档字段：position_size
   */
  position_size: number
  /**
   * 入场价格
   */
  entry_price: number
  /**
   * 清算价格
   * Coinglass 文档字段通常为 liq_price
   */
  liq_price: number
  /**
   * 持仓价值（USD）
   */
  position_value_usd: number
  /**
   * 持仓操作类型：1 = 开仓, 2 = 平仓
   */
  position_action: number
  /**
   * 持仓创建/变动时间（时间戳，毫秒或秒）
   */
  create_time: number
}

interface WhaleAlertApiResponse {
  code: string
  msg: string
  data?: WhaleAlertDataPoint[]
}

@Injectable()
export class CoinglassWhaleAlertJob implements DataPullJob {
  readonly key = 'coinglass-hyperliquid-whale-alert'
  private readonly logger = new Logger(CoinglassWhaleAlertJob.name)
  private readonly requestTimeoutMs = 15_000
  private readonly maxAttempts = 2

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async run(ctx: DataPullJobContext): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)

    const apiKey = this.configService.get<string>('COINGLASS_API_KEY')
    const endpoint =
      this.configService.get<string>('COINGLASS_WHALE_ALERT_ENDPOINT') ??
      // 参考文档：https://docs.coinglass.com/v4.0-zh/reference/hyperliquid-whale-alert
      // v4 统一使用 /api 前缀
      'https://open-api-v4.coinglass.com/api/hyperliquid/whale-alert'

    if (!apiKey) {
      throw new Error('COINGLASS_API_KEY is not configured')
    }

    const url = new URL(endpoint)
    // 注意：Whale Alert API 不支持 start_time 和 limit 参数
    // API 会返回最新的一批 whale alert 记录

    this.logger.log(`Requesting Coinglass Hyperliquid whale alert: ${url.toString()}`)

    const json = await this.fetchWhaleAlertJson(url, apiKey)

    if (json.code !== '0' || !json.data) {
      throw new Error(
        `Coinglass whale alert API returned error: code=${json.code}, msg=${json.msg}`,
      )
    }

    if (json.data.length === 0) {
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify(cursor),
        meta: {
          note: 'No whale alert data returned from API',
        },
      }
    }

    const client = this.prisma.getClient()

    // 将返回的数据点转换为带毫秒时间戳的格式
    const pointsWithTimestamps = json.data.map(point => {
      // Coinglass API 返回的时间戳应该已经是毫秒，但为了保险起见做个检查
      const timestampMs =
        point.create_time >= 1_000_000_000_000 ? point.create_time : point.create_time * 1000
      return {
        ...point,
        timestampMs,
      }
    })

    // 为避免丢数，这里不再基于 lastTimestamp 做客户端过滤，
    // 直接依赖数据库唯一键 (userAddress, symbol, createTime, positionAction) + skipDuplicates 实现幂等
    const incrementalPoints = pointsWithTimestamps

    let insertedCount = 0
    if (incrementalPoints.length > 0) {
      const rows = incrementalPoints.map(point => ({
        userAddress: point.user,
        symbol: point.symbol,
        positionSize: point.position_size.toString(),
        entryPrice: point.entry_price.toString(),
        liquidationPrice: point.liq_price.toString(),
        positionValueUsd: point.position_value_usd.toString(),
        positionAction: point.position_action,
        createTime: new Date(point.timestampMs),
        source: 'COINGLASS',
      }))

      const result = await client.hyperliquidWhaleAlert.createMany({
        data: rows,
        skipDuplicates: true,
      })
      insertedCount = result.count
    }

    // 计算最新的时间戳
    const newLatestTimestampCandidates: number[] = []
    if (pointsWithTimestamps.length > 0) {
      for (const point of pointsWithTimestamps) {
        newLatestTimestampCandidates.push(point.timestampMs)
      }
    }
    if (typeof cursor.lastTimestamp === 'number') {
      newLatestTimestampCandidates.push(cursor.lastTimestamp)
    }
    const newLatestTimestampMs =
      newLatestTimestampCandidates.length > 0 ? Math.max(...newLatestTimestampCandidates) : undefined

    const newCursor: WhaleAlertCursor = {
      lastTimestamp: newLatestTimestampMs,
    }

    // 统计所有 API 返回的数据（而非仅增量数据）
    const longPositions = pointsWithTimestamps.filter(p => p.position_size > 0).length
    const shortPositions = pointsWithTimestamps.filter(p => p.position_size < 0).length
    const openActions = pointsWithTimestamps.filter(p => p.position_action === 1).length
    const closeActions = pointsWithTimestamps.filter(p => p.position_action === 2).length

    return {
      fetchedCount: insertedCount,
      newCursor: JSON.stringify(newCursor),
      meta: {
        latestTime: newLatestTimestampMs ? new Date(newLatestTimestampMs).toISOString() : null,
        lastTimestamp: newLatestTimestampMs ?? null,
        apiDataCount: json.data.length,
        insertedCount,
        stats: {
          longPositions,
          shortPositions,
          openActions,
          closeActions,
        },
      },
    }
  }

  private async fetchWhaleAlertJson(url: URL, apiKey: string): Promise<WhaleAlertApiResponse> {
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
              `Coinglass whale alert request failed (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
            )
            continue
          }

          throw new Error(
            `Coinglass whale alert request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} ${failure}`,
          )
        }

        return (await response.json()) as WhaleAlertApiResponse
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
            `Coinglass whale alert request error (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
          )
          continue
        }

        throw new Error(
          `Coinglass whale alert request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} error=${failure}`,
        )
      } finally {
        clearTimeout(timer)
      }
    }

    // 理论不可达，兜底
    throw new Error(
      `Coinglass whale alert request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${lastFailure ?? 'unknown'}`,
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

  private parseCursor(currentCursor: string | null): WhaleAlertCursor {
    if (!currentCursor) {
      return {
        lastTimestamp: undefined,
      }
    }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<WhaleAlertCursor>
      if (typeof parsed.lastTimestamp !== 'number') {
        delete parsed.lastTimestamp
      }
      return parsed as WhaleAlertCursor
    } catch {
      this.logger.warn(`Failed to parse cursor: ${currentCursor}, fallback to default`)
      return {
        lastTimestamp: undefined,
      }
    }
  }
}
