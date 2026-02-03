/* eslint-disable jsdoc/check-param-names */
/**
 * Hyperliquid API 前端客户端
 *
 * 直接调用 Hyperliquid 官方 API (https://api.hyperliquid.xyz/info)
 * 实现与后端 DTO 兼容的数据转换层
 *
 * 参考文档：
 * - https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
 * - https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals
 * - https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/spot
 */

import type { schemas } from '@ai/api-contracts'
import type { ZodTypeAny } from 'zod'
import { safeParseFloat, validateHyperliquidUrl } from '@ai/shared'
import pLimit from 'p-limit'
import { ApiError, logError } from './errors'
import { logger } from './logger'

type Infer<T extends ZodTypeAny> = T['_output']

// 复用后端 DTO 类型定义
export type TraderSnapshotResponse = Infer<typeof schemas.TraderSnapshotResponseDto>
export type TraderPositionsResponse = Infer<typeof schemas.TraderPositionsResponseDto>
export type TraderOpenOrdersResponse = Infer<typeof schemas.TraderOpenOrdersResponseDto>

// 前端专用的历史数据响应类型
export interface UserPortfolioResponse {
  day: PortfolioPeriodData
  week: PortfolioPeriodData
  month: PortfolioPeriodData
  allTime: PortfolioPeriodData
  perpDay: PortfolioPeriodData
  perpWeek: PortfolioPeriodData
  perpMonth: PortfolioPeriodData
  perpAllTime: PortfolioPeriodData
}

export interface PortfolioPeriodData {
  accountValueHistory: Array<{ timestamp: number; value: number }>
  pnlHistory: Array<{ timestamp: number; value: number }>
  volume: number
}

export interface UserFillsResponse {
  fills: UserFill[]
}

export interface UserFill {
  coin: string
  price: number
  size: number
  side: 'BUY' | 'SELL'
  time: number
  direction: 'Open Long' | 'Close Long' | 'Open Short' | 'Close Short'
  startPosition: number
  closedPnl: number
  fee: number
  feeToken: string
  hash: string
}

// ============================================================================
// Hyperliquid API 原始响应类型定义
// ============================================================================

/**
 * Hyperliquid API 杠杆信息
 */
interface HyperliquidLeverage {
  type: 'cross' | 'isolated'
  value: number
}

/**
 * Hyperliquid 永续合约持仓（来自 assetPositions）
 */
interface HyperliquidPosition {
  coin: string
  szi: string // 仓位大小（负数表示空头）
  entryPx: string // 入场价格
  positionValue: string // 持仓价值
  marginUsed: string // 已用保证金
  unrealizedPnl: string // 未实现盈亏
  liquidationPx: string | null // 清算价格
  leverage: HyperliquidLeverage
  returnOnEquity: string // ROE
  cumFunding: {
    allTime: string
    sinceChange: string
    sinceOpen: string
  }
}

/**
 * Hyperliquid 资产持仓包装
 */
interface HyperliquidAssetPosition {
  position: HyperliquidPosition
}

/**
 * Hyperliquid 保证金汇总
 */
interface HyperliquidMarginSummary {
  accountValue: string
  totalMarginUsed: string
  totalNtlPos: string // 总持仓名义价值
}

/**
 * Hyperliquid 永续合约清算所状态响应
 */
interface HyperliquidClearinghouseStateResponse {
  marginSummary: HyperliquidMarginSummary
  withdrawable: string
  assetPositions: HyperliquidAssetPosition[]
  crossMarginSummary?: HyperliquidMarginSummary
  time: number
}

/**
 * Hyperliquid 现货余额项
 */
interface HyperliquidSpotBalance {
  coin: string
  token: number // Token index
  total: string
  hold: string
  entryNtl: string
}

/**
 * Hyperliquid 现货清算所状态响应
 */
interface HyperliquidSpotClearinghouseStateResponse {
  balances: HyperliquidSpotBalance[]
}

/**
 * Hyperliquid spotMeta 响应（用于 token → universe 映射）
 */
interface HyperliquidSpotMetaResponse {
  universe: Array<{
    tokens: number[] // [tokenA_index, tokenB_index]
    name: string // 交易对名称或 @index
    index: number // Universe index
    isCanonical: boolean
  }>
  tokens: Array<{
    name: string
    index: number
    tokenId: string
  }>
}

/**
 * Hyperliquid 挂单详情
 */
