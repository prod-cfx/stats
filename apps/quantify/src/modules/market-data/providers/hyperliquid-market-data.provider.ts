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
import type { SymbolMarketType } from '../utils/market-symbol-code.util'
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

interface HyperliquidSpotMetaResponse {
  universe?: Array<{ tokens?: number[]; index?: number }>
  tokens?: Array<{ name?: string }>
}

interface HyperliquidCandle {
  t: number
  T?: number
  s?: string
  i?: string
  o: string
  h: string
  l: string
  c: string
  v?: string
}

interface HyperliquidAllMids {
  [coin: string]: string
}

interface HyperliquidWsPayload {
  channel?: string
  data?: (HyperliquidCandle & { coin?: string; interval?: string }) | HyperliquidAllMids | { mids?: HyperliquidAllMids }
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
  private subscriptions: Array<{
    market: SymbolMarketType
    raw: string
    timeframe: MarketTimeframe
    coinKey: string
    midKey: string
  }> = []
  private spotCoinKeyMap = new Map<string, string>()
  private spotMetaLoaded = false

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
    await this.ensureSpotMetaLoaded()
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
    const coin = await this.resolveCoinKey(raw, market)
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
      const coinKey = await this.resolveCoinKey(raw, market)
      const midKey = market === 'SPOT' ? coinKey : raw.replace(/USDC$/, '')
      for (const timeframe of params.timeframes) {
        this.subscriptions.push({ market, raw, timeframe, coinKey, midKey })
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
      ws.send(JSON.stringify({
        method: 'subscribe',
        subscription: { type: 'allMids' },
      }))

      const subscribed = new Set<string>()
      for (const item of this.subscriptions) {
        const key = `${item.coinKey}:${item.timeframe}`
        if (subscribed.has(key)) continue
        subscribed.add(key)
        ws.send(JSON.stringify({
          method: 'subscribe',
          subscription: {
            type: 'candle',
            coin: item.coinKey,
            interval: this.toHyperliquidInterval(item.timeframe),
          },
        }))
      }
      this.logger.log('metric=market_ws_connected value=1 market=ALL')
    })

    ws.on('message', data => {
      try {
        const payload = JSON.parse(data.toString()) as HyperliquidWsPayload
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

  private async handleWsPayload(payload: HyperliquidWsPayload) {
    if (payload.channel === 'allMids' && payload.data) {
      const mids = this.extractMids(payload.data)
      if (!mids) return
      await this.emitMidQuotes(mids)
      return
    }

    if (payload.channel !== 'candle' || !payload.data) return
    const candle = payload.data as HyperliquidCandle & { coin?: string; interval?: string }
    const coinKey = (candle.coin ?? candle.s ?? '').toUpperCase()
    const timeframe = this.fromHyperliquidInterval(candle.interval ?? candle.i ?? '1m')
    if (!coinKey) return

    for (const item of this.subscriptions) {
      if (item.coinKey !== coinKey || item.timeframe !== timeframe) continue
      await this.klineHandler?.({
        symbol: toSymbolCode(item.raw, item.market),
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
    }
  }

  private async emitMidQuotes(mids: HyperliquidAllMids) {
    const now = Date.now()
    const emitted = new Set<string>()

    for (const item of this.subscriptions) {
      const mid = mids[item.midKey]
      if (!mid) continue

      const symbol = toSymbolCode(item.raw, item.market)
      if (emitted.has(symbol)) continue
      emitted.add(symbol)

      await this.tickHandler?.({
        symbol,
        lastPrice: mid,
        eventTime: now,
        source: 'HYPERLIQUID_WS',
      } as MarketQuotePayload)
    }
  }

  private extractMids(data: HyperliquidWsPayload['data']): HyperliquidAllMids | null {
    if (!data || typeof data !== 'object') return null

    const maybeEnvelope = data as { mids?: unknown }
    if (maybeEnvelope.mids && typeof maybeEnvelope.mids === 'object') {
      return maybeEnvelope.mids as HyperliquidAllMids
    }

    return data as HyperliquidAllMids
  }

  private async ensureSpotMetaLoaded() {
    if (this.spotMetaLoaded) return

    const url = new URL('/info', this.restBaseUrl)
    const body = { type: 'spotMeta' }
    const { data } = await lastValueFrom(
      this.http.post<HyperliquidSpotMetaResponse>(url.toString(), body, { timeout: this.restTimeoutMs }),
    )

    const tokens = data.tokens ?? []
    const universe = data.universe ?? []
    const usdcIndex = tokens.findIndex(token => (token.name ?? '').toUpperCase() === 'USDC')
    if (usdcIndex < 0) {
      this.spotMetaLoaded = true
      return
    }

    for (const pair of universe) {
      const pairTokens = pair.tokens ?? []
      const pairIndex = pair.index
      if (pairTokens.length !== 2 || typeof pairIndex !== 'number') continue
      if (!pairTokens.includes(usdcIndex)) continue

      const baseIndex = pairTokens[0] === usdcIndex ? pairTokens[1] : pairTokens[0]
      const baseName = (tokens[baseIndex]?.name ?? '').toUpperCase()
      if (!baseName) continue

      const normalizedBase = this.normalizeSpotBaseAsset(baseName)
      const raw = `${normalizedBase}USDC`
      this.spotCoinKeyMap.set(raw, `@${pairIndex}`)
    }

    this.spotMetaLoaded = true
  }

  private normalizeSpotBaseAsset(baseName: string): string {
    if (baseName === 'UBTC') return 'BTC'
    if (baseName === 'UETH') return 'ETH'
    if (baseName === 'USOL') return 'SOL'
    return baseName
  }

  private async resolveCoinKey(raw: string, market: SymbolMarketType): Promise<string> {
    if (market === 'PERP') return raw.replace(/USDC$/, '')

    await this.ensureSpotMetaLoaded()
    return this.spotCoinKeyMap.get(raw) ?? raw.replace(/USDC$/, '')
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
