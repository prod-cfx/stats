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
import {
  extractRawSymbol,
  parseSymbolMarket,
  toSymbolCode,
  type SymbolMarketType,
} from '../utils/market-symbol-code.util'

interface OkxInstrument {
  instId: string
  baseCcy: string
  quoteCcy: string
  state: string
}

interface OkxInstrumentsResponse {
  code: string
  msg: string
  data: OkxInstrument[]
}

interface OkxCandlesResponse {
  code: string
  msg: string
  data: string[][]
}

@Injectable()
export class OkxMarketDataProvider implements MarketDataProvider, OnModuleDestroy {
  readonly name = 'OKX'
  private readonly logger = new Logger(OkxMarketDataProvider.name)
  private readonly wsByMarket: Partial<Record<SymbolMarketType, WebSocket>> = {}
  private readonly reconnectTimerByMarket: Partial<Record<SymbolMarketType, NodeJS.Timeout>> = {}
  private shouldReconnect = false
  private tickHandler?: SubscribeParams['onTick']
  private klineHandler?: SubscribeParams['onKline']
  private readonly subscriptionsByMarket: Partial<Record<SymbolMarketType, Array<{ raw: string; timeframe: MarketTimeframe }>>> = {}

  constructor(
    @Inject(HttpService)
    private readonly http: HttpService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  private get restBaseUrl() {
    return this.configService.get<string>('marketData.okxRestBaseUrl') ?? 'https://www.okx.com'
  }

  private get wsBaseUrl() {
    return this.configService.get<string>('marketData.okxWsBaseUrl') ?? 'wss://ws.okx.com:8443/ws/v5/public'
  }

  private get restTimeoutMs() {
    return this.configService.get<number>('marketData.restTimeoutMs', 10_000)
  }

  private get reconnectDelayMs() {
    return this.configService.get<number>('marketData.wsReconnectDelayMs', 5_000)
  }

  async fetchSymbols(symbols?: string[]): Promise<ProviderSymbol[]> {
    const requested = symbols?.map(item => extractRawSymbol(item))
    const [spot, perp] = await Promise.all([
      this.fetchInstruments('SPOT', requested),
      this.fetchInstruments('PERP', requested),
    ])
    return [...spot, ...perp]
  }

  async fetchHistoricalBars(query: HistoricalBarQuery): Promise<MarketBarPayload[]> {
    const market = parseSymbolMarket(query.symbol)
    const raw = extractRawSymbol(query.symbol)
    const instId = this.toInstId(raw, market)

    const params: Record<string, string> = {
      instId,
      bar: this.toOkxBar(query.timeframe),
      limit: String(query.limit ?? 500),
    }
    if (query.start) params.after = String(query.start.getTime())
    if (query.end) params.before = String(query.end.getTime())

    const url = new URL('/api/v5/market/history-candles', this.restBaseUrl)
    const { data } = await lastValueFrom(
      this.http.get<OkxCandlesResponse>(url.toString(), {
        params,
        timeout: this.restTimeoutMs,
      }),
    )

    const rows = data.data ?? []
    return rows
      .map(item => ({
        symbol: toSymbolCode(raw, market),
        timeframe: query.timeframe,
        open: item[1] ?? '0',
        high: item[2] ?? '0',
        low: item[3] ?? '0',
        close: item[4] ?? '0',
        volume: item[5] ?? undefined,
        quoteVolume: item[7] ?? undefined,
        timestamp: Number(item[0]),
        source: 'OKX_REST',
        isFinal: true,
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }

  async subscribe(params: SubscribeParams): Promise<() => Promise<void> | void> {
    this.tickHandler = params.onTick
    this.klineHandler = params.onKline
    this.shouldReconnect = true

    const grouped = this.groupSymbolsByMarket(params.symbols, params.timeframes)
    this.subscriptionsByMarket.SPOT = grouped.SPOT
    this.subscriptionsByMarket.PERP = grouped.PERP

    await Promise.all([
      this.openWebSocket('SPOT', grouped.SPOT),
      this.openWebSocket('PERP', grouped.PERP),
    ])

    return async () => {
      this.shouldReconnect = false
      await this.disconnect()
    }
  }

  async disconnect(): Promise<void> {
    await Promise.all([this.closeWebSocket('SPOT'), this.closeWebSocket('PERP')])
  }

  async onModuleDestroy() {
    await this.disconnect()
  }

  private async fetchInstruments(market: SymbolMarketType, symbols?: string[]): Promise<ProviderSymbol[]> {
    const url = new URL('/api/v5/public/instruments', this.restBaseUrl)
    const params = { instType: market === 'PERP' ? 'SWAP' : 'SPOT' }
    const { data } = await lastValueFrom(
      this.http.get<OkxInstrumentsResponse>(url.toString(), {
        params,
        timeout: this.restTimeoutMs,
      }),
    )

    return (data.data ?? [])
      .map(item => this.toProviderSymbol(item, market))
      .filter(item => {
        if (!symbols?.length) return true
        return symbols.includes(item.symbol)
      })
  }

  private toProviderSymbol(item: OkxInstrument, market: SymbolMarketType): ProviderSymbol {
    const raw = this.fromInstId(item.instId)
    return {
      symbol: raw,
      status: this.toStatus(item.state),
      baseAsset: item.baseCcy || raw.slice(0, 3),
      quoteAsset: item.quoteCcy || 'USDT',
      type: 'CRYPTO' satisfies MarketSymbolType,
      instrumentType: (market === 'PERP' ? 'PERPETUAL' : 'SPOT') satisfies MarketInstrumentType,
      isMarginTradingAllowed: market === 'SPOT',
      filters: [],
      exchange: this.name,
    }
  }

  private toStatus(state: string): MarketSymbolStatus {
    return state?.toLowerCase() === 'live' ? 'ACTIVE' : 'DISABLED'
  }

  private fromInstId(instId: string): string {
    const upper = instId.toUpperCase()
    if (upper.endsWith('-SWAP')) {
      return upper.replace(/-SWAP$/, '').replace(/-/g, '')
    }
    return upper.replace(/-/g, '')
  }

  private toInstId(rawSymbol: string, market: SymbolMarketType): string {
    const upper = rawSymbol.toUpperCase()
    const [base, quote] = this.splitRawSymbol(upper)
    return market === 'PERP' ? `${base}-${quote}-SWAP` : `${base}-${quote}`
  }

  private splitRawSymbol(raw: string): [string, string] {
    for (const quote of ['USDT', 'USDC', 'BUSD']) {
      if (raw.endsWith(quote) && raw.length > quote.length) {
        return [raw.slice(0, -quote.length), quote]
      }
    }
    const pivot = Math.floor(raw.length / 2)
    return [raw.slice(0, pivot), raw.slice(pivot)]
  }

  private toOkxBar(timeframe: MarketTimeframe): string {
    const mapping: Record<MarketTimeframe, string> = {
      '1m': '1m',
      '3m': '3m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1H',
      '4h': '4H',
      '6h': '6H',
      '8h': '8H',
      '12h': '12H',
      '1d': '1D',
      '1w': '1W',
    }
    return mapping[timeframe] ?? '1m'
  }

  private groupSymbolsByMarket(
    symbols: string[],
    timeframes: MarketTimeframe[],
  ): Record<SymbolMarketType, Array<{ raw: string; timeframe: MarketTimeframe }>> {
    const grouped: Record<SymbolMarketType, Array<{ raw: string; timeframe: MarketTimeframe }>> = {
      SPOT: [],
      PERP: [],
    }

    for (const symbol of symbols) {
      const market = parseSymbolMarket(symbol)
      const raw = extractRawSymbol(symbol)
      for (const timeframe of timeframes) {
        grouped[market].push({ raw, timeframe })
      }
    }

    return grouped
  }

  private async openWebSocket(market: SymbolMarketType, subscriptions: Array<{ raw: string; timeframe: MarketTimeframe }>) {
    if (!subscriptions.length) return

    const ws = new WebSocket(this.wsBaseUrl)
    this.wsByMarket[market] = ws

    ws.on('open', () => {
      const args = subscriptions.flatMap(item => ([
        { channel: 'tickers', instId: this.toInstId(item.raw, market) },
        { channel: `candle${this.toOkxBar(item.timeframe)}`, instId: this.toInstId(item.raw, market) },
      ]))
      ws.send(JSON.stringify({ op: 'subscribe', args }))
      this.logger.log(`metric=market_ws_connected value=1 market=${market}`)
    })

    ws.on('message', data => {
      try {
        const payload = JSON.parse(data.toString()) as {
          arg?: { channel?: string; instId?: string }
          data?: Array<Record<string, string> | string[]>
        }
        void this.handleWsPayload(market, payload)
      } catch (error) {
        this.logger.error(`okx ws payload parse failed market=${market} reason=${(error as Error).message}`)
      }
    })

    ws.on('close', () => {
      this.logger.warn(`metric=market_ws_connected value=0 market=${market}`)
      this.scheduleReconnect(market)
    })

    ws.on('error', error => {
      this.logger.error(`okx ws error market=${market} reason=${(error as Error).message}`)
      this.scheduleReconnect(market)
    })
  }

  private async closeWebSocket(market: SymbolMarketType) {
    const timer = this.reconnectTimerByMarket[market]
    if (timer) {
      clearTimeout(timer)
      this.reconnectTimerByMarket[market] = undefined
    }

    const ws = this.wsByMarket[market]
    if (!ws) return
    ws.close()
    this.wsByMarket[market] = undefined
  }

  private scheduleReconnect(market: SymbolMarketType) {
    if (!this.shouldReconnect) return
    if (this.reconnectTimerByMarket[market]) return

    this.logger.warn(`metric=market_ws_reconnect_total value=1 market=${market} delayMs=${this.reconnectDelayMs}`)
    this.reconnectTimerByMarket[market] = setTimeout(async () => {
      this.reconnectTimerByMarket[market] = undefined
      const subscriptions = this.subscriptionsByMarket[market] ?? []
      await this.openWebSocket(market, subscriptions)
    }, this.reconnectDelayMs)
  }

  private async handleWsPayload(
    market: SymbolMarketType,
    payload: { arg?: { channel?: string; instId?: string }; data?: Array<Record<string, string> | string[]> },
  ) {
    const channel = payload.arg?.channel ?? ''
    const instId = payload.arg?.instId ?? ''
    const rawSymbol = this.fromInstId(instId)
    const rows = payload.data ?? []

    if (!rows.length) return

    if (channel.startsWith('candle')) {
      const candle = rows[0]
      if (!Array.isArray(candle)) return
      await this.klineHandler?.({
        symbol: toSymbolCode(rawSymbol, market),
        timeframe: this.fromOkxBar(channel.replace('candle', '')),
        open: candle[1] ?? '0',
        high: candle[2] ?? '0',
        low: candle[3] ?? '0',
        close: candle[4] ?? '0',
        volume: candle[5] ?? undefined,
        quoteVolume: candle[7] ?? undefined,
        timestamp: Number(candle[0]),
        isFinal: candle[8] === '1',
        source: 'OKX_WS',
      })
      return
    }

    if (channel === 'tickers') {
      const ticker = rows[0]
      if (!ticker || Array.isArray(ticker)) return
      await this.tickHandler?.({
        symbol: toSymbolCode(rawSymbol, market),
        lastPrice: ticker.last ?? ticker.lastPx ?? '0',
        bidPrice: ticker.bidPx,
        askPrice: ticker.askPx,
        volume: ticker.vol24h,
        eventTime: Number(ticker.ts ?? Date.now()),
        source: 'OKX_WS',
      } as MarketQuotePayload)
    }
  }

  private fromOkxBar(bar: string): MarketTimeframe {
    const mapping: Record<string, MarketTimeframe> = {
      '1m': '1m',
      '3m': '3m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1H': '1h',
      '4H': '4h',
      '6H': '6h',
      '8H': '8h',
      '12H': '12h',
      '1D': '1d',
      '1W': '1w',
    }
    return mapping[bar] ?? '1m'
  }
}
