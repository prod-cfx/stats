import type { HyperliquidWhaleAlert } from '@/prisma/prisma.types'
import type { HyperliquidApiService } from './services'
import type { WhalePerformanceService } from './services/whale-performance.service'
import type { WhaleSnapshotService } from './services/whale-snapshot.service'
import type { WhaleTrackingRepository } from './whale-tracking.repository'
import type { WhaleTrackingService as WhaleTrackingServiceType } from './whale-tracking.service'
import { WhaleTrackingService } from './whale-tracking.service'

type WhaleTrackingServiceDependencies = ConstructorParameters<typeof WhaleTrackingServiceType>

function createService(overrides: {
  repository?: Partial<WhaleTrackingRepository>
  envService?: { getString: jest.Mock<string, [string]> }
  whalePerformanceService?: Partial<WhalePerformanceService>
  whaleSnapshotService?: Partial<WhaleSnapshotService>
} = {}): WhaleTrackingService {
  const repository = overrides.repository ?? {}
  const envService = overrides.envService ?? {
    getString: jest.fn().mockReturnValue('staging'),
  }
  const whalePerformanceService = overrides.whalePerformanceService ?? {}
  const whaleSnapshotService = overrides.whaleSnapshotService ?? {}

  return new WhaleTrackingService(
    repository as WhaleTrackingServiceDependencies[0],
    envService as unknown as WhaleTrackingServiceDependencies[1],
    whalePerformanceService as WhaleTrackingServiceDependencies[2],
    whaleSnapshotService as WhaleTrackingServiceDependencies[3],
  )
}

function createAlert(overrides: Record<string, unknown> = {}): HyperliquidWhaleAlert {
  return {
    id: 'alert-1',
    source: 'TEST',
    userAddress: '0xabc',
    symbol: 'BTC',
    positionSize: 1,
    positionValueUsd: 1000,
    entryPrice: 100,
    liquidationPrice: 50,
    positionAction: 'OPEN',
    createTime: new Date('2026-01-02T00:00:00.000Z'),
    updateTime: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  } as unknown as HyperliquidWhaleAlert
}

describe('WhaleTrackingService', () => {
  it('uses live Hyperliquid-backed addresses in non-e2e discover fallback data', async () => {
    const repository = {
      groupWhaleAlertsByAddress: jest.fn().mockResolvedValue([]),
    }

    const service = createService({ repository })

    const result = await service.getDiscoverWhales()
    const addresses = result.details.map(item => item.address.toLowerCase())
    const recommendedAddresses = result.recommended.map(item => item.address.toLowerCase())

    expect(recommendedAddresses).toContain('0x020ca66c30bec2c4fe3861a94e4db4a498a35872')
    expect(addresses).toContain('0x020ca66c30bec2c4fe3861a94e4db4a498a35872')
    expect(addresses).not.toContain('0x8ba1f109551bd432803012645ac136ddd64dba72')
  })

  it('keeps WhaleTrackingService as facade for trader performance', async () => {
    const getTraderPerformance = jest.fn().mockResolvedValue({
      summary: { address: '0xabc' },
      byAsset: [],
      trades: [],
    })
    const service = createService({
      whalePerformanceService: { getTraderPerformance },
    })

    const query = { timeRangeDays: 7, page: 1, limit: 20 }

    await expect(service.getTraderPerformance('0xabc', query)).resolves.toEqual({
      summary: { address: '0xabc' },
      byAsset: [],
      trades: [],
    })
    expect(getTraderPerformance).toHaveBeenCalledWith('0xabc', query)
  })

  it('keeps WhaleTrackingService as facade for snapshot, positions, and open orders', async () => {
    const getTraderSnapshot = jest.fn().mockResolvedValue({
      perp: {},
      spot: { balances: [] },
      total: {},
    })
    const getTraderPositions = jest.fn().mockResolvedValue({ perp: [], spot: [] })
    const getTraderOpenOrders = jest.fn().mockResolvedValue({ orders: [] })
    const service = createService({
      whaleSnapshotService: {
        getTraderSnapshot,
        getTraderPositions,
        getTraderOpenOrders,
      },
    })

    await expect(service.getTraderSnapshot('0xabc', { skipCache: true })).resolves.toEqual({
      perp: {},
      spot: { balances: [] },
      total: {},
    })
    await expect(service.getTraderPositions('0xabc', { type: 'perp' })).resolves.toEqual({
      perp: [],
      spot: [],
    })
    await expect(service.getTraderOpenOrders('0xabc', { coin: 'BTC' })).resolves.toEqual({
      orders: [],
    })

    expect(getTraderSnapshot).toHaveBeenCalledWith('0xabc', { skipCache: true })
    expect(getTraderPositions).toHaveBeenCalledWith('0xabc', { type: 'perp' })
    expect(getTraderOpenOrders).toHaveBeenCalledWith('0xabc', { coin: 'BTC' })
  })
})

