import type { MarketTimeframe } from '@ai/shared'
import type { MarketQuote } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 MarketDataRepository
import { MarketDataRepository } from './market-data.repository'

export interface GatewayBar {
  time: Date
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  quoteVolume: number
  trades: number | null
  isFinal: boolean
}

@Injectable()
export class MarketDataReadGateway {
  constructor(private readonly repository: MarketDataRepository) {}

  async getRecentBars(symbol: string, timeframe: MarketTimeframe, limit: number): Promise<GatewayBar[]> {
    const bars = await this.repository.findRecentBars(symbol, timeframe, limit)
    return bars.map(bar => ({
      time: bar.time,
      timestamp: bar.time.getTime(),
      open: Number(bar.open),
      high: Number(bar.high),
      low: Number(bar.low),
      close: Number(bar.close),
      volume: bar.volume !== null ? Number(bar.volume) : 0,
      quoteVolume: bar.quoteVolume !== null ? Number(bar.quoteVolume) : 0,
      trades: bar.trades,
      isFinal: bar.isFinal,
    }))
  }

  async getLatestBar(symbol: string, timeframe: MarketTimeframe): Promise<GatewayBar | null> {
    const bar = await this.repository.findLatestBar(symbol, timeframe)
    if (!bar) return null
    return {
      time: bar.time,
      timestamp: bar.time.getTime(),
      open: Number(bar.open),
      high: Number(bar.high),
      low: Number(bar.low),
      close: Number(bar.close),
      volume: bar.volume !== null ? Number(bar.volume) : 0,
      quoteVolume: bar.quoteVolume !== null ? Number(bar.quoteVolume) : 0,
      trades: bar.trades,
      isFinal: bar.isFinal,
    }
  }

  async getLatestQuote(symbol: string): Promise<MarketQuote> {
    const quote = await this.repository.findLatestQuote(symbol)
    if (quote) return quote

    throw new DomainException('No market data available', {
      code: ErrorCode.MARKET_DATA_PROVIDER_ERROR,
      args: { symbol },
    })
  }

  async getIndicatorSnapshot(
    symbol: string,
    timeframe: MarketTimeframe,
    fields: string[],
  ): Promise<Record<string, number>> {
    const values = await this.repository.findLatestIndicatorValues(symbol, timeframe, fields)
    if (values.length === 0) return {}

    const result: Record<string, number> = {}
    for (const value of values) {
      result[value.field] = value.value
    }
    return result
  }
}
