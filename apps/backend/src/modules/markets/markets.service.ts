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
import type { ExchangeId, MarketInstrumentType, MarketTimeframe, TradingPairConfig, TradingVenueType } from '@ai/shared'
import { TRADING_PAIRS } from '@ai/shared'
import { Prisma } from '@prisma/client'
import type { MarketTrade } from '@prisma/client'
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
   */
  async getExchangeLongShortRatios(params: {
    symbol: string
    timeRange: ExchangeLongShortTimeRange
  }): Promise<ExchangeLongShortRatioResponseDto[]> {
    const { symbol } = params

    // 1. 从 FuturesPairsMarket 聚合各交易所持仓量
    const oiByExchange = await this.futuresPairsMarketRepository.aggregateOIByExchange({
      symbol: symbol.toUpperCase(),
    })

    if (oiByExchange.length === 0) {
      // 如果没有数据，返回空数组
      return []
    }

    // 2. 从 TakerBuySellVolume 获取最新多空比例
    // 注意：Coinglass taker-volume 统一使用 24h 数据，忽略前端传入的 timeRange
    // symbol 使用基础币种（BTC/ETH），不含 USDT 后缀
    const takerVolumeData = await this.takerVolumeRepository.findLatestBySymbol({
      symbol: symbol.toUpperCase(),
      range: '24h',
    })

    // 构建 exchange -> ratio 映射
    const ratioByExchange = new Map<string, { longPercent: number; shortPercent: number }>()
    for (const item of takerVolumeData) {
      ratioByExchange.set(item.exchange, {
        longPercent: Number(item.buyRatio),
        shortPercent: Number(item.sellRatio),
      })
    }

    // 3. 处理 Hyperliquid（从 HyperliquidWhaleAlert 聚合）
    const hyperliquidData = await this.getHyperliquidPositions(symbol.toUpperCase())

    // 4. 计算多空持仓金额
    const results: Array<{
      name: string
      logoUrl?: string
      longPercent: number
      shortPercent: number
      longAmountUsd: number
      shortAmountUsd: number
      totalOI: number
    }> = []

    for (const oi of oiByExchange) {
      const ratio = ratioByExchange.get(oi.exchange)
      // 如果没有多空比例数据，使用默认 50/50
      const longPercent = ratio?.longPercent ?? 50
      const shortPercent = ratio?.shortPercent ?? 50

      const longAmount = (oi.openInterestUsd * longPercent) / 100
      const shortAmount = (oi.openInterestUsd * shortPercent) / 100

      results.push({
        name: oi.exchange,
        logoUrl: this.getExchangeLogo(oi.exchange),
        longPercent,
        shortPercent,
        longAmountUsd: longAmount,
        shortAmountUsd: shortAmount,
        totalOI: oi.openInterestUsd,
      })
    }

    // 5. 添加 Hyperliquid 数据（仅当 FuturesPairsMarket 中没有时）
    const hasHyperliquid = oiByExchange.some(
      e => e.exchange.toLowerCase() === 'hyperliquid',
    )
    if (!hasHyperliquid && hyperliquidData) {
      const totalOI = hyperliquidData.longPositionUsd + hyperliquidData.shortPositionUsd
      if (totalOI > 0) {
        results.push({
          name: 'Hyperliquid',
          logoUrl: this.getExchangeLogo('Hyperliquid'),
          longPercent: (hyperliquidData.longPositionUsd / totalOI) * 100,
          shortPercent: (hyperliquidData.shortPositionUsd / totalOI) * 100,
          longAmountUsd: hyperliquidData.longPositionUsd,
          shortAmountUsd: hyperliquidData.shortPositionUsd,
          totalOI,
        })
      }
    }

    // 6. 按总持仓排序并分配 rank
    return results
      .sort((a, b) => b.totalOI - a.totalOI)
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

  private async getHyperliquidPositions(symbol: string): Promise<{
    longPositionUsd: number
    shortPositionUsd: number
  } | null> {
    const client = this.prisma.getClient()

    const rows = await client.$queryRaw(Prisma.sql`
      WITH latest_positions AS (
        SELECT DISTINCT ON (user_address, symbol)
          user_address,
          symbol,
          position_size,
          position_value_usd,
          position_action,
          create_time
        FROM hyperliquid_whale_alerts
        WHERE symbol = ${symbol}
        ORDER BY user_address, symbol, create_time DESC
      )
      SELECT
        COALESCE(SUM(CASE WHEN position_action = 1 AND position_size > 0 THEN position_value_usd ELSE 0 END), 0)
          AS "longPositionUsd",
        COALESCE(SUM(CASE WHEN position_action = 1 AND position_size < 0 THEN position_value_usd ELSE 0 END), 0)
          AS "shortPositionUsd"
      FROM latest_positions;
    `) as Array<{
      longPositionUsd: Prisma.Decimal | null
      shortPositionUsd: Prisma.Decimal | null
    }>

    if (!rows.length) {
      return null
    }

    const row = rows[0]
    const longPositionUsd = this.toNumber(row.longPositionUsd)
    const shortPositionUsd = this.toNumber(row.shortPositionUsd)

    if (!Number.isFinite(longPositionUsd) && !Number.isFinite(shortPositionUsd)) {
      return null
    }

    return {
      longPositionUsd,
      shortPositionUsd,
    }
  }
}
