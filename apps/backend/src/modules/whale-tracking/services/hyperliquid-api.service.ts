import type { z } from 'zod'
import { ErrorCode, validateHyperliquidUrl } from '@ai/shared'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService,保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
import { LRUCache } from 'lru-cache'
import { DomainException } from '@/common/exceptions/domain.exception'
import {
  HyperliquidClearinghouseStateSchema,
  HyperliquidOpenOrderSchema,
  HyperliquidSpotClearinghouseStateSchema,
  HyperliquidUserFillSchema,
  validateHyperliquidResponse,
} from '../schemas/hyperliquid.schema'

/**
 * Hyperliquid API 请求类型枚举
 */
export enum HyperliquidApiType {
  CLEARINGHOUSE_STATE = 'clearinghouseState',
  SPOT_CLEARINGHOUSE_STATE = 'spotClearinghouseState',
  OPEN_ORDERS = 'openOrders',
  USER_FILLS = 'userFills',
  USER_FILLS_BY_TIME = 'userFillsByTime',
  USER_FUNDING = 'userFunding',
  HISTORICAL_ORDERS = 'historicalOrders',
  USER_NON_FUNDING_LEDGER_UPDATES = 'userNonFundingLedgerUpdates',
}

/**
 * Hyperliquid API 基础请求接口
 */
interface HyperliquidBaseRequest {
  type: HyperliquidApiType | string
  user?: string
  [key: string]: unknown
}

/**
 * Hyperliquid API 清算所状态请求
 */
export interface HyperliquidClearinghouseStateRequest extends HyperliquidBaseRequest {
  type: HyperliquidApiType.CLEARINGHOUSE_STATE
  user: string
}

/**
 * Hyperliquid API 现货清算所状态请求
 */
export interface HyperliquidSpotClearinghouseStateRequest extends HyperliquidBaseRequest {
  type: HyperliquidApiType.SPOT_CLEARINGHOUSE_STATE
  user: string
}

/**
 * Hyperliquid API 挂单请求
 */
export interface HyperliquidOpenOrdersRequest extends HyperliquidBaseRequest {
  type: HyperliquidApiType.OPEN_ORDERS
  user: string
}

/**
 * Hyperliquid API 用户成交请求
 */
export interface HyperliquidUserFillsRequest extends HyperliquidBaseRequest {
  type: HyperliquidApiType.USER_FILLS
  user: string
  aggregateByTime?: boolean
}

/**
 * Hyperliquid API 用户成交（按时间）请求
 */
export interface HyperliquidUserFillsByTimeRequest extends HyperliquidBaseRequest {
  type: HyperliquidApiType.USER_FILLS_BY_TIME
  user: string
  startTime: number
  endTime?: number
}

/**
 * Hyperliquid API 用户资金费率请求
 */
export interface HyperliquidUserFundingRequest extends HyperliquidBaseRequest {
  type: HyperliquidApiType.USER_FUNDING
  user: string
  startTime: number
  endTime?: number
}

/**
 * Hyperliquid API 历史订单请求
 */
export interface HyperliquidHistoricalOrdersRequest extends HyperliquidBaseRequest {
  type: HyperliquidApiType.HISTORICAL_ORDERS
  user: string
}

/**
 * Hyperliquid API 用户账本更新请求
 */
export interface HyperliquidUserNonFundingLedgerUpdatesRequest extends HyperliquidBaseRequest {
  type: HyperliquidApiType.USER_NON_FUNDING_LEDGER_UPDATES
  user: string
  startTime: number
  endTime?: number
}

// ============================================================================
// Hyperliquid API 响应类型定义
// ============================================================================

/**
 * 杠杆信息
 */
export interface HyperliquidLeverage {
  type: 'cross' | 'isolated'
  value: number
}

/**
 * 持仓详情（来自 assetPositions）
 */
export interface HyperliquidPosition {
  coin: string
  szi: string
  entryPx: string
  positionValue: string
  marginUsed: string
  unrealizedPnl: string
  liquidationPx: string | null
  leverage: HyperliquidLeverage
  returnOnEquity: string
  cumFunding: {
    allTime: string
    sinceChange: string
    sinceOpen: string
  }
}

