import { Injectable } from '@nestjs/common'
import { MarketSymbolCatalogService, type MarketSymbolSupportStatus } from '@/modules/market-data/services/market-symbol-catalog.service'

export interface BacktestSymbolSupportResult {
  status: MarketSymbolSupportStatus
}

@Injectable()
export class BacktestSymbolSupportService {
  constructor(
    private readonly marketSymbolCatalogService: MarketSymbolCatalogService,
  ) {}

  async checkSupport(exchange: string, symbol: string): Promise<BacktestSymbolSupportResult> {
    const status = await this.marketSymbolCatalogService.ensureExchangeSymbolAvailable(exchange, symbol)
    return { status }
  }
}
