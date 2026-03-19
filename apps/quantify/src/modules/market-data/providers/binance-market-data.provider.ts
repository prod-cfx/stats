import type {
  MarketBarPayload,
  MarketInstrumentType,
  MarketQuotePayload,
  MarketSymbolStatus,
  MarketSymbolType,
  MarketTimeframe,
} from '@ai/shared'
import type { OnModuleDestroy } from '@nestjs/common'
import type {
  HistoricalBarQuery,
  MarketDataProvider,
  ProviderSymbol,
  SubscribeParams,
} from '../interfaces/market-data-provider.interface'
import type {SymbolMarketType} from '../utils/market-symbol-code.util';
import { HttpService } from '@nestjs/axios'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { lastValueFrom } from 'rxjs'
import WebSocket from 'ws'
import {
  extractRawSymbol,
  parseSymbolMarket,
  toSymbolCode
  
} from '../utils/market-symbol-code.util'
import { WsLifecycleManager } from './ws-lifecycle.manager'

interface BinanceSymbolFilter {
  filterType: string
  tickSize?: string
  stepSize?: string
  minPrice?: string
  maxPrice?: string
  minQty?: string
  maxQty?: string
}

interface SpotExchangeInfoResponse {
  symbols: Array<{
    symbol: string
    status: MarketSymbolStatus
    baseAsset: string
    quoteAsset: string
    isMarginTradingAllowed: boolean
    filters: BinanceSymbolFilter[]
  }>
}

interface PerpExchangeInfoResponse {
  symbols: Array<{
    symbol: string
    status: string
    baseAsset: string
    quoteAsset: string
    contractType?: string
    filters: BinanceSymbolFilter[]
  }>
}

type BinanceKlineEntry = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
]

interface BinanceTickerPayload {
  e: '24hrTicker'
  s: string
  c: string
  p: string
  P: string
  o: string
  h: string
  l: string
  v: string
  q: string
  b: string
  B: string
  a: string
  A: string
  E: number
}

interface BinanceKlinePayload {
  e: 'kline'
  s: string
  k: {
    t: number
    T: number
    s: string
    i: string
    o: string
    h: string
    l: string
    c: string
    v: string
    q: string
    n: number
    x: boolean
  }
}

interface BinanceStreamPayload {
  stream: string
  data: BinanceTickerPayload | BinanceKlinePayload
}

@Injectable()
export class BinanceMarketDataProvider implements MarketDataProvider, OnModuleDestroy {
  readonly name = 'BINANCE'
  private readonly logger = new Logger(BinanceMarketDataProvider.name)
  private readonly wsLifecycle = new WsLifecycleManager<SymbolMarketType>({
    getReconnectDelayMs: () => this.reconnectDelayMs,
    onScheduleReconnect: (market, delayMs) => {
      this.logger.warn(`metric=market_ws_reconnect_total value=1 market=${market} delayMs=${delayMs}`)
    },
  })
  private readonly streamsByMarket: Partial<Record<SymbolMarketType, string>> = {}
  private readonly lastMessageAtByMarket: Partial<Record<SymbolMarketType, number>> = {}
  private readonly watchdogTimerByMarket: Partial<Record<SymbolMarketType, NodeJS.Timeout>> = {}
  private tickHandler?: SubscribeParams['onTick']
  private klineHandler?: SubscribeParams['onKline']

