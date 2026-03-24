import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { MailService } from '@/common/services/mail.service'
import { WhaleNotificationDeliveryRepository } from '@/modules/whale-notification/repositories/whale-notification-delivery.repository'
import { WhaleNotificationDispatcherService } from '@/modules/whale-notification/services/whale-notification-dispatcher.service'
import { WhaleNotificationMetricsService } from '@/modules/whale-notification/services/whale-notification-metrics.service'
import { WhaleNotificationChannel, WhaleNotificationDeliveryStatus } from '@ai/shared'

describe('WhaleNotificationDispatcherService retry (E2E)', () => {
  it('retries email dispatch and succeeds on later attempt', async () => {
    const sendMail = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary failure 1'))
      .mockRejectedValueOnce(new Error('temporary failure 2'))
      .mockResolvedValue(undefined)

    const module = await Test.createTestingModule({
      providers: [
        WhaleNotificationDispatcherService,
        WhaleNotificationMetricsService,
        {
          provide: WhaleNotificationDeliveryRepository,
          useValue: {
            findUserTelegramId: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: MailService,
          useValue: { sendMail },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) => {
              if (key === 'WHALE_NOTIFICATION_RETRY_MAX_ATTEMPTS')
                return '3'
              if (key === 'WHALE_NOTIFICATION_RETRY_BACKOFF_MS')
                return '0'
              return defaultValue
            },
          },
        },
      ],
    }).compile()

    const service = module.get(WhaleNotificationDispatcherService)

    const result = await service.dispatch({
      userId: 'u1',
      recipientEmail: 'u1@example.com',
      channel: WhaleNotificationChannel.EMAIL,
      whaleAddress: '0xabc',
      symbol: 'BTC',
      side: 'Long',
      tradeValueUsd: 123456,
    })

    expect(result.status).toBe(WhaleNotificationDeliveryStatus.SENT)
    expect(sendMail).toHaveBeenCalledTimes(3)
  })
})