/**
 * 资产持仓包装
 */
export interface HyperliquidAssetPosition {
  position: HyperliquidPosition
}

/**
 * 保证金汇总
 */
export interface HyperliquidMarginSummary {
  accountValue: string
  totalMarginUsed: string
  totalNtlPos: string
}

/**
 * 永续合约清算所状态响应
 */
export interface ClearinghouseStateResponse {
  marginSummary: HyperliquidMarginSummary
  withdrawable: string
  assetPositions: HyperliquidAssetPosition[]
  crossMarginSummary?: HyperliquidMarginSummary
}

/**
 * 现货余额项
 */
export interface HyperliquidSpotBalance {
  coin: string
  total: string
  hold: string
}

/**
 * 现货清算所状态响应
 */
export interface SpotClearinghouseStateResponse {
  balances: HyperliquidSpotBalance[]
}

/**
 * 挂单详情
 */
export interface HyperliquidOpenOrder {
  oid: number
  coin: string
  side: 'A' | 'B' // A = Buy, B = Sell (Hyperliquid 约定)
  limitPx: string
  sz: string
  origSz: string
  timestamp: number
  orderType?: string
  triggerPx?: string
  triggerCondition?: string
  reduceOnly?: boolean
}

/**
 * Hyperliquid API 客户端服务
 *
 * 功能：
 * - 封装 Hyperliquid API 的 HTTP 请求逻辑
 * - 实现限流和重试机制
 * - 提供响应缓存（LRU 缓存，最多1000项，TTL 5秒）
 * - 统一错误处理
 */
@Injectable()
export class HyperliquidApiService {
  private readonly logger = new Logger(HyperliquidApiService.name)
  private readonly apiUrl: string
  private readonly requestTimeoutMs = 10_000
  private readonly maxRetries = 2
  private readonly cache: LRUCache<string, unknown>

  constructor(private readonly configService: ConfigService) {
    const configUrl = this.configService.get<string>('HYPERLIQUID_API_URL')
    this.apiUrl = validateHyperliquidUrl(configUrl, 'https://api.hyperliquid.xyz')

    // 初始化 LRU 缓存：最多 1000 项，TTL 5 秒
    this.cache = new LRUCache<string, unknown>({
      max: 1000, // 最大缓存项数
      ttl: 5_000, // 5 秒过期时间
      updateAgeOnGet: false, // 获取时不更新过期时间
      updateAgeOnHas: false, // has 检查时不更新过期时间
    })

    this.logger.log(`Initialized with API URL: ${this.apiUrl}`)
  }

