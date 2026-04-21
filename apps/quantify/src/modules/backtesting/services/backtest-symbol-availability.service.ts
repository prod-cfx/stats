import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestMarketDataService } from './backtest-market-data.service'

export interface BacktestSymbolAvailabilityCheckInput {
  exchange: string
  marketType: 'spot' | 'perp'
  symbol: string
  baseTimeframe: string
}

export type BacktestSymbolAvailabilityResult =
  | { supported: true }
  | {
    supported: false
    reasonCode: string
    args?: Record<string, unknown>
  }

@Injectable()
export class BacktestSymbolAvailabilityService {
  constructor(
    private readonly marketDataService: BacktestMarketDataService,
  ) {}

  check(input: BacktestSymbolAvailabilityCheckInput): Promise<BacktestSymbolAvailabilityResult> {
    return this.marketDataService.ensureBacktestSymbolAvailable(input)
  }
}
