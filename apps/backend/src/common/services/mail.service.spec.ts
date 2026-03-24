import type { ConfigService } from '@nestjs/config'
import { EmailFailedException } from '@/common/exceptions/email-failed.exception'
import { MailService } from './mail.service'

function createConfigService(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService
}

describe('mailService', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should fall back to staging log delivery when resend daily quota is exhausted', async () => {
    const service = new MailService(createConfigService({
      'app.appEnv': 'staging',
      EMAIL_FROM: 'noreply@coinflux.ai',
      EMAIL_FROM_NAME: 'Coinflux',
      RESEND_API_KEY: 're_fake_quota_key',
    }))

    ;(service as any).resend = {
      emails: {
        send: jest.fn().mockResolvedValue({
          error: { message: 'You have reached your daily email sending quota.' },
        }),
      },
    }
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {})

    await expect(service.sendVerificationCode('541172405@qq.com', '896872', 'registration')).resolves.toBeUndefined()

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[staging-email-code] source=fallback verification code for 54***@qq.com: 896872'))
  })

  it('should continue throwing on staging when failure is not quota related', async () => {
    const service = new MailService(createConfigService({
      'app.appEnv': 'staging',
      EMAIL_FROM: 'noreply@coinflux.ai',
      EMAIL_FROM_NAME: 'Coinflux',
      RESEND_API_KEY: 're_fake_quota_key',
    }))

    jest.spyOn(service, 'sendMail').mockRejectedValueOnce(new EmailFailedException({
      recipient: '541172405@qq.com',
      reason: 'Domain is not verified',
    }))

    await expect(service.sendVerificationCode('541172405@qq.com', '896872', 'registration')).rejects.toBeInstanceOf(EmailFailedException)
  })

  it('should continue throwing in production even when quota is exhausted', async () => {
    const service = new MailService(createConfigService({
      'app.appEnv': 'production',
      EMAIL_FROM: 'noreply@coinflux.ai',
      EMAIL_FROM_NAME: 'Coinflux',
      RESEND_API_KEY: 're_fake_quota_key',
    }))

    jest.spyOn(service, 'sendMail').mockRejectedValueOnce(new EmailFailedException({
      recipient: '541172405@qq.com',
      reason: 'You have reached your daily email sending quota.',
    }))

    await expect(service.sendVerificationCode('541172405@qq.com', '896872', 'registration')).rejects.toBeInstanceOf(EmailFailedException)
  })

  it('should log verification codes on staging even when email delivery succeeds', async () => {
    const service = new MailService(createConfigService({
      'app.appEnv': 'staging',
      EMAIL_FROM: 'noreply@coinflux.ai',
      EMAIL_FROM_NAME: 'Coinflux',
      RESEND_API_KEY: 're_fake_success_key',
    }))

    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {})

    ;(service as any).resend = {
      emails: {
        send: jest.fn().mockResolvedValue({ error: null }),
      },
    }

    await expect(service.sendVerificationCode('541172405@qq.com', '896872', 'registration')).resolves.toBeUndefined()

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[staging-email-code] source=delivered verification code for 54***@qq.com: 896872'))
  })
})
