/* eslint-disable perfectionist/sort-imports -- auth service imports按职责分组，降低冲突 */
import type { User } from '@/prisma/prisma.types'
import type { LoginRequestDto } from '../dto/requests/login.request.dto'
import type { PasswordResetRequestDto } from '../dto/requests/password-reset.request.dto'
import type { RegisterRequestDto } from '../dto/requests/register.request.dto'
import type { ResendVerificationRequestDto } from '../dto/requests/resend-verification.request.dto'
import type { SendVerificationCodeRequestDto } from '../dto/requests/send-verification-code.request.dto'
import type { SendEmailLoginCodeRequestDto } from '../dto/requests/send-email-login-code.request.dto'
import type { TelegramExchangeRequestDto } from '../dto/requests/telegram-exchange.request.dto'
import type { VerifyEmailRequestDto } from '../dto/requests/verify-email.request.dto'
import type { VerifyEmailLoginCodeRequestDto } from '../dto/requests/verify-email-login-code.request.dto'
import type { VerifyPasswordResetRequestDto } from '../dto/requests/verify-password-reset.request.dto'
import type { AuthResponseDto } from '../dto/responses/auth.response.dto'
import type { UserProfileResponseDto } from '../dto/responses/user-profile.response.dto'
import type { BindEmailRequestDto } from '../dto/requests/bind-email.request.dto'
import type { BindTelegramRequestDto } from '../dto/requests/bind-telegram.request.dto'
import type { CreateTelegramDesktopIntentRequestDto } from '../dto/requests/create-telegram-desktop-intent.request.dto'
import type { TelegramBotWebhookRequestDto } from '../dto/requests/telegram-bot-webhook.request.dto'
import type { TelegramDesktopExchangeRequestDto } from '../dto/requests/telegram-desktop-exchange.request.dto'
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { ErrorCode, PrincipalType, UserCredentialType, VerificationCodePurpose } from '@ai/shared'
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService/JwtService，保留值导入
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Prisma } from '@/prisma/prisma.types'
import { compare, hash } from 'bcrypt'
import { DomainException } from '@/common/exceptions/domain.exception'
import { EnvService } from '@/common/services/env.service'
import { MailService } from '@/common/services/mail.service'
import { CacheService } from '@/common/services/cache.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { BetaCodeService } from '@/modules/beta-code/services/beta-code.service'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionEventsService } from '@/common/services/transaction-events.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { UserAuthRepository } from '../repositories/user-auth.repository'
import {
  EmailAlreadyTakenException,
  InvalidCredentialsException,
  PasswordResetInvalidException,
  VerificationCodeExpiredException,
  VerificationCodeInvalidException,
} from '../exceptions'
import { AppRole } from '../rbac/permissions'

// Prisma 7: 从 Prisma namespace 导出类型和值
/* eslint-disable no-redeclare, ts/no-redeclare */
type PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
/* eslint-enable no-redeclare, ts/no-redeclare */

const PASSWORD_SALT_ROUNDS = 10
const DEFAULT_TOKEN_EXPIRES_SECONDS = 30 * 24 * 60 * 60 // 30 天
const VERIFICATION_CODE_TTL_MINUTES = 15
const FIXED_VERIFICATION_CODE_FOR_TEST = '123456'
const VERIFICATION_CODE_MIN = 100000
const VERIFICATION_CODE_MAX = 1000000
const TELEGRAM_CREDENTIAL_PREFIX = 'telegram:'
const TELEGRAM_PLACEHOLDER_DOMAIN = 'telegram.local'
const TELEGRAM_AUTH_MAX_AGE_SECONDS = 5 * 60
const TELEGRAM_DESKTOP_INTENT_PREFIX = 'tg_login_'
const TELEGRAM_DESKTOP_INTENT_TTL_SECONDS = 5 * 60
const TELEGRAM_BOT_NAME_CACHE_TTL_SECONDS = 60 * 10

interface TelegramDesktopIntentPayload {
  status: 'pending' | 'confirmed'
  intent: 'login' | 'bind'
  lng: 'zh' | 'en'
  redirect: string
  createdAt: number
  telegramId?: string
  firstName?: string
  lastName?: string
  username?: string
  photoUrl?: string
}

@Injectable()
export class UserAuthService {
  private readonly logger = new Logger(UserAuthService.name)
  private readonly tokenExpiresInSeconds: number

