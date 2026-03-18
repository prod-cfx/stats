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

interface HyperliquidMetaResponse {
  universe?: Array<{ name: string }>
}

interface HyperliquidCandle {
  t: number
  T?: number
  o: string
  h: string
  l: string
  c: string
  v?: string
}

@Injectable()
export class HyperliquidMarketDataProvider implements MarketDataProvider, OnModuleDestroy {
  readonly name = 'HYPERLIQUID'
  private readonly logger = new Logger(HyperliquidMarketDataProvider.name)
  private readonly wsLifecycle = new WsLifecycleManager<'ALL'>({
    getReconnectDelayMs: () => this.reconnectDelayMs,
    onScheduleReconnect: (_market, delayMs) => {
      this.logger.warn(`metric=market_ws_reconnect_total value=1 market=ALL delayMs=${delayMs}`)
    },
  })
  private tickHandler?: SubscribeParams['onTick']
  private klineHandler?: SubscribeParams['onKline']
  private subscriptions: Array<{ market: SymbolMarketType; raw: string; timeframe: MarketTimeframe }> = []

  constructor(
    @Inject(HttpService)
    private readonly http: HttpService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  private get restBaseUrl() {
    return this.configService.get<string>('marketData.hyperliquidRestBaseUrl') ?? 'https://api.hyperliquid.xyz'
  }

  private get wsBaseUrl() {
    return this.configService.get<string>('marketData.hyperliquidWsBaseUrl') ?? 'wss://api.hyperliquid.xyz/ws'
  }

  private get restTimeoutMs() {
    return this.configService.get<number>('marketData.restTimeoutMs', 10_000)
  }

  private get reconnectDelayMs() {
    return this.configService.get<number>('marketData.wsReconnectDelayMs', 5_000)
  }

  async fetchSymbols(symbols?: string[]): Promise<ProviderSymbol[]> {
    const url = new URL('/info', this.restBaseUrl)
    const body = { type: 'meta' }
    const { data } = await lastValueFrom(
      this.http.post<HyperliquidMetaResponse>(url.toString(), body, { timeout: this.restTimeoutMs }),
    )

    const requestedRawSymbols = this.buildRequestedRawSymbolSet(symbols)
    const rows = data.universe ?? []
    const selected = rows
      .map(item => `${item.name.toUpperCase()}USDC`)
      .filter(raw => {
        if (!requestedRawSymbols) return true
        return requestedRawSymbols.has(raw)
      })

    return selected.flatMap(raw => ([
      {
        symbol: raw,
        status: 'ACTIVE' as MarketSymbolStatus,
        baseAsset: raw.replace(/USDC$/, ''),
        quoteAsset: 'USDC',
        type: 'CRYPTO' satisfies MarketSymbolType,
        instrumentType: 'SPOT' satisfies MarketInstrumentType,
        isMarginTradingAllowed: false,
        filters: [],
        exchange: this.name,
      },
      {
        symbol: raw,
        status: 'ACTIVE' as MarketSymbolStatus,
        baseAsset: raw.replace(/USDC$/, ''),
        quoteAsset: 'USDC',
        type: 'CRYPTO' satisfies MarketSymbolType,
        instrumentType: 'PERPETUAL' satisfies MarketInstrumentType,
        isMarginTradingAllowed: false,
        filters: [],
        exchange: this.name,
      },
    ]))
  }

  private buildRequestedRawSymbolSet(symbols?: string[]): Set<string> | null {
    if (!symbols?.length) return null

    const set = new Set<string>()
    for (const value of symbols) {
      const raw = extractRawSymbol(value)
      if (!raw) continue
      set.add(raw)
      // Hyperliquid 现货/永续主流稳定币计价为 USDC，兼容默认 USDT symbol 输入。
      if (raw.endsWith('USDT')) {
        set.add(`${raw.slice(0, -4)}USDC`)
      }
    }
    return set
  }

  async fetchHistoricalBars(query: HistoricalBarQuery): Promise<MarketBarPayload[]> {
    const market = parseSymbolMarket(query.symbol)
    const raw = extractRawSymbol(query.symbol)
    const coin = raw.replace(/USDC$/, '')
    const endTime = query.end?.getTime() ?? Date.now()
    const startTime = query.start?.getTime() ?? endTime - (query.limit ?? 500) * 60_000

    const url = new URL('/info', this.restBaseUrl)
    const body = {
      type: 'candleSnapshot',
      req: {
        coin,
        interval: this.toHyperliquidInterval(query.timeframe),
        startTime,
        endTime,
      },
    }

    const { data } = await lastValueFrom(
      this.http.post<HyperliquidCandle[]>(url.toString(), body, { timeout: this.restTimeoutMs }),
    )

    return (data ?? []).map(item => ({
      symbol: toSymbolCode(raw, market),
      timeframe: query.timeframe,
      open: item.o,
      high: item.h,
      low: item.l,
      close: item.c,
      volume: item.v,
      timestamp: item.t,
      isFinal: true,
      source: 'HYPERLIQUID_REST',
    }))
  }

  async subscribe(params: SubscribeParams): Promise<() => Promise<void> | void> {
    this.tickHandler = params.onTick
    this.klineHandler = params.onKline
    this.wsLifecycle.setShouldReconnect(true)
    this.subscriptions = []

    for (const symbol of params.symbols) {
      const market = parseSymbolMarket(symbol)
      const raw = extractRawSymbol(symbol)
      for (const timeframe of params.timeframes) {
        this.subscriptions.push({ market, raw, timeframe })
      }
    }

    await this.openWebSocket()

    return async () => {
      this.wsLifecycle.setShouldReconnect(false)
      await this.disconnect()
    }
  }

  async disconnect(): Promise<void> {
    await this.wsLifecycle.closeSocket('ALL')
  }

  async onModuleDestroy() {
    await this.disconnect()
  }

  private async openWebSocket() {
    if (!this.subscriptions.length) return
    const ws = new WebSocket(this.wsBaseUrl)
    this.wsLifecycle.registerSocket('ALL', ws)

    ws.on('open', () => {
      for (const item of this.subscriptions) {
        const coin = item.raw.replace(/USDC$/, '')
        ws.send(JSON.stringify({
          method: 'subscribe',
          subscription: {
            type: 'candle',
            coin,
            interval: this.toHyperliquidInterval(item.timeframe),
          },
        }))
      }
      this.logger.log('metric=market_ws_connected value=1 market=ALL')
    })

    ws.on('message', data => {
      try {
        const payload = JSON.parse(data.toString()) as {
          channel?: string
          data?: HyperliquidCandle & { coin?: string; interval?: string }
        }
        void this.handleWsPayload(payload)
      } catch (error) {
        this.logger.error(`hyperliquid ws payload parse failed reason=${(error as Error).message}`)
      }
    })

    ws.on('close', () => {
      this.logger.warn('metric=market_ws_connected value=0 market=ALL')
      this.wsLifecycle.scheduleReconnect('ALL', () => this.openWebSocket())
    })

    ws.on('error', error => {
      this.logger.error(`hyperliquid ws error reason=${(error as Error).message}`)
      this.wsLifecycle.scheduleReconnect('ALL', () => this.openWebSocket())
    })
  }

  private async handleWsPayload(payload: {
    channel?: string
    data?: HyperliquidCandle & { coin?: string; interval?: string }
  }) {
    if (payload.channel !== 'candle' || !payload.data) return
    const candle = payload.data
    const coin = candle.coin?.toUpperCase() ?? 'BTC'
    const raw = `${coin}USDC`
    const timeframe = this.fromHyperliquidInterval(candle.interval ?? '1m')

    for (const item of this.subscriptions) {
      if (item.raw !== raw || item.timeframe !== timeframe) continue
      await this.klineHandler?.({
        symbol: toSymbolCode(raw, item.market),
        timeframe: item.timeframe,
        open: candle.o,
        high: candle.h,
        low: candle.l,
        close: candle.c,
        volume: candle.v,
        timestamp: candle.t,
        isFinal: true,
        source: 'HYPERLIQUID_WS',
      })

      await this.tickHandler?.({
        symbol: toSymbolCode(raw, item.market),
        lastPrice: candle.c,
        eventTime: candle.t,
        source: 'HYPERLIQUID_WS',
      } as MarketQuotePayload)
    }
  }

  private toHyperliquidInterval(timeframe: MarketTimeframe): string {
    const mapping: Record<MarketTimeframe, string> = {
      '1m': '1m',
      '3m': '3m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '4h': '4h',
      '6h': '6h',
      '8h': '8h',
      '12h': '12h',
      '1d': '1d',
      '1w': '1w',
    }
    return mapping[timeframe] ?? '1m'
  }

  private fromHyperliquidInterval(interval: string): MarketTimeframe {
    const mapping: Record<string, MarketTimeframe> = {
      '1m': '1m',
      '3m': '3m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '4h': '4h',
      '6h': '6h',
      '8h': '8h',
      '12h': '12h',
      '1d': '1d',
      '1w': '1w',
    }
    return mapping[interval] ?? '1m'
  }
}