interface HyperliquidOpenOrder {
  oid: number
  coin: string
  side: 'A' | 'B' // A = Buy, B = Sell
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
 * Hyperliquid 所有币种中间价响应
 */
interface HyperliquidAllMidsResponse {
  [coin: string]: string // 币种名称 -> 价格（字符串格式）
}

/**
 * Hyperliquid 用户成交记录
 */
interface HyperliquidUserFill {
  coin: string
  px: string // 成交价格
  sz: string // 成交数量
  side: string // 'A' = Buy, 'B' = Sell
  time: number // 时间戳（毫秒）
  startPosition: string // 成交前仓位
  dir: string // "Open Long" | "Close Long" | "Open Short" | "Close Short"
  closedPnl: string // 已实现盈亏（平仓时）
  hash: string // 交易哈希
  oid: number // 订单 ID
  crossed: boolean // 是否为吃单
  fee: string // 手续费
  tid: number // 成交 ID
  feeToken: string // 手续费币种
}

/**
 * Hyperliquid 历史委托（订单）条目
 *
 * Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint#retrieve-a-users-historical-orders
 */
export interface HyperliquidHistoricalOrder {
  coin: string
  side: 'A' | 'B'
  limitPx: string
  sz: string
  oid: number
  timestamp: number
  triggerCondition?: string
  isTrigger?: boolean
  triggerPx?: string
  children?: unknown[]
  isPositionTpsl?: boolean
  reduceOnly?: boolean
  orderType?: string
  origSz?: string
  tif?: string
  cloid?: string | null
}

export type HyperliquidHistoricalOrderStatus =
  | 'open'
  | 'filled'
  | 'canceled'
  | 'triggered'
  | 'rejected'
  | 'marginCanceled'

export interface HyperliquidHistoricalOrderEntry {
  order: HyperliquidHistoricalOrder
  status: HyperliquidHistoricalOrderStatus
  statusTimestamp: number
}

/**
 * Hyperliquid 投资组合时间序列数据点
 */
type PortfolioDataPoint = [number, string] // [timestamp_ms, value]

/**
 * Hyperliquid 投资组合周期数据
 */
interface HyperliquidPortfolioPeriodData {
  accountValueHistory: PortfolioDataPoint[]
  pnlHistory: PortfolioDataPoint[]
  vlm: string // 交易量
}

/**
 * Hyperliquid 投资组合响应（数组格式）
 */
type HyperliquidPortfolioResponse = Array<
  [string, HyperliquidPortfolioPeriodData] // [period, data]
>

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 空的永续合约数据（用于 spot-only 查询）
 */
const EMPTY_PERP_DATA: HyperliquidClearinghouseStateResponse = {
  marginSummary: {
    accountValue: '0',
    totalMarginUsed: '0',
    totalNtlPos: '0',
  },
  withdrawable: '0',
  assetPositions: [],
  time: 0,
}

/**
 * 空的现货数据（用于 perp-only 查询）
 */
const EMPTY_SPOT_DATA: HyperliquidSpotClearinghouseStateResponse = {
  balances: [],
}

/**
 * 有效的投资组合周期（用于 portfolio 数据转换）
 */
const VALID_PERIODS = [
  'day',
  'week',
  'month',
  'allTime',
  'perpDay',
  'perpWeek',
  'perpMonth',
  'perpAllTime',
] as const
type ValidPeriod = (typeof VALID_PERIODS)[number]

/**
 * 有效的成交方向（用于 fills 数据转换）
 */
const VALID_DIRECTIONS = ['Open Long', 'Close Long', 'Open Short', 'Close Short'] as const
type ValidDirection = (typeof VALID_DIRECTIONS)[number]

// ============================================================================
// Hyperliquid API HTTP 客户端
// ============================================================================

const HYPERLIQUID_BASE_URL = validateHyperliquidUrl(
  process.env.NEXT_PUBLIC_HYPERLIQUID_API_URL,
  'https://api.hyperliquid.xyz',
)
const HYPERLIQUID_API_URL = `${HYPERLIQUID_BASE_URL}/info`

// ============================================================================
// 地址校验
// ============================================================================

/**
 * 校验以太坊地址格式
 * @param address - 待校验的地址
 * @returns 是否为有效的以太坊地址（42 字符，0x 前缀 + 40 位十六进制）
 */
function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// ============================================================================
// spotMeta/allMids 缓存（Promise 缓存策略，消除竞态条件）
// ============================================================================

const CACHE_TTL_MS = 60_000 // 60 秒

// Promise 缓存：缓存 Promise 本身而非数据，避免并发请求时重复调用 API
let spotMetaPromise: Promise<HyperliquidSpotMetaResponse> | null = null
let spotMetaCacheExpiry = 0

let allMidsPromise: Promise<HyperliquidAllMidsResponse> | null = null
let allMidsCacheExpiry = 0

/**
 * 获取 spotMeta（Promise 缓存策略，消除竞态条件）
 */
async function getCachedSpotMeta(): Promise<HyperliquidSpotMetaResponse> {
  const now = Date.now()
  if (spotMetaPromise && spotMetaCacheExpiry > now) {
    return spotMetaPromise
  }
  spotMetaCacheExpiry = now + CACHE_TTL_MS
  spotMetaPromise = postHyperliquidInfo<HyperliquidSpotMetaResponse>({ type: 'spotMeta' }).catch(
    error => {
      // 请求失败时清除缓存，允许下次重试
      spotMetaPromise = null
      spotMetaCacheExpiry = 0
      throw error
    },
  )
  return spotMetaPromise
}

/**
 * 获取 allMids（Promise 缓存策略，消除竞态条件）
 */
async function getCachedAllMids(): Promise<HyperliquidAllMidsResponse> {
  const now = Date.now()
  if (allMidsPromise && allMidsCacheExpiry > now) {
    return allMidsPromise
  }
  allMidsCacheExpiry = now + CACHE_TTL_MS
  allMidsPromise = postHyperliquidInfo<HyperliquidAllMidsResponse>({ type: 'allMids' }).catch(
    error => {
      // 请求失败时清除缓存，允许下次重试
      allMidsPromise = null
      allMidsCacheExpiry = 0
      throw error
    },
  )
  return allMidsPromise
}
/**
 * Hyperliquid API 请求超时时间（毫秒）
 *
 * 根据 Hyperliquid 官方文档，API 响应时间通常在 200-500ms，
 * 设置 10 秒超时以应对网络抖动和高负载场景
 */
const REQUEST_TIMEOUT_MS = 10000

/**
 * 客户端速率限制：最多并发 10 个请求
 *
 * Hyperliquid API 限制为 100 req/10s，设置 10 并发确保不会触发限制
 */
const limit = pLimit(10)

/**
 * 最大重试次数（用于 429 速率限制错误）
 */
const MAX_RETRIES = 3

/**
 * 发送 POST 请求到 Hyperliquid API
 *
 * @param request - API 请求参数
 * @param request.type - info endpoint 的请求类型
 * @param request.user - 用户地址（可选，依赖 type）
 * @returns API 响应数据
 * @throws ApiError 当请求失败时
 */
async function postHyperliquidInfo<T>(request: {
  type: string
  user?: string
  [key: string]: unknown
}): Promise<T> {
  return limit(async () => {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      try {
        const response = await fetch(HYPERLIQUID_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        })

        if (!response.ok) {
          const errorText = await safeReadText(response)

          // 429 速率限制，进行指数退避重试
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After')
            const delay = retryAfter
              ? Number.parseInt(retryAfter) * 1000
              : Math.min(2 ** attempt * 1000, 10000)

            if (attempt < MAX_RETRIES - 1) {
              await new Promise(resolve => setTimeout(resolve, delay))
              lastError = new ApiError(
                `Hyperliquid API 速率限制，正在重试... (${attempt + 1}/${MAX_RETRIES})`,
                'HYPERLIQUID_API_RATE_LIMIT',
                429,
              )
              continue
            }
          }

          throw new ApiError(
            `Hyperliquid API 请求失败: ${response.status} ${response.statusText}`,
            'HYPERLIQUID_API_ERROR',
            response.status,
            { errorText: errorText?.slice(0, 200) },
          )
        }

        const data = (await response.json()) as T
        return data
      } catch (error) {
        if (isAbortError(error)) {
          throw new ApiError(
            `Hyperliquid API 请求超时 (${REQUEST_TIMEOUT_MS}ms)`,
            'HYPERLIQUID_API_TIMEOUT',
            408,
          )
        }

        lastError = error instanceof Error ? error : new Error(String(error))

        // 非 429 错误直接抛出
        if (!(error instanceof ApiError && error.statusCode === 429)) {
          throw error
        }
      } finally {
        clearTimeout(timer)
      }
    }

