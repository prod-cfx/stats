/* eslint-disable perfectionist/sort-imports */
import { Injectable } from '@nestjs/common'
import type { LongShortRatio } from './repositories/long-short-ratio.repository'
// Nest 注入需要运行时引用 LongShortRatioRepository，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { LongShortRatioRepository } from './repositories/long-short-ratio.repository'
// eslint-disable-next-line ts/consistent-type-imports
import { MarketTradesRepository } from './repositories/market-trades.repository'
import type { ExchangeId, MarketInstrumentType, MarketTimeframe, TradingPairConfig, TradingVenueType } from '@ai/shared'
import { TRADING_PAIRS } from '@ai/shared'
import type { MarketTrade } from '@prisma/client'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { GetMarketTradesRequestDto } from './dto/requests/get-market-trades.request.dto'

export interface MarketsFilter {
  venueType?: TradingVenueType
  instrumentType?: MarketInstrumentType
  exchange?: ExchangeId
}

@Injectable()
export class MarketsService {
  private readonly pairs: TradingPairConfig[]

  constructor(
    private readonly longShortRatioRepository: LongShortRatioRepository,
    private readonly marketTradesRepository: MarketTradesRepository,
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
}

