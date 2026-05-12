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

  it('ignores non-directional exchange positions during reconciliation', async () => {
    const positionsRepository = {
      findOpenByAccount: jest.fn().mockResolvedValue([]),
      saveSyncLog: jest.fn().mockResolvedValue(undefined),
    }
    const tradingService = {
      getPositions: jest.fn().mockResolvedValue([{
        symbol: 'BTC/USDT:PERP',
        side: 'flat',
        size: '0',
        entryPrice: '0',
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

  it('skips creating missing positions for unassigned net exposure on shared exchange accounts', async () => {
    const positionsRepository = {
      countActiveStrategyBindingsByExchangeAccount: jest.fn().mockResolvedValue(3),
      findTradesByAccount: jest.fn().mockResolvedValue([]),
      findOpenByAccount: jest.fn().mockResolvedValue([]),
      saveSyncLog: jest.fn().mockResolvedValue(undefined),
    }
    const tradingService = {
      getPositions: jest.fn().mockResolvedValue([{
        symbol: 'ETH/USDT:PERP',
        side: 'long',
        size: '1.069',
        entryPrice: '2287.03',
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

    expect(result.differences).toEqual([{
      symbol: 'ETH/USDT:PERP',
      positionSide: 'LONG',
      exchangeQuantity: '1.069',
      localQuantity: '0',
      difference: '1.069',
      action: 'skipped',
    }])
    expect(positionsService.recordTrade).not.toHaveBeenCalled()
  })

  it('loads shared attribution only from trades tagged with the current exchange account', async () => {
    const positionsRepository = {
      countActiveStrategyBindingsByExchangeAccount: jest.fn().mockResolvedValue(3),
      findTradesByAccount: jest.fn().mockResolvedValue([
        {
          symbol: 'ETHUSDT',
          market: 'okx:perp',
          side: 'BUY',
          positionSide: 'LONG',
          quantity: '0.305',
          orderId: 'current-account-trade',
          externalTradeId: 'current-account-trade',
          provider: 'okx',
          metadata: { exchangeAccountId: 'exchange-account-1' },
        },
        {
          symbol: 'ETHUSDT',
          market: 'okx:perp',
          side: 'BUY',
          positionSide: 'LONG',
          quantity: '0.764',
          orderId: 'other-account-trade',
          externalTradeId: 'other-account-trade',
          provider: 'okx',
          metadata: { exchangeAccountId: 'exchange-account-2' },
        },
      ]),
      findOpenByAccount: jest.fn().mockResolvedValue([]),
      saveSyncLog: jest.fn().mockResolvedValue(undefined),
    }
    const tradingService = {
      getPositions: jest.fn().mockResolvedValue([{
        symbol: 'ETH/USDT:PERP',
        side: 'long',
        size: '1.069',
        entryPrice: '2287.03',
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

    expect(result.differences).toEqual([expect.objectContaining({
      action: 'created',
      difference: '0.305',
    })])
    expect(positionsRepository.findTradesByAccount).toHaveBeenCalledWith(
      'strategy-account-1',
      ['ETHUSDT'],
    )
    expect(positionsService.recordTrade).toHaveBeenCalledWith(expect.objectContaining({
      quantity: '0.305',
      metadata: expect.objectContaining({
        exchangeAccountId: 'exchange-account-1',
      }),
    }))
  })

  it('keeps normal reconciliation for non-shared exchange accounts', async () => {
    const positionsRepository = {
      countActiveStrategyBindingsByExchangeAccount: jest.fn().mockResolvedValue(1),
      findTradesByAccount: jest.fn().mockResolvedValue([]),
      findOpenByAccount: jest.fn().mockResolvedValue([]),
      saveSyncLog: jest.fn().mockResolvedValue(undefined),
    }
    const tradingService = {
      getPositions: jest.fn().mockResolvedValue([{
        symbol: 'ETH/USDT:PERP',
        side: 'long',
        size: '1.069',
        entryPrice: '2287.03',
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

    expect(result.differences).toEqual([expect.objectContaining({
      action: 'created',
      exchangeQuantity: '1.069',
    })])
    expect(positionsService.recordTrade).toHaveBeenCalledWith(expect.objectContaining({
      quantity: '1.069',
      metadata: expect.objectContaining({ syncSource: 'position-reconciliation' }),
    }))
  })

  it('keeps spot reconciliation out of shared perp attribution mode', async () => {
    const positionsRepository = {
      countActiveStrategyBindingsByExchangeAccount: jest.fn().mockResolvedValue(3),
      findTradesByAccount: jest.fn().mockResolvedValue([]),
      findOpenByAccount: jest.fn().mockResolvedValue([]),
      saveSyncLog: jest.fn().mockResolvedValue(undefined),
    }
    const tradingService = {
      getPositions: jest.fn().mockResolvedValue([{
        symbol: 'BTCUSDT',
        side: 'long',
        size: '0.01',
        entryPrice: '80000',
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
      'spot',
      'auto',
      'position-sync',
      'exchange-account-1',
    )

    expect(result.differences).toEqual([expect.objectContaining({
      action: 'created',
      exchangeQuantity: '0.01',
    })])
    expect(positionsService.recordTrade).toHaveBeenCalledWith(expect.objectContaining({
      market: 'okx:spot',
      quantity: '0.01',
    }))
  })

  it('resolves strategy-bound exchange account for manual sync when it is not passed by the controller', async () => {
    const positionsRepository = {
      findExchangeAccountIdForStrategyAccount: jest.fn().mockResolvedValue('exchange-account-1'),
      countActiveStrategyBindingsByExchangeAccount: jest.fn().mockResolvedValue(3),
      findTradesByAccount: jest.fn().mockResolvedValue([]),
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
      'manual',
      'user-1',
    )

    expect(tradingService.getPositions).toHaveBeenCalledWith(
      'user-1',
      'okx',
      'perp',
      'exchange-account-1',
    )
  })

  it('closes synthetic reconciliation positions on shared exchange accounts when they have no real attributed trades', async () => {
    const positionsRepository = {
      countActiveStrategyBindingsByExchangeAccount: jest.fn().mockResolvedValue(3),
      findTradesByAccount: jest.fn().mockResolvedValue([{
        symbol: 'ETHUSDT',
        market: 'okx:perp',
        side: 'BUY',
        positionSide: 'LONG',
        quantity: '1.069',
        orderId: 'sync-1778580001229',
        externalTradeId: 'sync-strategy-account-1-ETH-USDT-SWAP',
        provider: 'okx',
        metadata: { syncSource: 'position-reconciliation', exchangeAccountId: 'exchange-account-1' },
      }]),
      findOpenByAccount: jest.fn().mockResolvedValue([{
        id: 'position-synthetic-1',
        userStrategyAccountId: 'strategy-account-1',
        symbol: 'ETHUSDT',
        positionSide: 'LONG',
        quantity: '1.069',
        avgEntryPrice: '2287.03',
        exchangeId: 'okx',
        marketType: 'perp',
        metadata: { syncSource: 'position-reconciliation', market: 'okx:perp', exchangeAccountId: 'exchange-account-1' },
      }]),
      saveSyncLog: jest.fn().mockResolvedValue(undefined),
    }
    const tradingService = {
      getPositions: jest.fn().mockResolvedValue([{
        symbol: 'ETH/USDT:PERP',
        side: 'long',
        size: '1.069',
        entryPrice: '2287.03',
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

    expect(result.differences).toEqual([{
      symbol: 'ETH/USDT:PERP',
      positionSide: 'LONG',
      exchangeQuantity: '1.069',
      localQuantity: '1.069',
      difference: '-1.069',
      action: 'closed',
    }])
    expect(positionsService.recordTrade).toHaveBeenCalledWith(expect.objectContaining({
      side: 'SELL',
      positionSide: 'LONG',
      market: 'okx:perp',
      quantity: '1.069',
      metadata: expect.objectContaining({
        reason: 'shared-account-unattributed-synthetic-position',
      }),
    }))
  })

  it('reconciles shared exchange account positions to real attributed trade quantity instead of full exchange net quantity', async () => {
    const positionsRepository = {
      countActiveStrategyBindingsByExchangeAccount: jest.fn().mockResolvedValue(3),
      findTradesByAccount: jest.fn().mockResolvedValue([
        {
          symbol: 'ETHUSDT',
          market: 'okx:perp',
          side: 'BUY',
          positionSide: 'LONG',
          quantity: '0.305',
          orderId: '3559343634595618816',
          externalTradeId: '3559343634595618816',
          provider: 'okx',
          metadata: { exchangeAccountId: 'exchange-account-1', runtimeProvenance: { runtimeStrategyInstanceId: 'strategy-1' } },
        },
        {
          symbol: 'ETHUSDT',
          market: 'okx:perp',
          side: 'BUY',
          positionSide: 'LONG',
          quantity: '0.764',
          orderId: 'sync-adjust-1',
          externalTradeId: 'sync-adjust-position-1',
          provider: 'reconciliation',
          metadata: { syncSource: 'position-adjustment', exchangeAccountId: 'exchange-account-1' },
        },
      ]),
      findOpenByAccount: jest.fn().mockResolvedValue([{
        id: 'position-1',
        userStrategyAccountId: 'strategy-account-1',
        symbol: 'ETHUSDT',
        positionSide: 'LONG',
        quantity: '1.069',
        avgEntryPrice: '2287.03',
        exchangeId: 'okx',
        marketType: 'perp',
        metadata: { syncSource: 'position-adjustment', market: 'okx:perp', exchangeAccountId: 'exchange-account-1' },
      }]),
      saveSyncLog: jest.fn().mockResolvedValue(undefined),
    }
    const tradingService = {
      getPositions: jest.fn().mockResolvedValue([{
        symbol: 'ETH/USDT:PERP',
        side: 'long',
        size: '1.069',
        entryPrice: '2287.03',
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

    expect(result.differences).toEqual([expect.objectContaining({
      symbol: 'ETH/USDT:PERP',
      positionSide: 'LONG',
      exchangeQuantity: '1.069',
      localQuantity: '1.069',
      difference: '-0.764',
      action: 'updated',
    })])
    expect(positionsService.recordTrade).toHaveBeenCalledWith(expect.objectContaining({
      side: 'SELL',
      positionSide: 'LONG',
      provider: 'reconciliation',
      quantity: '0.764',
      metadata: expect.objectContaining({
        targetQuantity: '0.305',
      }),
    }))
  })

  it('continues syncing shared exchange account positions when one reconciliation write fails', async () => {
    const positionsRepository = {
      countActiveStrategyBindingsByExchangeAccount: jest.fn().mockResolvedValue(3),
      findTradesByAccount: jest.fn().mockResolvedValue([{
        symbol: 'ETHUSDT',
        market: 'okx:perp',
        side: 'BUY',
        positionSide: 'LONG',
        quantity: '0.305',
        orderId: '3559343634595618816',
        externalTradeId: '3559343634595618816',
        provider: 'okx',
        metadata: { exchangeAccountId: 'exchange-account-1', runtimeProvenance: { runtimeStrategyInstanceId: 'strategy-1' } },
      }]),
      findOpenByAccount: jest.fn().mockResolvedValue([]),
      saveSyncLog: jest.fn().mockResolvedValue(undefined),
    }
    const tradingService = {
      getPositions: jest.fn().mockResolvedValue([
        {
          symbol: 'ETH/USDT:PERP',
          side: 'long',
          size: '1.069',
          entryPrice: '2287.03',
        },
        {
          symbol: 'BTC/USDT:PERP',
          side: 'long',
          size: '0.01',
          entryPrice: '95000',
        },
      ]),
    }
    const positionsService = {
      recordTrade: jest.fn().mockRejectedValue(new Error('ledger unavailable')),
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

    expect(result.success).toBe(false)
    expect(result.errors).toEqual([
      'Failed to sync shared account position ETH/USDT:PERP: ledger unavailable',
    ])
    expect(result.differences).toEqual([{
      symbol: 'BTC/USDT:PERP',
      positionSide: 'LONG',
      exchangeQuantity: '0.01',
      localQuantity: '0',
      difference: '0.01',
      action: 'skipped',
    }])
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

  it('does not reconcile local perp positions during spot sync', async () => {
    const positionsRepository = {
      findOpenByAccount: jest.fn().mockResolvedValue([
        {
          id: 'position-spot-1',
          userStrategyAccountId: 'strategy-account-1',
          symbol: 'BTCUSDT',
          positionSide: 'LONG',
          quantity: '0.0710829',
          avgEntryPrice: '78696.7553',
          exchangeId: 'okx',
          marketType: 'spot',
          metadata: { market: 'okx:spot' },
        },
        {
          id: 'position-perp-1',
          userStrategyAccountId: 'strategy-account-1',
          symbol: 'BTCUSDT:PERP',
          positionSide: 'LONG',
          quantity: '0.01',
      avgEntryPrice: '95000',
      exchangeId: 'okx',
      marketType: 'perp',
      metadata: null,
        },
      ]),
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

    expect(result.localPositions).toBe(1)
    expect(result.differences).toEqual([])
    expect(positionsService.recordTrade).not.toHaveBeenCalled()
  })

  it('does not close legacy spot positions during perp sync', async () => {
    const positionsRepository = {
      findOpenByAccount: jest.fn().mockResolvedValue([{
        id: 'position-legacy-spot-1',
        userStrategyAccountId: 'strategy-account-1',
        symbol: 'BTCUSDT',
        positionSide: 'LONG',
        quantity: '0.0710829',
        avgEntryPrice: '78696.7553',
        exchangeId: 'okx',
        marketType: null,
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
      'perp',
      'auto',
      'position-sync',
      'exchange-account-1',
    )

    expect(result.localPositions).toBe(0)
    expect(result.differences).toEqual([])
    expect(positionsService.recordTrade).not.toHaveBeenCalled()
  })

  it('closes perp orphan positions during perp sync', async () => {
    const positionsRepository = {
      findOpenByAccount: jest.fn().mockResolvedValue([{
        id: 'position-perp-1',
        userStrategyAccountId: 'strategy-account-1',
        symbol: 'BTCUSDT:PERP',
        positionSide: 'LONG',
        quantity: '0.01',
        avgEntryPrice: '95000',
        exchangeId: 'okx',
        marketType: 'perp',
        metadata: { market: 'okx:perp' },
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
      'perp',
      'auto',
      'position-sync',
      'exchange-account-1',
    )

    expect(result.differences).toEqual([{
      symbol: 'BTCUSDT:PERP',
      positionSide: 'LONG',
      exchangeQuantity: '0',
      localQuantity: '0.01',
      difference: '-0.01',
      action: 'closed',
    }])
    expect(positionsService.recordTrade).toHaveBeenCalledWith(expect.objectContaining({
      side: 'SELL',
      positionSide: 'LONG',
      market: 'okx:perp',
      quantity: '0.01',
    }))
  })

  it('does not close positions whose exchange ownership is unknown during perp sync', async () => {
    const positionsRepository = {
      findOpenByAccount: jest.fn().mockResolvedValue([{
        id: 'position-unknown-exchange-1',
        userStrategyAccountId: 'strategy-account-1',
        symbol: 'BTCUSDT:PERP',
        positionSide: 'LONG',
        quantity: '0.01',
        avgEntryPrice: '95000',
        exchangeId: null,
        marketType: 'perp',
        metadata: null,
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
      'perp',
      'auto',
      'position-sync',
      'exchange-account-1',
    )

    expect(result.localPositions).toBe(0)
    expect(result.differences).toEqual([])
    expect(positionsService.recordTrade).not.toHaveBeenCalled()
  })

  it('does not close positions whose market ownership is unknown during spot sync', async () => {
    const positionsRepository = {
      findOpenByAccount: jest.fn().mockResolvedValue([{
        id: 'position-unknown-market-1',
        userStrategyAccountId: 'strategy-account-1',
        symbol: 'BTCUSDT:PERP',
        positionSide: 'LONG',
        quantity: '0.01',
        avgEntryPrice: '95000',
        exchangeId: 'okx',
        marketType: null,
        metadata: null,
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

    expect(result.localPositions).toBe(0)
    expect(result.differences).toEqual([])
    expect(positionsService.recordTrade).not.toHaveBeenCalled()
  })

  it('matches ownership-unknown local positions before creating missing exchange positions', async () => {
    const positionsRepository = {
      findOpenByAccount: jest.fn().mockResolvedValue([{
        id: 'position-unknown-owner-1',
        userStrategyAccountId: 'strategy-account-1',
        symbol: 'BTCUSDT:PERP',
        positionSide: 'LONG',
        quantity: '0.01',
        avgEntryPrice: '95000',
        exchangeId: null,
        marketType: 'perp',
        metadata: null,
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

  it('adjusts ownership-unknown matched positions with the current sync market', async () => {
    const positionsRepository = {
      findOpenByAccount: jest.fn().mockResolvedValue([{
        id: 'position-unknown-owner-1',
        userStrategyAccountId: 'strategy-account-1',
        symbol: 'BTCUSDT:PERP',
        positionSide: 'LONG',
        quantity: '0.01',
        avgEntryPrice: '95000',
        exchangeId: null,
        marketType: 'perp',
        metadata: null,
      }]),
      saveSyncLog: jest.fn().mockResolvedValue(undefined),
    }
    const tradingService = {
      getPositions: jest.fn().mockResolvedValue([{
        symbol: 'BTC/USDT:PERP',
        side: 'long',
        size: '0.02',
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

    expect(result.differences).toEqual([expect.objectContaining({
      symbol: 'BTC/USDT:PERP',
      positionSide: 'LONG',
      exchangeQuantity: '0.02',
      localQuantity: '0.01',
      difference: '0.01',
      action: 'updated',
    })])
    expect(positionsService.recordTrade).toHaveBeenCalledWith(expect.objectContaining({
      market: 'okx:perp',
      provider: 'reconciliation',
      quantity: '0.01',
      metadata: expect.objectContaining({ market: 'okx:perp' }),
    }))
  })
})