    throw lastError || new Error('Max retries exceeded')
  })
}

/**
 * 安全读取响应文本
 */
async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

/**
 * 判断是否为 AbortError
 */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  )
}

// ============================================================================
// 数据转换函数（Hyperliquid 原始格式 → 后端 DTO 格式）
// ============================================================================

/**
 * 从价格数据中查找现货 token 的 USD 价格
 *
 * @param tokenIndex - Token index（从 spotClearinghouseState 获取）
 * @param spotMeta - spotMeta 响应数据
 * @param priceData - allMids 返回的价格数据
 * @returns USD 价格，如果找不到则返回 0
 */
function findSpotPrice(
  tokenIndex: number,
  spotMeta: HyperliquidSpotMetaResponse,
  priceData: HyperliquidAllMidsResponse,
): number {
  // 1. 如果是 USDC (token index 0)，直接返回 1.0
  if (tokenIndex === 0) {
    return 1.0
  }

  // 2. 查找包含该 token 的交易对（优先查找 canonical 交易对）
  const pairs = spotMeta.universe.filter(u => u.tokens.includes(tokenIndex))

  logger.debug('findSpotPrice', { tokenIndex, pairsCount: pairs.length })
  if (pairs.length > 0) {
    logger.debug('findSpotPrice - first pair', { pair: pairs[0] })
  }
  logger.debug('findSpotPrice - sample keys', { count: Object.keys(priceData).length })

  // 优先使用 canonical 交易对
  const canonicalPair = pairs.find(p => p.isCanonical)
  const targetPair = canonicalPair || pairs[0]

  if (!targetPair) {
    logger.warn('findSpotPrice: No pair found', { tokenIndex })
    return 0
  }

  // 3. 使用 universe index 查找价格
  const universeKey = `@${targetPair.index}`
  const priceStr = priceData[universeKey]

  logger.debug('findSpotPrice - price lookup', { universeKey, priceStr })

  if (!priceStr) {
    logger.warn('findSpotPrice: No price found', { universeKey })
    return 0
  }

  return safeParseFloat(priceStr)
}

