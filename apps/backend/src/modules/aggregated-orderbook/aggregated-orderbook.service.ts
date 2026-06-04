import type { VenueOrderBook } from '@ai/shared'
import type { OrderbookPairConfig } from '@/prisma/prisma.types'
import { Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { RedisService } from '@/common/services/redis.service'
// Nest 注入需要运行时引用，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { OrderbookPairConfigService } from '@/modules/orderbook-config/services/orderbook-pair-config.service'

// 稳定币列表，这些计价资产会被合并
const STABLE_QUOTES = ['USDT', 'USDC']

// 聚合结果缓存 TTL（秒）
const AGGREGATED_CACHE_TTL = 2
const STALE_ORDERBOOK_MAX_AGE_MS = 60_000

// 支持的交易所和对应的 venueId 映射
const VENUE_MAPPING: Record<string, Record<string, string>> = {
  binance: { spot: 'binance-spot', perp: 'binance-perp' },
  okx: { spot: 'okx-spot', perp: 'okx-perp' },
  bybit: { spot: 'bybit-spot', perp: 'bybit-perp' },
  bitmax: { spot: 'bitmax-spot', perp: 'bitmax-perp' },
  hyperliquid: { spot: 'hyperliquid-spot', perp: 'hyperliquid-perp' },
}

const INSTRUMENT_TYPE_TO_MARKET_TYPE: Partial<Record<OrderbookPairConfig['instrumentType'], 'spot' | 'perp'>> = {
  SPOT: 'spot',
  PERPETUAL: 'perp',
}

interface AggregatedLevel {
  price: number
  sizeTotal: number
  details: { venueId: string, size: number }[]
}

interface AggregatedResult {
  marketKey: string
  base: string
  type: string
  asks: AggregatedLevel[]
  bids: AggregatedLevel[]
  midPrice: number
  updatedAt: number
  venues: string[]
  mergedQuotes: string[]
}

interface AvailableAggregatedMarket {
  base: string
  type: 'spot' | 'perp'
  venues: string[]
}

@Injectable()
export class AggregatedOrderbookService {
  private readonly logger = new Logger(AggregatedOrderbookService.name)

  constructor(
    private readonly redisService: RedisService,
    private readonly orderbookPairConfigService: OrderbookPairConfigService,
  ) {}

  async getAvailableMarkets(): Promise<AvailableAggregatedMarket[]> {
    const configs = await this.orderbookPairConfigService.findEnabledConfigs()
    const liveVenues = await this.getLiveVenueKeys(configs)
    const grouped = new Map<string, AvailableAggregatedMarket>()

    for (const config of configs) {
      const venue = config.venue.toLowerCase()
      const type = INSTRUMENT_TYPE_TO_MARKET_TYPE[config.instrumentType]
      if (!type || !VENUE_MAPPING[venue]?.[type]) continue

      const base = config.baseAsset.toUpperCase()
      if (!liveVenues.has(`${base}:${type}:${venue}`)) continue

      const key = `${base}:${type}`
      const existing = grouped.get(key)
      if (existing) {
        if (!existing.venues.includes(venue)) existing.venues.push(venue)
      }
      else {
        grouped.set(key, { base, type, venues: [venue] })
      }
    }

    return [...grouped.values()]
      .map(item => ({ ...item, venues: item.venues.sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => a.base.localeCompare(b.base) || a.type.localeCompare(b.type))
  }

  private async getLiveVenueKeys(configs: OrderbookPairConfig[]): Promise<Set<string>> {
    const client = this.redisService.getClient()
    const lookups: { key: string, liveKey: string }[] = []

    for (const config of configs) {
      const venue = config.venue.toLowerCase()
      const type = INSTRUMENT_TYPE_TO_MARKET_TYPE[config.instrumentType]
      if (!type || !VENUE_MAPPING[venue]?.[type]) continue

      const venueId = VENUE_MAPPING[venue][type]
      const base = config.baseAsset.toUpperCase()
      for (const quote of STABLE_QUOTES) {
        lookups.push({
          key: `orderbook:${venueId}:${base}-${quote}:${type}`,
          liveKey: `${base}:${type}:${venue}`,
        })
      }
    }

    if (!lookups.length) return new Set()

    const live = new Set<string>()
    try {
      const snapshots = await client.mget(...lookups.map(item => item.key))
      for (let i = 0; i < snapshots.length; i += 1) {
        const raw = snapshots[i]
        if (!raw) continue
        try {
          const book = JSON.parse(raw) as VenueOrderBook
          if (this.isFreshOrderbook(book)) live.add(lookups[i]!.liveKey)
        }
        catch (err) {
          this.logger.warn(`Failed to parse market availability orderbook: ${err}`)
        }
      }
    }
    catch (err) {
      this.logger.warn(`Failed to read market availability orderbooks: ${err}`)
    }

    return live
  }

  async getAggregatedOrderbook(params: {
    base: string
    type: 'spot' | 'perp'
    venues?: string[]
    depth?: number
    tickSize?: number
  }): Promise<AggregatedResult> {
    const { base, type, venues, depth = 50, tickSize } = params
    const baseUpper = base.toUpperCase()

    // 根据资产设置默认 tickSize（BTC: $1, ETH: $0.1, 其他: $0.01）
    // 注：BTC 100档数据仅覆盖 ~$12 价差，$1 tick 可聚合约 10-12 档
    const defaultTickSize = baseUpper === 'BTC' ? 1 : baseUpper === 'ETH' ? 0.1 : 0.01
    const effectiveTickSize = tickSize ?? defaultTickSize

    // 解析交易所列表并排序（保证缓存 key 一致性）
    const targetVenues = (venues?.length ? venues : Object.keys(VENUE_MAPPING)).sort()

    // 构建缓存 key（包含 tickSize）
    const cacheKey = this.buildCacheKey(baseUpper, type, targetVenues, depth, effectiveTickSize)
    const client = this.redisService.getClient()

    // 尝试从缓存读取
    try {
      const cached = await client.get(cacheKey)
      if (cached) {
        return JSON.parse(cached) as AggregatedResult
      }
    }
    catch (err) {
      this.logger.warn(`Failed to read aggregated cache: ${err}`)
    }

    // 缓存未命中，执行聚合计算
    const result = await this.computeAggregatedOrderbook(baseUpper, type, targetVenues, depth, effectiveTickSize)

    // 写入缓存（异步，不阻塞响应）
    client.setex(cacheKey, AGGREGATED_CACHE_TTL, JSON.stringify(result)).catch(err => {
      this.logger.warn(`Failed to write aggregated cache: ${err}`)
    })

    return result
  }

  private buildCacheKey(
    base: string,
    type: string,
    venues: string[],
    depth: number,
    tickSize: number,
  ): string {
    return `orderbook:aggregated:${base}:${type}:${venues.join(',')}:${depth}:${tickSize}`
  }

  private async computeAggregatedOrderbook(
    base: string,
    type: 'spot' | 'perp',
    venues: string[],
    depth: number,
    tickSize: number,
  ): Promise<AggregatedResult> {
    // 从 Redis 批量获取所有相关订单簿
    const orderbooks = await this.fetchOrderbooksFromRedis(base, type, venues)

    if (orderbooks.length === 0) {
      return {
        marketKey: `${base}-USD:${type}`,
        base,
        type,
        asks: [],
        bids: [],
        midPrice: 0,
        updatedAt: Date.now(),
        venues: [],
        mergedQuotes: STABLE_QUOTES,
      }
    }

    // 聚合订单簿（按 tickSize 分组）
    const aggregated = this.aggregateOrderbooks(orderbooks, depth, tickSize)

    // 计算中间价
    const midPrice = this.calculateMidPrice(aggregated.asks, aggregated.bids)

    // 提取实际返回数据的交易所
    const actualVenues = [...new Set(orderbooks.map(ob => ob.venueId.split('-')[0]))]

    return {
      marketKey: `${base}-USD:${type}`,
      base,
      type,
      asks: aggregated.asks,
      bids: aggregated.bids,
      midPrice,
      updatedAt: Date.now(),
      venues: actualVenues,
      mergedQuotes: STABLE_QUOTES,
    }
  }

  private async fetchOrderbooksFromRedis(
    base: string,
    type: 'spot' | 'perp',
    venues: string[],
  ): Promise<VenueOrderBook[]> {
    const client = this.redisService.getClient()

    // 构建所有需要查询的 Redis keys
    const keysToFetch: string[] = []
    for (const venue of venues) {
      const venueConfig = VENUE_MAPPING[venue]
      if (!venueConfig)
        continue

      const venueId = venueConfig[type]
      if (!venueId)
        continue

      // 遍历稳定币，合并 USDT/USDC
      for (const quote of STABLE_QUOTES) {
        const marketKey = `${base}-${quote}:${type}`
        keysToFetch.push(`orderbook:${venueId}:${marketKey}`)
      }
    }

    if (keysToFetch.length === 0) {
      return []
    }

    // 使用 mget 批量获取，减少 Redis 往返
    const results = await client.mget(...keysToFetch)

    const orderbooks: VenueOrderBook[] = []
    for (const raw of results) {
      if (raw) {
        try {
          const book = JSON.parse(raw) as VenueOrderBook
          if (!this.isFreshOrderbook(book)) {
            this.logger.warn(
              `Skip stale orderbook snapshot: venue=${book.venueId} market=${book.marketKey} exchangeTs=${book.exchangeTs ?? 'n/a'} receivedTs=${book.receivedTs ?? 'n/a'}`,
            )
            continue
          }
          orderbooks.push(book)
        }
        catch (err) {
          this.logger.warn(`Failed to parse orderbook: ${err}`)
        }
      }
    }

    return orderbooks
  }

  private isFreshOrderbook(book: VenueOrderBook): boolean {
    const candidateTimestamps = [book.receivedTs, book.exchangeTs].filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0,
    )

    if (candidateTimestamps.length === 0) {
      return true
    }

    const latestTimestamp = Math.max(...candidateTimestamps)
    return Date.now() - latestTimestamp <= STALE_ORDERBOOK_MAX_AGE_MS
  }

  private aggregateOrderbooks(
    orderbooks: VenueOrderBook[],
    depth: number,
    tickSize: number,
  ): { bids: AggregatedLevel[], asks: AggregatedLevel[] } {
    // 使用 Map 按价格档位聚合
    const bidsMap = new Map<number, { price: number, details: Map<string, number> }>()
    const asksMap = new Map<number, { price: number, details: Map<string, number> }>()

    // 价格取整函数：买单向下取整，卖单向上取整
    const priceRounder = this.createPriceRounder(tickSize)
    const roundBidPrice = (price: number) => priceRounder(price, 'bid')
    const roundAskPrice = (price: number) => priceRounder(price, 'ask')

    for (const book of orderbooks) {
      // 处理买单（向下取整到最近档位）
      for (const level of book.bids) {
        const bucketPrice = roundBidPrice(level.price)
        if (!bidsMap.has(bucketPrice)) {
          bidsMap.set(bucketPrice, { price: bucketPrice, details: new Map() })
        }
        const entry = bidsMap.get(bucketPrice)!
        const currentSize = entry.details.get(book.venueId) || 0
        entry.details.set(book.venueId, currentSize + level.size)
      }

      // 处理卖单（向上取整到最近档位）
      for (const level of book.asks) {
        const bucketPrice = roundAskPrice(level.price)
        if (!asksMap.has(bucketPrice)) {
          asksMap.set(bucketPrice, { price: bucketPrice, details: new Map() })
        }
        const entry = asksMap.get(bucketPrice)!
        const currentSize = entry.details.get(book.venueId) || 0
        entry.details.set(book.venueId, currentSize + level.size)
      }
    }

    // 转换为数组并排序
    const bids = Array.from(bidsMap.values())
      .map(entry => ({
        price: entry.price,
        sizeTotal: Array.from(entry.details.values()).reduce((a, b) => a + b, 0),
        details: Array.from(entry.details.entries()).map(([venueId, size]) => ({
          venueId,
          size,
        })),
      }))
      .sort((a, b) => b.price - a.price) // 买单从高到低
      .slice(0, depth)

    const asks = Array.from(asksMap.values())
      .map(entry => ({
        price: entry.price,
        sizeTotal: Array.from(entry.details.values()).reduce((a, b) => a + b, 0),
        details: Array.from(entry.details.entries()).map(([venueId, size]) => ({
          venueId,
          size,
        })),
      }))
      .sort((a, b) => a.price - b.price) // 卖单从低到高
      .slice(0, depth)

    return { bids, asks }
  }

  private calculateMidPrice(
    asks: { price: number }[],
    bids: { price: number }[],
  ): number {
    const bestAsk = asks[0]?.price ?? 0
    const bestBid = bids[0]?.price ?? 0
    if (bestAsk === 0 || bestBid === 0)
      return bestAsk || bestBid
    return (bestAsk + bestBid) / 2
  }

  private createPriceRounder(tickSize: number): (price: number, side: 'bid' | 'ask') => number {
    const tickDecimals = this.countDecimals(tickSize)
    const scale = 10 ** tickDecimals
    const tickUnits = Math.max(1, Math.round(tickSize * scale))

    return (price, side) => {
      const scaledPrice = price * scale
      const units = side === 'bid'
        ? Math.floor((scaledPrice + 1e-9) / tickUnits) * tickUnits
        : Math.ceil((scaledPrice - 1e-9) / tickUnits) * tickUnits
      return Number((units / scale).toFixed(tickDecimals))
    }
  }

  private countDecimals(value: number): number {
    if (!Number.isFinite(value)) return 0
    const normalized = value.toString().toLowerCase()
    if (!normalized.includes('e')) return normalized.split('.')[1]?.length ?? 0

    const [, exponent = '0'] = normalized.split('e')
    return Math.max(0, -Number.parseInt(exponent, 10))
  }
}
