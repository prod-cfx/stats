import type { Bar, ExecutionConfig, Fill } from '../types/backtesting.types'
import { Injectable } from '@nestjs/common'

@Injectable()
export class TheoreticalExecutionModel {
  fill(bar: Bar, side: 'BUY' | 'SELL', qty: number, cfg: ExecutionConfig, reason?: string): Fill {
    const mid = (bar.open + bar.close) / 2
    const slip = cfg.slippageBps / 10000
    const price = side === 'BUY' ? mid * (1 + slip) : mid * (1 - slip)
    const notional = Math.abs(price * qty)
    const fee = notional * (cfg.feeBps / 10000)

    return {
      symbol: bar.symbol,
      ts: bar.closeTime,
      side,
      qty,
      price,
      notional,
      fee,
      reason,
    }
  }
}
