import type { CoinglassContractType, MarketTimeframe } from '@ai/shared'
import type { DataPullJob, DataPullJobContext, JobRunResult } from '../contracts/data-pull-job'
import { ErrorCode, toCoinglassSymbol } from '@ai/shared'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService/PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
import { DomainException } from '@/common/exceptions/domain.exception'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
import { INTERVAL_MS } from '@/modules/kline/utils/kline-time.utils'
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'

interface FuturesPriceCursor {
  /**
   * 币种基础资产或交易对符号，例如 BTC / BTCUSDT
   */
  symbol: string
  /**
   * 交易所代码，例如 BINANCE / OKX
   * 对应 Coinglass 文档中的 exchange 参数
   */
  exchangeCode?: string
  /**
   * 合约类型，例如 PERPETUAL / CURRENT_QUARTER 等
   * 对应 Coinglass 文档中的 contractType 参数
   *
   * 约定：
   * - null：表示现货（spot）
   * - undefined：表示未指定（将使用默认期货合约类型）
   */
  contractType?: string | null
  /**
   * 时间粒度，例如 "4h"
   */
  interval: MarketTimeframe
  /**
   * 最新一次成功写入的数据点时间戳（毫秒）
   * 主要用于后续增量抓取
   */
  lastTimestamp?: number
  /**
   * 回填是否完成
   */
  backfillCompleted?: boolean
  /**
   * 回填完成时间戳（毫秒）
   */
  backfillCompletedAt?: number
  /**
   * Gap 审计窗口游标（毫秒）
   * 记录上次 gap 检测扫描到的终点，下次从此处继续向前推进。
   * 未设置时从 backfillTarget 起扫；到达 now 后重置，循环审计。
   */
  gapAuditCursorMs?: number
}

interface CoinglassFuturesPricePoint {
  time: number
  open: string
  high: string
  low: string
  close: string
  volume_usd?: string
}

interface CoinglassFuturesPriceApiResponse {
  code: string
  msg: string
  data?: CoinglassFuturesPricePoint[]
}

@Injectable()
export class CoinglassFuturesPriceHistoryJob implements DataPullJob {
  readonly key = 'coinglass-futures-price-history'
  private readonly logger = new Logger(CoinglassFuturesPriceHistoryJob.name)
  private readonly requestTimeoutMs = 10_000
  private readonly maxAttempts = 2
  private readonly BATCH_INSERT_SIZE = 500
  // Coinglass 增量拉取使用毫秒级递增，避免重复拉取最后一条
  private readonly TIMESTAMP_INCREMENT_MS = 1
  // 回填完成后的复查间隔（90 天）
  private readonly BACKFILL_RECHECK_WINDOW_MS = 90 * 24 * 60 * 60 * 1000
  // 单次 tick 内最多连续回填的页数，防止长时间占用调度线程
  private readonly MAX_BACKFILL_PAGES_PER_RUN = 50
  // 单个缺口最大分页次数，防止 API 异常导致无限循环
  private readonly MAX_PAGES_PER_GAP = 100
  // Gap 检测窗口上限（7 天），防止首次运行时扫描过大范围
  private readonly MAX_GAP_CHECK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

  // 默认配置：BTCUSDT.BINANCE.PERP & 4h 粒度
  private readonly defaultSymbol = 'BTCUSDT'
  private readonly defaultExchangeCode = 'BINANCE'
  private readonly defaultContractType: string | null = 'PERPETUAL'
  private readonly defaultInterval: MarketTimeframe = '4h'
  private readonly defaultLimit = 1000

