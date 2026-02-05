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
// eslint-disable-next-line ts/consistent-type-imports
import { TakerBuySellVolumeRepository } from './repositories/taker-buy-sell-volume.repository'
import type {
  ExchangeId,
  MarketInstrumentType,
  MarketTimeframe,
  TradingPairConfig,
  TradingVenueType,
} from '@ai/shared'
import { TRADING_PAIRS } from '@ai/shared'
import type { MarketTrade, Prisma } from '@prisma/client'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
// Nest 注入需要运行时引用 PrismaService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PrismaService } from '@/prisma/prisma.service'
import type { GetMarketTradesRequestDto } from './dto/requests/get-market-trades.request.dto'
import type { GetAggregatedVolumeRequestDto } from './dto/requests/get-aggregated-volume.request.dto'
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

@Injectable()
export class MarketsService {
  private readonly pairs: TradingPairConfig[]

  constructor(
    private readonly prisma: PrismaService,
    private readonly longShortRatioRepository: LongShortRatioRepository,
    private readonly marketTradesRepository: MarketTradesRepository,
    private readonly futuresPairsMarketRepository: FuturesPairsMarketRepository,
    private readonly takerVolumeRepository: TakerBuySellVolumeRepository,
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
  async getTrades(
    query: GetMarketTradesRequestDto,
  ): Promise<BasePaginationResponseDto<MarketTrade>> {
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
   * 数据来源：TakerBuySellVolume 表
   * - longPercent/shortPercent: buyRatio/sellRatio
   * - longAmountUsd/shortAmountUsd: buyVolUsd/sellVolUsd
   */
  async getExchangeLongShortRatios(params: {
    symbol: string
    timeRange: ExchangeLongShortTimeRange
  }): Promise<ExchangeLongShortRatioResponseDto[]> {
    const { symbol, timeRange } = params

    const takerVolumeData = await this.takerVolumeRepository.findLatestBySymbol({
      symbol: symbol.toUpperCase(),
      range: timeRange,
    })

    if (takerVolumeData.length === 0) {
      return []
    }

    // 直接使用 TakerBuySellVolume 的数据
    const results = takerVolumeData.map(item => {
      const buyVolUsd = this.toNumber(item.buyVolUsd)
      const sellVolUsd = this.toNumber(item.sellVolUsd)
      const totalVolUsd = buyVolUsd + sellVolUsd

      return {
        name: item.exchange,
        logoUrl: this.getExchangeLogo(item.exchange),
        longPercent: Number(item.buyRatio),
        shortPercent: Number(item.sellRatio),
        longAmountUsd: buyVolUsd,
        shortAmountUsd: sellVolUsd,
        totalVolUsd,
      }
    })

    // 按总成交量排序并分配 rank
    return results
      .sort((a, b) => b.totalVolUsd - a.totalVolUsd)
      .map((row, index) => ({
        rank: index + 1,
        name: row.name,
        logoUrl: row.logoUrl,
        longPercent: Number(row.longPercent.toFixed(2)),
        shortPercent: Number(row.shortPercent.toFixed(2)),
        longAmountUsd: Math.round(row.longAmountUsd),
        shortAmountUsd: Math.round(row.shortAmountUsd),
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

  /**
   * 获取币种的市场行情数据（Ticker）
   *
   * @param symbol - 币种符号（如 BTC、ETH）
   * @param exchange - 交易所名称（可选，不传则返回聚合数据）
   * @returns 市场行情数据
   */
  async getTicker(symbol: string, exchange?: string) {
    return this.futuresPairsMarketRepository.findTicker({
      symbol,
      exchange,
    })
  }

  private mapTimeRangeToInterval(timeRange: ExchangeLongShortTimeRange): MarketTimeframe {
    switch (timeRange) {
      case '5m':
        return '5m'
      case '15m':
        return '15m'
      case '30m':
        return '30m'
      case '1h':
        return '1h'
      case '4h':
        return '4h'
      case '12h':
        return '12h'
      case '24h':
      default:
        return '1d'
    }
  }

  private getExchangeLogo(exchange: string): string | undefined {
    const normalized = exchange.trim().toLowerCase()
    return EXCHANGE_DEFINITIONS.find(item => item.name.toLowerCase() === normalized)?.logoUrl
  }

  private toNumber(value: Prisma.Decimal | number | string | null): number {
    if (value == null) return 0
    if (typeof value === 'number') return value
    if (typeof value === 'string') return Number(value)
    return value.toNumber()
  }
}
