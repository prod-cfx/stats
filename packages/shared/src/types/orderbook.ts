// 标准化的订单簿与市场模型类型
// 统一多 CEX / DEX 的内部数据结构

export type VenueType = 'spot' | 'perp' | 'future' | 'margin' | 'amm'

// 流动性来源唯一标识，例如：
// - 'binance-spot'
// - 'okx-spot'
// - 'bybit-perp'
// - 'uniswap-v3'
export type VenueId = string

// 内部统一的市场标识（结构化形式）
// 注意：这是“逻辑市场”，不绑定某个具体 venue
export interface MarketId {
  base: string // 例如 'BTC'
  quote: string // 例如 'USDT'
  venueType: VenueType // 例如 'spot'
}

// 方便作为 Map key 使用的扁平字符串形式
// 约定格式：`${base}-${quote}:${venueType}`，例如：'BTC-USDT:spot'
export type MarketKey = string

// 将结构化 MarketId 转成字符串 key
export function toMarketKey(market: MarketId): MarketKey {
  const base = market.base.toUpperCase()
  const quote = market.quote.toUpperCase()
  return `${base}-${quote}:${market.venueType}`
}

// 从字符串 key 解析回结构化 MarketId
// 非法输入会抛出 Error，调用方可按需捕获
export function parseMarketKey(key: MarketKey): MarketId {
  const parts = key.split(':')
  if (parts.length !== 2) {
    throw new Error(`Invalid MarketKey format (expected "<BASE-QUOTE>:<TYPE>"): "${key}"`)
  }

  const [symbolPart, venueType] = parts
  if (!symbolPart || !venueType) {
    throw new Error(`Invalid MarketKey: "${key}"`)
  }

  const lastDash = symbolPart.lastIndexOf('-')
  if (lastDash <= 0 || lastDash === symbolPart.length - 1) {
    throw new Error(`Invalid MarketKey symbol part: "${symbolPart}"`)
  }

  const base = symbolPart.slice(0, lastDash)
  const quote = symbolPart.slice(lastDash + 1)

  const normalizedVenueType = venueType as VenueType
  const allowedVenueTypes: readonly VenueType[] = ['spot', 'perp', 'future', 'margin', 'amm']
  if (!allowedVenueTypes.includes(normalizedVenueType)) {
    throw new Error(`Invalid MarketKey venue type: "${venueType}"`)
  }

  return {
    base: base.toUpperCase(),
    quote: quote.toUpperCase(),
    venueType: normalizedVenueType,
  }
}

// 单个价格档位
export interface OrderBookLevel {
  price: number // 统一为 base-quote 价格，例如 BTC/USDT
  size: number // base 数量，例如 0.1 BTC
}

// 单个 venue、单个市场的订单簿视图（已标准化）
export interface VenueOrderBook {
  venueId: VenueId
  marketKey: MarketKey

  // 价格有序：
  // - bids: price 从高到低
  // - asks: price 从低到高
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]

  // 时间信息
  exchangeTs?: number // 交易所事件时间（如有）
  receivedTs: number // 本地接收时间（必填）

  // 本地版本号 / 序列，用于去重与连续性检查
  version: number
}

// 聚合订单簿中的详细拆分：每个档位下的 venue 明细
export interface AggregatedLevelDetail {
  venueId: VenueId
  size: number
}

// 聚合后的单个档位
export interface AggregatedLevel {
  price: number
  sizeTotal: number
  details: AggregatedLevelDetail[]
}

// 跨多 venue 聚合后的订单簿
export interface AggregatedOrderBook {
  marketKey: MarketKey
  bids: AggregatedLevel[]
  asks: AggregatedLevel[]
  updatedTs: number
}

// 所有 CEX / DEX 适配器应实现的统一接口
export interface VenueConnector {
  readonly venueId: VenueId

  /**
   * 订阅一组内部市场。
   * 实现需要自行完成 MarketKey <-> 交易所 symbol 的映射。
   */
  subscribe: (markets: MarketId[]) => Promise<void>

  /**
   * 获取当前本地订单簿快照。
   * 如果该市场尚未准备就绪，应返回 null。
   */
  getOrderBook: (marketKey: MarketKey) => VenueOrderBook | null

  /**
   * 注册订单簿更新回调。
   * 实现需要在本地订单簿发生变化时调用 handler。
   * 返回一个用于取消订阅的 disposer 函数。
   */
  onOrderBookUpdate: (handler: (book: VenueOrderBook) => void) => () => void
}

