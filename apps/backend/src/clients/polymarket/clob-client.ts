import type {
  PolymarketBookLevel,
  PolymarketMarketChannelMessage,
  PolymarketRestBook,
} from './types'
import type { PolymarketConfig } from '@/config/polymarket.config'
import * as path from 'node:path'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { ConfigService } from '@nestjs/config'
import WebSocket from 'ws'
import { DomainException } from '@/common/exceptions/domain.exception'

export interface FetchOrderbookParams {
  tokenId: string
}

export interface OrderbookSubscriptionOptions {
  assetIds: string[]
  onMessage: (message: PolymarketMarketChannelMessage & { bids: PolymarketBookLevel[]; asks: PolymarketBookLevel[] }) => void
  onError?: (error: Error) => void
  onClose?: () => void
}

export interface OrderbookSubscription {
  close: () => void
}

@Injectable()
export class PolymarketClobClient {
  private readonly logger = new Logger(PolymarketClobClient.name)
  private readonly apiKey?: string
  private readonly restBaseUrl: string
  private readonly wsUrl: string
  private readonly timeoutMs: number

  constructor(private readonly configService: ConfigService) {
    const cfg = this.configService.get<PolymarketConfig>('polymarket')
    this.apiKey = cfg?.clob.apiKey
    this.restBaseUrl = cfg?.clob.restBaseUrl ?? 'https://clob.polymarket.com'
    this.wsUrl = cfg?.clob.wsUrl ?? 'wss://ws-subscriptions.polymarket.com'
    this.timeoutMs = cfg?.clob.timeoutMs ?? 10_000
  }

  async fetchOrderbook(params: FetchOrderbookParams): Promise<PolymarketRestBook> {
    if (!params.tokenId) {
      throw new DomainException('polymarket.client_error', {
        code: ErrorCode.POLYMARKET_CLIENT_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: 'tokenId is required for fetchOrderbook' },
      })
    }
    // 安全拼接路径，保留 restBaseUrl 中的路径段
    const url = new URL(this.restBaseUrl)
    // 使用 path.posix.join 保留原有路径并追加新路径
    url.pathname = path.posix.join(url.pathname, 'book')
    url.searchParams.set('token_id', params.tokenId)

    const json = await this.fetchJson(url)
    return this.normalizeBook(json)
  }

  createMarketChannel(options: OrderbookSubscriptionOptions): OrderbookSubscription {
    if (!options.assetIds.length) {
      throw new DomainException('polymarket.client_error', {
        code: ErrorCode.POLYMARKET_CLIENT_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: 'assetIds is required for Polymarket market channel subscription' },
      })
    }

    const headers: Record<string, string> = {}
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey
    }

    const ws = new WebSocket(this.wsUrl, { headers })

    const handleMessage = (raw: WebSocket.RawData) => {
      try {
        const payload = JSON.parse(raw.toString()) as {
          channel?: string
          data?: PolymarketMarketChannelMessage
          event_type?: string
        }

        const message =
          (payload?.data as PolymarketMarketChannelMessage) ??
          ((payload as unknown as PolymarketMarketChannelMessage) || null)

        if (!message || (payload.channel && payload.channel !== 'market')) {
          return
        }

        if (!message.event_type || message.event_type !== 'book') {
          return
        }

        const normalized = this.normalizeLevels(message)
        options.onMessage(normalized)
      } catch (error) {
        this.logger.warn(
          `Failed to parse Polymarket WS message: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    ws.on('open', () => {
      const subscribePayload = {
        type: 'subscribe',
        channel: 'market',
        asset_ids: options.assetIds,  // 修复：字段名应为 asset_ids，不是 assets_ids
      }
      this.logger.log(`Subscribing to Polymarket market channel for ${options.assetIds.length} assets`)
      ws.send(JSON.stringify(subscribePayload))
    })

    ws.on('message', handleMessage)

    ws.on('error', error => {
      options.onError?.(
        error instanceof Error
          ? error
          : new DomainException('polymarket.client_error', {
              code: ErrorCode.POLYMARKET_CLIENT_ERROR,
              status: HttpStatus.INTERNAL_SERVER_ERROR,
              args: { reason: String(error) },
            }),
      )
    })

    ws.on('close', () => {
      options.onClose?.()
    })

    return {
      close: () => {
        try {
          ws.close()
        } catch (error) {
          this.logger.warn(
            `Failed to close Polymarket WS: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      },
    }
  }

  private async fetchJson(url: URL): Promise<any> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
      })
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new DomainException('polymarket.client_error', {
          code: ErrorCode.POLYMARKET_CLIENT_ERROR,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          args: { reason: `Polymarket CLOB request failed: status=${response.status} ${response.statusText} body=${body.slice(0, 200)}` },
        })
      }
      const json = await response.json()
      return json
    } catch (error) {
      this.logger.error(
        `Polymarket CLOB request error: ${error instanceof Error ? error.message : String(error)}`,
      )
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  private normalizeBook(raw: any): PolymarketRestBook {
    const bids = this.normalizeLevelsArray(raw?.bids ?? [])
    const asks = this.normalizeLevelsArray(raw?.asks ?? [])
    return {
      ...(raw as Record<string, unknown>),
      bids,
      asks,
    } as PolymarketRestBook
  }

  private normalizeLevels(
    message: PolymarketMarketChannelMessage,
  ): PolymarketMarketChannelMessage & { bids: PolymarketBookLevel[]; asks: PolymarketBookLevel[] } {
    return {
      ...message,
      bids: this.normalizeLevelsArray(message.bids ?? []),
      asks: this.normalizeLevelsArray(message.asks ?? []),
    }
  }

  private normalizeLevelsArray(levels: PolymarketBookLevel[] | [string, string][]): PolymarketBookLevel[] {
    if (!Array.isArray(levels)) return []
    return levels
      .map(level => {
        if (Array.isArray(level)) {
          const [price, size] = level
          return { price: String(price ?? '0'), size: String(size ?? '0') }
        }
        return {
          price: String(level.price ?? '0'),
          size: String(level.size ?? '0'),
        }
      })
      .filter(level => !!level.price && !!level.size)
  }
}
