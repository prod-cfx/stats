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
import { HttpService } from '@nestjs/axios'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { lastValueFrom } from 'rxjs'
import WebSocket from 'ws'

interface BinanceSymbolFilter {
  filterType: string
  tickSize?: string
  stepSize?: string
  minPrice?: string
  maxPrice?: string
  minQty?: string
  maxQty?: string
}

interface ExchangeInfoResponse {
  symbols: Array<{
    symbol: string
    status: MarketSymbolStatus
    baseAsset: string
    quoteAsset: string
    baseAssetPrecision: number
    quotePrecision: number
    isMarginTradingAllowed: boolean
    filters: BinanceSymbolFilter[]
  }>
}

// Binance Kline API 返回数组格式：[openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, ...]
type BinanceKlineEntry = [
  number, // 0: openTime
  string, // 1: open
  string, // 2: high
  string, // 3: low
  string, // 4: close
  string, // 5: volume
  number, // 6: closeTime
  string, // 7: quoteVolume
  number, // 8: trades
  string, // 9: takerBuyBaseVolume
  string, // 10: takerBuyQuoteVolume
  string, // 11: ignore
]

interface BinanceTickerPayload {
  e: '24hrTicker'
  s: string // symbol
  c: string // lastPrice
  p: string // priceChange
  P: string // priceChangePercent
  o: string // openPrice
  h: string // highPrice
  l: string // lowPrice
  v: string // volume
  q: string // quoteVolume
  b: string // bidPrice
  B: string // bidQty
  a: string // askPrice
  A: string // askQty
  E: number // eventTime
}

interface BinanceKlinePayload {
  e: 'kline'
  s: string // symbol
  k: {
    t: number // openTime
    T: number // closeTime
    s: string // symbol
    i: string // interval
    o: string // open
    h: string // high
    l: string // low
    c: string // close
    v: string // volume
    q: string // quoteVolume
    n: number // trades
    x: boolean // isFinal
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
  private ws?: WebSocket
  private shouldReconnect = false
  private reconnectTimer?: NodeJS.Timeout
  private tickHandler?: SubscribeParams['onTick']
  private klineHandler?: SubscribeParams['onKline']
  private currentStreams?: string

  constructor(
    @Inject(HttpService)
    private readonly http: HttpService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  private get restBaseUrl() {
    return this.configService.get<string>('marketData.restBaseUrl') ?? 'https://api.binance.com'
  }

  private get wsBaseUrl() {
    return this.configService.get<string>('marketData.wsBaseUrl') ?? 'wss://stream.binance.com:9443'
  }

  private get streamPathTemplate() {
    return this.configService.get<string>('marketData.streamPathTemplate') ?? 'stream?streams='
  }

  private get restTimeoutMs() {
    return this.configService.get<number>('marketData.restTimeoutMs', 10_000)
  }

  private get reconnectDelayMs() {
    return this.configService.get<number>('marketData.wsReconnectDelayMs', 5_000)
  }

  async fetchSymbols(symbols?: string[]): Promise<ProviderSymbol[]> {
    const url = new URL('/api/v3/exchangeInfo', this.restBaseUrl)
    const params: Record<string, string> = {}
    if (symbols?.length) {
      params.symbols = JSON.stringify(symbols.map(symbol => symbol.toUpperCase()))
    }
    const { data } = await lastValueFrom(
      this.http.get<ExchangeInfoResponse>(url.toString(), {
        params,
        timeout: this.restTimeoutMs,
      }),
    )
    return data.symbols.map(item => ({
      symbol: item.symbol,
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

  async fetchHistoricalBars(query: HistoricalBarQuery): Promise<MarketBarPayload[]> {
    const url = new URL('/api/v3/klines', this.restBaseUrl)
    const params: Record<string, string> = {
      symbol: query.symbol.toUpperCase(),
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

    return data.map(item => this.adaptRestBar(item, query.timeframe, query.symbol))
  }

  async subscribe(params: SubscribeParams): Promise<() => Promise<void> | void> {
    this.tickHandler = params.onTick
    this.klineHandler = params.onKline
    this.currentStreams = this.buildStreamParam(params.symbols, params.timeframes)
    this.shouldReconnect = true
    await this.openWebSocket()
    return async () => {
      this.shouldReconnect = false
      await this.disconnect()
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      await new Promise<void>(resolve => {
        this.ws?.once('close', () => resolve())
        this.ws?.close()
      })
    } else if (this.ws) {
      this.ws.close()
    }
    this.ws = undefined
  }

  async onModuleDestroy() {
    await this.disconnect()
  }

  private adaptRestBar(entry: BinanceKlineEntry, timeframe: MarketTimeframe, symbol: string): MarketBarPayload {
    return {
      symbol: symbol.toUpperCase(),
      timeframe,
      open: entry[1],
      high: entry[2],
      low: entry[3],
      close: entry[4],
      volume: entry[5],
      quoteVolume: entry[7],
      trades: entry[8],
      timestamp: entry[0], // 使用 openTime 而非 closeTime，确保游标推进正确
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

  private async openWebSocket() {
    if (!this.currentStreams) return
    const base = this.wsBaseUrl.replace(/\/$/, '')
    const template = this.streamPathTemplate
    const path = template.startsWith('/') ? template : `/${template}`

    let url: string

    if (template.includes('streams=')) {
      // 多路复用模式，例如 /stream?streams=btcusdt@ticker/ethusdt@kline_1m
      url = `${base}${path}${this.currentStreams}`
    } else {
      // 单流模式，例如 /ws/<streamName>
      url = `${base}${path}${this.currentStreams}`
    }
    this.ws = new WebSocket(url)

    this.ws.on('open', () => {
      this.logger.log(`Binance WebSocket 已连接: ${this.currentStreams}`)
    })

    this.ws.on('message', data => {
      try {
        const payload = JSON.parse(data.toString()) as BinanceStreamPayload
        this.handleStreamPayload(payload)
      } catch (error) {
        this.logger.error(`解析 WebSocket 消息失败: ${(error as Error).message}`)
      }
    })

    this.ws.on('close', () => {
      this.logger.warn('Binance WebSocket 连接关闭')
      this.scheduleReconnect()
    })

    this.ws.on('error', error => {
      this.logger.error(`Binance WebSocket 错误: ${(error as Error).message}`)
      this.scheduleReconnect()
    })
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect) return
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined
      await this.openWebSocket()
    }, this.reconnectDelayMs)
  }

  private async handleStreamPayload(payload: BinanceStreamPayload) {
    const data = payload?.data
    if (!data) return

    try {
      if (data.e === '24hrTicker') {
        await this.tickHandler?.(this.adaptTicker(data))
        return
      }
      if (data.e === 'kline') {
        await this.klineHandler?.(this.adaptWsKline(data))
      }
    } catch (error) {
      this.logger.error(`处理 WebSocket 消息失败: ${(error as Error).message}`, (error as Error).stack)
    }
  }

  private adaptTicker(data: BinanceTickerPayload): MarketQuotePayload {
    return {
      symbol: data.s,
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

  private adaptWsKline(data: BinanceKlinePayload): MarketBarPayload {
    const k = data.k
    return {
      symbol: data.s,
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
