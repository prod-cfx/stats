import type { ConfigService } from '@nestjs/config'
import type { WhaleNotificationDeliveryRepository } from '../repositories/whale-notification-delivery.repository'
import type { WhaleNotificationRulesRepository } from '../repositories/whale-notification-rules.repository'
import type { WhaleNotificationDeduplicatorService } from './whale-notification-deduplicator.service'
import type { WhaleNotificationDispatcherService } from './whale-notification-dispatcher.service'
import type { WhaleNotificationMatcherService } from './whale-notification-matcher.service'
import type { WhaleNotificationMetricsService } from './whale-notification-metrics.service'
import { Inject, Injectable, Logger  } from '@nestjs/common'
import { ConfigService as ConfigServiceToken } from '@nestjs/config'
import { WhaleNotificationChannel, WhaleNotificationDeliveryStatus } from '@ai/shared'
import { Prisma } from '@/prisma/prisma.types'
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
  private readonly logger = new Logger(WhaleNotificationOrchestratorService.name)

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
      try {
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
      } catch (error) {
        if (!this.isStaleRelationError(error)) {
          throw error
        }
        this.logger.warn(`Skip stale skipped-delivery write for user=${skipped.userId} rule=${skipped.ruleId}`)
      }
    }

    for (const item of dedupResult.allowed) {
      const channel = this.toChannelEnum(item.channel)
      let dispatchResult: Awaited<ReturnType<WhaleNotificationDispatcherService['dispatch']>>
      try {
        dispatchResult = await this.dispatcher.dispatch({
          userId: item.userId,
          recipientEmail: await this.deliveryRepository.findUserEmail(item.userId),
          channel,
          whaleAddress: item.whaleAddress,
          symbol: item.symbol,
          side: item.side,
          tradeValueUsd: item.tradeValueUsd,
        })
      } catch (error) {
        await this.repository.releaseCooldownSlot({
          dedupKey: item.dedupKey,
          channel,
        })
        throw error
      }

      try {
        await this.repository.createDelivery({
          userId: item.userId,
          ruleId: item.ruleId,
          dedupKey: item.dedupKey,
          channel,
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
      } catch (error) {
        if (!this.isStaleRelationError(error)) {
          throw error
        }
        this.logger.warn(`Skip stale delivery write for user=${item.userId} rule=${item.ruleId}`)
        await this.repository.releaseCooldownSlot({
          dedupKey: item.dedupKey,
          channel,
        })
        continue
      } finally {
        if (dispatchResult.status === WhaleNotificationDeliveryStatus.FAILED) {
          await this.repository.releaseCooldownSlot({
            dedupKey: item.dedupKey,
            channel,
          })
        }
      }

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
    // 已取消灰度白名单逻辑：命中规则的用户全部继续派发
    return matches
  }

  private isStaleRelationError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false
    }
    return error.code === 'P2003' || error.code === 'P2025'
  }
}
