import type { TradesAdapterKey, TradesConfig, TradesWsAdapter } from '../../trades-ws-adapter'
import { inspect } from 'node:util'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Mutex } from 'async-mutex'
import WebSocket from 'ws'
import { WhaleAlertService } from '@/modules/whale-alert/whale-alert.service'
import { PrismaService } from '@/prisma/prisma.service'
import { HyperliquidTradesWsConfig } from './hyperliquid-trades-ws.config'

interface HyperliquidWsTrade {
  coin?: string
  px?: string
  sz?: string
  side?: string
  time?: number | string
  hash?: string
  tid?: string
  users?: string[]
}

interface HyperliquidTradesPayload {
  coin?: string
  trades: HyperliquidWsTrade[]
}

type HyperliquidWsMessage =
  | { channel: 'trades'; data: HyperliquidWsTrade[] | HyperliquidTradesPayload }
  | {
      channel: 'subscriptionResponse'
      data: { method: string; subscription: { type: string; coin: string } }
    }
  | { channel: 'error'; data: { message: string } }

interface TradeState {
  cfg: TradesConfig
  coin: string
}

export interface HyperliquidWhaleTradeEvent {
  venueId: string
  coin: string
  price: number
  size: number
  side: string
  time: number
  whaleAddress: string
  counterpartyAddress: string | null
  tradeId: string | null
  users: [string, string]
}

@Injectable()
export abstract class HyperliquidTradesWsAdapterBase implements TradesWsAdapter {
  abstract readonly key: TradesAdapterKey

  protected abstract readonly venueId: string
  protected abstract readonly instrumentType: 'SPOT' | 'PERPETUAL'
  protected abstract toCoin(cfg: TradesConfig): string

  private readonly logger = new Logger(this.constructor.name)
  private ws: WebSocket | null = null
  private open = false
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private lastPongTs = 0
  private missedPongCount = 0
  private readonly states = new Map<string, TradeState>()
  private readonly pendingRemoval = new Set<string>()
  private readonly subscribedCoins = new Set<string>()

  private whaleList = new Set<string>()
  private lastWhaleRefreshAt = 0
  private whaleRefreshTimer: NodeJS.Timeout | null = null
  private readonly whaleRefreshMutex = new Mutex()

  constructor(
    @Inject(ConfigService)
    protected readonly configService: ConfigService,
    @Inject(HyperliquidTradesWsConfig)
    protected readonly hyperliquidTradesConfig: HyperliquidTradesWsConfig,
    @Inject(PrismaService)
    protected readonly prismaService: PrismaService,
    @Inject(WhaleAlertService)
    protected readonly whaleAlertService: WhaleAlertService,
  ) {}

  async ensureConnected(): Promise<void> {
    if (this.open && this.ws) return
    await this.connect()
  }

  async syncTargetConfigs(configs: TradesConfig[]): Promise<void> {
    if (!this.hyperliquidTradesConfig.isEnabled) {
      await this.disableSubscriptions()
      return
    }

    const targets = configs
      .filter(
        cfg =>
          cfg.exchange.toUpperCase() === 'HYPERLIQUID' &&
          cfg.instrumentType === this.instrumentType,
      )
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

    const targetCoins = new Map<string, TradesConfig>()
    for (const cfg of targets) {
      const coin = this.toCoin(cfg)
      if (!coin) {
        this.logger.warn(
          `Trades config missing Hyperliquid coin mapping, skip: symbol=${cfg.symbol}`,
        )
        continue
      }
      if (targetCoins.has(coin)) {
        this.logger.warn(
          `Duplicate Hyperliquid trades config detected for coin=${coin}, keep first`,
        )
        continue
      }
      targetCoins.set(coin, cfg)
    }

    const coinsToRemove = [...this.states.keys()].filter(coin => !targetCoins.has(coin))
    for (const coin of coinsToRemove) {
      this.pendingRemoval.add(coin)
    }

    await Promise.allSettled(
      coinsToRemove.map(async coin => {
        await this.unsubscribe(coin)
        this.states.delete(coin)
        this.pendingRemoval.delete(coin)
      }),
    )

    const coinsToSubscribe: string[] = []
    for (const [coin, cfg] of targetCoins.entries()) {
      const state = this.states.get(coin)
      if (!state) {
        this.states.set(coin, { cfg, coin })
        coinsToSubscribe.push(coin)
      } else {
        state.cfg = cfg
      }
    }

    await Promise.allSettled(coinsToSubscribe.map(coin => this.subscribe(coin)))
  }

