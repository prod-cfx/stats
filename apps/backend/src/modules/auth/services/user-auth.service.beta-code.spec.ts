import type { User } from '@/prisma/prisma.types'
import type { TelegramExchangeRequestDto } from '../dto/requests/telegram-exchange.request.dto'
import type { VerifyEmailLoginCodeRequestDto } from '../dto/requests/verify-email-login-code.request.dto'
import { createHash, createHmac } from 'node:crypto'
import { UserCredentialType } from '@ai/shared'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import { CacheService } from '@/common/services/cache.service'
import { EnvService } from '@/common/services/env.service'
import { MailService } from '@/common/services/mail.service'
import { TransactionEventsService } from '@/common/services/transaction-events.service'
import { BetaCodeService } from '@/modules/beta-code/services/beta-code.service'
import { AppRole } from '../rbac/permissions'
import { UserAuthRepository } from '../repositories/user-auth.repository'
import { UserAuthService } from './user-auth.service'

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(async () => 'hashed-password'),
}))

type AuthRepositoryMock = Pick<
  jest.Mocked<UserAuthRepository>,
  | 'consumeVerificationCode'
  | 'createRoleAssignment'
  | 'createUser'
  | 'createUserCredential'
  | 'findRoleAssignments'
  | 'findRoleByCode'
  | 'findUserByEmail'
  | 'findUserCredential'
  | 'findVerificationCode'
  | 'updateUser'
>

interface TestContext {
  service: UserAuthService
  repository: AuthRepositoryMock
  betaCodeService: jest.Mocked<Pick<BetaCodeService, 'consumeForNewUser'>>
  cacheService: jest.Mocked<Pick<CacheService, 'del' | 'get'>>
}

const BOT_TOKEN = '123456:test-token'

