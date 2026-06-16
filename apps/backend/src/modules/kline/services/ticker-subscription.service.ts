import type { KlineBarDto } from '../dto/kline-bar.dto'
import type { MarketsService } from '@/modules/markets/markets.service'

import { Injectable } from '@nestjs/common'

export interface TickerSubscriptionInfo {
  timer: NodeJS.Timeout
  clients: Set<string>
  roomName: string
  isRunning: boolean
  lastKlinePrice: number | null
  klineCallback: (bar: KlineBarDto) => void
  params: {
    exchange: string
    instrumentType: string
    symbol: string
    quoteAsset: string
  }
}

@Injectable()
export class TickerSubscriptionService {
  readonly clientSubscriptions = new Map<string, Set<string>>()
  readonly intervals = new Map<string, TickerSubscriptionInfo>()
  readonly dbCache = new Map<
    string,
    {
      data: Awaited<ReturnType<MarketsService['getTicker']>>
      timestamp: number
    }
  >()

  ensureClientSubscriptions(clientId: string): Set<string> {
    const existing = this.clientSubscriptions.get(clientId)
    if (existing) return existing

    const subscriptions = new Set<string>()
    this.clientSubscriptions.set(clientId, subscriptions)
    return subscriptions
  }

  getClientSubscriptions(clientId: string): Set<string> | undefined {
    return this.clientSubscriptions.get(clientId)
  }

  deleteClient(clientId: string): void {
    this.clientSubscriptions.delete(clientId)
  }

  countForClient(clientId: string): number {
    return this.clientSubscriptions.get(clientId)?.size ?? 0
  }

  hasActiveSubscriptions(clientId: string): boolean {
    return this.countForClient(clientId) > 0
  }
}
