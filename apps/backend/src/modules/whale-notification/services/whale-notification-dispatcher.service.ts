import type { WhaleNotificationDeliveryRepository } from '../repositories/whale-notification-delivery.repository'
import type { WhaleNotificationMetricsService } from './whale-notification-metrics.service'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { WhaleNotificationChannel, WhaleNotificationDeliveryStatus } from '@prisma/client'
import { MailService } from '@/common/services/mail.service'
import { WhaleNotificationDeliveryRepository as WhaleNotificationDeliveryRepositoryToken } from '../repositories/whale-notification-delivery.repository'
import { WhaleNotificationMetricsService as WhaleNotificationMetricsServiceToken } from './whale-notification-metrics.service'

export interface DispatchInput {
  userId: string
  recipientEmail?: string | null
  channel: WhaleNotificationChannel
  whaleAddress: string
  symbol: string
  side: string
  tradeValueUsd: number
}

export interface DispatchResult {
  status: WhaleNotificationDeliveryStatus
  title: string
  content: string
  errorMessage?: string
}

@Injectable()
export class WhaleNotificationDispatcherService {
  constructor(
    @Inject(MailService) private readonly mailService: MailService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(WhaleNotificationDeliveryRepositoryToken)
    private readonly deliveryRepository: WhaleNotificationDeliveryRepository,
    @Inject(WhaleNotificationMetricsServiceToken)
    private readonly metricsService: WhaleNotificationMetricsService,
  ) {}

  async dispatch(input: DispatchInput): Promise<DispatchResult> {
    const title = 'Whale Trade Alert'
    const content = `${input.whaleAddress} ${input.side} ${input.symbol} $${input.tradeValueUsd.toLocaleString('en-US')}`

    if (input.channel === WhaleNotificationChannel.WEB) {
      return {
        status: WhaleNotificationDeliveryStatus.SENT,
        title,
        content,
      }
    }

    if (input.channel === WhaleNotificationChannel.EMAIL) {
      const recipient = input.recipientEmail?.trim().toLowerCase() || null
      if (!recipient) {
        return {
          status: WhaleNotificationDeliveryStatus.FAILED,
          title,
          content,
          errorMessage: 'Email recipient not found',
        }
      }

      return this.dispatchWithRetry(async () => {
        await this.mailService.sendMail({
          to: recipient,
          subject: title,
          text: content,
        })
        return {
          status: WhaleNotificationDeliveryStatus.SENT,
          title,
          content,
        }
      }, {
        title,
        content,
        fallbackErrorMessage: 'Email dispatch failed',
      })
    }

    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN')?.trim()
    if (!botToken) {
      return {
        status: WhaleNotificationDeliveryStatus.FAILED,
        title,
        content,
        errorMessage: 'Telegram bot is not configured',
      }
    }

    const telegramId = await this.deliveryRepository.findUserTelegramId(input.userId)
    if (!telegramId) {
      return {
        status: WhaleNotificationDeliveryStatus.FAILED,
        title,
        content,
        errorMessage: 'Telegram recipient not found',
      }
    }

    return this.dispatchWithRetry(async () => {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramId,
          text: `${title}\n${content}`,
        }),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`Telegram dispatch failed: status=${response.status}, body=${body}`)
      }

      return {
        status: WhaleNotificationDeliveryStatus.SENT,
        title,
        content,
      }
    }, {
      title,
      content,
      fallbackErrorMessage: 'Telegram dispatch failed',
    })
  }

  private async dispatchWithRetry(
    fn: () => Promise<DispatchResult>,
    options: { title: string, content: string, fallbackErrorMessage: string },
  ): Promise<DispatchResult> {
    const maxAttempts = this.getRetryMaxAttempts()
    const backoffMs = this.getRetryBackoffMs()

    let lastErrorMessage: string | undefined

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await fn()
      } catch (error) {
        lastErrorMessage = error instanceof Error ? error.message : options.fallbackErrorMessage

        if (attempt < maxAttempts) {
          this.metricsService.incrementDispatchRetryAttempts()
          if (backoffMs > 0) {
            await this.sleep(backoffMs)
          }
        }
      }
    }

    return {
      status: WhaleNotificationDeliveryStatus.FAILED,
      title: options.title,
      content: options.content,
      errorMessage: lastErrorMessage ?? options.fallbackErrorMessage,
    }
  }

  private getRetryMaxAttempts(): number {
    const raw = this.configService.get<string>('WHALE_NOTIFICATION_RETRY_MAX_ATTEMPTS')?.trim()
    if (!raw)
      return 3
    const parsed = Number(raw)
    if (!Number.isFinite(parsed))
      return 3
    return Math.max(1, Math.floor(parsed))
  }

  private getRetryBackoffMs(): number {
    const raw = this.configService.get<string>('WHALE_NOTIFICATION_RETRY_BACKOFF_MS')?.trim()
    if (!raw)
      return 500
    const parsed = Number(raw)
    if (!Number.isFinite(parsed))
      return 500
    return Math.max(0, Math.floor(parsed))
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms))
  }
}