  private readonly allowedIntervals = [
    '1m',
    '3m',
    '5m',
    '15m',
    '30m',
    '1h',
    '4h',
    '6h',
    '8h',
    '12h',
    '1d',
    '1w',
  ] as const satisfies readonly MarketTimeframe[]
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async run(ctx: DataPullJobContext): Promise<JobRunResult> {
    const cursor = this.parseCursor(ctx.cursor)

    // 首次运行时（cursor 为空）允许用 task.meta 填充参数，避免 seed 配置不生效。
    // 注意：只在没有 cursor 时合并，避免覆盖已有增量游标。
    if (!ctx.cursor) {
      this.applyMetaDefaults(cursor, ctx.meta)
    }

    const apiKey = this.configService.get<string>('COINGLASS_API_KEY')

    // 根据 contractType 动态选择 endpoint
    // contractType 为 null 时使用现货 API，否则使用期货 API
    const isSpot = cursor.contractType === null
    const endpoint = isSpot
      ? 'https://open-api-v4.coinglass.com/api/spot/price/history'
      : 'https://open-api-v4.coinglass.com/api/futures/price/history'

    if (!apiKey) {
      // 不应"默默成功"，否则后台无法感知配置缺失
      throw new DomainException('data_sync.futures_price_history.config_missing', {
        code: ErrorCode.DATA_SYNC_CONFIG_MISSING,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: 'COINGLASS_API_KEY is not configured' },
      })
    }

    const interval = cursor.interval ?? this.defaultInterval
    const lastTimestampMs = cursor.lastTimestamp ?? null
    const contractType = isSpot ? null : (cursor.contractType ?? this.defaultContractType)
    const now = Date.now()
    const shouldSkipBackfillCheck =
      cursor.backfillCompleted &&
      typeof cursor.backfillCompletedAt === 'number' &&
      Date.now() - cursor.backfillCompletedAt < this.BACKFILL_RECHECK_WINDOW_MS

    const dbClient = this.prisma.getClient()
    const prismaInterval = mapTimeframe(interval as MarketTimeframe)

    if (!shouldSkipBackfillCheck) {
      // 检查数据库中最早的记录，如果存在历史数据缺口则优先回填
      const earliestRecord = await dbClient.futuresPriceHistory.findFirst({
        where: {
          symbol: cursor.symbol,
          exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
          interval: prismaInterval,
          source: 'COINGLASS',
          contractType,
        },
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true },
      })

