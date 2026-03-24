import type { WhaleNotificationRulesRepository } from '../repositories/whale-notification-rules.repository'
import { Inject, Injectable } from '@nestjs/common'
import { WhaleNotificationChannel } from '@ai/shared'
import { WhaleNotificationRulesRepository as WhaleNotificationRulesRepositoryToken } from '../repositories/whale-notification-rules.repository'

export interface DeliveryCandidate {
  userId: string
  ruleId: string
  channel: 'WEB' | 'EMAIL' | 'TELEGRAM'
  whaleAddress: string
  symbol: string
  side: string
  tradeValueUsd: number
  tradeTime: Date
}

export interface DedupSkippedItem extends DeliveryCandidate {
  reason: 'cooldown'
  dedupKey: string
}

export interface DedupResult {
  allowed: Array<DeliveryCandidate & { dedupKey: string }>
  skipped: DedupSkippedItem[]
}

@Injectable()
export class WhaleNotificationDeduplicatorService {
  constructor(
    @Inject(WhaleNotificationRulesRepositoryToken)
    private readonly repository: WhaleNotificationRulesRepository,
  ) {}

  async filterByCooldown(candidates: DeliveryCandidate[], cooldownSeconds: number): Promise<DedupResult> {
    if (!candidates.length) {
      return { allowed: [], skipped: [] }
    }

    const allowed: Array<DeliveryCandidate & { dedupKey: string }> = []
    const skipped: DedupSkippedItem[] = []

    for (const item of candidates) {
      const dedupKey = this.buildDedupKey(item)
      const acquired = await this.repository.tryAcquireCooldownSlot({
        dedupKey,
        channel: this.toChannelEnum(item.channel),
        cooldownSeconds,
      })
      if (!acquired) {
        skipped.push({
          ...item,
          reason: 'cooldown',
          dedupKey,
        })
        continue
      }

      allowed.push({
        ...item,
        dedupKey,
      })
    }

    return { allowed, skipped }
  }

  private buildDedupKey(input: DeliveryCandidate): string {
    return [
      input.userId,
      input.whaleAddress.trim().toLowerCase(),
      input.symbol.trim().toUpperCase(),
      input.side,
      input.channel,
    ].join(':')
  }

  toChannelEnum(channel: DeliveryCandidate['channel']): WhaleNotificationChannel {
    if (channel === 'EMAIL') return WhaleNotificationChannel.EMAIL
    if (channel === 'TELEGRAM') return WhaleNotificationChannel.TELEGRAM
    return WhaleNotificationChannel.WEB
  }
}
