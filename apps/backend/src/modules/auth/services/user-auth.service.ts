import type { User } from '@prisma/client'
import type { LoginRequestDto } from '../dto/requests/login.request.dto'
import type { PasswordResetRequestDto } from '../dto/requests/password-reset.request.dto'
import type { RegisterRequestDto } from '../dto/requests/register.request.dto'
import type { ResendVerificationRequestDto } from '../dto/requests/resend-verification.request.dto'
import type { SendVerificationCodeRequestDto } from '../dto/requests/send-verification-code.request.dto'
import type { VerifyEmailRequestDto } from '../dto/requests/verify-email.request.dto'
import type { VerifyPasswordResetRequestDto } from '../dto/requests/verify-password-reset.request.dto'
import type { AuthResponseDto } from '../dto/responses/auth.response.dto'
import type { UserProfileResponseDto } from '../dto/responses/user.profile.response.dto'
import { randomInt } from 'node:crypto'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService/JwtService，保留值导入
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { PrincipalType, Prisma, UserCredentialType, VerificationCodePurpose } from '@prisma/client'
import { compare, hash } from 'bcrypt'
import { DomainException } from '@/common/exceptions/domain.exception'
import { EnvService } from '@/common/services/env.service'
import { MailService } from '@/common/services/mail.service'
import { PrismaService } from '@/prisma/prisma.service'
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