  constructor(
    private readonly userAuthRepository: UserAuthRepository,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(MailService) private readonly mailService: MailService,
    @Inject(EnvService) private readonly envService: EnvService,
    @Inject(CacheService) private readonly cacheService: CacheService,
    private readonly txEvents: TransactionEventsService,
    private readonly betaCodeService: BetaCodeService,
  ) {
    this.tokenExpiresInSeconds = this.resolveExpiresInSeconds(
      this.configService.get<string | number>('jwt.expiresIn'),
    )
  }

  async register(dto: RegisterRequestDto): Promise<AuthResponseDto> {
    const email = this.normalizeEmail(dto.email)
    const existingUser = await this.userAuthRepository.findUserByEmail(email)
    if (existingUser) {
      throw new EmailAlreadyTakenException({ email })
    }

    try {
      const passwordHash = await hash(dto.password, PASSWORD_SALT_ROUNDS)
      const now = new Date()
      const user = await this.userAuthRepository.createUser({
        email,
        passwordHash,
        nickname: dto.nickname?.trim() || null,
        emailVerified: true,
        emailVerifiedAt: now,
        isGuest: false,
      })

      await this.userAuthRepository.createUserCredential({
        userId: user.id,
        type: UserCredentialType.email,
        value: email,
      })

      await this.ensureDefaultRoleAssignment(user.id)
      await this.betaCodeService.consumeForNewUser({ betaCode: dto.betaCode, userId: user.id })

      return await this.buildAuthResponse(user, [AppRole.USER])
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new EmailAlreadyTakenException({ email })
      }
      throw error
    }
  }

  async login(dto: LoginRequestDto): Promise<AuthResponseDto> {
    const email = this.normalizeEmail(dto.email)
    const user = await this.userAuthRepository.findUserByEmail(email)
    if (!user) {
      throw new InvalidCredentialsException()
    }
    const passwordValid = await compare(dto.password, user.passwordHash)
    if (!passwordValid) {
      throw new InvalidCredentialsException()
    }
    const roles = await this.getUserRoles(user.id)
    if (roles.length === 0) {
      throw new DomainException('User has no roles assigned', {
        code: ErrorCode.AUTH_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      })
    }
    return this.buildAuthResponse(user, roles)
  }

  async requestPasswordReset(dto: PasswordResetRequestDto): Promise<void> {
    const email = this.normalizeEmail(dto.email)
    const user = await this.userAuthRepository.findUserByEmail(email)
    if (!user) {
      // 防止邮箱枚举攻击：静默返回，不记录任何日志
      return
    }
    const code = this.generateVerificationCode()
    await this.userAuthRepository.createVerificationCode({
      email,
      code,
      purpose: VerificationCodePurpose.PASSWORD_RESET,
      expiresAt: this.addMinutes(new Date(), VERIFICATION_CODE_TTL_MINUTES),
    })

    const maskedEmail = this.maskEmail(email)
    this.txEvents.afterCommit(async () => {
      await this.mailService.sendVerificationCode(email, code, 'password_reset')
      this.logger.log(`Sent password reset code to ${maskedEmail}`)
    })
  }

  async verifyPasswordReset(dto: VerifyPasswordResetRequestDto): Promise<void> {
    const email = this.normalizeEmail(dto.email)
    await this.verifyAndConsumeCode(email, dto.code, VerificationCodePurpose.PASSWORD_RESET)
    const user = await this.userAuthRepository.findUserByEmail(email)
    if (!user) {
      throw new PasswordResetInvalidException({ email })
    }
    const passwordHash = await hash(dto.newPassword, PASSWORD_SALT_ROUNDS)
    await this.userAuthRepository.updateUser(user.id, {
      passwordHash,
      tokenVersion: { increment: 1 },
    })
  }

  async verifyEmail(dto: VerifyEmailRequestDto): Promise<void> {
    const email = this.normalizeEmail(dto.email)
    await this.verifyAndConsumeCode(email, dto.code, VerificationCodePurpose.EMAIL_VERIFICATION)
    await this.userAuthRepository.updateUsersByEmail(email, {
      emailVerified: dto.updateUserStatus ?? true,
      emailVerifiedAt: new Date(),
    })
  }

  async sendVerificationCode(dto: SendVerificationCodeRequestDto): Promise<void> {
    const email = this.normalizeEmail(dto.email)

    // 针对注册场景：检查邮箱是否已注册
    if (dto.purpose === VerificationCodePurpose.EMAIL_VERIFICATION) {
      const existingUser = await this.userAuthRepository.findUserByEmail(email)
      if (existingUser) {
        throw new EmailAlreadyTakenException({ email })
      }
    }

    // 针对密码重置场景：检查用户是否存在
    if (dto.purpose === VerificationCodePurpose.PASSWORD_RESET) {
      const user = await this.userAuthRepository.findUserByEmail(email)
      if (!user) {
        // 防止邮箱枚举攻击：静默返回，不记录任何日志
        return
      }
    }

    const code = this.generateVerificationCode()
    await this.userAuthRepository.createVerificationCode({
      email,
      code,
      purpose: dto.purpose,
      expiresAt: this.addMinutes(new Date(), VERIFICATION_CODE_TTL_MINUTES),
    })

    // 邮件发送属于外部 I/O，移到事务提交后执行，避免长时间持锁
    const purpose = dto.purpose === VerificationCodePurpose.EMAIL_VERIFICATION ? 'registration' : 'password_reset'
    const maskedEmail = this.maskEmail(email)
    this.txEvents.afterCommit(async () => {
      await this.mailService.sendVerificationCode(email, code, purpose)
      this.logger.log(`Sent ${dto.purpose} code to ${maskedEmail}`)
    })
  }

  async sendEmailLoginCode(dto: SendEmailLoginCodeRequestDto): Promise<void> {
    const email = this.normalizeEmail(dto.email)
    const code = this.generateVerificationCode()

    await this.userAuthRepository.createVerificationCode({
      email,
      code,
      purpose: VerificationCodePurpose.EMAIL_VERIFICATION,
      expiresAt: this.addMinutes(new Date(), VERIFICATION_CODE_TTL_MINUTES),
    })

    const maskedEmail = this.maskEmail(email)
    this.txEvents.afterCommit(async () => {
      await this.mailService.sendVerificationCode(email, code, 'registration')
      this.logger.log(`Sent EMAIL_LOGIN code to ${maskedEmail}`)
    })
  }

  async getTelegramLoginConfig(): Promise<{ botName: string | null }> {
    const botName = await this.resolveTelegramBotName()
    return { botName }
  }

  async getTelegramWebAuthorizeUrl(payload: {
    intent: 'login' | 'bind'
    lng: 'zh' | 'en'
    redirect?: string
  }): Promise<{ authorizeUrl: string }> {
    const botId = this.resolveTelegramBotId()
    const frontUrl = this.resolveFrontendUrl()
    const frontOrigin = new URL(frontUrl).origin
    const callbackUrl = this.buildTelegramCallbackUrl({
      frontUrl,
      source: 'web',
      intent: payload.intent,
      lng: payload.lng,
      redirect: this.normalizeAuthRedirect(payload.redirect, payload.lng),
    })

    const query = new URLSearchParams({
      bot_id: botId,
      origin: frontOrigin,
      request_access: 'write',
      return_to: callbackUrl,
    })

    return {
      authorizeUrl: `https://oauth.telegram.org/auth?${query.toString()}`,
    }
  }

  async createTelegramDesktopIntent(dto: CreateTelegramDesktopIntentRequestDto): Promise<{
    intentId: string
    deepLink: string
    webLink: string
    callbackUrl: string
    expiresInSeconds: number
  }> {
    const botName = await this.resolveTelegramBotName()
    if (!botName) {
      throw new DomainException('Telegram login bot is not configured', {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      })
    }

    const frontUrl = this.resolveFrontendUrl()
    const intent = dto.intent === 'bind' ? 'bind' : 'login'
    const lng = dto.lng === 'en' ? 'en' : 'zh'
    const intentId = randomBytes(16).toString('hex')
    const startParam = `${TELEGRAM_DESKTOP_INTENT_PREFIX}${intentId}`

    const payload: TelegramDesktopIntentPayload = {
      status: 'pending',
      intent,
      lng,
      redirect: this.normalizeAuthRedirect(dto.redirect, lng),
      createdAt: Date.now(),
    }

    await this.cacheService.set(this.telegramDesktopIntentCacheKey(intentId), payload, TELEGRAM_DESKTOP_INTENT_TTL_SECONDS)

    const callbackUrl = this.buildTelegramCallbackUrl({
      frontUrl,
      source: 'desktop',
      intent,
      lng,
      desktopIntentId: intentId,
      redirect: payload.redirect,
    })
    return {
      intentId,
      deepLink: `tg://resolve?domain=${botName}&start=${startParam}`,
      webLink: `https://t.me/${botName}?start=${startParam}`,
      callbackUrl,
      expiresInSeconds: TELEGRAM_DESKTOP_INTENT_TTL_SECONDS,
    }
  }

  async getTelegramDesktopIntentStatus(intentId: string): Promise<{ status: 'pending' | 'confirmed' | 'expired' }> {
    const payload = await this.cacheService.get<TelegramDesktopIntentPayload>(this.telegramDesktopIntentCacheKey(intentId))
    if (!payload) {
      return { status: 'expired' }
    }
    return { status: payload.status }
  }

  async telegramDesktopExchange(dto: TelegramDesktopExchangeRequestDto): Promise<AuthResponseDto> {
    const payload = await this.readTelegramDesktopIntent(dto.intentId, 'login')
    const telegramId = payload.telegramId!
    const credentialValue = this.buildTelegramCredentialValue(telegramId)

    const credential = await this.userAuthRepository.findUserCredential(credentialValue)

    if (credential?.user) {
      const roles = await this.getUserRoles(credential.user.id)
      if (roles.length > 0) {
        const response = await this.buildAuthResponse(credential.user, roles)
        await this.deleteTelegramDesktopIntent(dto.intentId)
        return response
      }
      await this.ensureDefaultRoleAssignment(credential.user.id)
      const latestRoles = await this.getUserRoles(credential.user.id)
      const response = await this.buildAuthResponse(credential.user, latestRoles)
      await this.deleteTelegramDesktopIntent(dto.intentId)
      return response
    }

    const placeholderEmail = this.buildTelegramPlaceholderEmail(telegramId)
    const user = await this.createUserWithEmail(placeholderEmail, {
      nickname: payload.username || payload.firstName || `tg_${telegramId.slice(0, 6)}`,
    })
    await this.betaCodeService.consumeForNewUser({ betaCode: dto.betaCode, userId: user.id })

    await this.userAuthRepository.createUserCredential({
      userId: user.id,
      type: UserCredentialType.email,
      value: credentialValue,
    })

    const roles = await this.getUserRoles(user.id)
    const response = await this.buildAuthResponse(user, roles)
    await this.deleteTelegramDesktopIntent(dto.intentId)
    return response
  }

  async bindTelegramByDesktopIntent(userId: string, dto: TelegramDesktopExchangeRequestDto): Promise<AuthResponseDto> {
    const payload = await this.readTelegramDesktopIntent(dto.intentId, 'bind')
    const credentialValue = this.buildTelegramCredentialValue(payload.telegramId!)

    const existing = await this.userAuthRepository.findUserCredential(credentialValue)

    if (existing && existing.userId !== userId) {
      throw new DomainException('Telegram account already bound', {
        code: ErrorCode.AUTH_FORBIDDEN,
        status: HttpStatus.CONFLICT,
      })
    }

    if (!existing) {
      await this.userAuthRepository.createUserCredential({
        userId,
        type: UserCredentialType.email,
        value: credentialValue,
      })
    }

    const user = await this.userAuthRepository.findUserByIdOrThrow(userId)
    const roles = await this.getUserRoles(userId)
    const response = await this.buildAuthResponse(user, roles)
    await this.deleteTelegramDesktopIntent(dto.intentId)
    return response
  }

  async handleTelegramBotWebhook(dto: TelegramBotWebhookRequestDto, secretToken?: string): Promise<void> {
    this.verifyTelegramBotWebhookSecret(secretToken)

    const message = dto.message || dto.edited_message
    if (!message || typeof message !== 'object') return

    const text = typeof message.text === 'string' ? message.text.trim() : ''
    if (!text.startsWith('/start')) return

    const startParam = text.slice('/start'.length).trim()
    const chat = message.chat as { id?: number } | undefined
    const from = message.from as {
      id?: number
      first_name?: string
      last_name?: string
      username?: string
      photo_url?: string
    } | undefined

    const chatId = chat?.id
    if (!chatId) return

    const intentId = this.parseTelegramDesktopIntentId(startParam)
    if (!intentId || !from?.id) {
      await this.sendTelegramMessage(chatId, '请从 Coinflux 登录页重新发起 Telegram 登录。')
      return
    }

    const cacheKey = this.telegramDesktopIntentCacheKey(intentId)
    const payload = await this.cacheService.get<TelegramDesktopIntentPayload>(cacheKey)

    if (!payload || payload.status !== 'pending') {
      await this.sendTelegramMessage(chatId, '该登录请求已失效，请返回 Coinflux 页面重新发起。')
      return
    }

    const updated: TelegramDesktopIntentPayload = {
      ...payload,
      status: 'confirmed',
      telegramId: String(from.id),
      firstName: from.first_name,
      lastName: from.last_name,
      username: from.username,
      photoUrl: from.photo_url,
    }

    await this.cacheService.set(cacheKey, updated, TELEGRAM_DESKTOP_INTENT_TTL_SECONDS)

    const frontUrl = this.resolveFrontendUrl()
    const callbackUrl = this.buildTelegramCallbackUrl({
      frontUrl,
      source: 'desktop',
      intent: payload.intent,
      lng: payload.lng,
      desktopIntentId: intentId,
      redirect: payload.redirect,
    })
    const messageText = payload.lng === 'en'
      ? `Authorization confirmed. Click to continue:\n${callbackUrl}`
      : `授权成功，请点击继续登录：\n${callbackUrl}`
    await this.sendTelegramMessage(chatId, messageText)
  }

  async verifyEmailLoginCode(dto: VerifyEmailLoginCodeRequestDto): Promise<AuthResponseDto> {
    const email = this.normalizeEmail(dto.email)

    await this.verifyAndConsumeCode(email, dto.code, VerificationCodePurpose.EMAIL_VERIFICATION)

    let user = await this.userAuthRepository.findUserByEmail(email)
    if (!user) {
      user = await this.createUserWithEmail(email)
      await this.betaCodeService.consumeForNewUser({ betaCode: dto.betaCode, userId: user.id })
    } else if (!user.emailVerified) {
      user = await this.userAuthRepository.updateUser(user.id, {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      })
    }

    const roles = await this.getUserRoles(user.id)
    if (roles.length === 0) {
      await this.ensureDefaultRoleAssignment(user.id)
    }
    const latestRoles = roles.length > 0 ? roles : await this.getUserRoles(user.id)

    return this.buildAuthResponse(user, latestRoles)
  }

  async telegramExchange(dto: TelegramExchangeRequestDto): Promise<AuthResponseDto> {
    const telegramId = dto.telegramId.trim()
    this.verifyTelegramLoginPayload(dto)
    const credentialValue = this.buildTelegramCredentialValue(telegramId)

    const credential = await this.userAuthRepository.findUserCredential(credentialValue)

    if (credential?.user) {
      const roles = await this.getUserRoles(credential.user.id)
      if (roles.length > 0) {
        return this.buildAuthResponse(credential.user, roles)
      }
      await this.ensureDefaultRoleAssignment(credential.user.id)
      const latestRoles = await this.getUserRoles(credential.user.id)
      return this.buildAuthResponse(credential.user, latestRoles)
    }

    const placeholderEmail = this.buildTelegramPlaceholderEmail(telegramId)
    const user = await this.createUserWithEmail(placeholderEmail, {
      nickname: `tg_${telegramId.slice(0, 6)}`,
    })
    await this.betaCodeService.consumeForNewUser({ betaCode: dto.betaCode, userId: user.id })

    await this.userAuthRepository.createUserCredential({
      userId: user.id,
      type: UserCredentialType.email,
      value: credentialValue,
    })

    const roles = await this.getUserRoles(user.id)
    return this.buildAuthResponse(user, roles)
  }

  async bindEmail(userId: string, dto: BindEmailRequestDto): Promise<AuthResponseDto> {
    const email = this.normalizeEmail(dto.email)

    await this.verifyAndConsumeCode(email, dto.code, VerificationCodePurpose.EMAIL_VERIFICATION)

    const existing = await this.userAuthRepository.findUserByEmail(email)
    if (existing && existing.id !== userId) {
      throw new EmailAlreadyTakenException({ email })
    }

    await this.userAuthRepository.updateUser(userId, {
      email,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    })

    const existingEmailCredential = await this.userAuthRepository.findUserCredentialByUserAndValue(userId, email)

    if (!existingEmailCredential) {
      await this.userAuthRepository.createUserCredential({
        userId,
        type: UserCredentialType.email,
        value: email,
      })
    }

    const user = await this.userAuthRepository.findUserByIdOrThrow(userId)
    const roles = await this.getUserRoles(userId)
    return this.buildAuthResponse(user, roles)
  }

  async bindTelegram(userId: string, dto: BindTelegramRequestDto): Promise<AuthResponseDto> {
    this.verifyTelegramLoginPayload({
      telegramId: dto.telegramId,
      authDate: dto.authDate,
      hash: dto.hash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      username: dto.username,
      photoUrl: dto.photoUrl,
      source: undefined,
    })

    const credentialValue = this.buildTelegramCredentialValue(dto.telegramId.trim())

    const existing = await this.userAuthRepository.findUserCredential(credentialValue)

    if (existing && existing.userId !== userId) {
      throw new DomainException('Telegram account already bound', {
        code: ErrorCode.AUTH_FORBIDDEN,
        status: HttpStatus.CONFLICT,
      })
    }

    if (!existing) {
      await this.userAuthRepository.createUserCredential({
        userId,
        type: UserCredentialType.email,
        value: credentialValue,
      })
    }

    const user = await this.userAuthRepository.findUserByIdOrThrow(userId)
    const roles = await this.getUserRoles(userId)
    return this.buildAuthResponse(user, roles)
  }

  async resendVerification(dto: ResendVerificationRequestDto): Promise<void> {
    const email = this.normalizeEmail(dto.email)
    const user = await this.userAuthRepository.findUserByEmail(email)
    if (!user || user.emailVerified) {
      // 静默返回，不记录任何日志（避免泄露用户状态）
      return
    }
    const code = this.generateVerificationCode()
    await this.userAuthRepository.createVerificationCode({
      email,
      code,
      purpose: VerificationCodePurpose.EMAIL_VERIFICATION,
      expiresAt: this.addMinutes(new Date(), VERIFICATION_CODE_TTL_MINUTES),
    })
    // 邮件发送属于外部 I/O，移到事务提交后执行
    const maskedEmail = this.maskEmail(email)
    this.txEvents.afterCommit(async () => {
      await this.mailService.sendVerificationCode(email, code, 'registration')
      this.logger.log(`Sent verification code to ${maskedEmail}`)
    })
  }

  private async ensureDefaultRoleAssignment(userId: string) {
    const userRole = await this.userAuthRepository.findRoleByCode(AppRole.USER)
    if (!userRole) {
      throw new DomainException('Default user role is missing', {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      })
    }

    await this.userAuthRepository.createRoleAssignment({
      principalId: userId,
      principalType: PrincipalType.USER,
      roleId: userRole.id,
    })
  }

  private async getUserRoles(userId: string): Promise<string[]> {
    const assignments = await this.userAuthRepository.findRoleAssignments(userId)
    return assignments.map(item => item.role.code)
  }

  private async verifyAndConsumeCode(
    email: string,
    code: string,
    purpose: VerificationCodePurpose,
  ) {
    // 先查找验证码记录（不加锁，仅用于验证过期时间）
    const record = await this.userAuthRepository.findVerificationCode({ email, code, purpose })
    if (!record) {
      throw new VerificationCodeInvalidException({ email })
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new VerificationCodeExpiredException({ email })
    }

    // 使用 updateMany + consumedAt: null 条件确保原子性，防止并发重复消费
    const updateCount = await this.userAuthRepository.consumeVerificationCode(record.id)

    // 如果更新条数为 0，说明验证码已被其他并发请求消费
    if (updateCount === 0) {
      throw new VerificationCodeInvalidException({ email })
    }

    return record
  }

  private async buildAuthResponse(user: User, roles: string[]): Promise<AuthResponseDto> {
    const payload = {
      sub: user.id,
      email: user.email,
      roles,
      principalType: 'user' as const,
      tokenVersion: user.tokenVersion, // 用于密码重置后使旧 token 失效
    }
    const accessToken = await this.jwtService.signAsync(payload)
    const profile: UserProfileResponseDto = {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      isGuest: user.isGuest,
      roles,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
    return {
      accessToken,
      user: profile,
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  private verifyTelegramLoginPayload(dto: TelegramExchangeRequestDto): void {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN')?.trim()
    if (!botToken) {
      throw new DomainException('Telegram bot token is not configured', {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      })
    }

    const authDate = Number(dto.authDate)
    if (!Number.isFinite(authDate)) {
      throw new DomainException('Invalid Telegram auth_date', {
        code: ErrorCode.AUTH_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const now = Math.floor(Date.now() / 1000)
    if (now - authDate > TELEGRAM_AUTH_MAX_AGE_SECONDS) {
      throw new DomainException('Telegram login data expired', {
        code: ErrorCode.AUTH_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const checkPairs: Array<[string, string]> = [
      ['auth_date', dto.authDate],
      ['id', dto.telegramId],
    ]

    if (dto.firstName) checkPairs.push(['first_name', dto.firstName])
    if (dto.lastName) checkPairs.push(['last_name', dto.lastName])
    if (dto.username) checkPairs.push(['username', dto.username])
    if (dto.photoUrl) checkPairs.push(['photo_url', dto.photoUrl])

    checkPairs.sort(([a], [b]) => a.localeCompare(b))
    const dataCheckString = checkPairs.map(([k, v]) => `${k}=${v}`).join('\n')

    const secret = createHash('sha256').update(botToken).digest()
    const expectedHash = createHmac('sha256', secret).update(dataCheckString).digest('hex')
    const providedHash = dto.hash.toLowerCase()

    const expectedBuffer = Buffer.from(expectedHash, 'utf8')
    const providedBuffer = Buffer.from(providedHash, 'utf8')
    const valid =
      expectedBuffer.length === providedBuffer.length &&
      timingSafeEqual(expectedBuffer, providedBuffer)

    if (!valid) {
      throw new DomainException('Invalid Telegram login signature', {
        code: ErrorCode.AUTH_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
  }

  private buildTelegramCredentialValue(telegramId: string): string {
    return `${TELEGRAM_CREDENTIAL_PREFIX}${telegramId}`
  }

  private telegramDesktopIntentCacheKey(intentId: string): string {
    return `auth:telegram:desktop:intent:${intentId}`
  }

  private parseTelegramDesktopIntentId(startParam: string): string | null {
    if (!startParam.startsWith(TELEGRAM_DESKTOP_INTENT_PREFIX)) {
      return null
    }
    const intentId = startParam.slice(TELEGRAM_DESKTOP_INTENT_PREFIX.length).trim()
    if (!/^[a-f0-9]{16,64}$/i.test(intentId)) {
      return null
    }
    return intentId
  }

  private verifyTelegramBotWebhookSecret(secretToken?: string): void {
    const configured = this.configService.get<string>('TELEGRAM_BOT_WEBHOOK_SECRET')?.trim()
    if (!configured) {
      return
    }
    if (configured !== (secretToken || '').trim()) {
      throw new DomainException('Invalid telegram webhook secret', {
        code: ErrorCode.AUTH_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
  }

  private async readTelegramDesktopIntent(
    intentId: string,
    expectedIntent: 'login' | 'bind',
  ): Promise<TelegramDesktopIntentPayload> {
    const cacheKey = this.telegramDesktopIntentCacheKey(intentId)
    const payload = await this.cacheService.get<TelegramDesktopIntentPayload>(cacheKey)
    if (!payload) {
      throw new DomainException('Telegram desktop login intent expired', {
        code: ErrorCode.AUTH_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
    if (payload.intent !== expectedIntent) {
      throw new DomainException('Telegram desktop login intent mismatch', {
        code: ErrorCode.AUTH_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      })
    }
    if (payload.status !== 'confirmed' || !payload.telegramId) {
      throw new DomainException('Telegram desktop login is not confirmed', {
        code: ErrorCode.AUTH_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
    return payload
  }

  private async deleteTelegramDesktopIntent(intentId: string): Promise<void> {
    await this.cacheService.del(this.telegramDesktopIntentCacheKey(intentId))
  }

  private async sendTelegramMessage(chatId: number, text: string): Promise<void> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN')?.trim()
    if (!botToken) return

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
      })
    } catch (error) {
      this.logger.warn(`Failed to send Telegram bot message: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async resolveTelegramBotName(): Promise<string | null> {
    const configuredName = this.configService.get<string>('TELEGRAM_LOGIN_BOT_NAME')?.trim()
    if (configuredName) {
      return configuredName.startsWith('@') ? configuredName.slice(1) : configuredName
    }

    const cachedName = await this.cacheService.get<string>('auth:telegram:bot-name')
    if (cachedName) return cachedName

    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN')?.trim()
    if (!botToken) return null

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
      const data = await response.json().catch(() => ({})) as {
        ok?: boolean
        result?: { username?: string }
      }
      const username = data?.result?.username?.trim()
      if (!response.ok || !data.ok || !username) {
        this.logger.warn(`Failed to resolve Telegram bot name from getMe: status=${response.status}`)
        return null
      }
      await this.cacheService.set('auth:telegram:bot-name', username, TELEGRAM_BOT_NAME_CACHE_TTL_SECONDS)
      return username
    } catch (error) {
      this.logger.warn(`Failed to resolve Telegram bot name: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }

  private resolveTelegramBotId(): string {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN')?.trim()
    const match = /^(\d+):/.exec(botToken || '')
    if (!match) {
      throw new DomainException('Telegram bot token is invalid', {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      })
    }
    return match[1]
  }

  private resolveFrontendUrl(): string {
    const fromEnv = this.configService.get<string>('FRONTEND_URL')?.trim()
    if (fromEnv) return fromEnv.replace(/\/$/, '')
    return 'http://localhost:3001'
  }

  private normalizeAuthRedirect(redirect: string | undefined, lng: 'zh' | 'en'): string {
    if (!redirect) return `/${lng}/account`
    if (!redirect.startsWith('/') || redirect.startsWith('//')) return `/${lng}/account`
    return redirect
  }

  private buildTelegramCallbackUrl(input: {
    frontUrl: string
    source: 'web' | 'desktop'
    intent: 'login' | 'bind'
    lng: 'zh' | 'en'
    desktopIntentId?: string
    redirect: string
  }): string {
    const callbackUrl = new URL(`${input.frontUrl}/${input.lng}/auth/telegram/callback`)
    callbackUrl.searchParams.set('source', input.source)
    callbackUrl.searchParams.set('intent', input.intent)
    callbackUrl.searchParams.set('redirect', input.redirect)
    if (input.desktopIntentId) {
      callbackUrl.searchParams.set('desktop_intent', input.desktopIntentId)
    }
    return callbackUrl.toString()
  }

  private buildTelegramPlaceholderEmail(telegramId: string): string {
    const sanitized = telegramId.replace(/\W/g, '').slice(0, 64) || 'user'
    return `tg_${sanitized}@${TELEGRAM_PLACEHOLDER_DOMAIN}`
  }

  private async createUserWithEmail(
    email: string,
    options?: {
      nickname?: string | null
    },
  ) {
    const passwordHash = await hash(`${email}:${Date.now()}`, PASSWORD_SALT_ROUNDS)
    const now = new Date()

    const user = await this.userAuthRepository.createUser({
      email,
      passwordHash,
      nickname: options?.nickname?.trim() || null,
      emailVerified: true,
      emailVerifiedAt: now,
      isGuest: false,
    })

    await this.userAuthRepository.createUserCredential({
      userId: user.id,
      type: UserCredentialType.email,
      value: email,
    })

    await this.ensureDefaultRoleAssignment(user.id)
    return user
  }

  /**
   * 邮箱脱敏：保留前 2 位和域名，中间打码
   * 例如：user@example.com -> us***@example.com
   */
  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@')
    if (!domain || localPart.length <= 2) {
      return `***@${  domain || '***'}`
    }
    return `${localPart.slice(0, 2)}***@${domain}`
  }

  private generateVerificationCode(): string {
    // 仅在本地开发和单元测试环境使用固定验证码
    // staging/e2e/production 等环境使用随机验证码以保证安全性
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

  private resolveExpiresInSeconds(value?: string | number | null): number {
    if (!value) return DEFAULT_TOKEN_EXPIRES_SECONDS
    if (typeof value === 'number') return value
    const match = /^(\d+)([smhd])?$/.exec(value.trim())
    if (!match) return DEFAULT_TOKEN_EXPIRES_SECONDS
    const amount = Number(match[1])
    const unit = match[2] ?? 's'
    switch (unit) {
      case 's':
        return amount
      case 'm':
        return amount * 60
      case 'h':
        return amount * 60 * 60
      case 'd':
        return amount * 24 * 60 * 60
      default:
        return DEFAULT_TOKEN_EXPIRES_SECONDS
    }
  }

}
