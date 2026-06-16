import { Injectable } from '@nestjs/common'

export interface OrderbookSubscriptionInfo {
  timer: NodeJS.Timeout
  clients: Set<string>
  roomName: string
  isRunning: boolean
  params: {
    exchange: string
    instrumentType: string
    symbol: string
    isAggregated: boolean
    depth: number
  }
}

@Injectable()
export class OrderbookSubscriptionService {
  readonly clientSubscriptions = new Map<string, Set<string>>()
  readonly intervals = new Map<string, OrderbookSubscriptionInfo>()

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
