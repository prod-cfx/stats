import { ErrorCode } from '@ai/shared'
import { InvalidCredentialsException } from '@/modules/trading/exceptions/invalid-credentials.exception'
import { Prisma } from '@/prisma/prisma.types'
import { ExchangeAccountsService } from './exchange-accounts.service'

describe('exchangeAccountsService', () => {
  function createService() {
    const prisma = {
      getClient: jest.fn(),
      exchangeAccount: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 'account-1',
          exchangeId: 'hyperliquid',
          name: 'HL',
          isTestnet: true,
          lastValidatedAt: new Date('2026-03-19T00:00:00.000Z'),
          createdAt: new Date('2026-03-19T00:00:00.000Z'),
        }),
        update: jest.fn().mockResolvedValue({
          id: 'account-1',
          exchangeId: 'binance',
          name: 'Updated Binance',
          isTestnet: false,
          lastValidatedAt: new Date('2026-03-20T00:00:00.000Z'),
          createdAt: new Date('2026-03-19T00:00:00.000Z'),
        }),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    }
    prisma.getClient.mockReturnValue(prisma)
    const crypto = {
      encryptConfig: jest.fn().mockReturnValue('encrypted-config'),
    }
    const tradingService = {
      validateCexCredentials: jest.fn().mockResolvedValue(true),
    }

    const service = new ExchangeAccountsService(
      prisma as any,
      crypto as any,
      tradingService as any,
    )

    return { service, prisma, crypto, tradingService }
  }

  it('validates hyperliquid credentials with the requested spot market type', async () => {
    const { service, tradingService } = createService()

    await service.create('user-1', {
      userId: 'user-1',
      exchangeId: 'hyperliquid',
      marketType: 'spot',
      name: 'HL spot',
      isTestnet: true,
      mainWalletAddress: '0x1234567890123456789012345678901234567890',
      agentPrivateKey: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    })

    expect(tradingService.validateCexCredentials).toHaveBeenCalledWith(
      'hyperliquid',
      'spot',
      expect.objectContaining({
        mainWalletAddress: '0x1234567890123456789012345678901234567890',
        isTestnet: true,
      }),
    )
  })

  it('returns fixed exchange status items for binance okx hyperliquid when user has no bindings', async () => {
    const { service } = createService()

    await expect(service.list('user-1')).resolves.toEqual([
      {
        id: null,
        exchangeId: 'binance',
        name: null,
        isBound: false,
        maskedCredential: null,
        isTestnet: null,
        lastValidatedAt: null,
        createdAt: null,
      },
      {
        id: null,
        exchangeId: 'okx',
        name: null,
        isBound: false,
        maskedCredential: null,
        isTestnet: null,
        lastValidatedAt: null,
        createdAt: null,
      },
      {
        id: null,
        exchangeId: 'hyperliquid',
        name: null,
        isBound: false,
        maskedCredential: null,
        isTestnet: null,
        lastValidatedAt: null,
        createdAt: null,
      },
    ])
  })

  it('updates an existing exchange binding after validation succeeds', async () => {
    const { service, prisma, tradingService } = createService()
    prisma.exchangeAccount.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    )
    prisma.exchangeAccount.findFirst.mockResolvedValue({
      id: 'account-1',
      exchangeId: 'binance',
      encryptedConfig: 'old-encrypted-config',
      name: 'Old Binance',
      isTestnet: false,
      lastValidatedAt: new Date('2026-03-19T00:00:00.000Z'),
      createdAt: new Date('2026-03-19T00:00:00.000Z'),
    })

    await service.create('user-1', {
      userId: 'user-1',
      exchangeId: 'binance',
      apiKey: 'new-valid-key',
      apiSecret: 'new-valid-secret',
      marketType: 'spot',
      name: 'Updated Binance',
    })

    expect(tradingService.validateCexCredentials).toHaveBeenCalledWith(
      'binance',
      'spot',
      expect.objectContaining({
        apiKey: 'new-valid-key',
        secret: 'new-valid-secret',
      }),
    )
    expect(prisma.exchangeAccount.update).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      data: expect.objectContaining({
        name: 'Updated Binance',
        encryptedConfig: 'encrypted-config',
      }),
    })
    expect(prisma.exchangeAccount.create).toHaveBeenCalled()
  })

  it('keeps existing binding unchanged when revalidation fails during update', async () => {
    const { service, prisma, tradingService } = createService()
    prisma.exchangeAccount.findFirst.mockResolvedValue({
      id: 'account-1',
      exchangeId: 'binance',
      encryptedConfig: 'old-encrypted-config',
      name: 'Old Binance',
      isTestnet: false,
      lastValidatedAt: new Date('2026-03-19T00:00:00.000Z'),
      createdAt: new Date('2026-03-19T00:00:00.000Z'),
    })
    tradingService.validateCexCredentials.mockRejectedValue(
      new InvalidCredentialsException({
        exchangeId: 'binance',
        message: 'API Key或Secret错误，请检查是否正确复制（不要有多余空格）',
      }),
    )

    await expect(service.create('user-1', {
      userId: 'user-1',
      exchangeId: 'binance',
      apiKey: 'bad-key',
      apiSecret: 'bad-secret',
      marketType: 'spot',
      name: 'Broken Binance',
    })).rejects.toMatchObject({
      code: ErrorCode.TRADING_INVALID_CREDENTIALS,
      args: expect.objectContaining({
        reasonCode: 'INVALID_API_KEY',
        retryable: false,
      }),
    })

    expect(prisma.exchangeAccount.update).not.toHaveBeenCalled()
    expect(prisma.exchangeAccount.create).not.toHaveBeenCalled()
  })

  it('normalizes credential validation failures into machine-readable args', async () => {
    const { service, tradingService } = createService()
    tradingService.validateCexCredentials.mockRejectedValue(
      new InvalidCredentialsException({
        exchangeId: 'okx',
        message: 'Passphrase错误，请检查创建API Key时设置的密码短语',
      }),
    )

    await expect(service.create('user-1', {
      userId: 'user-1',
      exchangeId: 'okx',
      apiKey: 'valid_key',
      apiSecret: 'valid_secret',
      passphrase: 'wrong_passphrase',
      marketType: 'spot',
    })).rejects.toMatchObject({
      code: ErrorCode.TRADING_INVALID_CREDENTIALS,
      args: expect.objectContaining({
        reasonCode: 'INVALID_PASSPHRASE',
        retryable: false,
        reasonMessage: 'Passphrase错误，请检查创建API Key时设置的密码短语',
      }),
    })
  })

  it('deletes the current user binding by exchangeId', async () => {
    const { service, prisma } = createService()
    prisma.exchangeAccount.findFirst.mockResolvedValue({
      id: 'account-1',
      exchangeId: 'binance',
    })
    const updateMany = jest.fn().mockResolvedValue({ count: 0 })
    prisma.getClient.mockReturnValue({
      exchangeAccount: prisma.exchangeAccount,
      userLlmStrategySubscription: {
        updateMany,
      },
    })

    await service.delete('user-1', 'binance')

    expect(prisma.exchangeAccount.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', exchangeId: 'binance' },
      select: { id: true },
    })
    expect(prisma.exchangeAccount.delete).toHaveBeenCalledWith({
      where: { id: 'account-1' },
    })
  })
})