/**
 * 转换 clearinghouseState 和 spotClearinghouseState 为 TraderSnapshotResponse
 *
 * 对齐 hyperbot.network：
 * - 可用保证金 / withdrawable 来自默认 dex 的 clearinghouseState
 * - 持仓（positionValue、unrealizedPnl、marginUsed）来自 dex=xyz 的 clearinghouseState
 */
function transformToTraderSnapshot(
  perpCashData: HyperliquidClearinghouseStateResponse,
  perpXyzData: HyperliquidClearinghouseStateResponse,
  spotData: HyperliquidSpotClearinghouseStateResponse,
  spotMeta: HyperliquidSpotMetaResponse,
  priceData: HyperliquidAllMidsResponse,
): TraderSnapshotResponse {
  const cashMarginSummary = perpCashData.marginSummary
  const withdrawable = safeParseFloat(perpCashData.withdrawable)

  const cashPositions = perpCashData.assetPositions
  const xyzPositions = perpXyzData.assetPositions

  const cashMarginUsed = safeParseFloat(cashMarginSummary.totalMarginUsed)
  const xyzMarginUsed = xyzPositions.reduce(
    (sum, pos) => sum + safeParseFloat(pos.position.marginUsed),
    0,
  )
  const totalMarginUsed = cashMarginUsed + xyzMarginUsed

  // 账户总价值（Perp）：可提资金 + 已用保证金（含 xyz）
  const accountValue = withdrawable + totalMarginUsed

  // 总持仓价值：使用 assetPositions 聚合，避免 totalNtlPos 的净值口径
  const cashPositionValue = cashPositions.reduce(
    (sum, pos) => sum + Math.abs(safeParseFloat(pos.position.positionValue)),
    0,
  )
  const xyzPositionValue = xyzPositions.reduce(
    (sum, pos) => sum + Math.abs(safeParseFloat(pos.position.positionValue)),
    0,
  )
  const totalPositionValue = cashPositionValue + xyzPositionValue

  logger.debug('transformToTraderSnapshot', {
    cashMarginSummary,
    accountValue,
    totalMarginUsed,
    totalPositionValue,
    withdrawable,
    assetPositionsCount: cashPositions.length + xyzPositions.length,
  })

  // 计算总未实现盈亏
  const unrealizedPnl = [...cashPositions, ...xyzPositions].reduce(
    (sum, pos) => sum + safeParseFloat(pos.position.unrealizedPnl),
    0,
  )

  // 计算保证金使用率
  const marginUsagePercent = accountValue > 0 ? (totalMarginUsed / accountValue) * 100 : 0

  // 计算杠杆倍数
  const leverageRatio = totalMarginUsed > 0 ? totalPositionValue / totalMarginUsed : 0

  // 计算 ROI
  const roi = accountValue > 0 ? (unrealizedPnl / accountValue) * 100 : 0

  // 处理现货余额，使用价格数据计算 USD 价值
  const spotBalances = spotData.balances.map(balance => {
    const total = safeParseFloat(balance.total)
    const hold = safeParseFloat(balance.hold)

    // 使用 token index 查找价格
    const price = findSpotPrice(balance.token, spotMeta, priceData)

    // 计算 USD 价值
    const value = total * price

    logger.debug('spotBalance', { coin: balance.coin, total, price, value })

    return {
      coin: balance.coin,
      total,
      hold,
      value,
      sharePercent: 0, // 需要在知道总价值后计算
    }
  })

  // 计算现货总价值
  const spotTotalValue = spotBalances.reduce((sum, b) => sum + b.value, 0)

  // 更新现货占比
  if (spotTotalValue > 0) {
    spotBalances.forEach(balance => {
      balance.sharePercent = (balance.value / spotTotalValue) * 100
    })
  }

  // 计算总账户价值
  const totalAccountValue = accountValue + spotTotalValue

  return {
    perp: {
      accountValue,
      totalMarginUsed,
      totalPositionValue,
      withdrawable,
      marginUsagePercent,
      leverageRatio,
      unrealizedPnl,
      roi,
    },
    spot: {
      totalValue: spotTotalValue,
      balances: spotBalances,
    },
    total: {
      accountValue: totalAccountValue,
      perpPercent: totalAccountValue > 0 ? (accountValue / totalAccountValue) * 100 : 0,
      spotPercent: totalAccountValue > 0 ? (spotTotalValue / totalAccountValue) * 100 : 0,
    },
  }
}