describe('WhalePerformanceService', () => {
  it('aggregates trader performance by asset and caps trade history limit', async () => {
    const { WhalePerformanceService } = await import('./services/whale-performance.service')
    const repository = {
      groupAlertsByAddressForSummary: jest.fn().mockResolvedValue([
        {
          _sum: { positionValueUsd: 3000 },
          _count: { _all: 2 },
        },
      ]),
      groupAlertsBySymbol: jest.fn().mockResolvedValue([
        {
          symbol: 'ETH',
          _sum: { positionValueUsd: 2000 },
          _count: { _all: 1 },
        },
        {
          symbol: 'BTC',
          _sum: { positionValueUsd: 1000 },
          _count: { _all: 1 },
        },
      ]),
      groupAlertsBySymbolWithPositionFilter: jest
        .fn()
        .mockResolvedValueOnce([{ symbol: 'BTC', _count: { _all: 1 } }])
        .mockResolvedValueOnce([{ symbol: 'ETH', _count: { _all: 1 } }]),
      findManyAlertsWithLimit: jest.fn().mockResolvedValue([
        createAlert({
          userAddress: '0xabc',
          symbol: 'ETH',
          positionSize: -2,
          positionValueUsd: 2000,
          entryPrice: 200,
          liquidationPrice: 300,
          positionAction: 'INCREASE',
        }),
      ]),
    }
    const service = new WhalePerformanceService(repository as unknown as WhaleTrackingRepository)

    const result = await service.getTraderPerformance('0xabc', {
      timeRangeDays: 14,
      page: 1,
      limit: 999,
    })

    expect(result.summary).toMatchObject({
      address: '0xabc',
      lookbackDays: 14,
      trades: 2,
      positions: 2,
      totalValueUsd: 3000,
      longCount: 1,
      shortCount: 1,
      winRatePct: 50,
      pnlUsd: 240,
    })
    expect(result.byAsset).toEqual([
      { symbol: 'ETH', totalValueUsd: 2000, trades: 1, longCount: 0, shortCount: 1 },
      { symbol: 'BTC', totalValueUsd: 1000, trades: 1, longCount: 1, shortCount: 0 },
    ])
    expect(result.trades).toEqual([
      expect.objectContaining({
        address: '0xabc',
        symbol: 'ETH',
        side: 'SHORT',
        positionSize: -2,
        positionValueUsd: 2000,
      }),
    ])
    expect(repository.findManyAlertsWithLimit).toHaveBeenCalledWith(expect.any(Object), 500)
  })
})

describe('WhaleSnapshotService', () => {
  it('builds trader snapshot from perp and spot states without changing spot value placeholder behavior', async () => {
    const { WhaleSnapshotService } = await import('./services/whale-snapshot.service')
    const hyperliquidApi = {
      getClearinghouseState: jest.fn().mockResolvedValue({
        marginSummary: {
          accountValue: '1000',
          totalMarginUsed: '250',
          totalNtlPos: '500',
        },
        withdrawable: '750',
        assetPositions: [
          { position: { unrealizedPnl: '12.345' } },
          { position: { unrealizedPnl: '-2.345' } },
        ],
      }),
      getSpotClearinghouseState: jest.fn().mockResolvedValue({
        balances: [{ coin: 'USDC', total: '10', hold: '2' }],
      }),
    }
    const service = new WhaleSnapshotService(hyperliquidApi as unknown as HyperliquidApiService)

    const result = await service.getTraderSnapshot('0xabc', { skipCache: true })

    expect(result).toEqual({
      perp: {
        accountValue: 1000,
        totalMarginUsed: 250,
        totalPositionValue: 500,
        withdrawable: 750,
        marginUsagePercent: 25,
        leverageRatio: 2,
        unrealizedPnl: 10,
        roi: 4,
      },
      spot: {
        totalValue: 0,
        balances: [{ coin: 'USDC', total: 10, hold: 2, value: 0, sharePercent: 0 }],
      },
      total: {
        accountValue: 1000,
        perpPercent: 100,
        spotPercent: 0,
      },
    })
    expect(hyperliquidApi.getClearinghouseState).toHaveBeenCalledWith('0xabc', true)
    expect(hyperliquidApi.getSpotClearinghouseState).toHaveBeenCalledWith('0xabc', true)
  })

  it('returns empty position arrays when Hyperliquid has no positions or balances', async () => {
    const { WhaleSnapshotService } = await import('./services/whale-snapshot.service')
    const hyperliquidApi = {
      getClearinghouseState: jest.fn().mockResolvedValue({ assetPositions: [] }),
      getSpotClearinghouseState: jest.fn().mockResolvedValue({ balances: [] }),
    }
    const service = new WhaleSnapshotService(hyperliquidApi as unknown as HyperliquidApiService)

    await expect(service.getTraderPositions('0xabc', {})).resolves.toEqual({
      perp: [],
      spot: [],
    })
  })
})