      if (earliestRecord) {
        const earliestMs = earliestRecord.timestamp.getTime()
        const backfillTargetMs = this.getBackfillTarget(interval)

        if (earliestMs > backfillTargetMs) {
          this.logger.log(
            `Backfilling history for ${cursor.symbol} ${interval}: from ${new Date(backfillTargetMs).toISOString()} to ${new Date(earliestMs).toISOString()}`,
          )
          return await this.runBackfill(
            cursor,
            endpoint,
            apiKey,
            earliestMs,
            backfillTargetMs,
            prismaInterval,
          )
        }

        if (!cursor.backfillCompleted) {
          cursor.backfillCompleted = true
          cursor.backfillCompletedAt = Date.now()
        }
      }
    }

    // 在增量拉取前，检测并回填数据缺口
    if (typeof lastTimestampMs === 'number') {
      const gapCheckFromMs = this.getBackfillTarget(interval)
      // gap 审计窗口：使用持久化游标 gapAuditCursorMs 作为滑动起点，
      // 每次推进 MAX_GAP_CHECK_WINDOW_MS，真正逐步覆盖从 backfillTarget 到 now 的全历史。
      // 游标到达 now 后重置为 backfillTarget，实现循环审计。
      const auditFrom = cursor.gapAuditCursorMs ?? gapCheckFromMs
      // 如果游标已越过回填范围起点（now - depth 随时间前移），重置为新起点
      const effectiveAuditFrom = Math.max(auditFrom, gapCheckFromMs)
      const gapCheckToMs = Math.min(now, effectiveAuditFrom + this.MAX_GAP_CHECK_WINDOW_MS)

      if (gapCheckToMs > gapCheckFromMs) {
        if (now > gapCheckToMs) {
          this.logger.log(
            `Gap detection limited to ${this.MAX_GAP_CHECK_WINDOW_MS / INTERVAL_MS['1d']} days window, remaining gaps will be checked in subsequent runs`,
          )
        }
        const gaps = await this.detectGaps(
          cursor.symbol,
          cursor.exchangeCode ?? this.defaultExchangeCode,
          contractType,
          interval,
          effectiveAuditFrom,
          gapCheckToMs,
        )

        if (gaps.length > 0) {
          this.logger.log(`Detected ${gaps.length} gaps in data, filling...`)
          const filledCount = await this.fillGaps(gaps, cursor, endpoint, apiKey)
          this.logger.log(`Filled ${filledCount} records from ${gaps.length} gaps`)
        }
      }
    }

    const url = new URL(endpoint)
    url.searchParams.set('symbol', this.getApiSymbol(cursor))
    url.searchParams.set('interval', interval)
    url.searchParams.set('limit', this.defaultLimit.toString())
    if (cursor.exchangeCode) {
      url.searchParams.set('exchange', cursor.exchangeCode)
    }
    // 仅在期货模式下设置 contractType 参数
    if (!isSpot && (cursor.contractType ?? this.defaultContractType)) {
      url.searchParams.set('contractType', cursor.contractType ?? this.defaultContractType!)
    }
    if (typeof lastTimestampMs === 'number') {
      // Coinglass 文档示例：start_time 以毫秒为单位
      // 加 1ms 避免重复拉取最后一条记录（与 Binance Job 保持一致）
      url.searchParams.set(
        'start_time',
        Math.floor(lastTimestampMs + this.TIMESTAMP_INCREMENT_MS).toString(),
      )
    } else {
      // 空库首次拉取时，如果不传任何时间参数，Coinglass 可能返回 time error。
      // 使用与回填深度一致的窗口作为初始 start_time。
      url.searchParams.set('start_time', this.getBackfillTarget(interval).toString())
    }

    this.logger.log(
      `Requesting Coinglass futures price history: ${url.toString()} (cursor: ${ctx.cursor ?? 'null'})`,
    )

    const json = await this.fetchFuturesPriceJson(url, apiKey)

    if (json.code !== '0' || !json.data) {
      throw new DomainException('data_sync.futures_price_history.invalid_response', {
        code: ErrorCode.DATA_SYNC_INVALID_RESPONSE,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: `Coinglass futures price history API returned error: code=${json.code}, msg=${json.msg}` },
      })
    }

    if (json.data.length === 0) {
      // Bug fix: API 返回空数据时，也要更新 lastTimestamp 到当前时间
      // 否则这段时间的缺口会被反复检测，且永远无法被标记为已处理
      const updatedCursor: FuturesPriceCursor = {
        ...cursor,
        lastTimestamp: Date.now(),
      }
      return {
        fetchedCount: 0,
        newCursor: JSON.stringify(updatedCursor),
        meta: {
          symbol: cursor.symbol,
          exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
          contractType:
            cursor.contractType === undefined ? this.defaultContractType : cursor.contractType,
          interval,
          note: 'No futures price history data returned from API, cursor updated to current time',
        },
      }
    }

    const client = this.prisma.getClient()

    const pointsWithTimestamps = json.data.map(point => {
      const timestampMs = point.time >= 1_000_000_000_000 ? point.time : point.time * 1000
      return {
        ...point,
        timestampMs,
      }
    })

    const incrementalPoints = lastTimestampMs
      ? pointsWithTimestamps.filter(point => point.timestampMs > lastTimestampMs)
      : pointsWithTimestamps

    let insertedCount = 0
    if (incrementalPoints.length > 0) {
      const rows = incrementalPoints.map(point => ({
        symbol: cursor.symbol,
        exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
        contractType: cursor.contractType ?? this.defaultContractType,
        interval: prismaInterval,
        timestamp: new Date(point.timestampMs),
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        volumeUsd: point.volume_usd ?? null,
        source: 'COINGLASS',
      }))

      for (let start = 0; start < rows.length; start += this.BATCH_INSERT_SIZE) {
        const batch = rows.slice(start, start + this.BATCH_INSERT_SIZE)
        const result = await client.futuresPriceHistory.createMany({
          data: batch,
          skipDuplicates: true,
        })
        insertedCount += result.count
      }
    }

    const latestTimestampCandidates: number[] = []
    if (pointsWithTimestamps.length > 0) {
      for (const point of pointsWithTimestamps) {
        latestTimestampCandidates.push(point.timestampMs)
      }
    }
    if (typeof lastTimestampMs === 'number') {
      latestTimestampCandidates.push(lastTimestampMs)
    }
    const latestTimestampMs =
      latestTimestampCandidates.length > 0 ? Math.max(...latestTimestampCandidates) : undefined

    // 推进 gap 审计游标：本次扫到 gapCheckToMs，下次从此继续
    // 若 gapCheckToMs 已接近 now（在 1 个 interval 内），则重置游标触发新一轮循环
    const _intervalMs = INTERVAL_MS[interval] ?? 0
    const nextGapAuditCursor =
      typeof lastTimestampMs === 'number'
        ? (() => {
            const gapCheckFromMs = this.getBackfillTarget(interval)
            const auditFrom = cursor.gapAuditCursorMs ?? gapCheckFromMs
            const effectiveAuditFrom = Math.max(auditFrom, gapCheckFromMs)
            const gapCheckToMs = Math.min(now, effectiveAuditFrom + this.MAX_GAP_CHECK_WINDOW_MS)
            // 仅在真正到达 now 时重置，避免临界值提前重置导致审计窗口遗漏
            return gapCheckToMs >= now ? undefined : gapCheckToMs
          })()
        : cursor.gapAuditCursorMs

    const newCursor: FuturesPriceCursor = {
      symbol: cursor.symbol,
      exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
      contractType:
        cursor.contractType === undefined ? this.defaultContractType : cursor.contractType,
      interval,
      lastTimestamp: latestTimestampMs,
      backfillCompleted: cursor.backfillCompleted,
      backfillCompletedAt: cursor.backfillCompletedAt,
      gapAuditCursorMs: nextGapAuditCursor,
    }

    return {
      fetchedCount: insertedCount,
      newCursor: JSON.stringify(newCursor),
      meta: {
        symbol: cursor.symbol,
        exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
        contractType:
          cursor.contractType === undefined ? this.defaultContractType : cursor.contractType,
        interval,
        latestTime: latestTimestampMs ? new Date(latestTimestampMs).toISOString() : null,
        lastTimestamp: latestTimestampMs ?? null,
        apiDataCount: json.data.length,
        insertedCount,
      },
    }
  }

  private async fetchFuturesPriceJson(
    url: URL,
    apiKey: string,
  ): Promise<CoinglassFuturesPriceApiResponse> {
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
              `Coinglass futures price history request failed (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
            )
            continue
          }

          throw new DomainException('data_sync.futures_price_history.api_error', {
            code: ErrorCode.DATA_SYNC_API_ERROR,
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            args: { reason: `Coinglass futures price history request failed after ${attempt}/${this.maxAttempts}: url=${url.toString()} ${failure}` },
          })
        }

        return (await response.json()) as CoinglassFuturesPriceApiResponse
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
            `Coinglass futures price history request error (attempt ${attempt}/${this.maxAttempts}), retrying: ${failure}`,
          )
          continue
        }

        throw new DomainException('data_sync.futures_price_history.api_error', {
          code: ErrorCode.DATA_SYNC_API_ERROR,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          args: { reason: `Coinglass futures price history request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${failure}` },
        })
      } finally {
        clearTimeout(timer)
      }
    }

    // 理论不可达，兜底
    throw new DomainException('data_sync.futures_price_history.api_error', {
      code: ErrorCode.DATA_SYNC_API_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      args: { reason: `Coinglass futures price history request failed after ${this.maxAttempts} attempts: url=${url.toString()} error=${lastFailure ?? 'unknown'}` },
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

  private async runBackfill(
    cursor: FuturesPriceCursor,
    endpoint: string,
    apiKey: string,
    earliestMs: number,
    targetMs: number,
    prismaInterval: string,
  ): Promise<JobRunResult> {
    const isSpot = cursor.contractType === null
    const contractType = isSpot ? null : (cursor.contractType ?? this.defaultContractType)
    const dbClient = this.prisma.getClient()

    const baseUrl = new URL(endpoint)
    baseUrl.searchParams.set('symbol', this.getApiSymbol(cursor))
    baseUrl.searchParams.set('interval', cursor.interval)
    baseUrl.searchParams.set('limit', this.defaultLimit.toString())
    if (cursor.exchangeCode) {
      baseUrl.searchParams.set('exchange', cursor.exchangeCode)
    }
    if (!isSpot && (cursor.contractType ?? this.defaultContractType)) {
      baseUrl.searchParams.set('contractType', cursor.contractType ?? this.defaultContractType!)
    }

    let currentEarliestMs = earliestMs
    let totalInserted = 0
    let backfillCompleted = cursor.backfillCompleted ?? false
    let backfillCompletedAt = cursor.backfillCompletedAt

    for (let page = 0; page < this.MAX_BACKFILL_PAGES_PER_RUN; page++) {
      const backfillEndTimeMs = Math.max(currentEarliestMs - 1000, 0)
      const url = new URL(baseUrl.toString())
      url.searchParams.set('end_time', Math.floor(backfillEndTimeMs).toString())

      this.logger.log(
        `Backfill request (page ${page + 1}/${this.MAX_BACKFILL_PAGES_PER_RUN}): ${url.toString()}`,
      )

      const json = await this.fetchFuturesPriceJson(url, apiKey)

      const hasNoData = json.code === '0' && (!json.data || json.data.length === 0)
      if (json.code !== '0' || !json.data || json.data.length === 0) {
        if (hasNoData) {
          backfillCompleted = true
          backfillCompletedAt = Date.now()
        }
        break
      }

      const pointsWithTimestamps = json.data.map(point => {
        const timestampMs = point.time >= 1_000_000_000_000 ? point.time : point.time * 1000
        return { ...point, timestampMs }
      })

      const filteredPoints = pointsWithTimestamps.filter(
        point => point.timestampMs < currentEarliestMs,
      )
      if (filteredPoints.length === 0) {
        // API 返回的数据没有比当前最早记录更早的，无法继续
        backfillCompleted = true
        backfillCompletedAt = Date.now()
        break
      }

      const rows = filteredPoints.map(point => ({
        symbol: cursor.symbol,
        exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
        contractType,
        interval: prismaInterval,
        timestamp: new Date(point.timestampMs),
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        volumeUsd: point.volume_usd ?? null,
        source: 'COINGLASS',
      }))

      for (let start = 0; start < rows.length; start += this.BATCH_INSERT_SIZE) {
        const batch = rows.slice(start, start + this.BATCH_INSERT_SIZE)
        const result = await dbClient.futuresPriceHistory.createMany({
          data: batch,
          skipDuplicates: true,
        })
        totalInserted += result.count
      }

      const oldestFetched = Math.min(...filteredPoints.map(p => p.timestampMs))
      currentEarliestMs = oldestFetched

      if (oldestFetched <= targetMs) {
        backfillCompleted = true
        backfillCompletedAt = Date.now()
        break
      }
    }

    const denominator = earliestMs - targetMs
    const backfillProgress =
      denominator === 0 ? 100 : Math.round(((earliestMs - currentEarliestMs) / denominator) * 100)

    const newCursor: FuturesPriceCursor = {
      symbol: cursor.symbol,
      exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
      contractType: cursor.contractType,
      interval: cursor.interval,
      lastTimestamp: cursor.lastTimestamp,
      backfillCompleted: backfillCompleted ? true : cursor.backfillCompleted,
      backfillCompletedAt,
    }

    return {
      fetchedCount: totalInserted,
      newCursor: JSON.stringify(newCursor),
      meta: {
        symbol: cursor.symbol,
        exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
        contractType:
          cursor.contractType === undefined ? this.defaultContractType : cursor.contractType,
        interval: cursor.interval,
        mode: 'backfill',
        oldestFetched: new Date(currentEarliestMs).toISOString(),
        backfillProgress: `${backfillProgress}%`,
        insertedCount: totalInserted,
      },
    }
  }

  private getBackfillTarget(interval: string): number {
    const now = Date.now()
    const depthMap: Record<string, number> = {
      '1m': 2 * 24 * 60 * 60 * 1000, // Coinglass 1m 数据只支持最近 2 天
      '5m': 30 * 24 * 60 * 60 * 1000,
      '15m': 90 * 24 * 60 * 60 * 1000,
      '30m': 180 * 24 * 60 * 60 * 1000,
      '1h': 365 * 24 * 60 * 60 * 1000,
      '4h': 1 * 365 * 24 * 60 * 60 * 1000,
      '1d': 1 * 365 * 24 * 60 * 60 * 1000,
    }
    const depth = depthMap[interval] ?? 90 * 24 * 60 * 60 * 1000
    return now - depth
  }

  /**
   * 检测数据库中的 K 线数据缺口
   * 返回缺失数据段的时间范围列表
   *
   * @param symbol 交易对符号
   * @param exchangeCode 交易所代码
   * @param contractType 合约类型（null 表示现货）
   * @param interval 时间粒度
   * @param fromMs 检查起始时间（毫秒）
   * @param toMs 检查结束时间（毫秒）
   * @returns 缺口列表，每个缺口包含 start 和 end 时间戳
   */
  private async detectGaps(
    symbol: string,
    exchangeCode: string,
    contractType: string | null,
    interval: string,
    fromMs: number,
    toMs: number,
  ): Promise<Array<{ start: number; end: number }>> {
    const intervalMs = INTERVAL_MS[interval]
    if (!intervalMs) {
      this.logger.warn(`Unknown interval ${interval}, skipping gap detection`)
      return []
    }

    const dbClient = this.prisma.getClient()
    const prismaInterval = mapTimeframe(interval as MarketTimeframe)

    // 使用分块查询避免大数据量场景下的内存爆炸
    const CHUNK_SIZE = 10000
    const gaps: Array<{ start: number; end: number }> = []
    let prevTs = fromMs - intervalMs // 初始化为 fromMs 前一个周期
    let cursor: Date | undefined
    let hasMoreData = true

    while (hasMoreData) {
      const records = await dbClient.futuresPriceHistory.findMany({
        where: {
          symbol,
          exchangeCode,
          contractType,
          interval: prismaInterval,
          source: 'COINGLASS',
          timestamp: cursor
            ? { gt: cursor, lte: new Date(toMs) }
            : { gte: new Date(fromMs), lte: new Date(toMs) },
        },
        orderBy: { timestamp: 'asc' },
        take: CHUNK_SIZE,
        select: { timestamp: true },
      })

      if (records.length === 0) {
        hasMoreData = false
        break
      }

      for (const record of records) {
        const currTs = record.timestamp.getTime()
        const expectedNext = prevTs + intervalMs

        // 如果当前时间戳与预期差距超过一个周期，说明有缺口
        if (currTs > expectedNext) {
          gaps.push({ start: expectedNext, end: currTs - intervalMs })
        }
        prevTs = currTs
      }

      cursor = records[records.length - 1].timestamp
      hasMoreData = records.length === CHUNK_SIZE
    }

    // 检查结尾是否有缺口（prevTs 是最后一条记录的时间戳）
    if (prevTs < toMs - intervalMs && prevTs >= fromMs) {
      gaps.push({ start: prevTs + intervalMs, end: toMs - intervalMs })
    }

    // 特殊情况：完全没有数据时，整个范围都是缺口
    if (prevTs === fromMs - intervalMs) {
      return [{ start: fromMs, end: toMs - intervalMs }]
    }

    return gaps
  }

  /**
   * 回填检测到的数据缺口
   *
   * @param gaps 缺口列表
   * @param cursor 当前游标
   * @param endpoint API 端点
   * @param apiKey API 密钥
   * @returns 插入的记录数
   */
  private async fillGaps(
    gaps: Array<{ start: number; end: number }>,
    cursor: FuturesPriceCursor,
    endpoint: string,
    apiKey: string,
  ): Promise<number> {
    if (gaps.length === 0) {
      return 0
    }

    const isSpot = cursor.contractType === null
    const contractType = isSpot ? null : (cursor.contractType ?? this.defaultContractType)
    const interval = cursor.interval ?? this.defaultInterval
    const prismaInterval = mapTimeframe(interval as MarketTimeframe)
    const dbClient = this.prisma.getClient()

    let totalInserted = 0

    for (const gap of gaps) {
      this.logger.log(
        `Filling gap for ${cursor.symbol} ${interval}: ${new Date(gap.start).toISOString()} to ${new Date(gap.end).toISOString()}`,
      )

      // 使用分页拉取处理大缺口，避免超过 API limit 导致数据不完整
      let currentStart = gap.start
      let gapInserted = 0
      let pageCount = 0

      while (currentStart <= gap.end && pageCount < this.MAX_PAGES_PER_GAP) {
        pageCount++
        const url = new URL(endpoint)
        url.searchParams.set('symbol', this.getApiSymbol(cursor))
        url.searchParams.set('interval', interval)
        url.searchParams.set('limit', this.defaultLimit.toString())
        if (cursor.exchangeCode) {
          url.searchParams.set('exchange', cursor.exchangeCode)
        }
        if (!isSpot && (cursor.contractType ?? this.defaultContractType)) {
          url.searchParams.set('contractType', cursor.contractType ?? this.defaultContractType!)
        }
        url.searchParams.set('start_time', currentStart.toString())
        url.searchParams.set('end_time', gap.end.toString())

        try {
          const json = await this.fetchFuturesPriceJson(url, apiKey)

          if (json.code !== '0' || !json.data || json.data.length === 0) {
            // 没有更多数据，退出当前缺口的分页循环
            break
          }

          const pointsWithTimestamps = json.data.map(point => {
            const timestampMs = point.time >= 1_000_000_000_000 ? point.time : point.time * 1000
            return {
              ...point,
              timestampMs,
            }
          })

          // 过滤只保留缺口范围内的数据
          const filteredPoints = pointsWithTimestamps.filter(
            point => point.timestampMs >= gap.start && point.timestampMs <= gap.end,
          )

          if (filteredPoints.length === 0) {
            break
          }

          const rows = filteredPoints.map(point => ({
            symbol: cursor.symbol,
            exchangeCode: cursor.exchangeCode ?? this.defaultExchangeCode,
            contractType,
            interval: prismaInterval,
            timestamp: new Date(point.timestampMs),
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volumeUsd: point.volume_usd ?? null,
            source: 'COINGLASS',
          }))

          for (let start = 0; start < rows.length; start += this.BATCH_INSERT_SIZE) {
            const batch = rows.slice(start, start + this.BATCH_INSERT_SIZE)
            const result = await dbClient.futuresPriceHistory.createMany({
              data: batch,
              skipDuplicates: true,
            })
            gapInserted += result.count
          }

          // 计算下一轮起始时间：取本次返回数据的最大时间戳 + 1ms
          const maxTimestamp = Math.max(...filteredPoints.map(p => p.timestampMs))
          const newStart = maxTimestamp + this.TIMESTAMP_INCREMENT_MS

          // 检测进度停滞（API 返回相同数据），防止无限循环
          if (newStart <= currentStart) {
            this.logger.warn(
              `Gap fill progress stalled at ${new Date(currentStart).toISOString()}, breaking`,
            )
            break
          }
          currentStart = newStart

          // 如果返回数据量小于 limit，说明已经拉取完毕
          if (json.data.length < this.defaultLimit) {
            break
          }
        } catch (error) {
          this.logger.error(
            `Failed to fill gap page: ${error instanceof Error ? error.message : String(error)}`,
          )
          // 发生错误时退出当前缺口，继续处理下一个缺口
          break
        }
      }

      if (pageCount >= this.MAX_PAGES_PER_GAP) {
        this.logger.warn(
          `Gap fill for ${cursor.symbol} ${interval} exceeded max pages (${this.MAX_PAGES_PER_GAP}), some data may be missing`,
        )
      }

      if (gapInserted > 0) {
        this.logger.log(`Filled ${gapInserted} points for gap`)
      }
      totalInserted += gapInserted
    }

    return totalInserted
  }

  private applyMetaDefaults(cursor: FuturesPriceCursor, meta: unknown): void {
    if (!this.isRecord(meta)) return

    const symbol = this.getNonEmptyString(meta.symbol)
    if (symbol) {
      cursor.symbol = symbol
    }

    const exchangeCode = this.getNonEmptyString(meta.exchangeCode)
    if (exchangeCode) {
      cursor.exchangeCode = exchangeCode
    }

    const contractType = meta.contractType
    if (typeof contractType === 'string') {
      cursor.contractType = contractType.trim()
    } else if (contractType === null) {
      cursor.contractType = null
    }

    const interval = this.getNonEmptyString(meta.interval)
    if (interval && this.isAllowedInterval(interval)) {
      cursor.interval = interval
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  private getNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  private isAllowedInterval(value: string): value is MarketTimeframe {
    return (this.allowedIntervals as readonly string[]).includes(value)
  }

  /**
   * 将内部统一 symbol 转换为 Coinglass API 所需的交易所特定格式
   *
   * 不同交易所在 Coinglass API 中使用不同的 symbol 格式：
   * - Binance: BTCUSDT
   * - OKX: BTC-USDT-SWAP（永续）/ BTC-USDT（现货）
   */
  private getApiSymbol(cursor: FuturesPriceCursor): string {
    const exchangeCode = cursor.exchangeCode ?? this.defaultExchangeCode
    const contractType =
      cursor.contractType === null
        ? 'SPOT'
        : cursor.contractType === undefined
          ? (this.defaultContractType as CoinglassContractType)
          : (cursor.contractType as CoinglassContractType)
    return toCoinglassSymbol(cursor.symbol, exchangeCode, contractType)
  }

  private parseCursor(currentCursor: string | null): FuturesPriceCursor {
    if (!currentCursor) {
      return {
        symbol: this.defaultSymbol,
        exchangeCode: this.defaultExchangeCode,
        contractType: this.defaultContractType ?? undefined,
        interval: this.defaultInterval,
        lastTimestamp: undefined,
        backfillCompleted: false,
        backfillCompletedAt: undefined,
      }
    }

    try {
      const parsed = JSON.parse(currentCursor) as Partial<FuturesPriceCursor>
      if (!parsed.symbol) {
        parsed.symbol = this.defaultSymbol
      }
      if (!parsed.exchangeCode) {
        parsed.exchangeCode = this.defaultExchangeCode
      }
      // contractType 约定：null=spot；undefined=使用默认期货合约
      if (parsed.contractType === undefined && this.defaultContractType) {
        parsed.contractType = this.defaultContractType
      }

      if (!parsed.interval || !this.isAllowedInterval(parsed.interval as string)) {
        parsed.interval = this.defaultInterval
      }
      if (
        typeof parsed.lastTimestamp !== 'number' ||
        !Number.isFinite(parsed.lastTimestamp) ||
        parsed.lastTimestamp < 0
      ) {
        delete parsed.lastTimestamp
      }
      if (typeof parsed.backfillCompleted !== 'boolean') {
        delete parsed.backfillCompleted
      }
      if (
        typeof parsed.backfillCompletedAt !== 'number' ||
        !Number.isFinite(parsed.backfillCompletedAt) ||
        parsed.backfillCompletedAt < 0
      ) {
        delete parsed.backfillCompletedAt
      }
      if (
        typeof parsed.gapAuditCursorMs !== 'number' ||
        !Number.isFinite(parsed.gapAuditCursorMs) ||
        parsed.gapAuditCursorMs < 0
      ) {
        delete parsed.gapAuditCursorMs
      }
      return parsed as FuturesPriceCursor
    } catch {
      this.logger.warn(`Failed to parse cursor: ${currentCursor}, fallback to default`)
      return {
        symbol: this.defaultSymbol,
        exchangeCode: this.defaultExchangeCode,
        contractType: this.defaultContractType ?? undefined,
        interval: this.defaultInterval,
        lastTimestamp: undefined,
        backfillCompleted: false,
        backfillCompletedAt: undefined,
      }
    }
  }
}
