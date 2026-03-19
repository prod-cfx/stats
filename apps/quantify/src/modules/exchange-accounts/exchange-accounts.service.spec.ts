import { ExchangeAccountsService } from './exchange-accounts.service'

describe('exchangeAccountsService', () => {
  function createService() {
    const prisma = {
      exchangeAccount: {
        create: jest.fn().mockResolvedValue({
          id: 'account-1',
          exchangeId: 'hyperliquid',
          name: 'HL',
          isTestnet: true,
          lastValidatedAt: new Date('2026-03-19T00:00:00.000Z'),
          createdAt: new Date('2026-03-19T00:00:00.000Z'),
        }),
      },
    }
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
})
