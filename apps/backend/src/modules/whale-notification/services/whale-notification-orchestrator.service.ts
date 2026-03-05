import { Injectable } from '@nestjs/common'
import { WhaleNotificationChannel, WhaleNotificationDeliveryStatus } from '@prisma/client'
import { WhaleNotificationDeliveryRepository } from '../repositories/whale-notification-delivery.repository'
import { WhaleNotificationRulesRepository } from '../repositories/whale-notification-rules.repository'
import { WhaleNotificationDeduplicatorService } from './whale-notification-deduplicator.service'
import { WhaleNotificationDispatcherService } from './whale-notification-dispatcher.service'
import { WhaleNotificationMatcherService } from './whale-notification-matcher.service'

export interface WhaleTradeEventInput {
  whaleAddress: string
  symbol: string
  side: string
  tradeValueUsd: number
  tradeTime: Date
}

@Injectable()
export class WhaleNotificationOrchestratorService {
  constructor(
    private readonly matcher: WhaleNotificationMatcherService,
    private readonly deduplicator: WhaleNotificationDeduplicatorService,
    private readonly dispatcher: WhaleNotificationDispatcherService,
    private readonly repository: WhaleNotificationRulesRepository,
    private readonly deliveryRepository: WhaleNotificationDeliveryRepository,
  ) {}

  async processTradeEvent(event: WhaleTradeEventInput): Promise<void> {
    const matches = await this.matcher.matchTradeEvent(event)
    if (!matches.length) return

    const candidates = matches.flatMap(match => {
      const out: Array<{
        userId: string
        ruleId: string
        channel: 'WEB' | 'EMAIL' | 'TELEGRAM'
        whaleAddress: string
        symbol: string
        side: string
        tradeValueUsd: number
        tradeTime: Date
      }> = []

      if (match.channels.web) {
        out.push({ ...match, channel: 'WEB' })
      }
      if (match.channels.email) {
        out.push({ ...match, channel: 'EMAIL' })
      }
      if (match.channels.telegram) {
        out.push({ ...match, channel: 'TELEGRAM' })
      }
      return out
    })

    const dedupResult = await this.deduplicator.filterByCooldown(candidates, 60)

    for (const skipped of dedupResult.skipped) {
      await this.repository.createDelivery({
        userId: skipped.userId,
        ruleId: skipped.ruleId,
        dedupKey: skipped.dedupKey,
        channel: this.toChannelEnum(skipped.channel),
        status: WhaleNotificationDeliveryStatus.SKIPPED_COOLDOWN,
        whaleAddress: skipped.whaleAddress,
        symbol: skipped.symbol,
        side: skipped.side,
        tradeValueUsd: skipped.tradeValueUsd,
        tradeTime: skipped.tradeTime,
        title: 'Whale Trade Alert',
        content: `${skipped.whaleAddress} ${skipped.side} ${skipped.symbol} $${skipped.tradeValueUsd.toLocaleString('en-US')}`,
        errorMessage: 'cooldown',
      })
    }

    for (const item of dedupResult.allowed) {
      const dispatchResult = await this.dispatcher.dispatch({
        userId: item.userId,
        recipientEmail: await this.deliveryRepository.findUserEmail(item.userId),
        channel: this.toChannelEnum(item.channel),
        whaleAddress: item.whaleAddress,
        symbol: item.symbol,
        side: item.side,
        tradeValueUsd: item.tradeValueUsd,
      })

      await this.repository.createDelivery({
        userId: item.userId,
        ruleId: item.ruleId,
        dedupKey: item.dedupKey,
        channel: this.toChannelEnum(item.channel),
        status: dispatchResult.status,
        whaleAddress: item.whaleAddress,
        symbol: item.symbol,
        side: item.side,
        tradeValueUsd: item.tradeValueUsd,
        tradeTime: item.tradeTime,
        title: dispatchResult.title,
        content: dispatchResult.content,
        errorMessage: dispatchResult.errorMessage,
      })
    }
  }

  private toChannelEnum(channel: 'WEB' | 'EMAIL' | 'TELEGRAM'): WhaleNotificationChannel {
    if (channel === 'EMAIL') return WhaleNotificationChannel.EMAIL
    if (channel === 'TELEGRAM') return WhaleNotificationChannel.TELEGRAM
    return WhaleNotificationChannel.WEB
  }
}