  async shutdown(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.whaleRefreshTimer) {
      clearInterval(this.whaleRefreshTimer)
      this.whaleRefreshTimer = null
    }
    this.stopHeartbeat()
    this.open = false
    this.subscribedCoins.clear()
    this.states.clear()
    this.pendingRemoval.clear()
    if (this.ws) {
      try {
        this.ws.close()
      } catch (err) {
        this.logger.debug(`WS close failed during shutdown: ${inspect(err, { depth: 2 })}`)
      }
      this.ws = null
    }
  }

  refreshWhaleList(): Promise<void> {
    return this.whaleRefreshMutex.runExclusive(async () => {
      const addresses = await this.whaleAlertService.getActiveWhaleAddresses()
      const next = new Set<string>()
      for (const address of addresses) {
        next.add(address)
      }
      this.whaleList = next
      this.lastWhaleRefreshAt = Date.now()
      this.logger.debug(`Hyperliquid whale list refreshed, count=${next.size}`)
    })
  }

  isWhale(address: string): boolean {
    if (!address) return false
    return this.whaleList.has(address.trim().toLowerCase())
  }

  private mapTradeSide(side: string): string {
    const normalized = side.toLowerCase()
    if (normalized === 'a' || normalized === 'short' || normalized === 's') {
      return 'Short'
    }
    if (normalized === 'b' || normalized === 'long' || normalized === 'l') {
      return 'Long'
    }

    // 记录未知的交易方向,便于发现 Hyperliquid API 新增的交易方向类型
    this.logger.warn(
      `Unknown trade side from Hyperliquid: "${side}", defaulting to Long. ` +
        `Please update mapTradeSide() if this is a new valid value.`,
    )
    return 'Long'
  }

  protected handleTradesMessage(trades: HyperliquidWsTrade[], coinOverride?: string): void {
    if (!trades.length) return

    for (const trade of trades) {
      const users = this.normalizeUsers(trade.users)
      if (!users) continue

      const whaleAddress = this.pickWhaleUser(users)
      if (!whaleAddress) continue

      const coin = (trade.coin ?? coinOverride)?.toUpperCase()
      if (!coin) continue

      const price = trade.px != null ? Number(trade.px) : Number.NaN
      const size = trade.sz != null ? Number(trade.sz) : Number.NaN
      if (!Number.isFinite(price) || !Number.isFinite(size)) continue

      const timeValue = trade.time != null ? Number(trade.time) : Number.NaN
      const time = Number.isFinite(timeValue) ? timeValue : Date.now()
      const createTime = new Date(time)

      const normalizedSide = (trade.side ?? '').trim().toLowerCase()
      const side = this.mapTradeSide(normalizedSide)

      const absSize = Math.abs(size)

      const event: HyperliquidWhaleTradeEvent = {
        venueId: this.venueId,
        coin,
        price,
        size,
        side: trade.side ?? 'unknown',
        time,
        whaleAddress,
        counterpartyAddress: users[0] === whaleAddress ? users[1] : users[0],
        tradeId: trade.tid ?? trade.hash ?? null,
        users,
      }

      void this.insertWhaleTrade({
        whaleAddress: event.whaleAddress,
        coin: event.coin,
        side,
        tradeSize: absSize,
        price: event.price,
        tradeValueUsd: event.price * absSize,
        tradeTime: Number.isNaN(createTime.getTime()) ? new Date() : createTime,
      })
    }
  }

  private async insertWhaleTrade(payload: {
    whaleAddress: string
    coin: string
    side: string
    tradeSize: number
    price: number
    tradeValueUsd: number
    tradeTime: Date
  }): Promise<void> {
    const { whaleAddress, coin, side, tradeSize, price, tradeValueUsd, tradeTime } = payload
    try {
      await this.whaleAlertService.recordWhaleTrade({
        whaleAddress,
        coin,
        side,
        tradeSize,
        price,
        tradeValueUsd,
        tradeTime,
      })
    } catch (err) {
      this.logger.warn(
        `Hyperliquid whale trade upsert failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  protected getWsUrl(): string {
    return this.configService.get<string>('HYPERLIQUID_WS_URL') ?? 'wss://api.hyperliquid.xyz/ws'
  }

  private async connect(): Promise<void> {
    if (this.ws && (this.open || this.ws.readyState === WebSocket.CONNECTING)) return

    const url = this.getWsUrl()
    this.logger.log(`Connecting Hyperliquid trades WS: ${url}`)

    this.open = false
    this.subscribedCoins.clear()
    this.ws = new WebSocket(url)

    this.ws.on('open', () => {
      this.open = true
      this.lastPongTs = Date.now()
      this.logger.log('Hyperliquid trades WS connected')
      this.startHeartbeat()
      this.ensureWhaleRefreshTicker()
      void this.refreshWhaleList().catch(err => {
        this.logger.warn(
          `Failed to refresh whale list on connect: ${err instanceof Error ? err.message : String(err)}`,
        )
      })
      void this.resubscribeAll()
    })

    this.ws.on('message', (data: WebSocket.RawData) => {
      void this.onMessage(data)
    })

    this.ws.on('pong', () => {
      this.lastPongTs = Date.now()
      this.missedPongCount = 0
    })

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.open = false
      this.subscribedCoins.clear()
      this.stopHeartbeat()
      this.logger.warn(`Hyperliquid trades WS closed: code=${code} reason=${reason.toString()}`)
      this.scheduleReconnect()
    })

    this.ws.on('error', (err: Error) => {
      this.open = false
      this.subscribedCoins.clear()
      this.stopHeartbeat()
      this.logger.error(
        `Hyperliquid trades WS error: ${err instanceof Error ? err.message : String(err)}`,
      )
      this.scheduleReconnect()
    })
  }

  private async resubscribeAll(): Promise<void> {
    if (!this.open || !this.ws) return
    await Promise.allSettled([...this.states.keys()].map(coin => this.subscribe(coin)))
  }

  private async subscribe(coin: string): Promise<void> {
    if (!this.open || !this.ws || this.subscribedCoins.has(coin)) return

    const msg = {
      method: 'subscribe',
      subscription: {
        type: 'trades',
        coin,
      },
    }

    try {
      this.ws.send(JSON.stringify(msg))
      this.subscribedCoins.add(coin)
      this.logger.debug(`Subscribed to ${coin} trades`)
    } catch (err) {
      this.logger.error(`Failed to subscribe ${coin}: ${inspect(err, { depth: 2 })}`)
    }
  }

  private async unsubscribe(coin: string): Promise<void> {
    if (!this.open || !this.ws || !this.subscribedCoins.has(coin)) return

    const msg = {
      method: 'unsubscribe',
      subscription: {
        type: 'trades',
        coin,
      },
    }

    try {
      this.ws.send(JSON.stringify(msg))
      this.subscribedCoins.delete(coin)
      this.logger.debug(`Unsubscribed from ${coin} trades`)
    } catch (err) {
      this.logger.error(`Failed to unsubscribe ${coin}: ${inspect(err, { depth: 2 })}`)
    }
  }

  private async disableSubscriptions(): Promise<void> {
    const coinsToRemove = [...this.states.keys()]
    for (const coin of coinsToRemove) {
      this.pendingRemoval.add(coin)
    }
    await Promise.allSettled(
      coinsToRemove.map(async coin => {
        await this.unsubscribe(coin)
        this.states.delete(coin)
        this.pendingRemoval.delete(coin)
      }),
    )
  }

  private async onMessage(raw: WebSocket.RawData): Promise<void> {
    let msg: HyperliquidWsMessage
    try {
      msg = JSON.parse(raw.toString()) as HyperliquidWsMessage
    } catch (err) {
      const rawStr = raw.toString()
      this.logger.debug(
        `JSON parse failed: ${inspect(err, { depth: 1 })}, raw=${rawStr.slice(0, 200)}`,
      )
      return
    }

    if (msg.channel === 'error') {
      this.logger.warn(`Hyperliquid WS error: ${msg.data.message}`)
      return
    }

    if (msg.channel === 'subscriptionResponse') {
      this.logger.debug(`Subscription response: ${msg.data.method} ${msg.data.subscription.coin}`)
      return
    }

    if (msg.channel === 'trades') {
      void this.ensureWhaleListFresh()
      const payload = msg.data
      if (Array.isArray(payload)) {
        this.handleTradesMessage(payload)
        return
      }
      if (payload && Array.isArray(payload.trades)) {
        this.handleTradesMessage(payload.trades, payload.coin)
      }
    }
  }

  private ensureWhaleRefreshTicker(): void {
    if (this.whaleRefreshTimer) return
    const intervalMs = this.getWhaleRefreshIntervalMs()
    this.whaleRefreshTimer = setInterval(
      () => {
        void this.ensureWhaleListFresh()
      },
      Math.max(30_000, intervalMs),
    )
  }

  private async ensureWhaleListFresh(): Promise<void> {
    const intervalMs = this.getWhaleRefreshIntervalMs()
    const now = Date.now()
    if (this.lastWhaleRefreshAt > 0 && now - this.lastWhaleRefreshAt < intervalMs) return
    try {
      await this.refreshWhaleList()
    } catch (err) {
      this.logger.warn(
        `Failed to refresh whale list: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private normalizeUsers(users?: string[]): [string, string] | null {
    if (!Array.isArray(users) || users.length < 2) return null
    const userA = users[0]?.trim()
    const userB = users[1]?.trim()
    if (!userA || !userB) return null
    return [userA.toLowerCase(), userB.toLowerCase()]
  }

  private pickWhaleUser(users: [string, string]): string | null {
    if (this.isWhale(users[0])) return users[0]
    if (this.isWhale(users[1])) return users[1]
    return null
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    const delayMs = this.configService.get<number>('marketData.wsReconnectDelayMs') ?? 5_000
    this.reconnectTimer = setTimeout(
      () => {
        this.reconnectTimer = null
        void this.connect()
      },
      Math.max(1_000, delayMs),
    )
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return
    const intervalMs = this.configService.get<number>('TRADES_WS_HEARTBEAT_INTERVAL_MS') ?? 5_000
    const maxMissedPongs = this.configService.get<number>('TRADES_WS_MAX_MISSED_PONGS') ?? 3

    this.missedPongCount = 0
    this.heartbeatTimer = setInterval(
      () => {
        if (!this.ws) return
        const now = Date.now()
        if (now - this.lastPongTs > intervalMs * 1.5) {
          this.missedPongCount++
          this.logger.debug(
            `Missed pong #${this.missedPongCount}, last pong ${now - this.lastPongTs}ms ago`,
          )
        }
        if (this.missedPongCount >= maxMissedPongs) {
          try {
            this.logger.warn(
              `Hyperliquid trades WS heartbeat: ${this.missedPongCount} consecutive missed pongs, terminating`,
            )
            this.ws.terminate()
          } catch (err) {
            this.logger.debug(`WS terminate failed: ${inspect(err, { depth: 1 })}`)
          }
          return
        }
        try {
          this.ws.ping()
        } catch (err) {
          this.logger.debug(`WS ping failed: ${inspect(err, { depth: 1 })}`)
        }
      },
      Math.max(3_000, intervalMs),
    )
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private getWhaleRefreshIntervalMs(): number {
    const raw = this.configService.get<string>('HYPERLIQUID_WHALE_REFRESH_INTERVAL_MS')
    const parsed = raw != null ? Number(raw) : Number.NaN
    const ms = Number.isFinite(parsed) ? parsed : 300_000
    return Math.max(30_000, ms)
  }
}
