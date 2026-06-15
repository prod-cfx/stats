import type { User } from '@/prisma/prisma.types'
import { VerificationCodePurpose } from '@ai/shared'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { EnvService } from '@/common/services/env.service'
import { MailService } from '@/common/services/mail.service'
import { TransactionEventsService } from '@/common/services/transaction-events.service'
import { EmailAlreadyTakenException } from '../exceptions'
import { UserAuthRepository } from '../repositories/user-auth.repository'
import { VerificationCodeService } from './verification-code.service'

type RepositoryMock = Pick<
  jest.Mocked<UserAuthRepository>,
  'createVerificationCode' | 'findUserByEmail'
>

interface TestContext {
  service: VerificationCodeService
  repository: RepositoryMock
  mailService: jest.Mocked<Pick<MailService, 'sendVerificationCode'>>
  txEvents: jest.Mocked<Pick<TransactionEventsService, 'afterCommit'>>
}

describe('VerificationCodeService', () => {
  async function createContext(options?: { isDev?: boolean, appEnv?: string }): Promise<TestContext> {
    const repository: RepositoryMock = {
      createVerificationCode: jest.fn().mockResolvedValue(undefined),
      findUserByEmail: jest.fn().mockResolvedValue(null),
    }
    const mailService = {
      sendVerificationCode: jest.fn().mockResolvedValue(undefined),
    }
    const txEvents = {
      afterCommit: jest.fn(),
    }

    const module = await Test.createTestingModule({
      providers: [
        VerificationCodeService,
        { provide: UserAuthRepository, useValue: repository },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => {
              if (key === 'app.appEnv') return options?.appEnv ?? 'test'
              return fallback
            }),
          } satisfies Partial<ConfigService>,
        },
        {
          provide: EnvService,
          useValue: {
            getBoolean: jest.fn((_key: string, fallback: boolean) => fallback),
            getString: jest.fn(() => undefined),
            isDev: jest.fn(() => options?.isDev ?? true),
          } satisfies Partial<EnvService>,
        },
        { provide: MailService, useValue: mailService },
        { provide: TransactionEventsService, useValue: txEvents },
      ],
    }).compile()

    return {
      service: module.get(VerificationCodeService),
      repository,
      mailService,
      txEvents,
    }
  }

  it('creates registration verification code and sends registration mail after commit', async () => {
    const { service, repository, mailService, txEvents } = await createContext()

    await service.sendVerificationCode({
      email: 'User@Example.com',
      purpose: VerificationCodePurpose.EMAIL_VERIFICATION,
    })

    expect(repository.findUserByEmail).toHaveBeenCalledWith('user@example.com')
    expect(repository.createVerificationCode).toHaveBeenCalledWith({
      email: 'user@example.com',
      code: '123456',
      purpose: VerificationCodePurpose.EMAIL_VERIFICATION,
      expiresAt: expect.any(Date),
    })
    expect(txEvents.afterCommit).toHaveBeenCalledTimes(1)

    const [callback] = txEvents.afterCommit.mock.calls[0]
    await callback()

    expect(mailService.sendVerificationCode).toHaveBeenCalledWith('user@example.com', '123456', 'registration')
  })

  it('rejects registration verification code when email already exists', async () => {
    const { service, repository, txEvents } = await createContext()
    repository.findUserByEmail.mockResolvedValue(createUser({ email: 'taken@example.com' }))

    await expect(service.sendVerificationCode({
      email: 'taken@example.com',
      purpose: VerificationCodePurpose.EMAIL_VERIFICATION,
    })).rejects.toBeInstanceOf(EmailAlreadyTakenException)

    expect(repository.createVerificationCode).not.toHaveBeenCalled()
    expect(txEvents.afterCommit).not.toHaveBeenCalled()
  })

  it('silently returns when requesting password reset for missing email', async () => {
    const { service, repository, mailService, txEvents } = await createContext()
    repository.findUserByEmail.mockResolvedValue(null)

    await service.requestPasswordReset({ email: 'missing@example.com' })

    expect(repository.createVerificationCode).not.toHaveBeenCalled()
    expect(txEvents.afterCommit).not.toHaveBeenCalled()
    expect(mailService.sendVerificationCode).not.toHaveBeenCalled()
  })

  it('creates email login code and sends registration mail after commit', async () => {
    const { service, repository, mailService, txEvents } = await createContext()

    await service.sendEmailLoginCode({ email: 'Login@Example.com' })

    expect(repository.createVerificationCode).toHaveBeenCalledWith({
      email: 'login@example.com',
      code: '123456',
      purpose: VerificationCodePurpose.EMAIL_VERIFICATION,
      expiresAt: expect.any(Date),
    })
    expect(txEvents.afterCommit).toHaveBeenCalledTimes(1)

    const [callback] = txEvents.afterCommit.mock.calls[0]
    await callback()

    expect(mailService.sendVerificationCode).toHaveBeenCalledWith('login@example.com', '123456', 'registration')
  })
})

function createUser(overrides: Partial<User> = {}): User {
  const now = new Date('2026-01-01T00:00:00.000Z')
  return {
    avatarUrl: null,
    bio: null,
    createdAt: now,
    email: 'user@example.com',
    emailVerified: false,
    emailVerifiedAt: null,
    id: 'user-1',
    invitationCode: null,
    inviterId: null,
    isGuest: false,
    nickname: null,
    passwordHash: 'hash',
    tokenVersion: 0,
    updatedAt: now,
    ...overrides,
  }
}