/**
 * 转换 clearinghouseState 和 spotClearinghouseState 为 TraderPositionsResponse
 */
function transformToTraderPositions(
  perpData: HyperliquidClearinghouseStateResponse,
  spotData: HyperliquidSpotClearinghouseStateResponse,
  spotMeta: HyperliquidSpotMetaResponse,
  priceData: HyperliquidAllMidsResponse,
  type: 'perp' | 'spot' | 'all' = 'all',
): TraderPositionsResponse {
  const perpPositions =
    type === 'spot'
      ? []
      : perpData.assetPositions.map(assetPos => {
          const pos = assetPos.position
          const size = safeParseFloat(pos.szi)
          const side = size >= 0 ? ('LONG' as const) : ('SHORT' as const)
          const entryPrice = safeParseFloat(pos.entryPx)
          const positionValue = safeParseFloat(pos.positionValue)
          const marginUsed = safeParseFloat(pos.marginUsed)
          const unrealizedPnl = safeParseFloat(pos.unrealizedPnl)
          const roi = safeParseFloat(pos.returnOnEquity) * 100

          // 计算标记价格（基于持仓价值和数量）
          const markPrice = size !== 0 ? Math.abs(positionValue / size) : entryPrice

          // 解析清算价格
          // 注意：当 liquidationPx 为 null 时使用 0，实际上全仓模式可能不适用清算价
          const liquidationPrice = pos.liquidationPx ? safeParseFloat(pos.liquidationPx) : 0

          // 计算未实现盈亏百分比
          const unrealizedPnlPercent = marginUsed > 0 ? (unrealizedPnl / marginUsed) * 100 : 0

          return {
            coin: pos.coin,
            side,
            size,
            entryPrice,
            markPrice,
            liquidationPrice,
            positionValue,
            marginUsed,
            leverage: {
              type: pos.leverage.type,
              value: pos.leverage.value,
            },
            unrealizedPnl,
            unrealizedPnlPercent,
            roi,
          }
        })

  const spotPositions =
    type === 'perp'
      ? []
      : spotData.balances.map(balance => {
          const total = safeParseFloat(balance.total)
          const hold = safeParseFloat(balance.hold)
          const available = total - hold

          // 使用 token index 查找价格
          const price = findSpotPrice(balance.token, spotMeta, priceData)

          // 计算 USD 价值
          const value = total * price

          return {
            coin: balance.coin,
            total,
            hold,
            available,
            value,
          }
        })

  return {
    perp: perpPositions,
    spot: spotPositions,
  }
}

/**
 * 订单数量的最小有效阈值
 *
 * 低于此值的订单视为已完全成交（sz=0 或接近 0 的浮点误差）
 * 阈值设定为 1e-7，可容忍 8 位小数的精度损失
 */
const MIN_ORDER_SIZE = 0.0000001

/**
 * 转换 openOrders 为 TraderOpenOrdersResponse
 */
function transformToTraderOpenOrders(orders: HyperliquidOpenOrder[]): TraderOpenOrdersResponse {
  // 过滤掉 sz=0 的订单（可能已完全成交但未清理）
  const activeOrders = orders.filter(order => {
    const size = safeParseFloat(order.sz)
    return size > MIN_ORDER_SIZE // 使用常量替代魔法数字
  })

  const transformedOrders = activeOrders.map(order => {
    const side = order.side === 'A' ? ('BUY' as const) : ('SELL' as const)
    const price = safeParseFloat(order.limitPx)
    const size = safeParseFloat(order.sz)
    const origSize = safeParseFloat(order.origSz)
    const value = price * size

    return {
      orderId: order.oid,
      coin: order.coin,
      side,
      type: order.orderType ?? 'limit',
      price,
      size,
      origSize,
      value,
      timestamp: new Date(order.timestamp).toISOString(),
      triggerPrice: order.triggerPx ? safeParseFloat(order.triggerPx) : undefined,
      triggerCondition: order.triggerCondition ?? undefined,
      reduceOnly: order.reduceOnly ?? false,
    }
  })

  return {
    orders: transformedOrders,
  }
}

// ============================================================================
// 公共 API（导出给 lib/api.ts 使用）
// ============================================================================

/**
 * 从 Hyperliquid 获取交易者账户快照
 *
 * @param address - 用户地址（42 字符十六进制格式）
 * @returns 账户快照数据（兼容后端 DTO 格式）
 */
export async function fetchTraderSnapshotFromHyperliquid(
  address: string,
): Promise<TraderSnapshotResponse> {
  if (!isValidEthereumAddress(address)) {
    throw new ApiError('Invalid Ethereum address format', 'INVALID_ADDRESS', 400)
  }

  try {
    const [perpCashData, perpXyzData, spotData, spotMeta, priceData] = await Promise.all([
      postHyperliquidInfo<HyperliquidClearinghouseStateResponse>({
        type: 'clearinghouseState',
        user: address,
      }),
      postHyperliquidInfo<HyperliquidClearinghouseStateResponse>({
        type: 'clearinghouseState',
        user: address,
        dex: 'xyz',
      }),
      postHyperliquidInfo<HyperliquidSpotClearinghouseStateResponse>({
        type: 'spotClearinghouseState',
        user: address,
      }),
      getCachedSpotMeta(),
      getCachedAllMids(),
    ])

    return transformToTraderSnapshot(perpCashData, perpXyzData, spotData, spotMeta, priceData)
  } catch (error) {
    logError('FETCH_TRADER_SNAPSHOT_FROM_HYPERLIQUID', error, { address })
    throw error
  }
}

