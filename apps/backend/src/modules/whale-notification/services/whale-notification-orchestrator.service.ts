import type { ConfigService } from '@nestjs/config'
import type { WhaleNotificationDeliveryRepository } from '../repositories/whale-notification-delivery.repository'
import type { WhaleNotificationRulesRepository } from '../repositories/whale-notification-rules.repository'
import type { WhaleNotificationDeduplicatorService } from './whale-notification-deduplicator.service'
import type { WhaleNotificationDispatcherService } from './whale-notification-dispatcher.service'
import type { WhaleNotificationMatcherService } from './whale-notification-matcher.service'
import type { WhaleNotificationMetricsService } from './whale-notification-metrics.service'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService as ConfigServiceToken } from '@nestjs/config'
import { WhaleNotificationChannel, WhaleNotificationDeliveryStatus } from '@prisma/client'
import { WhaleNotificationDeliveryRepository as WhaleNotificationDeliveryRepositoryToken } from '../repositories/whale-notification-delivery.repository'
import { WhaleNotificationRulesRepository as WhaleNotificationRulesRepositoryToken } from '../repositories/whale-notification-rules.repository'
import { WhaleNotificationDeduplicatorService as WhaleNotificationDeduplicatorServiceToken } from './whale-notification-deduplicator.service'
import { WhaleNotificationDispatcherService as WhaleNotificationDispatcherServiceToken } from './whale-notification-dispatcher.service'
import { WhaleNotificationMatcherService as WhaleNotificationMatcherServiceToken } from './whale-notification-matcher.service'
import { WhaleNotificationMetricsService as WhaleNotificationMetricsServiceToken } from './whale-notification-metrics.service'

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
    @Inject(WhaleNotificationMatcherServiceToken)
    private readonly matcher: WhaleNotificationMatcherService,
    @Inject(WhaleNotificationDeduplicatorServiceToken)
    private readonly deduplicator: WhaleNotificationDeduplicatorService,
    @Inject(WhaleNotificationDispatcherServiceToken)
    private readonly dispatcher: WhaleNotificationDispatcherService,
    @Inject(WhaleNotificationRulesRepositoryToken)
    private readonly repository: WhaleNotificationRulesRepository,
    @Inject(WhaleNotificationDeliveryRepositoryToken)
    private readonly deliveryRepository: WhaleNotificationDeliveryRepository,
    @Inject(ConfigServiceToken)
    private readonly configService: ConfigService,
    @Inject(WhaleNotificationMetricsServiceToken)
    private readonly metricsService: WhaleNotificationMetricsService,
  ) {}

  async processTradeEvent(event: WhaleTradeEventInput): Promise<void> {
    this.metricsService.incrementEventsReceived()
    if (!this.isFeatureEnabled()) {
      this.metricsService.incrementFeatureFlagSkippedEvents()
      return
    }

    const rawMatches = await this.matcher.matchTradeEvent(event)
    const matches = this.applyGrayRelease(rawMatches)
    this.metricsService.addGrayReleaseSkippedMatches(rawMatches.length - matches.length)
    this.metricsService.addMatchedRules(matches.length)
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

    this.metricsService.addDeliveryCandidates(candidates.length)
    const dedupResult = await this.deduplicator.filterByCooldown(candidates, this.getCooldownSeconds())
    this.metricsService.addSkippedCooldownDeliveries(dedupResult.skipped.length)

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

      if (dispatchResult.status === WhaleNotificationDeliveryStatus.SENT) {
        this.metricsService.incrementDeliveriesSent()
      } else if (dispatchResult.status === WhaleNotificationDeliveryStatus.FAILED) {
        this.metricsService.incrementDeliveriesFailed()
      }
    }
  }

  private toChannelEnum(channel: 'WEB' | 'EMAIL' | 'TELEGRAM'): WhaleNotificationChannel {
    if (channel === 'EMAIL') return WhaleNotificationChannel.EMAIL
    if (channel === 'TELEGRAM') return WhaleNotificationChannel.TELEGRAM
    return WhaleNotificationChannel.WEB
  }

  private isFeatureEnabled(): boolean {
    const raw = this.configService.get<string>('WHALE_NOTIFICATION_ENABLED')
    if (typeof raw === 'string') {
      return raw.trim().toLowerCase() !== 'false'
    }
    return true
  }

  private getCooldownSeconds(): number {
    const raw = this.configService.get<string>('WHALE_NOTIFICATION_COOLDOWN_SECONDS')?.trim()
    if (!raw)
      return 60
    const parsed = Number(raw)
    if (!Number.isFinite(parsed))
      return 60
    return Math.max(1, Math.floor(parsed))
  }

  private applyGrayRelease<T extends { userId: string }>(matches: T[]): T[] {
    const rawAllowlist = this.configService.get<string>('WHALE_NOTIFICATION_ALLOWED_USER_IDS')?.trim()
    if (!rawAllowlist)
      return matches

    const allowlist = new Set(
      rawAllowlist
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
    )
    if (!allowlist.size)
      return matches
    return matches.filter(match => allowlist.has(match.userId))
  }
}
