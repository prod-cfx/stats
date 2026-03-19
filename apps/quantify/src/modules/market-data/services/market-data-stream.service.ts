import type { MarketQuotePayload } from '@ai/shared'
import { Injectable, Logger } from '@nestjs/common'

// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 EventEmitter2
import { EventEmitter2 } from '@nestjs/event-emitter'

export const MARKET_QUOTE_EVENT = 'market.quote'

export interface MarketQuoteEvent {
  symbol: string
  data: MarketQuotePayload
}

/**
 * 行情流服务，负责管理实时行情数据的事件广播。
 */
@Injectable()
export class MarketDataStreamService {
  private readonly logger = new Logger(MarketDataStreamService.name)

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * 广播 ticker 数据到所有订阅者。
   */
  emitQuote(payload: MarketQuotePayload): void {
    try {
      const event: MarketQuoteEvent = {
        symbol: payload.symbol,
        data: payload,
      }
      this.eventEmitter.emit(MARKET_QUOTE_EVENT, event)
    } catch (error) {
      this.logger.error(`广播 ticker 数据失败: ${(error as Error).message}`, (error as Error).stack)
    }
  }
}