/**
 * 从 Hyperliquid 获取交易者持仓详情
 *
 * @param address - 用户地址（42 字符十六进制格式）
 * @param options - 查询选项
 * @param options.type - 查询类型（perp/spot/all）
 * @returns 持仓详情数据（兼容后端 DTO 格式）
 */
export async function fetchTraderPositionsFromHyperliquid(
  address: string,
  options: { type?: 'perp' | 'spot' | 'all' } = {},
): Promise<TraderPositionsResponse> {
  if (!isValidEthereumAddress(address)) {
    throw new ApiError('Invalid Ethereum address format', 'INVALID_ADDRESS', 400)
  }

  const { type = 'all' } = options

  try {
    // 根据查询类型直接调用对应的 API，避免复杂的动态数组逻辑
    if (type === 'all') {
      const [perpCashData, perpXyzData, spotData, spotMeta, priceData] = await Promise.all([
        postHyperliquidInfo<HyperliquidClearinghouseStateResponse>({
          type: 'clearinghouseState',
          user: address,
        }),
        postHyperliquidInfo<HyperliquidClearinghouseStateResponse>({
          type: 'clearinghouseState',
          user: address,
          dex: 'xyz',
        }),
        postHyperliquidInfo<HyperliquidSpotClearinghouseStateResponse>({
          type: 'spotClearinghouseState',
          user: address,
        }),
        getCachedSpotMeta(),
        getCachedAllMids(),
      ])

      const mergedPerpData: HyperliquidClearinghouseStateResponse = {
        ...perpCashData,
        assetPositions: [...perpCashData.assetPositions, ...perpXyzData.assetPositions],
      }

      return transformToTraderPositions(mergedPerpData, spotData, spotMeta, priceData, type)
    } else if (type === 'perp') {
      const [perpCashData, perpXyzData] = await Promise.all([
        postHyperliquidInfo<HyperliquidClearinghouseStateResponse>({
          type: 'clearinghouseState',
          user: address,
        }),
        postHyperliquidInfo<HyperliquidClearinghouseStateResponse>({
          type: 'clearinghouseState',
          user: address,
          dex: 'xyz',
        }),
      ])

      const mergedPerpData: HyperliquidClearinghouseStateResponse = {
        ...perpCashData,
        assetPositions: [...perpCashData.assetPositions, ...perpXyzData.assetPositions],
      }
      // perp-only 查询不需要价格数据
      const emptySpotMeta: HyperliquidSpotMetaResponse = { universe: [], tokens: [] }
      return transformToTraderPositions(mergedPerpData, EMPTY_SPOT_DATA, emptySpotMeta, {}, type)
    } else {
      // type === 'spot'
      const [spotData, spotMeta, priceData] = await Promise.all([
        postHyperliquidInfo<HyperliquidSpotClearinghouseStateResponse>({
          type: 'spotClearinghouseState',
          user: address,
        }),
        getCachedSpotMeta(),
        getCachedAllMids(),
      ])
      return transformToTraderPositions(EMPTY_PERP_DATA, spotData, spotMeta, priceData, type)
    }
  } catch (error) {
    logError('FETCH_TRADER_POSITIONS_FROM_HYPERLIQUID', error, { address, type })
    throw error
  }
}

/**
 * 从 Hyperliquid 获取交易者挂单列表
 *
 * @param address - 用户地址（42 字符十六进制格式）
 * @param options - 查询选项
 * @param options.coin - 指定币种过滤
 * @returns 挂单列表数据（兼容后端 DTO 格式）
 */
export async function fetchTraderOpenOrdersFromHyperliquid(
  address: string,
  options: { coin?: string } = {},
): Promise<TraderOpenOrdersResponse> {
  if (!isValidEthereumAddress(address)) {
    throw new ApiError('Invalid Ethereum address format', 'INVALID_ADDRESS', 400)
  }

  try {
    const orders = await postHyperliquidInfo<HyperliquidOpenOrder[]>({
      type: 'openOrders',
      user: address,
    })

    // 如果指定了 coin，进行过滤
    const filteredOrders = options.coin
      ? orders.filter(order => order.coin === options.coin)
      : orders

    return transformToTraderOpenOrders(filteredOrders)
  } catch (error) {
    logError('FETCH_TRADER_OPEN_ORDERS_FROM_HYPERLIQUID', error, { address, coin: options.coin })
    throw error
  }
}

