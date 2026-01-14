/* eslint-disable perfectionist/sort-imports */
import { Injectable } from '@nestjs/common'
import type { LongShortRatio } from './repositories/long-short-ratio.repository'
// Nest 注入需要运行时引用 LongShortRatioRepository，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { LongShortRatioRepository } from './repositories/long-short-ratio.repository'
// eslint-disable-next-line ts/consistent-type-imports
import { MarketTradesRepository } from './repositories/market-trades.repository'
// eslint-disable-next-line ts/consistent-type-imports
import { FuturesPairsMarketRepository } from './repositories/futures-pairs-market.repository'
import type { ExchangeId, MarketInstrumentType, MarketTimeframe, TradingPairConfig, TradingVenueType } from '@ai/shared'
import { TRADING_PAIRS } from '@ai/shared'
import type { MarketTrade } from '@prisma/client'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { GetMarketTradesRequestDto } from './dto/requests/get-market-trades.request.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { GetAggregatedVolumeRequestDto } from './dto/requests/get-aggregated-volume.request.dto'
import type { ExchangeLongShortTimeRange } from './dto/requests/get-exchange-long-short-ratio.request.dto'
import type { ExchangeLongShortRatioResponseDto } from './dto/responses/exchange-long-short-ratio.response.dto'
import type { AggregatedVolumeResponseDto } from './dto/responses/aggregated-volume.response.dto'

export interface MarketsFilter {
  venueType?: TradingVenueType
  instrumentType?: MarketInstrumentType
  exchange?: ExchangeId
}

interface ExchangeDefinition {
  name: string
  logoUrl?: string
}

const EXCHANGE_DEFINITIONS: ExchangeDefinition[] = [
  {
    name: 'Binance',
    logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png',
  },
  {
    name: 'OKX',
    logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/294.png',
  },
  {
    name: 'Bybit',
    logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/521.png',
  },
  {
    name: 'KuCoin',
    logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/311.png',
  },
  {
    name: 'Gate',
    logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/302.png',
  },
  {
    name: 'Bitget',
    logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/513.png',
  },
  {
    name: 'DEX',
  },
]

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function hashToUnit(str: string): number {
  // 简单的 FNV-1a 风格哈希，将字符串映射到 0..1 区间
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 2 ** 32
}

@Injectable()
export class MarketsService {
  private readonly pairs: TradingPairConfig[]

  constructor(
    private readonly longShortRatioRepository: LongShortRatioRepository,
    private readonly marketTradesRepository: MarketTradesRepository,
    private readonly futuresPairsMarketRepository: FuturesPairsMarketRepository,
  ) {
    this.pairs = TRADING_PAIRS
  }

  findAll(filter?: MarketsFilter): TradingPairConfig[] {
    if (!filter) return this.pairs

    const { venueType, instrumentType, exchange } = filter

    return this.pairs.filter(pair => {
      if (venueType && pair.venueType !== venueType) return false
      if (instrumentType && pair.instrumentType !== instrumentType) return false

      if (exchange) {
        // 指定了交易所时，仅匹配 CEX，并按 exchange 过滤
        if (pair.venueType !== 'CEX') return false
        if (pair.exchange !== exchange) return false
      }

      return true
    })
  }

  /**
   * 查询指定交易对的多空比时间序列
   */
  async getLongShortRatios(params: {
    tradingPairId: string
    interval: MarketTimeframe
    from?: Date
    to?: Date
    limit?: number
  }): Promise<LongShortRatio[]> {
    const { tradingPairId, interval, from, to, limit } = params

    return this.longShortRatioRepository.findByPairAndTime({
      tradingPairId,
      interval,
      from,
      to,
      limit,
    })
  }

  /**
   * 获取最新成交记录
   */
  async getLatestTrades(
    exchange: string,
    instrumentType: string,
    symbol: string,
    limit = 50,
  ): Promise<MarketTrade[]> {
    return this.marketTradesRepository.findLatestTrades(
      exchange.toUpperCase(),
      instrumentType.toUpperCase(),
      symbol.toUpperCase(),
      limit,
    )
  }

  /**
   * 获取大额成交记录
   */
  async getLargeTrades(
    exchange: string,
    instrumentType: string,
    symbol: string,
    minValue = 100000,
    limit = 50,
  ): Promise<MarketTrade[]> {
    return this.marketTradesRepository.findLargeTrades(
      exchange.toUpperCase(),
      instrumentType.toUpperCase(),
      symbol.toUpperCase(),
      minValue,
      limit,
    )
  }

