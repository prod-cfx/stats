import { ErrorCode } from '@ai/shared'
import { InvalidCredentialsException } from '@/modules/trading/exceptions/invalid-credentials.exception'
import { Prisma } from '@/prisma/prisma.types'
import { ExchangeAccountsService } from './exchange-accounts.service'

describe('exchangeAccountsService', () => {
  function createService() {
    const repo = {
      findUserById: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'user-1@example.com',
      }),
      findUserByEmail: jest.fn().mockResolvedValue(null),
      updateUserEmail: jest.fn().mockResolvedValue(undefined),
      createUser: jest.fn().mockResolvedValue(undefined),
      findExchangeAccountFirst: jest.fn().mockResolvedValue(null),
      findExchangeAccountsByUser: jest.fn().mockResolvedValue([]),
      createExchangeAccount: jest.fn().mockResolvedValue({
        id: 'account-1',
        exchangeId: 'hyperliquid',
        name: 'HL',
        isTestnet: true,
        lastValidatedAt: new Date('2026-03-19T00:00:00.000Z'),
        createdAt: new Date('2026-03-19T00:00:00.000Z'),
      }),
      updateExchangeAccount: jest.fn().mockResolvedValue({
        id: 'account-1',
        exchangeId: 'binance',
        name: 'Updated Binance',
        isTestnet: false,
        lastValidatedAt: new Date('2026-03-20T00:00:00.000Z'),
        createdAt: new Date('2026-03-19T00:00:00.000Z'),
      }),
      deleteExchangeAccount: jest.fn().mockResolvedValue(undefined),
      pauseActiveLlmSubscriptions: jest.fn().mockResolvedValue({ count: 0 }),
    }

    const crypto = {
      encryptConfig: jest.fn().mockReturnValue('encrypted-config'),
      decryptConfig: jest.fn().mockReturnValue({
        apiKey: 'okx-valid-key',
        secret: 'okx-valid-secret',
        passphrase: 'okx-valid-passphrase',
      }),
    }
    const tradingService = {
      validateCexCredentials: jest.fn().mockResolvedValue(true),
    }

    const service = new ExchangeAccountsService(
      repo as any,
      crypto as any,
      tradingService as any,
    )

    return { service, repo, crypto, tradingService }
  }

  it('validates hyperliquid credentials with the requested spot market type', async () => {
    const { service, tradingService } = createService()

    await service.create('user-1', {
      userId: 'user-1',
      userEmail: 'user-1@example.com',
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
    const { service, repo, tradingService } = createService()
    repo.createExchangeAccount.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.4.2',
      }),
    )
    repo.findExchangeAccountFirst.mockResolvedValue({
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
      userEmail: 'user-1@example.com',
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
    expect(repo.updateExchangeAccount).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({
        name: 'Updated Binance',
        encryptedConfig: 'encrypted-config',
      }),
    )
    expect(repo.createExchangeAccount).toHaveBeenCalled()
  })

  it('keeps existing binding unchanged when revalidation fails during update', async () => {
    const { service, repo, tradingService } = createService()
    repo.findExchangeAccountFirst.mockResolvedValue({
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
      userEmail: 'user-1@example.com',
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

    expect(repo.updateExchangeAccount).not.toHaveBeenCalled()
    expect(repo.createExchangeAccount).not.toHaveBeenCalled()
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
      userEmail: 'user-1@example.com',
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
    const { service, repo } = createService()
    repo.findExchangeAccountFirst.mockResolvedValue({
      id: 'account-1',
      exchangeId: 'binance',
    })

    await service.delete('user-1', 'binance')

    expect(repo.findExchangeAccountFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', exchangeId: 'binance' },
      }),
    )
    expect(repo.deleteExchangeAccount).toHaveBeenCalledWith('account-1')
  })

  it('creates a quantify user mirror before first successful binding', async () => {
    const { service, repo } = createService()
    repo.findUserById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    repo.findUserByEmail.mockResolvedValue(null)

    await service.create('user-1', {
      userId: 'user-1',
      userEmail: 'user-1@example.com',
      exchangeId: 'okx',
      apiKey: 'valid-key',
      apiSecret: 'valid-secret',
      passphrase: 'valid-passphrase',
      marketType: 'spot',
    })

    expect(repo.createUser).toHaveBeenCalledWith({
      id: 'user-1',
      email: 'user-1@example.com',
    })
  })

  it('keeps the latest record when duplicate exchange data exists', async () => {
    const { service, repo } = createService()
    repo.findExchangeAccountsByUser.mockResolvedValue([
      {
        id: 'new-okx',
        exchangeId: 'okx',
        name: 'Newest OKX',
        isTestnet: true,
        encryptedConfig: 'encrypted-new',
        lastValidatedAt: new Date('2026-03-20T00:00:00.000Z'),
        createdAt: new Date('2026-03-20T00:00:00.000Z'),
      },
      {
        id: 'old-okx',
        exchangeId: 'okx',
        name: 'Old OKX',
        isTestnet: false,
        encryptedConfig: 'encrypted-old',
        lastValidatedAt: new Date('2026-03-19T00:00:00.000Z'),
        createdAt: new Date('2026-03-19T00:00:00.000Z'),
      },
    ])

    await expect(service.list('user-1')).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'new-okx',
        exchangeId: 'okx',
        name: 'Newest OKX',
      }),
    ]))
  })
})