describe('UserAuthService beta code creation flows', () => {
  async function createContext(): Promise<TestContext> {
    const repository: AuthRepositoryMock = {
      consumeVerificationCode: jest.fn().mockResolvedValue(1),
      createRoleAssignment: jest.fn().mockResolvedValue(undefined),
      createUser: jest.fn(),
      createUserCredential: jest.fn().mockResolvedValue(undefined),
      findRoleAssignments: jest.fn().mockResolvedValue([{ role: { code: AppRole.USER } }]),
      findRoleByCode: jest.fn().mockResolvedValue({ id: 'role-user' }),
      findUserByEmail: jest.fn(),
      findUserCredential: jest.fn(),
      findVerificationCode: jest.fn().mockResolvedValue({
        id: 'verification-code-1',
        expiresAt: new Date(Date.now() + 60_000),
      }),
      updateUser: jest.fn(),
    }
    const betaCodeService = {
      consumeForNewUser: jest.fn().mockResolvedValue(undefined),
    }
    const cacheService = {
      del: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
    }

    const module = await Test.createTestingModule({
      providers: [
        UserAuthService,
        { provide: UserAuthRepository, useValue: repository },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('access-token') } satisfies Partial<JwtService>,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => {
              if (key === 'TELEGRAM_BOT_TOKEN') return BOT_TOKEN
              if (key === 'jwt.expiresIn') return fallback ?? '30d'
              return fallback
            }),
          } as unknown as ConfigService,
        },
        { provide: MailService, useValue: {} satisfies Partial<MailService> },
        { provide: EnvService, useValue: { isDev: jest.fn(() => true) } satisfies Partial<EnvService> },
        { provide: CacheService, useValue: cacheService },
        { provide: TransactionEventsService, useValue: { afterCommit: jest.fn() } satisfies Partial<TransactionEventsService> },
        { provide: BetaCodeService, useValue: betaCodeService },
      ],
    }).compile()

    return {
      service: module.get(UserAuthService),
      repository,
      betaCodeService,
      cacheService,
    }
  }

  it('consumes beta code when email OTP creates a new user', async () => {
    const { service, repository, betaCodeService } = await createContext()
    const user = createUser({ id: 'user-new-email', email: 'new@example.com' })
    repository.findUserByEmail.mockResolvedValue(null)
    repository.createUser.mockResolvedValue(user)

    await service.verifyEmailLoginCode({
      email: 'new@example.com',
      code: '123456',
      betaCode: 'BETA1',
    } as VerifyEmailLoginCodeRequestDto & { betaCode: string })

    expect(betaCodeService.consumeForNewUser).toHaveBeenCalledWith({
      betaCode: 'BETA1',
      userId: 'user-new-email',
    })
  })

  it('consumes beta code when password registration creates a new user', async () => {
    const { service, repository, betaCodeService } = await createContext()
    repository.findUserByEmail.mockResolvedValue(null)
    repository.createUser.mockResolvedValue(createUser({ id: 'user-register', email: 'register@example.com' }))

    await service.register({
      email: 'register@example.com',
      password: 'password123',
      betaCode: 'BETA1',
    })

    expect(betaCodeService.consumeForNewUser).toHaveBeenCalledWith({
      betaCode: 'BETA1',
      userId: 'user-register',
    })
  })

  it('does not consume beta code when email OTP logs in an existing user', async () => {
    const { service, repository, betaCodeService } = await createContext()
    repository.findUserByEmail.mockResolvedValue(createUser({ id: 'user-existing-email', email: 'old@example.com' }))

    await service.verifyEmailLoginCode({
      email: 'old@example.com',
      code: '123456',
    })

    expect(betaCodeService.consumeForNewUser).not.toHaveBeenCalled()
  })

  it('consumes beta code when Telegram exchange creates a new user', async () => {
    const { service, repository, betaCodeService } = await createContext()
    repository.findUserCredential.mockResolvedValue(null)
    repository.createUser.mockResolvedValue(createUser({ id: 'user-new-telegram', email: 'tg_123456@telegram.local' }))

    await service.telegramExchange(createTelegramExchangeDto({
      telegramId: '123456',
      betaCode: 'BETA1',
    }))

    expect(betaCodeService.consumeForNewUser).toHaveBeenCalledWith({
      betaCode: 'BETA1',
      userId: 'user-new-telegram',
    })
  })

  it('does not consume beta code when Telegram exchange finds an existing credential', async () => {
    const { service, repository, betaCodeService } = await createContext()
    const user = createUser({ id: 'user-existing-telegram', email: 'old-tg@example.com' })
    repository.findUserCredential.mockResolvedValue(createCredential(user, 'telegram:123456', 'credential-1'))

    await service.telegramExchange(createTelegramExchangeDto({ telegramId: '123456' }))

    expect(betaCodeService.consumeForNewUser).not.toHaveBeenCalled()
  })

  it('consumes beta code when Telegram desktop exchange creates a new user', async () => {
    const { service, repository, betaCodeService, cacheService } = await createContext()
    cacheService.get.mockResolvedValue({
      status: 'confirmed',
      intent: 'login',
      lng: 'zh',
      redirect: '/zh/account',
      createdAt: Date.now(),
      telegramId: '654321',
    })
    repository.findUserCredential.mockResolvedValue(null)
    repository.createUser.mockResolvedValue(createUser({ id: 'user-new-desktop', email: 'tg_654321@telegram.local' }))

    await service.telegramDesktopExchange({
      intentId: 'intent-1',
      betaCode: 'BETA2',
    } as { intentId: string, betaCode: string })

    expect(betaCodeService.consumeForNewUser).toHaveBeenCalledWith({
      betaCode: 'BETA2',
      userId: 'user-new-desktop',
    })
  })

  it('does not consume beta code when Telegram desktop exchange finds an existing credential', async () => {
    const { service, repository, betaCodeService, cacheService } = await createContext()
    const user = createUser({ id: 'user-existing-desktop', email: 'desktop-tg@example.com' })
    cacheService.get.mockResolvedValue({
      status: 'confirmed',
      intent: 'login',
      lng: 'zh',
      redirect: '/zh/account',
      createdAt: Date.now(),
      telegramId: '654321',
    })
    repository.findUserCredential.mockResolvedValue(createCredential(user, 'telegram:654321', 'credential-desktop'))

    await service.telegramDesktopExchange({ intentId: 'intent-1' })

    expect(betaCodeService.consumeForNewUser).not.toHaveBeenCalled()
  })
})

function createUser(overrides: Pick<User, 'email' | 'id'> & Partial<User>): User {
  return {
    avatarUrl: null,
    bio: null,
    createdAt: new Date(),
    emailVerified: true,
    emailVerifiedAt: new Date(),
    id: overrides.id,
    email: overrides.email,
    invitationCode: null,
    inviterId: null,
    isGuest: false,
    nickname: null,
    passwordHash: 'hashed-password',
    tokenVersion: 0,
    updatedAt: new Date(),
    ...overrides,
  } as User
}

function createCredential(
  user: User,
  value: string,
  id: string,
): Awaited<ReturnType<UserAuthRepository['findUserCredential']>> {
  return {
    id,
    userId: user.id,
    type: UserCredentialType.email,
    value,
    createdAt: new Date(),
    user,
  }
}

function createTelegramExchangeDto(input: {
  betaCode?: string
  telegramId: string
}): TelegramExchangeRequestDto & { betaCode?: string } {
  const authDate = Math.floor(Date.now() / 1000).toString()
  const dataCheckString = [
    ['auth_date', authDate],
    ['id', input.telegramId],
  ].map(([key, value]) => `${key}=${value}`).join('\n')
  const secret = createHash('sha256').update(BOT_TOKEN).digest()
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex')

  return {
    telegramId: input.telegramId,
    authDate,
    hash,
    betaCode: input.betaCode,
  }
}
