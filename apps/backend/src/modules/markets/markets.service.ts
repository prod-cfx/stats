import type {
  ExchangeId,
  MarketInstrumentType,
  TradingPairConfig,
  TradingVenueType,
} from '@ai/shared'
import { TRADING_PAIRS } from '@ai/shared'
import { Injectable } from '@nestjs/common'

export interface MarketsFilter {
  venueType?: TradingVenueType
  instrumentType?: MarketInstrumentType
  exchange?: ExchangeId
}

@Injectable()
export class MarketsService {
  private readonly pairs: TradingPairConfig[] = TRADING_PAIRS

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
}

