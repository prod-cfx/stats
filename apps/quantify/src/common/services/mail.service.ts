import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'
import { EmailFailedException } from '@/common/exceptions/email-failed.exception'

const MOCK_ENVIRONMENTS = new Set(['development', 'staging', 'test', 'e2e'])
const MAX_TEST_EMAIL_RECORDS = 50

export interface SendMailOptions {
  to: string
  subject: string
  text?: string
  html?: string
}

interface StoredEmailRecord {
  to: string
  subject: string
  html: string
  text?: string
  timestamp: Date
}

@Injectable()
export class MailService {
  private static resendClient: Resend | null = null

  private readonly logger = new Logger(MailService.name)
  private readonly appEnv: string
  private readonly isMockEnvironment: boolean
  private readonly useMockEmail: boolean
  private readonly storeTestEmails: boolean
  private readonly fromEmail: string
  private readonly fromName: string
  private readonly emailStats = { sent: 0, failed: 0 }
  private readonly testEmailStorage: StoredEmailRecord[] = []
  private readonly resend?: Resend

  constructor(
    // Nest 娉ㄥ叆闇€瑕佽繍琛屾椂寮曠敤 ConfigService
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    this.appEnv = this.configService.get<string>('app.appEnv', 'development')!
    this.isMockEnvironment = MOCK_ENVIRONMENTS.has(this.appEnv)
    this.storeTestEmails = this.appEnv === 'test' || this.appEnv === 'e2e'
    this.fromEmail = this.configService.get<string>('EMAIL_FROM', 'noreply@example.com')
    this.fromName = this.configService.get<string>('EMAIL_FROM_NAME', 'AI Platform')

    const apiKey = this.configService.get<string>('RESEND_API_KEY')?.trim()
    if (!apiKey && !this.isMockEnvironment) {
      throw new Error('RESEND_API_KEY is required outside mock environments')
    }

    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY 鏈厤缃紝閭欢灏嗕互妯℃嫙妯″紡鍙戦€?)
    }

    const shouldMock = this.isMockEnvironment || !apiKey
    this.useMockEmail = shouldMock

    if (!shouldMock && apiKey) {
      if (!MailService.resendClient) {
        MailService.resendClient = new Resend(apiKey)
      }
      this.resend = MailService.resendClient
    }
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    if (!options.html && !options.text) {
      throw new EmailFailedException({ recipient: options.to, reason: 'Missing email content' })
    }

    if (this.shouldMockSend()) {
      this.logMockEmail(options)
      this.recordTestEmail(options)
      this.emailStats.sent++
      return
    }

    try {
      this.logger.log(`Sending email to ${this.maskEmail(options.to)} via Resend`)
      const { error } = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [options.to],
        subject: options.subject,
        html: options.html ?? this.wrapPlainText(options.text!),
        text: options.text,
      })

      if (error) {
        this.logger.error(`Resend API error: ${error.message}`)
        this.emailStats.failed++
        throw new EmailFailedException({ recipient: options.to, reason: error.message })
      }

      this.emailStats.sent++
    } catch (error) {
      this.emailStats.failed++
      const reason = error instanceof Error ? error.message : 'unknown error'
      this.logger.error(`Failed to send email to ${this.maskEmail(options.to)}: ${reason}`)
      throw new EmailFailedException({ recipient: options.to, reason })
    }
  }

  async sendVerificationCode(email: string, code: string, purpose: 'registration' | 'password_reset'): Promise<void> {
    const isRegistration = purpose === 'registration'
    const subject = isRegistration ? 'Verify your email address' : 'Reset your password'
    const normalizedCode = code.trim()
    const html = this.buildVerificationHtml({
      heading: isRegistration ? 'Welcome!' : 'Password Reset Request',
      bodyIntro: isRegistration
        ? 'Thank you for registering. Please verify your email by entering the verification code below:'
        : 'We received a request to reset your password. Enter the following code to proceed:',
      code: normalizedCode,
      footer: isRegistration
        ? 'If you did not create an account, please ignore this email.'
        : 'If you did not request a password reset, please ignore this email.',
    })

    const text = this.buildVerificationText({
      greeting: isRegistration ? 'Welcome!' : 'Password Reset Request',
      intro: isRegistration
        ? 'Thank you for registering. Please verify your email by entering the verification code below:'
        : 'We received a request to reset your password. Enter the following code to proceed:',
      code: normalizedCode,
      footer: isRegistration
        ? 'If you did not create an account, please ignore this email.'
        : 'If you did not request a password reset, please ignore this email.',
    })

    await this.sendMail({
      to: email,
      subject,
      html,
      text,
    })
  }

  getEmailMetrics() {
    const total = this.emailStats.sent + this.emailStats.failed
    const successRate = total > 0 ? (this.emailStats.sent / total) * 100 : 0
    return {
      sent: this.emailStats.sent,
      failed: this.emailStats.failed,
      total,
      successRate: `${successRate.toFixed(2)}%`,
    }
  }

  getTestEmails(): StoredEmailRecord[] {
    if (!this.storeTestEmails) {
      throw new Error('getTestEmails 浠呭彲鍦ㄦ祴璇曠幆澧冧笅浣跨敤')
    }
    return [...this.testEmailStorage]
  }

  clearTestEmails(): void {
    if (!this.storeTestEmails) {
      throw new Error('clearTestEmails 浠呭彲鍦ㄦ祴璇曠幆澧冧笅浣跨敤')
    }
    this.testEmailStorage.length = 0
  }

  findTestEmailByRecipient(email: string): StoredEmailRecord[] {
    if (!this.storeTestEmails) {
      throw new Error('findTestEmailByRecipient 浠呭彲鍦ㄦ祴璇曠幆澧冧笅浣跨敤')
    }
    return this.testEmailStorage.filter(record => record.to === email)
  }

  extractVerificationCodeFromEmail(emailHtml: string): string | null {
    if (!this.storeTestEmails) {
      throw new Error('extractVerificationCodeFromEmail 浠呭彲鍦ㄦ祴璇曠幆澧冧笅浣跨敤')
    }
    const match = emailHtml.match(/>(\d{6})</)
    return match ? match[1] : null
  }

  private shouldMockSend(): boolean {
    return this.useMockEmail || !this.resend
  }

  private logMockEmail(options: SendMailOptions) {
    this.logger.log(
      `[${this.appEnv}] (mock) Email to ${this.maskEmail(options.to)} | Subject: ${options.subject}`,
    )
  }

  private recordTestEmail(options: SendMailOptions) {
    if (!this.storeTestEmails) return
    this.testEmailStorage.push({
      to: options.to,
      subject: options.subject,
      html: options.html ?? this.wrapPlainText(options.text || ''),
      text: options.text,
      timestamp: new Date(),
    })
    if (this.testEmailStorage.length > MAX_TEST_EMAIL_RECORDS) {
      this.testEmailStorage.splice(0, this.testEmailStorage.length - MAX_TEST_EMAIL_RECORDS)
    }
  }

  private wrapPlainText(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
    return `<pre style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;">${escaped}</pre>`
  }

  private buildVerificationHtml(options: { heading: string; bodyIntro: string; code: string; footer: string }) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color: #111827;">${options.heading}</h2>
        <p style="color: #374151;">${options.bodyIntro}</p>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px;">
          <span style="font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #111827;">${options.code}</span>
        </div>
        <p style="color: #4b5563;">This code will expire in 15 minutes.</p>
        <p style="color: #4b5563;">${options.footer}</p>
        <p style="color: #4b5563;">Best regards,<br>${this.fromName} Team</p>
      </div>
    `
  }

  private buildVerificationText(options: { greeting: string; intro: string; code: string; footer: string }) {
    return `${options.greeting}

${options.intro}

${options.code}

This code will expire in 15 minutes.

${options.footer}

Best regards,
${this.fromName} Team`
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@')
    if (!domain) return '***'
    if (!local || local.length <= 2) return `***@${domain}`
    return `${local.slice(0, 2)}***@${domain}`
  }
}
