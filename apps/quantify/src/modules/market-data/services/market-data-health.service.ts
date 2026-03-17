import type { MarketTimeframe } from '@ai/shared'
import { Injectable } from '@nestjs/common'
import { reverseMapTimeframe } from '@/common/utils/prisma-enum-mappers'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 MarketDataRepository
import { MarketDataRepository } from './market-data.repository'

export interface FreshnessResult {
  symbol: string
  timeframe: MarketTimeframe
  ageMs: number
  thresholdMs: number
  status: 'FRESH' | 'STALE'
}

const TIMEFRAME_MS: Record<MarketTimeframe, number> = {
  '1m': 60_000,
  '3m': 3 * 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '8h': 8 * 60 * 60_000,
  '12h': 12 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
  '1w': 7 * 24 * 60 * 60_000,
}

@Injectable()
export class MarketDataHealthService {
  constructor(private readonly repository: MarketDataRepository) {}

  async evaluateFreshness(
    symbol: string,
    timeframe: MarketTimeframe,
    nowMs: number = Date.now(),
  ): Promise<FreshnessResult> {
    const latest = await this.repository.findLatestBar(symbol, timeframe)
    const thresholdMs = 2 * TIMEFRAME_MS[timeframe]

    if (!latest) {
      return {
        symbol,
        timeframe,
        ageMs: Number.POSITIVE_INFINITY,
        thresholdMs,
        status: 'STALE',
      }
    }

    const ageMs = Math.max(0, nowMs - latest.time.getTime())
    return {
      symbol,
      timeframe,
      ageMs,
      thresholdMs,
      status: ageMs > thresholdMs ? 'STALE' : 'FRESH',
    }
  }

  async evaluateFreshnessFromPrismaTimeframe(
    symbol: string,
    prismaTimeframe: Parameters<typeof reverseMapTimeframe>[0],
    nowMs: number = Date.now(),
  ): Promise<FreshnessResult> {
    return this.evaluateFreshness(symbol, reverseMapTimeframe(prismaTimeframe), nowMs)
  }
}
