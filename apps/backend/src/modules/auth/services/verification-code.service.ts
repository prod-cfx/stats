import type { PasswordResetRequestDto } from '../dto/requests/password-reset.request.dto'
import type { ResendVerificationRequestDto } from '../dto/requests/resend-verification.request.dto'
import type { SendEmailLoginCodeRequestDto } from '../dto/requests/send-email-login-code.request.dto'
import type { SendVerificationCodeRequestDto } from '../dto/requests/send-verification-code.request.dto'
import { randomInt } from 'node:crypto'
import { VerificationCodePurpose } from '@ai/shared'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EnvService } from '@/common/services/env.service'
import { MailService } from '@/common/services/mail.service'
import { TransactionEventsService } from '@/common/services/transaction-events.service'
import { EmailAlreadyTakenException } from '../exceptions'
import { UserAuthRepository } from '../repositories/user-auth.repository'

const VERIFICATION_CODE_TTL_MINUTES = 15
const FIXED_VERIFICATION_CODE_FOR_TEST = '123456'
const VERIFICATION_CODE_MIN = 100000
const VERIFICATION_CODE_MAX = 1000000

@Injectable()
export class VerificationCodeService {
  private readonly logger = new Logger(VerificationCodeService.name)

  constructor(
    private readonly userAuthRepository: UserAuthRepository,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(EnvService) private readonly envService: EnvService,
    @Inject(MailService) private readonly mailService: MailService,
    private readonly txEvents: TransactionEventsService,
  ) {}

  async requestPasswordReset(dto: PasswordResetRequestDto): Promise<void> {
    const email = this.normalizeEmail(dto.email)
    const user = await this.userAuthRepository.findUserByEmail(email)
    if (!user) {
      return
    }

    await this.createCodeAndSendAfterCommit({
      email,
      logLabel: 'password reset',
      mailPurpose: 'password_reset',
      purpose: VerificationCodePurpose.PASSWORD_RESET,
    })
  }

  async sendVerificationCode(dto: SendVerificationCodeRequestDto): Promise<void> {
    const email = this.normalizeEmail(dto.email)

    if (dto.purpose === VerificationCodePurpose.EMAIL_VERIFICATION) {
      const existingUser = await this.userAuthRepository.findUserByEmail(email)
      if (existingUser) {
        throw new EmailAlreadyTakenException({ email })
      }
    }

    if (dto.purpose === VerificationCodePurpose.PASSWORD_RESET) {
      const user = await this.userAuthRepository.findUserByEmail(email)
      if (!user) {
        return
      }
    }

    await this.createCodeAndSendAfterCommit({
      email,
      logLabel: `${dto.purpose}`,
      mailPurpose: dto.purpose === VerificationCodePurpose.EMAIL_VERIFICATION ? 'registration' : 'password_reset',
      purpose: dto.purpose,
    })
  }

  async sendEmailLoginCode(dto: SendEmailLoginCodeRequestDto): Promise<void> {
    const email = this.normalizeEmail(dto.email)
    await this.createCodeAndSendAfterCommit({
      email,
      logLabel: 'EMAIL_LOGIN',
      mailPurpose: 'registration',
      purpose: VerificationCodePurpose.EMAIL_VERIFICATION,
    })
  }

  async resendVerification(dto: ResendVerificationRequestDto): Promise<void> {
    const email = this.normalizeEmail(dto.email)
    const user = await this.userAuthRepository.findUserByEmail(email)
    if (!user || user.emailVerified) {
      return
    }

    await this.createCodeAndSendAfterCommit({
      email,
      logLabel: 'verification',
      mailPurpose: 'registration',
      purpose: VerificationCodePurpose.EMAIL_VERIFICATION,
    })
  }

  private async createCodeAndSendAfterCommit(params: {
    email: string
    logLabel: string
    mailPurpose: 'password_reset' | 'registration'
    purpose: VerificationCodePurpose
  }): Promise<void> {
    const code = this.generateVerificationCode()
    await this.userAuthRepository.createVerificationCode({
      email: params.email,
      code,
      purpose: params.purpose,
      expiresAt: this.addMinutes(new Date(), VERIFICATION_CODE_TTL_MINUTES),
    })

    const maskedEmail = this.maskEmail(params.email)
    this.txEvents.afterCommit(async () => {
      await this.mailService.sendVerificationCode(params.email, code, params.mailPurpose)
      this.logger.log(`Sent ${params.logLabel} code to ${maskedEmail}`)
    })
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@')
    if (!domain || localPart.length <= 2) {
      return `***@${domain || '***'}`
    }
    return `${localPart.slice(0, 2)}***@${domain}`
  }

  private generateVerificationCode(): string {
    const appEnv = this.configService.get<string>('app.appEnv')
    const useFixedCode = this.envService.isDev() || appEnv === 'test'

    if (useFixedCode) {
      this.logger.debug('Using fixed verification code for local development/testing')
      return FIXED_VERIFICATION_CODE_FOR_TEST
    }

    const isStaging = appEnv === 'staging'
    const stagingFixedOtpEnabled = isStaging && this.envService.getBoolean('STAGING_FIXED_EMAIL_OTP_ENABLED', false) === true
    if (stagingFixedOtpEnabled) {
      const configuredCode = this.envService.getString('STAGING_FIXED_EMAIL_OTP_CODE')?.trim()
      const fixedCode = /^\d{6}$/.test(configuredCode ?? '')
        ? configuredCode!
        : FIXED_VERIFICATION_CODE_FOR_TEST
      this.logger.warn('Using fixed verification code for staging because STAGING_FIXED_EMAIL_OTP_ENABLED=true')
      return fixedCode
    }

    this.logger.debug('Using random verification code for non-development environments')
    return randomInt(VERIFICATION_CODE_MIN, VERIFICATION_CODE_MAX).toString()
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000)
  }
}
