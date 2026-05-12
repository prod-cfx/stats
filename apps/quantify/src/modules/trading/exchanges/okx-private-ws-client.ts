import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { OkxPrivateOrderEvent, OkxPrivatePositionEvent } from '../events/okx-private-ws.events'
import type { ExchangeAccountStore, OkxAccountConfig } from '../factory/account-store'
import { createHmac } from 'node:crypto'
import { Inject, Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 ConfigService
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import WebSocket from 'ws'
import {
  OKX_PRIVATE_ORDER_EVENT,
  OKX_PRIVATE_POSITION_EVENT,
} from '../events/okx-private-ws.events'

type OkxWsRow = Record<string, unknown>

interface OkxWsPayload {
  event?: string
  code?: string
  msg?: string
  arg?: {
    channel?: string
  }
  data?: OkxWsRow[]
}

@Injectable()
export class OkxPrivateWsClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OkxPrivateWsClient.name)
  private readonly sockets = new Map<string, WebSocket>()
  private readonly accounts = new Map<string, OkxAccountConfig>()
  private readonly reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly reconnectAttempts = new Map<string, number>()
  private stopping = false

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Inject('ExchangeAccountStore')
    private readonly accountStore: Pick<ExchangeAccountStore, 'listOkxAccountConfigs'>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled()) return

    const accounts = await this.accountStore.listOkxAccountConfigs()
    for (const account of accounts) {
      await this.connect(account)
    }
  }

  async connect(account: OkxAccountConfig): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.log('OKX private WebSocket disabled by feature flag')
      return
    }

    this.stopping = false
    const socket = new WebSocket(this.wsBaseUrl)
    this.sockets.set(account.apiKey, socket)
    this.accounts.set(account.apiKey, account)
    this.clearReconnectTimer(account.apiKey)
    this.bindSocket(socket, account.apiKey)
  }

  async disconnect(): Promise<void> {
    this.stopping = true
    for (const apiKey of this.reconnectTimers.keys()) {
      this.clearReconnectTimer(apiKey)
    }
    const sockets = [...this.sockets.values()]
    this.sockets.clear()
    this.accounts.clear()
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.CLOSED) continue
      socket.close()
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect()
  }

  private bindSocket(socket: WebSocket, apiKey: string): void {
    socket.on('open', () => {
      this.reconnectAttempts.set(apiKey, 0)
      socket.send(JSON.stringify(this.buildLoginPayload(apiKey)))
    })

    socket.on('message', data => {
      try {
        this.handlePayload(apiKey, JSON.parse(data.toString()) as OkxWsPayload)
      } catch (error) {
        this.logger.error(`OKX private WebSocket payload parse failed reason=${(error as Error).message}`)
      }
    })

    socket.on('close', () => {
      this.logger.warn(`metric=okx_ws_disconnect_total value=1 apiKeyFingerprint=${this.fingerprint(apiKey)}`)
      if (this.sockets.get(apiKey) === socket) {
        this.sockets.delete(apiKey)
      }
      this.scheduleReconnect(apiKey)
    })

    socket.on('error', error => {
      this.logger.error(`OKX private WebSocket error reason=${(error as Error).message}`)
    })
  }

  private handlePayload(apiKey: string, payload: OkxWsPayload): void {
    if (payload.event === 'login') {
      if (payload.code === '0') {
        this.subscribePrivateChannels(apiKey)
        return
      }
      this.logger.warn(`OKX private WebSocket login failed code=${payload.code ?? ''} msg=${payload.msg ?? ''}`)
      return
    }

    const rows = payload.data ?? []
    if (!rows.length) return

    if (payload.arg?.channel === 'orders') {
      for (const row of rows) {
        this.eventEmitter.emit(OKX_PRIVATE_ORDER_EVENT, this.toOrderEvent(apiKey, row))
      }
      return
    }

    if (payload.arg?.channel === 'positions') {
      for (const row of rows) {
        this.eventEmitter.emit(OKX_PRIVATE_POSITION_EVENT, this.toPositionEvent(apiKey, row))
      }
    }
  }

  private subscribePrivateChannels(apiKey: string): void {
    this.sockets.get(apiKey)?.send(JSON.stringify({
      op: 'subscribe',
      args: [
        { channel: 'orders', instType: 'ANY' },
        { channel: 'account' },
        { channel: 'positions', instType: 'ANY' },
      ],
    }))
  }

  private buildLoginPayload(apiKey: string) {
    const account = this.requireAccount(apiKey)
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const sign = createHmac('sha256', account.secret)
      .update(`${timestamp}GET/users/self/verify`)
      .digest('base64')

    return {
      op: 'login',
      args: [{
        apiKey: account.apiKey,
        passphrase: account.passphrase,
        timestamp,
        sign,
      }],
    }
  }

  private toOrderEvent(apiKey: string, row: OkxWsRow): OkxPrivateOrderEvent {
    return {
      exchangeId: 'okx',
      exchangeAccountId: this.requireAccount(apiKey).exchangeAccountId,
      apiKey: this.requireAccount(apiKey).apiKey,
      instId: this.readString(row.instId),
      orderId: this.readString(row.ordId),
      clientOrderId: this.readOptionalString(row.clOrdId),
      state: this.readString(row.state),
      side: this.readOptionalString(row.side),
      orderType: this.readOptionalString(row.ordType),
      avgPrice: this.readOptionalNumber(row.avgPx),
      fillPrice: this.readOptionalNumber(row.fillPx),
      filledSize: this.readOptionalNumber(row.accFillSz),
      fee: this.readOptionalNumber(row.fee),
      feeCurrency: this.readOptionalString(row.feeCcy),
      tradeId: this.readOptionalString(row.tradeId),
      updatedAt: this.readTimestamp(row.uTime),
      raw: row,
    }
  }

  private toPositionEvent(apiKey: string, row: OkxWsRow): OkxPrivatePositionEvent {
    return {
      exchangeId: 'okx',
      exchangeAccountId: this.requireAccount(apiKey).exchangeAccountId,
      apiKey: this.requireAccount(apiKey).apiKey,
      instId: this.readString(row.instId),
      positionSide: this.readOptionalString(row.posSide),
      quantity: this.readOptionalNumber(row.pos),
      avgPrice: this.readOptionalNumber(row.avgPx),
      updatedAt: this.readTimestamp(row.uTime),
      raw: row,
    }
  }

  private readTimestamp(value: unknown): Date {
    const timestamp = this.readOptionalNumber(value)
    return timestamp !== undefined ? new Date(timestamp) : new Date()
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value : ''
  }

  private readOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined
  }

  private readOptionalNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value !== 'string' || value.length === 0) return undefined

    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  private requireAccount(apiKey: string): OkxAccountConfig {
    const account = this.accounts.get(apiKey)
    if (!account) {
      throw new Error('OKX private WebSocket account is not configured')
    }
    return account
  }

  private isEnabled(): boolean {
    const direct = this.configService.get<boolean>('featureFlags.okxWsEnabled')
    if (typeof direct === 'boolean') return direct

    return this.configService.get<{ okxWsEnabled?: boolean }>('featureFlags')?.okxWsEnabled ?? false
  }

  private get wsBaseUrl(): string {
    return this.configService.get<string>('marketData.okxPrivateWsBaseUrl')
      ?? 'wss://ws.okx.com:8443/ws/v5/private'
  }

  private fingerprint(value: string): string {
    return createHmac('sha256', 'okx-private-ws-log-fingerprint')
      .update(value)
      .digest('hex')
      .slice(0, 12)
  }

  private scheduleReconnect(apiKey: string): void {
    if (this.stopping || !this.isEnabled()) return
    if (!this.accounts.has(apiKey)) return
    if (this.reconnectTimers.has(apiKey)) return

    const attempt = this.reconnectAttempts.get(apiKey) ?? 0
    const delayMs = Math.min(30_000, 1_000 * 2 ** attempt)
    this.reconnectAttempts.set(apiKey, attempt + 1)

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(apiKey)
      const account = this.accounts.get(apiKey)
      if (!account || this.stopping || !this.isEnabled()) return
      void this.connect(account)
    }, delayMs)
    this.reconnectTimers.set(apiKey, timer)
  }

  private clearReconnectTimer(apiKey: string): void {
    const timer = this.reconnectTimers.get(apiKey)
    if (!timer) return
    clearTimeout(timer)
    this.reconnectTimers.delete(apiKey)
  }
}
