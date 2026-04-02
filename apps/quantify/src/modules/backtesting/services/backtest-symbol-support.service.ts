import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { MarketSymbolCatalogService } from '@/modules/market-data/services/market-symbol-catalog.service'

export interface BacktestSymbolSupportResult {
  status: 'supported' | 'refreshed_then_supported' | 'not_supported'
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
