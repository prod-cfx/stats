import type { MarketTimeframe, MarketBarPayload  } from '@ai/shared'
import type { MarketBar, MarketQuote } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 MarketDataRepository
import { MarketDataRepository } from './market-data.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 MarketDataService
import { MarketDataService } from './market-data.service'

export interface GatewayBar {
  time: Date
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number | null
  quoteVolume: number | null
  trades: number | null
  isFinal: boolean
}

export interface GatewayQuote {
  lastPrice: Prisma.Decimal
  priceChange: Prisma.Decimal | null
  priceChangePercent: Prisma.Decimal | null
  openPrice: Prisma.Decimal | null
  highPrice: Prisma.Decimal | null
  lowPrice: Prisma.Decimal | null
  volume: Prisma.Decimal | null
  quoteVolume: Prisma.Decimal | null
  bidPrice: Prisma.Decimal | null
  bidQty: Prisma.Decimal | null
  askPrice: Prisma.Decimal | null
  askQty: Prisma.Decimal | null
  eventTime: Date
  source: string | null
  createdAt: Date
}

@Injectable()
export class MarketDataReadGateway {
  constructor(
    private readonly repository: MarketDataRepository,
    private readonly marketDataService: MarketDataService,
  ) {}

  async getRecentBars(symbol: string, timeframe: MarketTimeframe, limit: number): Promise<GatewayBar[]> {
    const snapshotBars = this.marketDataService
      .getRecentBarsSnapshot(symbol, timeframe, limit)
      .map(bar => this.toGatewayBarFromPayload(bar))
    if (snapshotBars.length >= limit) {
      return snapshotBars
    }

    const repositoryBars = this.toGatewayBars(await this.repository.findRecentBars(symbol, timeframe, limit))
    return this.mergeRecentBars(snapshotBars, repositoryBars, limit)
  }

  async getRecentBarsBySymbolId(symbolId: string, timeframe: MarketTimeframe, limit: number): Promise<GatewayBar[]> {
    const snapshotBars = this.marketDataService
      .getRecentBarsSnapshotBySymbolId(symbolId, timeframe, limit)
      .map(bar => this.toGatewayBarFromPayload(bar))
    if (snapshotBars.length >= limit) {
      return snapshotBars
    }

    const repositoryBars = this.toGatewayBars(await this.repository.findRecentBarsBySymbolId(symbolId, timeframe, limit))
    return this.mergeRecentBars(snapshotBars, repositoryBars, limit)
  }

  async getLatestBar(symbol: string, timeframe: MarketTimeframe): Promise<GatewayBar | null> {
    const snapshot = this.marketDataService.getLatestBarSnapshot(symbol, timeframe)
    if (snapshot) {
      return this.toGatewayBarFromPayload(snapshot)
    }
    const bar = await this.repository.findLatestBar(symbol, timeframe)
    return this.toGatewayBar(bar)
  }

  async getLatestBarBySymbolId(symbolId: string, timeframe: MarketTimeframe): Promise<GatewayBar | null> {
    const snapshot = this.marketDataService.getLatestBarSnapshotBySymbolId(symbolId, timeframe)
    if (snapshot) {
      return this.toGatewayBarFromPayload(snapshot)
    }
    const bar = await this.repository.findLatestBarBySymbolId(symbolId, timeframe)
    return this.toGatewayBar(bar)
  }

  private toGatewayBars(
    bars: readonly MarketBar[],
  ): GatewayBar[] {
    return bars.map(bar => this.toGatewayBar(bar)).filter((bar): bar is GatewayBar => bar !== null)
  }

  private toGatewayBarFromPayload(
    bar: MarketBarPayload,
  ): GatewayBar {
    return {
      time: new Date(bar.timestamp),
      timestamp: bar.timestamp,
      open: Number(bar.open),
      high: Number(bar.high),
      low: Number(bar.low),
      close: Number(bar.close),
      volume: bar.volume != null ? Number(bar.volume) : null,
      quoteVolume: bar.quoteVolume != null ? Number(bar.quoteVolume) : null,
      trades: bar.trades ?? null,
      isFinal: bar.isFinal ?? true,
    }
  }