  /**
   * 查询交易记录（分页）
   */
  async getTrades(query: GetMarketTradesRequestDto): Promise<BasePaginationResponseDto<MarketTrade>> {
    const normalize = (value?: string) =>
      typeof value === 'string' ? value.trim().toUpperCase() : undefined

    const filters = {
      exchange: normalize(query.exchange),
      instrumentType: normalize(query.instrumentType),
      symbol: normalize(query.symbol),
      baseAsset: normalize(query.baseAsset),
      quoteAsset: normalize(query.quoteAsset),
      side: query.side,
      fromTimestamp: query.fromTimestamp ? BigInt(query.fromTimestamp) : undefined,
      toTimestamp: query.toTimestamp ? BigInt(query.toTimestamp) : undefined,
    }

    const page = query.page ?? 1
    const limit = query.limit ?? 50
    const offset = (page - 1) * limit

    const [items, total] = await Promise.all([
      this.marketTradesRepository.findTrades({
        ...filters,
        limit,
        offset,
      }),
      this.marketTradesRepository.countTrades(filters),
    ])

    return new BasePaginationResponseDto(total, page, limit, items)
  }

  /**
   * 按交易所聚合的多空比快照
   *
   * 当前实现为基于 symbol + 时间范围的确定性 Mock 生成：
   * - 使用哈希函数将字符串映射到 0..1，用于生成稳定但看起来“随机”的数值
   * - 按总名义持仓金额从高到低排序并生成 rank
   *
   * 后续如果接入真实数据源，只需替换该方法内部实现，保持返回结构不变即可。
   */
  async getExchangeLongShortRatios(params: {
    symbol: string
    timeRange: ExchangeLongShortTimeRange
  }): Promise<ExchangeLongShortRatioResponseDto[]> {
    const { symbol, timeRange } = params

    const hours = this.timeRangeToHours(timeRange)
    const timeScale = clamp(hours / 4, 0.5, 6) // 4h 为基准

    const rows = EXCHANGE_DEFINITIONS.map(exchange => {
      // 基础规模：2..14 (M)，再乘时间范围和波动因子
      const baseMillions = 2 + 12 * hashToUnit(`${symbol}:${exchange.name}`)
      const volatility = 0.85 + 0.35 * hashToUnit(`${symbol}:${exchange.name}:${hours}`)
      const amountUsd = baseMillions * 1_000_000 * timeScale * volatility

      // 做多占比 0.35..0.9
      const longShare = clamp(
        0.35 + 0.55 * hashToUnit(`${symbol}:${exchange.name}:LONG:${hours}`),
        0.05,
        0.95,
      )
      const longAmountUsd = amountUsd * longShare
      const shortAmountUsd = amountUsd - longAmountUsd

      const longPercent = longShare * 100
      const shortPercent = 100 - longPercent

      return {
        name: exchange.name,
        logoUrl: exchange.logoUrl,
        longPercent,
        shortPercent,
        longAmountUsd,
        shortAmountUsd,
      }
    })

    // 按总持仓金额排序并生成 rank
    const sorted = rows
      .slice()
      .sort((a, b) => b.longAmountUsd + b.shortAmountUsd - (a.longAmountUsd + a.shortAmountUsd))

    return sorted.map((row, index) => ({
      rank: index + 1,
      name: row.name,
      logoUrl: row.logoUrl,
      longPercent: row.longPercent,
      shortPercent: row.shortPercent,
      longAmountUsd: row.longAmountUsd,
      shortAmountUsd: row.shortAmountUsd,
    }))
  }

  /**
   * 查询聚合交易量（分页）
   *
   * 从 FuturesPairsMarket 表聚合各交易所的交易量数据
   */
  async getAggregatedVolumes(
    query: GetAggregatedVolumeRequestDto,
  ): Promise<BasePaginationResponseDto<AggregatedVolumeResponseDto>> {
    const symbol = query.symbol.trim().toUpperCase()
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const offset = (page - 1) * limit

    // 从 Repository 查询各交易所的交易量
    const result = await this.futuresPairsMarketRepository.findVolumesBySymbol({
      symbol,
      limit,
      offset,
    })

    const now = new Date()
    const nowIso = now.toISOString()

    // 计算总交易量（所有交易所之和）
    const totalVolumeUsd = result.data.reduce((sum, item) => {
      return sum + Number.parseFloat(item.volumeUsd)
    }, 0)

    // 构建响应数据：先插入 All 总量，再追加各交易所数据
    const items: AggregatedVolumeResponseDto[] = [
      {
        id: 0,
        exchange: 'All',
        symbol,
        instrumentType: query.instrumentType,
        volumeUsd: totalVolumeUsd.toString(),
        dataTimestamp: nowIso,
        source: 'COINGLASS',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      ...result.data.map((item, idx) => ({
        id: idx + 1,
        exchange: item.exchange,
        symbol,
        instrumentType: query.instrumentType,
        volumeUsd: item.volumeUsd,
        dataTimestamp: nowIso,
        source: 'COINGLASS',
        createdAt: nowIso,
        updatedAt: nowIso,
      })),
    ]

    // 总条数 = All记录 + 实际交易所数量
    const total = result.total + 1

    return new BasePaginationResponseDto(total, page, limit, items)
  }

  private timeRangeToHours(timeRange: ExchangeLongShortTimeRange): number {
    switch (timeRange) {
      case '5m':
        return 5 / 60
      case '15m':
        return 15 / 60
      case '30m':
        return 0.5
      case '1h':
        return 1
      case '4h':
        return 4
      case '12h':
        return 12
      case '24h':
      default:
        return 24
    }
  }
}