/**
 * 从 Hyperliquid 获取用户投资组合历史数据
 *
 * @param address - 用户地址（42 字符十六进制格式）
 * @returns 投资组合历史数据
 */
export async function fetchUserPortfolioFromHyperliquid(
  address: string,
): Promise<UserPortfolioResponse> {
  if (!isValidEthereumAddress(address)) {
    throw new ApiError('Invalid Ethereum address format', 'INVALID_ADDRESS', 400)
  }

  try {
    const rawData = await postHyperliquidInfo<HyperliquidPortfolioResponse>({
      type: 'portfolio',
      user: address,
    })

    // 将数组格式转换为对象格式，并转换数据点格式
    const result: UserPortfolioResponse = {
      day: { accountValueHistory: [], pnlHistory: [], volume: 0 },
      week: { accountValueHistory: [], pnlHistory: [], volume: 0 },
      month: { accountValueHistory: [], pnlHistory: [], volume: 0 },
      allTime: { accountValueHistory: [], pnlHistory: [], volume: 0 },
      perpDay: { accountValueHistory: [], pnlHistory: [], volume: 0 },
      perpWeek: { accountValueHistory: [], pnlHistory: [], volume: 0 },
      perpMonth: { accountValueHistory: [], pnlHistory: [], volume: 0 },
      perpAllTime: { accountValueHistory: [], pnlHistory: [], volume: 0 },
    }

    for (const [period, data] of rawData) {
      if (!VALID_PERIODS.includes(period as ValidPeriod)) {
        logger.warn('Unknown portfolio period', { period })
        continue
      }
      const periodKey = period as ValidPeriod
      result[periodKey] = {
        accountValueHistory: data.accountValueHistory.map(([timestamp, value]) => ({
          timestamp,
          value: safeParseFloat(value),
        })),
        pnlHistory: data.pnlHistory.map(([timestamp, value]) => ({
          timestamp,
          value: safeParseFloat(value),
        })),
        volume: safeParseFloat(data.vlm),
      }
    }

    return result
  } catch (error) {
    logError('FETCH_USER_PORTFOLIO_FROM_HYPERLIQUID', error, { address })
    throw error
  }
}

/**
 * 从 Hyperliquid 获取用户成交记录
 *
 * @param address - 用户地址（42 字符十六进制格式）
 * @param options - 查询选项
 * @param options.aggregateByTime - 是否按时间聚合
 * @returns 成交记录列表
 */
export async function fetchUserFillsFromHyperliquid(
  address: string,
  options: { aggregateByTime?: boolean } = {},
): Promise<UserFillsResponse> {
  if (!isValidEthereumAddress(address)) {
    throw new ApiError('Invalid Ethereum address format', 'INVALID_ADDRESS', 400)
  }

  try {
    const { aggregateByTime = false } = options

    const rawFills = await postHyperliquidInfo<HyperliquidUserFill[]>({
      type: 'userFills',
      user: address,
      aggregateByTime,
    })

    const fills: UserFill[] = rawFills.map(fill => {
      const direction: ValidDirection = VALID_DIRECTIONS.includes(fill.dir as ValidDirection)
        ? (fill.dir as ValidDirection)
        : 'Open Long' // 默认值，避免类型错误

      if (!VALID_DIRECTIONS.includes(fill.dir as ValidDirection)) {
        logger.warn('Unknown fill direction', { dir: fill.dir, hash: fill.hash })
      }

      return {
        coin: fill.coin,
        price: safeParseFloat(fill.px),
        size: safeParseFloat(fill.sz),
        side: fill.side === 'A' ? 'BUY' : 'SELL',
        time: fill.time,
        direction,
        startPosition: safeParseFloat(fill.startPosition),
        closedPnl: safeParseFloat(fill.closedPnl),
        fee: safeParseFloat(fill.fee),
        feeToken: fill.feeToken,
        hash: fill.hash,
      }
    })

    return { fills }
  } catch (error) {
    logError('FETCH_USER_FILLS_FROM_HYPERLIQUID', error, { address, ...options })
    throw error
  }
}

export interface HyperliquidHistoricalOrdersResponse {
  orders: HyperliquidHistoricalOrderEntry[]
}

/**
 * 从 Hyperliquid 获取用户历史委托（订单）
 *
 * 注意：官方 API 当前返回“最多 2000 条最近历史委托”，无 cursor/limit 参数。
 * UI 侧的“无限滚动”需要采用“单次拉取 + 渐进渲染”的方式实现。
 */
export async function fetchTraderHistoricalOrdersFromHyperliquid(
  address: string,
): Promise<HyperliquidHistoricalOrdersResponse> {
  if (!isValidEthereumAddress(address)) {
    throw new ApiError('Invalid Ethereum address format', 'INVALID_ADDRESS', 400)
  }

  try {
    const orders = await postHyperliquidInfo<HyperliquidHistoricalOrderEntry[]>({
      type: 'historicalOrders',
      user: address,
    })

    return { orders }
  } catch (error) {
    logError('FETCH_TRADER_HISTORICAL_ORDERS_FROM_HYPERLIQUID', error, { address })
    throw error
  }
}