  private toGatewayBar(
    bar: MarketBar | null,
  ): GatewayBar | null {
    if (!bar) return null
    return {
      time: bar.time,
      timestamp: bar.time.getTime(),
      open: Number(bar.open),
      high: Number(bar.high),
      low: Number(bar.low),
      close: Number(bar.close),
      volume: bar.volume !== null ? Number(bar.volume) : null,
      quoteVolume: bar.quoteVolume !== null ? Number(bar.quoteVolume) : null,
      trades: bar.trades,
      isFinal: bar.isFinal,
    }
  }

  private mergeRecentBars(
    snapshotBars: readonly GatewayBar[],
    repositoryBars: readonly GatewayBar[],
    limit: number,
  ): GatewayBar[] {
    const mergedByTimestamp = new Map<number, GatewayBar>()
    for (const bar of repositoryBars) {
      mergedByTimestamp.set(bar.timestamp, bar)
    }
    for (const bar of snapshotBars) {
      mergedByTimestamp.set(bar.timestamp, bar)
    }

    const mergedBars = [...mergedByTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp)
    if (mergedBars.length <= limit) {
      return mergedBars
    }

    return mergedBars.slice(-limit)
  }

  async getLatestQuote(symbol: string): Promise<GatewayQuote> {
    const snapshot = this.marketDataService.getLatestQuoteSnapshot(symbol)
    if (snapshot) {
      return {
        lastPrice: new Prisma.Decimal(Number(snapshot.lastPrice)),
        priceChange: this.toDecimalOrNull(snapshot.priceChange),
        priceChangePercent: this.toDecimalOrNull(snapshot.priceChangePercent),
        openPrice: this.toDecimalOrNull(snapshot.openPrice),
        highPrice: this.toDecimalOrNull(snapshot.highPrice),
        lowPrice: this.toDecimalOrNull(snapshot.lowPrice),
        volume: this.toDecimalOrNull(snapshot.volume),
        quoteVolume: this.toDecimalOrNull(snapshot.quoteVolume),
        bidPrice: this.toDecimalOrNull(snapshot.bidPrice),
        bidQty: this.toDecimalOrNull(snapshot.bidQty),
        askPrice: this.toDecimalOrNull(snapshot.askPrice),
        askQty: this.toDecimalOrNull(snapshot.askQty),
        eventTime: new Date(snapshot.eventTime),
        source: snapshot.source,
        createdAt: new Date(snapshot.eventTime),
      }
    }
    const quote = await this.repository.findLatestQuote(symbol)
    const mappedQuote = this.toGatewayQuote(quote)
    if (mappedQuote) return mappedQuote

    throw new DomainException('No market data available', {
      code: ErrorCode.MARKET_DATA_PROVIDER_ERROR,
      args: { symbol },
    })
  }

  private toDecimalOrNull(value: string | number | null | undefined): Prisma.Decimal | null {
    if (value == null) return null
    return new Prisma.Decimal(Number(value))
  }

  private toGatewayQuote(quote: MarketQuote | null): GatewayQuote | null {
    if (!quote) return null
    return {
      lastPrice: quote.lastPrice,
      priceChange: quote.priceChange,
      priceChangePercent: quote.priceChangePercent,
      openPrice: quote.openPrice,
      highPrice: quote.highPrice,
      lowPrice: quote.lowPrice,
      volume: quote.volume,
      quoteVolume: quote.quoteVolume,
      bidPrice: quote.bidPrice,
      bidQty: quote.bidQty,
      askPrice: quote.askPrice,
      askQty: quote.askQty,
      eventTime: quote.eventTime,
      source: quote.source,
      createdAt: quote.createdAt,
    }
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
