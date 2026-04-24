import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import {
  BetaCodeDisabledException,
  BetaCodeExhaustedException,
  BetaCodeInvalidException,
  BetaCodeRequiredException,
} from '../exceptions'
import { BetaAccessCodeRepository } from '../repositories/beta-code.repository'
import { BetaCodeService } from './beta-code.service'

describe('BetaCodeService', () => {
  let service: BetaCodeService
  let repository: jest.Mocked<BetaAccessCodeRepository>

  const activeCode = {
    id: 'code-1',
    code: 'ABC123',
    maxUses: 2,
    usedCount: 1,
    isActive: true,
    createdByAdminId: 'admin-1',
    createdAt: new Date('2026-04-24T00:00:00.000Z'),
    updatedAt: new Date('2026-04-24T00:00:00.000Z'),
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BetaCodeService,
        {
          provide: BetaAccessCodeRepository,
          useValue: {
            count: jest.fn(),
            findMany: jest.fn(),
            createMany: jest.fn(),
            findByCode: jest.fn(),
            incrementUsedCountIfAvailable: jest.fn(),
            createRedemption: jest.fn(),
            updateUserInvitationCode: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get(BetaCodeService)
    repository = module.get(BetaAccessCodeRepository)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  function expectDomainError(error: unknown, code: ErrorCode, status: HttpStatus): void {
    expect(error).toMatchObject({ code })
    expect((error as { getStatus: () => number }).getStatus()).toBe(status)
  }

  async function expectRejectsWith(
    promise: Promise<unknown>,
    exception: new (...args: never[]) => Error,
    code: ErrorCode,
    status: HttpStatus,
  ): Promise<void> {
    let thrown: unknown
    try {
      await promise
    }
    catch (error: unknown) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(exception)
    expectDomainError(thrown, code, status)
  }

  describe('consumeForNewUser', () => {
    it('throws required when a new user has no beta code', async () => {
      await expectRejectsWith(
        service.consumeForNewUser({ betaCode: undefined, userId: 'user-1' }),
        BetaCodeRequiredException,
        ErrorCode.BETA_CODE_REQUIRED,
        HttpStatus.BAD_REQUEST,
      )

      expect(repository.findByCode).not.toHaveBeenCalled()
    })

    it('throws invalid when the code does not exist', async () => {
      repository.findByCode.mockResolvedValue(null)

      await expectRejectsWith(
        service.consumeForNewUser({ betaCode: 'missing1', userId: 'user-1' }),
        BetaCodeInvalidException,
        ErrorCode.BETA_CODE_INVALID,
        HttpStatus.BAD_REQUEST,
      )

      expect(repository.findByCode).toHaveBeenCalledWith('MISSING1')
      expect(repository.incrementUsedCountIfAvailable).not.toHaveBeenCalled()
    })

    it('throws disabled before consuming inactive code', async () => {
      repository.findByCode.mockResolvedValue({ ...activeCode, isActive: false })

      await expectRejectsWith(
        service.consumeForNewUser({ betaCode: 'abc123', userId: 'user-1' }),
        BetaCodeDisabledException,
        ErrorCode.BETA_CODE_DISABLED,
        HttpStatus.FORBIDDEN,
      )

      expect(repository.incrementUsedCountIfAvailable).not.toHaveBeenCalled()
    })

    it('throws exhausted when no uses remain', async () => {
      repository.findByCode.mockResolvedValue({ ...activeCode, usedCount: 2, maxUses: 2 })

      await expectRejectsWith(
        service.consumeForNewUser({ betaCode: 'abc123', userId: 'user-1' }),
        BetaCodeExhaustedException,
        ErrorCode.BETA_CODE_EXHAUSTED,
        HttpStatus.CONFLICT,
      )

      expect(repository.incrementUsedCountIfAvailable).not.toHaveBeenCalled()
    })

    it('increments, records redemption, and stores invitation code on success', async () => {
      repository.findByCode.mockResolvedValue(activeCode)
      repository.incrementUsedCountIfAvailable.mockResolvedValue(1)
      repository.createRedemption.mockResolvedValue({
        id: 'redemption-1',
        codeId: activeCode.id,
        userId: 'user-1',
        createdAt: new Date('2026-04-24T00:00:00.000Z'),
      })

      await service.consumeForNewUser({ betaCode: ' abc123 ', userId: 'user-1' })

      expect(repository.findByCode).toHaveBeenCalledWith('ABC123')
      expect(repository.incrementUsedCountIfAvailable).toHaveBeenCalledWith(activeCode.id)
      expect(repository.createRedemption).toHaveBeenCalledWith({
        codeId: activeCode.id,
        userId: 'user-1',
      })
      expect(repository.updateUserInvitationCode).toHaveBeenCalledWith('user-1', 'ABC123')
    })

    it('maps a lost conditional update race to exhausted', async () => {
      repository.findByCode.mockResolvedValue(activeCode)
      repository.incrementUsedCountIfAvailable.mockResolvedValue(0)

      await expectRejectsWith(
        service.consumeForNewUser({ betaCode: 'abc123', userId: 'user-1' }),
        BetaCodeExhaustedException,
        ErrorCode.BETA_CODE_EXHAUSTED,
        HttpStatus.CONFLICT,
      )

      expect(repository.createRedemption).not.toHaveBeenCalled()
      expect(repository.updateUserInvitationCode).not.toHaveBeenCalled()
    })
  })
})