  /**
   * 发送 POST 请求到 Hyperliquid API
   *
   * @param request - API 请求参数
   * @param options - 可选配置
   * @param options.skipCache - 是否跳过缓存
   * @param options.timeout - 请求超时时间（毫秒）
   * @param options.schema - Zod schema 用于验证响应数据
   * @returns API 响应数据
   */
  async post<T = unknown>(
    request: HyperliquidBaseRequest,
    options?: {
      skipCache?: boolean
      timeout?: number
      schema?: z.ZodSchema<T>
    },
  ): Promise<T> {
    const cacheKey = JSON.stringify(request)

    // 检查缓存（除非明确跳过）
    // LRU 缓存自动处理过期，get 会返回 undefined 如果已过期
    if (!options?.skipCache) {
      const cached = this.cache.get(cacheKey)
      if (cached !== undefined) {
        this.logger.debug(`Cache hit for request type: ${request.type}`)
        return cached as T
      }
    }

    const url = `${this.apiUrl}/info`
    const timeout = options?.timeout ?? this.requestTimeoutMs

    this.logger.debug(`POST ${url} - type: ${request.type}, user: ${request.user ?? 'N/A'}`)

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeout)

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
            signal: controller.signal,
          })

          if (!response.ok) {
            const errorText = await this.safeReadText(response)
            const errorMessage = `HTTP ${response.status} ${response.statusText}${errorText ? `: ${errorText.slice(0, 200)}` : ''}`

            // 5xx 错误或 429 限流错误可重试
            if ((response.status >= 500 || response.status === 429) && attempt < this.maxRetries) {
              this.logger.warn(
                `Request failed (attempt ${attempt}/${this.maxRetries}): ${errorMessage}`,
              )
              lastError = new DomainException('whale_tracking.api_error', {
                code: ErrorCode.WHALE_TRACKING_API_ERROR,
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                args: { reason: errorMessage },
              })
              continue
            }

            throw new DomainException('whale_tracking.api_error', {
              code: ErrorCode.WHALE_TRACKING_API_ERROR,
              status: HttpStatus.INTERNAL_SERVER_ERROR,
              args: { reason: errorMessage },
            })
          }

          const data = (await response.json()) as T

          // 如果提供了 schema,进行运行时验证
          if (options?.schema) {
            const validated = validateHyperliquidResponse(options.schema, data, request.type)
            this.cache.set(cacheKey, validated)
            return validated
          }

          // 写入缓存（LRU 缓存会自动处理容量限制和过期时间）
          this.cache.set(cacheKey, data)

          return data
        } finally {
          clearTimeout(timer)
        }
      } catch (error) {
        const isAbort = this.isAbortError(error)
        const errorMessage = isAbort
          ? `Request timeout after ${timeout}ms`
          : error instanceof Error
            ? error.message
            : String(error)

        lastError = new DomainException('whale_tracking.api_error', {
          code: ErrorCode.WHALE_TRACKING_API_ERROR,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          args: { reason: errorMessage },
        })

        if (attempt < this.maxRetries) {
          this.logger.warn(
            `Request failed (attempt ${attempt}/${this.maxRetries}): ${errorMessage}`,
          )
          continue
        }

        this.logger.error(
          `Request failed after ${this.maxRetries} attempts: ${errorMessage}`,
          error instanceof Error ? error.stack : undefined,
        )

        throw lastError
      }
    }

    // 理论上不可达（循环至少会抛出最后一次错误）
    throw lastError ?? new DomainException('whale_tracking.api_error', {
      code: ErrorCode.WHALE_TRACKING_API_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      args: { reason: 'Request failed with unknown error' },
    })
  }

  /**
   * 获取用户永续合约账户状态
   *
   * @param userAddress - 用户地址（42 字符十六进制格式）
   * @param skipCache - 是否跳过缓存
   * @returns 清算所状态数据
   */
  async getClearinghouseState(
    userAddress: string,
    skipCache = false,
  ): Promise<ClearinghouseStateResponse> {
    return this.post<ClearinghouseStateResponse>(
      {
        type: HyperliquidApiType.CLEARINGHOUSE_STATE,
        user: userAddress,
      },
      {
        skipCache,
        schema:
          HyperliquidClearinghouseStateSchema as unknown as z.ZodSchema<ClearinghouseStateResponse>,
      },
    )
  }

  /**
   * 获取用户现货账户状态
   *
   * @param userAddress - 用户地址（42 字符十六进制格式）
   * @param skipCache - 是否跳过缓存
   * @returns 现货清算所状态数据
   */
  async getSpotClearinghouseState(
    userAddress: string,
    skipCache = false,
  ): Promise<SpotClearinghouseStateResponse> {
    return this.post<SpotClearinghouseStateResponse>(
      {
        type: HyperliquidApiType.SPOT_CLEARINGHOUSE_STATE,
        user: userAddress,
      },
      {
        skipCache,
        schema:
          HyperliquidSpotClearinghouseStateSchema as unknown as z.ZodSchema<SpotClearinghouseStateResponse>,
      },
    )
  }

  /**
   * 获取用户当前挂单
   *
   * @param userAddress - 用户地址（42 字符十六进制格式）
   * @param skipCache - 是否跳过缓存
   * @returns 挂单列表
   */
  async getOpenOrders(userAddress: string, skipCache = false): Promise<HyperliquidOpenOrder[]> {
    return this.post<HyperliquidOpenOrder[]>(
      {
        type: HyperliquidApiType.OPEN_ORDERS,
        user: userAddress,
      },
      {
        skipCache,
        schema: HyperliquidOpenOrderSchema.array() as unknown as z.ZodSchema<
          HyperliquidOpenOrder[]
        >,
      },
    )
  }

  /**
   * 获取用户成交记录（最多 2000 条）
   *
   * @param userAddress - 用户地址（42 字符十六进制格式）
   * @param aggregateByTime - 是否按时间聚合部分成交
   * @param skipCache - 是否跳过缓存
   * @returns 成交记录列表
   */
  async getUserFills<T = unknown>(
    userAddress: string,
    aggregateByTime = false,
    skipCache = false,
  ): Promise<T> {
    return this.post<T>(
      {
        type: HyperliquidApiType.USER_FILLS,
        user: userAddress,
        aggregateByTime,
      },
      { skipCache, schema: HyperliquidUserFillSchema.array() as unknown as z.ZodSchema<T> },
    )
  }

  /**
   * 获取用户成交记录（按时间范围，最多 2000 条）
   *
   * @param userAddress - 用户地址（42 字符十六进制格式）
   * @param startTime - 开始时间（毫秒时间戳）
   * @param endTime - 结束时间（毫秒时间戳，可选，默认当前时间）
   * @param skipCache - 是否跳过缓存
   * @returns 成交记录列表
   */
  async getUserFillsByTime<T = unknown>(
    userAddress: string,
    startTime: number,
    endTime?: number,
    skipCache = false,
  ): Promise<T> {
    return this.post<T>(
      {
        type: HyperliquidApiType.USER_FILLS_BY_TIME,
        user: userAddress,
        startTime,
        endTime,
      },
      { skipCache },
    )
  }

  /**
   * 获取用户资金费率历史
   *
   * @param userAddress - 用户地址（42 字符十六进制格式）
   * @param startTime - 开始时间（毫秒时间戳）
   * @param endTime - 结束时间（毫秒时间戳，可选，默认当前时间）
   * @param skipCache - 是否跳过缓存
   * @returns 资金费率历史列表
   */
  async getUserFunding<T = unknown>(
    userAddress: string,
    startTime: number,
    endTime?: number,
    skipCache = false,
  ): Promise<T> {
    return this.post<T>(
      {
        type: HyperliquidApiType.USER_FUNDING,
        user: userAddress,
        startTime,
        endTime,
      },
      { skipCache },
    )
  }

  /**
   * 获取用户历史订单（最多 2000 条）
   *
   * @param userAddress - 用户地址（42 字符十六进制格式）
   * @param skipCache - 是否跳过缓存
   * @returns 历史订单列表
   */
  async getHistoricalOrders<T = unknown>(userAddress: string, skipCache = false): Promise<T> {
    return this.post<T>(
      {
        type: HyperliquidApiType.HISTORICAL_ORDERS,
        user: userAddress,
      },
      { skipCache },
    )
  }

  /**
   * 获取用户非资金费用账本更新（充值/提现/转账等）
   *
   * @param userAddress - 用户地址（42 字符十六进制格式）
   * @param startTime - 开始时间（毫秒时间戳）
   * @param endTime - 结束时间（毫秒时间戳，可选，默认当前时间）
   * @param skipCache - 是否跳过缓存
   * @returns 账本更新列表
   */
  async getUserNonFundingLedgerUpdates<T = unknown>(
    userAddress: string,
    startTime: number,
    endTime?: number,
    skipCache = false,
  ): Promise<T> {
    return this.post<T>(
      {
        type: HyperliquidApiType.USER_NON_FUNDING_LEDGER_UPDATES,
        user: userAddress,
        startTime,
        endTime,
      },
      { skipCache },
    )
  }

  /**
   * 安全读取响应文本
   */
  private async safeReadText(response: Response): Promise<string> {
    try {
      return await response.text()
    } catch {
      return ''
    }
  }

  /**
   * 判断是否为 AbortError
   */
  private isAbortError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false
    if (!('name' in error)) return false
    return (error as { name?: unknown }).name === 'AbortError'
  }
}
