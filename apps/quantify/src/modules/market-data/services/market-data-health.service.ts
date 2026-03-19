import type { MarketTimeframe } from '@ai/shared'
import { Injectable } from '@nestjs/common'
import { reverseMapTimeframe } from '@/common/utils/prisma-enum-mappers'
import { getMarketTimeframeMs } from '../utils/market-timeframe.util'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 MarketDataRepository
import { MarketDataRepository } from './market-data.repository'

export interface FreshnessResult {
  symbol: string
  timeframe: MarketTimeframe
  ageMs: number
  thresholdMs: number
  status: 'FRESH' | 'STALE'
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
    const thresholdMs = 2 * getMarketTimeframeMs(timeframe)

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
