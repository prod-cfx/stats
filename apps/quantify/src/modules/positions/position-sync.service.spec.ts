import { PositionSyncService } from './position-sync.service'

describe('positionSyncService', () => {
  it('syncs positions through the strategy-bound exchange account', async () => {
    const positionsRepository = {
      findOpenByAccount: jest.fn().mockResolvedValue([]),
      saveSyncLog: jest.fn().mockResolvedValue(undefined),
    }
    const tradingService = {
      getPositions: jest.fn().mockResolvedValue([]),
    }
    const positionsService = {
      recordTrade: jest.fn(),
    }

    const service = new PositionSyncService(
      positionsRepository as any,
      tradingService as any,
      positionsService as any,
    )

    await service.syncUserPositions(
      'user-1',
      'strategy-account-1',
      'okx',
      'perp',
      'auto',
      'account-strategy-detail',
      'exchange-account-1',
    )

    expect(tradingService.getPositions).toHaveBeenCalledWith(
      'user-1',
      'okx',
      'perp',
      'exchange-account-1',
    )
  })

  it('matches perp exchange and local positions by normalized ledger symbol', async () => {
    const positionsRepository = {
      findOpenByAccount: jest.fn().mockResolvedValue([{
        id: 'position-1',
        userStrategyAccountId: 'strategy-account-1',
        symbol: 'BTCUSDT',
        positionSide: 'LONG',
        quantity: '0.01',
        avgEntryPrice: '95000',
        metadata: { market: 'okx:perp' },
      }]),
      saveSyncLog: jest.fn().mockResolvedValue(undefined),
    }
    const tradingService = {
      getPositions: jest.fn().mockResolvedValue([{
        symbol: 'BTC/USDT:PERP',
        side: 'long',
        size: '0.01',
        entryPrice: '95000',
      }]),
    }
    const positionsService = {
      recordTrade: jest.fn(),
    }

    const service = new PositionSyncService(
      positionsRepository as any,
      tradingService as any,
      positionsService as any,
    )

    const result = await service.syncUserPositions(
      'user-1',
      'strategy-account-1',
      'okx',
      'perp',
      'auto',
      'position-sync',
      'exchange-account-1',
    )

    expect(result.differences).toEqual([])
    expect(positionsService.recordTrade).not.toHaveBeenCalled()
  })

  it('does not close spot positions when exchange positions are empty', async () => {
    const positionsRepository = {
      findOpenByAccount: jest.fn().mockResolvedValue([{
        id: 'position-spot-1',
        userStrategyAccountId: 'strategy-account-1',
        symbol: 'BTCUSDT',
        positionSide: 'LONG',
        quantity: '0.0710829',
        avgEntryPrice: '78696.7553',
        exchangeId: 'okx',
        marketType: 'spot',
        metadata: { market: 'okx:spot' },
      }]),
      saveSyncLog: jest.fn().mockResolvedValue(undefined),
    }
    const tradingService = {
      getPositions: jest.fn().mockResolvedValue([]),
    }
    const positionsService = {
      recordTrade: jest.fn(),
    }

    const service = new PositionSyncService(
      positionsRepository as any,
      tradingService as any,
      positionsService as any,
    )

    const result = await service.syncUserPositions(
      'user-1',
      'strategy-account-1',
      'okx',
      'spot',
      'auto',
      'position-sync',
      'exchange-account-1',
    )

    expect(result.differences).toEqual([])
    expect(positionsService.recordTrade).not.toHaveBeenCalled()
  })
})
