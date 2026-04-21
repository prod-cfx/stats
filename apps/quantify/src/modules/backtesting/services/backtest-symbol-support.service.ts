import type { BacktestSymbolAvailabilityResult } from './backtest-symbol-availability.service'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BacktestSymbolAvailabilityService } from './backtest-symbol-availability.service'

export interface BacktestSymbolSupportResult {
  status: 'supported' | 'not_supported'
  reasonCode?: string
  args?: Record<string, unknown>
}

@Injectable()
export class BacktestSymbolSupportService {
  constructor(
    private readonly symbolAvailabilityService: BacktestSymbolAvailabilityService,
  ) {}

  async checkSupport(input: {
    exchange: string
    marketType: 'spot' | 'perp'
    symbol: string
    baseTimeframe: string
  }): Promise<BacktestSymbolSupportResult> {
    const availability = await this.symbolAvailabilityService.check(input)
    if (availability.supported) {
      return { status: 'supported' }
    }

    const failure = availability as Extract<BacktestSymbolAvailabilityResult, { supported: false }>
    return {
      status: 'not_supported',
      reasonCode: failure.reasonCode,
      args: failure.args,
    }
  }
}
