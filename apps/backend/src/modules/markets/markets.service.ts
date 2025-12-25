/* eslint-disable perfectionist/sort-imports */
import { Injectable } from '@nestjs/common'
import type { LongShortRatio } from './repositories/long-short-ratio.repository'
// Nest 注入需要运行时引用 LongShortRatioRepository，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { LongShortRatioRepository } from './repositories/long-short-ratio.repository'
import type { ExchangeId, MarketInstrumentType, MarketTimeframe, TradingPairConfig, TradingVenueType } from '@ai/shared'
import { TRADING_PAIRS } from '@ai/shared'

export interface MarketsFilter {
  venueType?: TradingVenueType
  instrumentType?: MarketInstrumentType
  exchange?: ExchangeId
}

@Injectable()
export class MarketsService {
  private readonly pairs: TradingPairConfig[]

  constructor(private readonly longShortRatioRepository: LongShortRatioRepository) {
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
}