@Injectable()
export class UserAuthService {
  private readonly logger = new Logger(UserAuthService.name)
  private readonly tokenExpiresInSeconds: number

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(MailService) private readonly mailService: MailService,
    @Inject(EnvService) private readonly envService: EnvService,
  ) {
    this.tokenExpiresInSeconds = this.resolveExpiresInSeconds(
      this.configService.get<string | number>('jwt.expiresIn'),
    )
  }

  async register(dto: RegisterRequestDto): Promise<AuthResponseDto> {
    const email = this.normalizeEmail(dto.email)
    const prismaClient = this.prisma.getClient()
    const existingUser = await prismaClient.user.findUnique({ where: { email } })
    if (existingUser) {
      throw new EmailAlreadyTakenException({ email })
    }

    try {
      return await this.prisma.runInTransaction(async tx => {
        const passwordHash = await hash(dto.password, PASSWORD_SALT_ROUNDS)
        const now = new Date()
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            nickname: dto.nickname?.trim() || null,
            emailVerified: true,
            emailVerifiedAt: now,
            isGuest: false,
          },
        })

        await tx.userCredential.create({
          data: {
            userId: user.id,
            type: UserCredentialType.email,
            value: email,
          },
        })

        await this.ensureDefaultRoleAssignment(tx, user.id)

        return this.buildAuthResponse(user, [AppRole.USER])
      })
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new EmailAlreadyTakenException({ email })
      }
      throw error
    }
  }

  async login(dto: LoginRequestDto): Promise<AuthResponseDto> {
    const email = this.normalizeEmail(dto.email)
    const prismaClient = this.prisma.getClient()
    const user = await prismaClient.user.findUnique({ where: { email } })
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
    const prismaClient = this.prisma.getClient()
    const user = await prismaClient.user.findUnique({ where: { email } })
    if (!user) {
      // 防止邮箱枚举攻击：静默返回，不记录任何日志
      return
    }
    const code = this.generateVerificationCode()
    await prismaClient.verificationCode.create({
      data: {
        email,
        code,
        purpose: VerificationCodePurpose.PASSWORD_RESET,
        expiresAt: this.addMinutes(new Date(), VERIFICATION_CODE_TTL_MINUTES),
      },
    })

    // 发送验证码邮件
    await this.mailService.sendVerificationCode(email, code, 'password_reset')
    this.logger.log(`Sent password reset code to ${this.maskEmail(email)}`)
  }

  async verifyPasswordReset(dto: VerifyPasswordResetRequestDto): Promise<void> {
    const email = this.normalizeEmail(dto.email)
    await this.prisma.runInTransaction(async tx => {
      await this.verifyAndConsumeCode(tx, email, dto.code, VerificationCodePurpose.PASSWORD_RESET)
      const user = await tx.user.findUnique({ where: { email } })
      if (!user) {
        throw new PasswordResetInvalidException({ email })
      }
      const passwordHash = await hash(dto.newPassword, PASSWORD_SALT_ROUNDS)
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      })
    })
  }

  async verifyEmail(dto: VerifyEmailRequestDto): Promise<void> {
    const email = this.normalizeEmail(dto.email)
    await this.prisma.runInTransaction(async tx => {
      await this.verifyAndConsumeCode(tx, email, dto.code, VerificationCodePurpose.EMAIL_VERIFICATION)
      await tx.user.updateMany({
        where: { email },
        data: {
          emailVerified: dto.updateUserStatus ?? true,
          emailVerifiedAt: new Date(),
        },
      })
    })
  }

  async sendVerificationCode(dto: SendVerificationCodeRequestDto): Promise<void> {
    const email = this.normalizeEmail(dto.email)
    const prismaClient = this.prisma.getClient()

    // 针对注册场景：检查邮箱是否已注册
    if (dto.purpose === VerificationCodePurpose.EMAIL_VERIFICATION) {
      const existingUser = await prismaClient.user.findUnique({ where: { email } })
      if (existingUser) {
        throw new EmailAlreadyTakenException({ email })
      }
    }

    // 针对密码重置场景：检查用户是否存在
    if (dto.purpose === VerificationCodePurpose.PASSWORD_RESET) {
      const user = await prismaClient.user.findUnique({ where: { email } })
      if (!user) {
        // 防止邮箱枚举攻击：静默返回，不记录任何日志
        return
      }
    }

    const code = this.generateVerificationCode()
    await prismaClient.verificationCode.create({
      data: {
        email,
        code,
        purpose: dto.purpose,
        expiresAt: this.addMinutes(new Date(), VERIFICATION_CODE_TTL_MINUTES),
      },
    })

    // 发送验证码邮件
    const purpose = dto.purpose === VerificationCodePurpose.EMAIL_VERIFICATION ? 'registration' : 'password_reset'
    await this.mailService.sendVerificationCode(email, code, purpose)
    this.logger.log(`Sent ${dto.purpose} code to ${this.maskEmail(email)}`)
  }

  async resendVerification(dto: ResendVerificationRequestDto): Promise<void> {
    const email = this.normalizeEmail(dto.email)
    const prismaClient = this.prisma.getClient()
    const user = await prismaClient.user.findUnique({ where: { email } })
    if (!user || user.emailVerified) {
      // 静默返回，不记录任何日志（避免泄露用户状态）
      return
    }
    const code = this.generateVerificationCode()
    await prismaClient.verificationCode.create({
      data: {
        email,
        code,
        purpose: VerificationCodePurpose.EMAIL_VERIFICATION,
        expiresAt: this.addMinutes(new Date(), VERIFICATION_CODE_TTL_MINUTES),
      },
    })
    // 发送验证码邮件
    await this.mailService.sendVerificationCode(email, code, 'registration')
    this.logger.log(`Sent verification code to ${this.maskEmail(email)}`)
  }

  private async ensureDefaultRoleAssignment(tx: Prisma.TransactionClient, userId: string) {
    const userRole = await tx.role.findUnique({
      where: { code: AppRole.USER },
      select: { id: true },
    })
    if (!userRole) {
      throw new DomainException('Default user role is missing', {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      })
    }

    await tx.roleAssignment.create({
      data: {
        principalId: userId,
        principalType: PrincipalType.USER,
        roleId: userRole.id,
      },
    })
  }

  private async getUserRoles(userId: string): Promise<string[]> {
    const prismaClient = this.prisma.getClient()
    const assignments = await prismaClient.roleAssignment.findMany({
      where: {
        principalId: userId,
        principalType: PrincipalType.USER,
      },
      include: { role: { select: { code: true } } },
    })
    return assignments.map(item => item.role.code)
  }

  private async verifyAndConsumeCode(
    tx: Prisma.TransactionClient,
    email: string,
    code: string,
    purpose: VerificationCodePurpose,
  ) {
    // 先查找验证码记录（不加锁，仅用于验证过期时间）
    const record = await tx.verificationCode.findFirst({
      where: {
        email,
        code,
        purpose,
        consumedAt: null, // 只查找未消费的记录
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!record) {
      throw new VerificationCodeInvalidException({ email })
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new VerificationCodeExpiredException({ email })
    }

    // 使用 updateMany + consumedAt: null 条件确保原子性，防止并发重复消费
    const now = new Date()
    const updateResult = await tx.verificationCode.updateMany({
      where: {
        id: record.id,
        consumedAt: null, // 关键条件：只更新未消费的记录
      },
      data: { consumedAt: now },
    })

    // 如果更新条数为 0，说明验证码已被其他并发请求消费
    if (updateResult.count === 0) {
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
    const useFixedCode = this.envService.isDev() ||
      (this.configService.get<string>('app.appEnv') === 'test')

    if (useFixedCode) {
      this.logger.debug('Using fixed verification code for local development/testing')
      return FIXED_VERIFICATION_CODE_FOR_TEST
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