  constructor(
    @Inject(HttpService)
    private readonly http: HttpService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  private get spotRestBaseUrl() {
    return (
      this.configService.get<string>('marketData.spotRestBaseUrl')
      ?? this.configService.get<string>('marketData.restBaseUrl')
      ?? 'https://api.binance.com'
    )
  }

  private get perpRestBaseUrl() {
    return this.configService.get<string>('marketData.perpRestBaseUrl') ?? 'https://fapi.binance.com'
  }

  private get spotWsBaseUrl() {
    return (
      this.configService.get<string>('marketData.spotWsBaseUrl')
      ?? this.configService.get<string>('marketData.wsBaseUrl')
      ?? 'wss://stream.binance.com:9443'
    )
  }

  private get perpWsBaseUrl() {
    return this.configService.get<string>('marketData.perpWsBaseUrl') ?? 'wss://fstream.binance.com'
  }

  private get spotExchangeInfoPath() {
    return this.configService.get<string>('marketData.spotExchangeInfoPath') ?? '/api/v3/exchangeInfo'
  }

  private get perpExchangeInfoPath() {
    return this.configService.get<string>('marketData.perpExchangeInfoPath') ?? '/fapi/v1/exchangeInfo'
  }

  private get spotKlinePath() {
    return this.configService.get<string>('marketData.spotRestPathTemplate') ?? '/api/v3/klines'
  }

  private get perpKlinePath() {
    return this.configService.get<string>('marketData.perpRestPathTemplate') ?? '/fapi/v1/klines'
  }

  private get spotWsPathTemplate() {
    return (
      this.configService.get<string>('marketData.spotWsPathTemplate')
      ?? this.configService.get<string>('marketData.streamPathTemplate')
      ?? 'stream?streams='
    )
  }

  private get perpWsPathTemplate() {
    return (
      this.configService.get<string>('marketData.perpWsPathTemplate')
      ?? this.configService.get<string>('marketData.streamPathTemplate')
      ?? 'stream?streams='
    )
  }

  private get restTimeoutMs() {
    return this.configService.get<number>('marketData.restTimeoutMs', 10_000)
  }

  private get reconnectDelayMs() {
    return this.configService.get<number>('marketData.wsReconnectDelayMs', 5_000)
  }

  private get staleTimeoutMs() {
    // 防止连接“假活跃”（TCP 未断开但长期无任何消息）。
    return this.configService.get<number>('marketData.wsStaleTimeoutMs', 60_000)
  }

  async fetchSymbols(symbols?: string[]): Promise<ProviderSymbol[]> {
    const requestedRawSymbols = symbols
      ? [...new Set(symbols.map(item => extractRawSymbol(item)).filter(Boolean))]
      : undefined
    const [spot, perp] = await Promise.all([
      this.fetchSpotSymbols(requestedRawSymbols),
      this.fetchPerpSymbols(requestedRawSymbols),
    ])
    return [...spot, ...perp]
  }

  async fetchHistoricalBars(query: HistoricalBarQuery): Promise<MarketBarPayload[]> {
    const market = parseSymbolMarket(query.symbol)
    const rawSymbol = extractRawSymbol(query.symbol)
    const url = new URL(this.getKlinePath(market), this.getRestBaseUrl(market))

    const params: Record<string, string> = {
      symbol: rawSymbol,
      interval: query.timeframe,
      limit: String(query.limit ?? 500),
    }
    if (query.start) params.startTime = String(query.start.getTime())
    if (query.end) params.endTime = String(query.end.getTime())

    const { data } = await lastValueFrom(
      this.http.get<BinanceKlineEntry[]>(url.toString(), {
        params,
        timeout: this.restTimeoutMs,
      }),
    )

    return data.map(item => this.adaptRestBar(item, query.timeframe, rawSymbol, market))
  }

  async subscribe(params: SubscribeParams): Promise<() => Promise<void> | void> {
    this.tickHandler = params.onTick
    this.klineHandler = params.onKline
    this.wsLifecycle.setShouldReconnect(true)

    const grouped = this.groupSymbolsByMarket(params.symbols)
    this.streamsByMarket.SPOT = this.buildStreamParam(grouped.SPOT, params.timeframes)
    this.streamsByMarket.PERP = this.buildStreamParam(grouped.PERP, params.timeframes)

    await Promise.all([
      this.openWebSocket('SPOT', this.streamsByMarket.SPOT),
      this.openWebSocket('PERP', this.streamsByMarket.PERP),
    ])

    return async () => {
      this.wsLifecycle.setShouldReconnect(false)
      await this.disconnect()
    }
  }

  async disconnect(): Promise<void> {
    await Promise.all([this.closeWebSocket('SPOT'), this.closeWebSocket('PERP')])
  }

  async onModuleDestroy() {
    await this.disconnect()
  }

  private async fetchSpotSymbols(symbols?: string[]): Promise<ProviderSymbol[]> {
    const url = new URL(this.spotExchangeInfoPath, this.spotRestBaseUrl)
    const params: Record<string, string> = {}
    if (symbols?.length) {
      params.symbols = JSON.stringify(symbols)
    }

    const { data } = await lastValueFrom(
      this.http.get<SpotExchangeInfoResponse>(url.toString(), {
        params,
        timeout: this.restTimeoutMs,
      }),
    )

    return data.symbols.map(item => ({
      symbol: extractRawSymbol(item.symbol),
      status: item.status,
      baseAsset: item.baseAsset,
      quoteAsset: item.quoteAsset,
      type: 'CRYPTO' satisfies MarketSymbolType,
      instrumentType: 'SPOT' satisfies MarketInstrumentType,
      isMarginTradingAllowed: item.isMarginTradingAllowed,
      filters: this.mapFilters(item.filters),
      exchange: this.name,
    }))
  }

  private async fetchPerpSymbols(symbols?: string[]): Promise<ProviderSymbol[]> {
    const url = new URL(this.perpExchangeInfoPath, this.perpRestBaseUrl)
    const params: Record<string, string> = {}
    if (symbols?.length) {
      params.symbols = JSON.stringify(symbols)
    }

    const { data } = await lastValueFrom(
      this.http.get<PerpExchangeInfoResponse>(url.toString(), {
        params,
        timeout: this.restTimeoutMs,
      }),
    )

    return data.symbols
      .filter(item => item.contractType !== 'PERPETUAL_DELIVERING')
      .map(item => ({
        symbol: extractRawSymbol(item.symbol),
        status: item.status,
        baseAsset: item.baseAsset,
        quoteAsset: item.quoteAsset,
        type: 'CRYPTO' satisfies MarketSymbolType,
        instrumentType: 'PERPETUAL' satisfies MarketInstrumentType,
        isMarginTradingAllowed: false,
        filters: this.mapFilters(item.filters),
        exchange: this.name,
      }))
  }

  private getRestBaseUrl(market: SymbolMarketType): string {
    return market === 'PERP' ? this.perpRestBaseUrl : this.spotRestBaseUrl
  }

  private getKlinePath(market: SymbolMarketType): string {
    return market === 'PERP' ? this.perpKlinePath : this.spotKlinePath
  }

  private getWsBaseUrl(market: SymbolMarketType): string {
    return market === 'PERP' ? this.perpWsBaseUrl : this.spotWsBaseUrl
  }

  private getWsPathTemplate(market: SymbolMarketType): string {
    return market === 'PERP' ? this.perpWsPathTemplate : this.spotWsPathTemplate
  }

  private groupSymbolsByMarket(symbols: string[]): Record<SymbolMarketType, string[]> {
    const grouped: Record<SymbolMarketType, string[]> = { SPOT: [], PERP: [] }

    for (const symbol of symbols) {
      const market = parseSymbolMarket(symbol)
      grouped[market].push(extractRawSymbol(symbol))
    }

    return grouped
  }

  private adaptRestBar(
    entry: BinanceKlineEntry,
    timeframe: MarketTimeframe,
    rawSymbol: string,
    market: SymbolMarketType,
  ): MarketBarPayload {
    return {
      symbol: toSymbolCode(rawSymbol, market),
      timeframe,
      open: entry[1],
      high: entry[2],
      low: entry[3],
      close: entry[4],
      volume: entry[5],
      quoteVolume: entry[7],
      trades: entry[8],
      timestamp: entry[0],
      isFinal: true,
      source: 'BINANCE_REST',
    }
  }

  private buildStreamParam(symbols: string[], timeframes: MarketTimeframe[]): string {
    const streams: string[] = []
    for (const symbol of symbols) {
      const lower = symbol.toLowerCase()
      streams.push(`${lower}@ticker`)
      for (const tf of timeframes) {
        streams.push(`${lower}@kline_${tf}`)
      }
    }
    return streams.join('/')
  }

  private async openWebSocket(market: SymbolMarketType, streams?: string) {
    if (!streams) return

    const base = this.getWsBaseUrl(market).replace(/\/$/, '')
    const template = this.getWsPathTemplate(market)
    const path = template.startsWith('/') ? template : `/${template}`
    const url = `${base}${path}${streams}`

    const ws = new WebSocket(url)
    this.wsLifecycle.registerSocket(market, ws)

    ws.on('open', () => {
      this.lastMessageAtByMarket[market] = Date.now()
      this.startWatchdog(market)
      this.logger.log(`Binance WebSocket 已连接: market=${market} streams=${streams}`)
      this.logger.log(`metric=market_ws_connected value=1 market=${market}`)
    })

    ws.on('message', data => {
      this.lastMessageAtByMarket[market] = Date.now()
      try {
        const payload = JSON.parse(data.toString()) as BinanceStreamPayload
        void this.handleStreamPayload(payload, market)
      } catch (error) {
        this.logger.error(`解析 WebSocket 消息失败: ${(error as Error).message} market=${market}`)
      }
    })

    ws.on('close', () => {
      this.stopWatchdog(market)
      this.logger.warn(`Binance WebSocket 连接关闭 market=${market}`)
      this.logger.warn(`metric=market_ws_connected value=0 market=${market}`)
      this.wsLifecycle.scheduleReconnect(market, () => this.openWebSocket(market, this.streamsByMarket[market]))
    })

    ws.on('error', error => {
      this.stopWatchdog(market)
      this.logger.error(`Binance WebSocket 错误: ${(error as Error).message} market=${market}`)
      this.wsLifecycle.scheduleReconnect(market, () => this.openWebSocket(market, this.streamsByMarket[market]))
    })
  }

  private async closeWebSocket(market: SymbolMarketType): Promise<void> {
    this.stopWatchdog(market)
    await this.wsLifecycle.closeSocket(market)
  }

  private startWatchdog(market: SymbolMarketType): void {
    const existing = this.watchdogTimerByMarket[market]
    if (existing) clearInterval(existing)

    this.watchdogTimerByMarket[market] = setInterval(() => {
      const ws = this.wsLifecycle.getSocket(market)
      if (!ws || ws.readyState !== WebSocket.OPEN) return

      const lastMessageAt = this.lastMessageAtByMarket[market] ?? 0
      const idleMs = Date.now() - lastMessageAt
      if (idleMs < this.staleTimeoutMs) return

      this.logger.warn(
        `Binance WebSocket 长时间无消息，主动重连: market=${market} idleMs=${idleMs} timeoutMs=${this.staleTimeoutMs}`,
      )
      ws.terminate()
    }, 10_000)
  }

  private stopWatchdog(market: SymbolMarketType): void {
    const timer = this.watchdogTimerByMarket[market]
    if (timer) {
      clearInterval(timer)
      this.watchdogTimerByMarket[market] = undefined
    }
  }

  private async handleStreamPayload(payload: BinanceStreamPayload, market: SymbolMarketType) {
    const data = payload?.data
    if (!data) return

    try {
      if (data.e === '24hrTicker') {
        await this.tickHandler?.(this.adaptTicker(data, market))
        return
      }
      if (data.e === 'kline') {
        await this.klineHandler?.(this.adaptWsKline(data, market))
      }
    } catch (error) {
      this.logger.error(`处理 WebSocket 消息失败: ${(error as Error).message}`, (error as Error).stack)
    }
  }

  private adaptTicker(data: BinanceTickerPayload, market: SymbolMarketType): MarketQuotePayload {
    return {
      symbol: toSymbolCode(data.s, market),
      lastPrice: data.c,
      priceChange: data.p,
      priceChangePercent: data.P,
      openPrice: data.o,
      highPrice: data.h,
      lowPrice: data.l,
      volume: data.v,
      quoteVolume: data.q,
      bidPrice: data.b,
      bidQty: data.B,
      askPrice: data.a,
      askQty: data.A,
      eventTime: data.E,
      source: 'BINANCE_WS',
    }
  }

  private adaptWsKline(data: BinanceKlinePayload, market: SymbolMarketType): MarketBarPayload {
    const k = data.k
    return {
      symbol: toSymbolCode(data.s, market),
      timeframe: k.i as MarketTimeframe,
      open: k.o,
      high: k.h,
      low: k.l,
      close: k.c,
      volume: k.v,
      quoteVolume: k.q,
      trades: k.n,
      timestamp: k.T,
      isFinal: k.x,
      source: 'BINANCE_WS',
    }
  }

  private mapFilters(filters?: BinanceSymbolFilter[]): ProviderSymbol['filters'] {
    if (!filters) return []
    return filters.map(filter => ({
      filterType: filter.filterType,
      tickSize: filter.tickSize,
      stepSize: filter.stepSize,
      minPrice: filter.minPrice,
      maxPrice: filter.maxPrice,
      minQty: filter.minQty,
      maxQty: filter.maxQty,
    }))
  }
}
