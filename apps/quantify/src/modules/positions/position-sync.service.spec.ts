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
})
