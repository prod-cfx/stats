import type { StateSnapshot, Timeframe } from '../types/backtesting.types'
import { Injectable } from '@nestjs/common'

@Injectable()
export class StateEngineService {
  private snapshots = new Map<string, StateSnapshot>()

  reset() {
    this.snapshots.clear()
  }

  upsert(snapshot: StateSnapshot) {
    this.snapshots.set(this.key(snapshot.symbol, snapshot.timeframe), snapshot)
  }

  getLatest(symbol: string, timeframe: Timeframe): StateSnapshot | undefined {
    return this.snapshots.get(this.key(symbol, timeframe))
  }

  getLatestByTimeframes(symbol: string, timeframes: Timeframe[]) {
    return Object.fromEntries(
      timeframes
        .map(tf => [tf, this.getLatest(symbol, tf)] as const)
        .filter((entry): entry is [Timeframe, StateSnapshot] => Boolean(entry[1])),
    )
  }

  private key(symbol: string, timeframe: Timeframe) {
    return `${symbol}:${timeframe}`
  }
}
