import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { WhaleNotificationChannel, WhaleNotificationDeliveryStatus } from '@prisma/client'
import { MailService } from '@/common/services/mail.service'

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

      try {
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
      } catch (error) {
        return {
          status: WhaleNotificationDeliveryStatus.FAILED,
          title,
          content,
          errorMessage: error instanceof Error ? error.message : 'Email dispatch failed',
        }
      }
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

    return {
      status: WhaleNotificationDeliveryStatus.FAILED,
      title,
      content,
      errorMessage: 'Telegram binding is not supported in current schema',
    }
  }
}