export interface TraderFullDataResponse {
  snapshot: TraderSnapshotResponse
  positions: TraderPositionsResponse
  orders: TraderOpenOrdersResponse
  portfolio: UserPortfolioResponse
  fills: UserFillsResponse
}

export async function fetchTraderFullData(
  address: string,
  options: { aggregateByTime?: boolean } = {},
): Promise<TraderFullDataResponse> {
  if (!isValidEthereumAddress(address)) {
    throw new ApiError('Invalid Ethereum address format', 'INVALID_ADDRESS', 400)
  }

  try {
    const aggregateByTime = options.aggregateByTime ?? false

    // 合并为单个 Promise.all，最大化并发效率
    const [
      perpCashData,
      perpXyzData,
      spotData,
      spotMeta,
      priceData,
      orders,
      portfolioData,
      rawFills,
    ] = await Promise.all([
      postHyperliquidInfo<HyperliquidClearinghouseStateResponse>({
        type: 'clearinghouseState',
        user: address,
      }),
      postHyperliquidInfo<HyperliquidClearinghouseStateResponse>({
        type: 'clearinghouseState',
        user: address,
        dex: 'xyz',
      }),
      postHyperliquidInfo<HyperliquidSpotClearinghouseStateResponse>({
        type: 'spotClearinghouseState',
        user: address,
      }),
      getCachedSpotMeta(),
      getCachedAllMids(),
      postHyperliquidInfo<HyperliquidOpenOrder[]>({
        type: 'openOrders',
        user: address,
      }),
      postHyperliquidInfo<HyperliquidPortfolioResponse>({
        type: 'portfolio',
        user: address,
      }),
      postHyperliquidInfo<HyperliquidUserFill[]>({
        type: 'userFills',
        user: address,
        aggregateByTime,
      }),
    ])

    const portfolio: UserPortfolioResponse = {
      day: { accountValueHistory: [], pnlHistory: [], volume: 0 },
      week: { accountValueHistory: [], pnlHistory: [], volume: 0 },
      month: { accountValueHistory: [], pnlHistory: [], volume: 0 },
      allTime: { accountValueHistory: [], pnlHistory: [], volume: 0 },
      perpDay: { accountValueHistory: [], pnlHistory: [], volume: 0 },
      perpWeek: { accountValueHistory: [], pnlHistory: [], volume: 0 },
      perpMonth: { accountValueHistory: [], pnlHistory: [], volume: 0 },
      perpAllTime: { accountValueHistory: [], pnlHistory: [], volume: 0 },
    }

    for (const [period, data] of portfolioData) {
      if (!VALID_PERIODS.includes(period as ValidPeriod)) {
        logger.warn('Unknown portfolio period', { period })
        continue
      }
      const periodKey = period as ValidPeriod
      portfolio[periodKey] = {
        accountValueHistory: data.accountValueHistory.map(([timestamp, value]) => ({
          timestamp,
          value: safeParseFloat(value),
        })),
        pnlHistory: data.pnlHistory.map(([timestamp, value]) => ({
          timestamp,
          value: safeParseFloat(value),
        })),
        volume: safeParseFloat(data.vlm),
      }
    }

    const fills: UserFill[] = rawFills.map(fill => {
      const direction: ValidDirection = VALID_DIRECTIONS.includes(fill.dir as ValidDirection)
        ? (fill.dir as ValidDirection)
        : 'Open Long'

      if (!VALID_DIRECTIONS.includes(fill.dir as ValidDirection)) {
        logger.warn('Unknown fill direction', { dir: fill.dir, hash: fill.hash })
      }

      return {
        coin: fill.coin,
        price: safeParseFloat(fill.px),
        size: safeParseFloat(fill.sz),
        side: fill.side === 'A' ? 'BUY' : 'SELL',
        time: fill.time,
        direction,
        startPosition: safeParseFloat(fill.startPosition),
        closedPnl: safeParseFloat(fill.closedPnl),
        fee: safeParseFloat(fill.fee),
        feeToken: fill.feeToken,
        hash: fill.hash,
      }
    })

    const mergedPerpData: HyperliquidClearinghouseStateResponse = {
      ...perpCashData,
      assetPositions: [...perpCashData.assetPositions, ...perpXyzData.assetPositions],
    }

    return {
      snapshot: transformToTraderSnapshot(perpCashData, perpXyzData, spotData, spotMeta, priceData),
      positions: transformToTraderPositions(mergedPerpData, spotData, spotMeta, priceData, 'all'),
      orders: transformToTraderOpenOrders(orders),
      portfolio,
      fills: { fills },
    }
  } catch (error) {
    logError('FETCH_TRADER_FULL_DATA', error, { address, ...options })
    throw error
  }
}
