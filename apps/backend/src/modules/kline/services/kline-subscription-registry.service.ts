import type { KlineBarDto } from '../dto/kline-bar.dto'

import { Injectable } from '@nestjs/common'

@Injectable()
export class KlineSubscriptionRegistryService {
  readonly clientSubscriptions = new Map<string, Set<string>>()
  readonly clientCallbacks = new Map<string, (bar: KlineBarDto) => void>()

  initializeClient(clientId: string): void {
    this.clientSubscriptions.set(clientId, new Set())
  }

  getClientSubscriptions(clientId: string): Set<string> | undefined {
    return this.clientSubscriptions.get(clientId)
  }

  ensureClientSubscriptions(clientId: string): Set<string> {
    const existing = this.clientSubscriptions.get(clientId)
    if (existing) return existing

    const subscriptions = new Set<string>()
    this.clientSubscriptions.set(clientId, subscriptions)
    return subscriptions
  }

  getCallback(clientId: string, subscriptionKey: string): ((bar: KlineBarDto) => void) | undefined {
    return this.clientCallbacks.get(this.getCallbackKey(clientId, subscriptionKey))
  }

  setCallback(clientId: string, subscriptionKey: string, callback: (bar: KlineBarDto) => void): void {
    this.clientCallbacks.set(this.getCallbackKey(clientId, subscriptionKey), callback)
  }

  deleteCallback(clientId: string, subscriptionKey: string): void {
    this.clientCallbacks.delete(this.getCallbackKey(clientId, subscriptionKey))
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

  private getCallbackKey(clientId: string, subscriptionKey: string): string {
    return `${clientId}:${subscriptionKey}`
  }
}
