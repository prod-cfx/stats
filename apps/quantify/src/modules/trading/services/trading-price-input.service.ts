import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 MarketDataReadGateway
import { MarketDataReadGateway } from '@/modules/market-data/services/market-data-read.gateway'

@Injectable()
export class TradingPriceInputService {
  constructor(private readonly marketDataReadGateway: MarketDataReadGateway) {}

  async getReferencePrice(symbol: string): Promise<number> {
    const quote = await this.marketDataReadGateway.getLatestQuote(symbol)
    return Number(quote.lastPrice)
  }
}
