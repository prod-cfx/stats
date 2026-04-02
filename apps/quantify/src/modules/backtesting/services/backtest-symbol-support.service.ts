import { Injectable } from '@nestjs/common'
import { BacktestMarketDataService } from './backtest-market-data.service'

export interface BacktestSymbolSupportResult {
  status: 'supported' | 'refreshed_then_supported' | 'not_supported'
}

@Injectable()
export class BacktestSymbolSupportService {
  constructor(
    private readonly backtestMarketDataService: BacktestMarketDataService,
  ) {}

  async checkSupport(exchange: string, symbol: string): Promise<BacktestSymbolSupportResult> {
    const status = await this.backtestMarketDataService.ensureSymbolSupported(exchange, symbol)
    return { status }
  }
}
