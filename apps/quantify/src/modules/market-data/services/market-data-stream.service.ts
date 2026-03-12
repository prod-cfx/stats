import type { MarketQuotePayload } from '@ai/shared'
import { Injectable, Logger } from '@nestjs/common'

// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤 EventEmitter2
import { EventEmitter2 } from '@nestjs/event-emitter'

export const MARKET_QUOTE_EVENT = 'market.quote'

export interface MarketQuoteEvent {
  symbol: string
  data: MarketQuotePayload
}

/**
 * 琛屾儏娴佹湇鍔?- 璐熻矗绠＄悊瀹炴椂琛屾儏鏁版嵁鐨勪簨浠跺箍鎾?
 */
@Injectable()
export class MarketDataStreamService {
  private readonly logger = new Logger(MarketDataStreamService.name)

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * 骞挎挱 ticker 鏁版嵁鍒版墍鏈夎闃呰€?
   */
  emitQuote(payload: MarketQuotePayload): void {
    try {
      const event: MarketQuoteEvent = {
        symbol: payload.symbol,
        data: payload,
      }
      this.eventEmitter.emit(MARKET_QUOTE_EVENT, event)
    } catch (error) {
      this.logger.error(`骞挎挱 ticker 鏁版嵁澶辫触: ${(error as Error).message}`, (error as Error).stack)
    }
  }
}
