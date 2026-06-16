import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { HyperliquidUserFillsSyncJob } from './hyperliquid-user-fills-sync.job'
import { HyperliquidUserFundingSyncJob } from './hyperliquid-user-funding-sync.job'
import { HyperliquidUserOrdersSyncJob } from './hyperliquid-user-orders-sync.job'

describe('hyperliquid user sync job config validation', () => {
  const marketDataRepository = {}
  const hyperliquidApi = {}
  type JobClass = typeof HyperliquidUserFillsSyncJob

  it.each([
    ['fills', HyperliquidUserFillsSyncJob],
    ['orders', HyperliquidUserOrdersSyncJob],
    ['funding', HyperliquidUserFundingSyncJob],
  ])('returns bad request for %s template task without userAddress', async (_name, JobClass) => {
    const ctor = JobClass as JobClass
    const [marketDataRepositoryArg, hyperliquidApiArg] = [
      marketDataRepository,
      hyperliquidApi,
    ] as unknown as ConstructorParameters<JobClass>
    const job = new ctor(marketDataRepositoryArg, hyperliquidApiArg)

    let error: unknown
    try {
      await job.run({
        taskId: 1,
        key: job.key,
        cursor: JSON.stringify({ userAddress: '', lastSyncTime: 0 }),
        meta: null,
        now: new Date(),
      })
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(DomainException)
    expect(error).toMatchObject<Partial<DomainException>>({
      code: ErrorCode.DATA_SYNC_CONFIG_MISSING,
    })
    expect((error as DomainException).getStatus()).toBe(HttpStatus.BAD_REQUEST)
  })

  it('maps nested historical order payloads returned by Hyperliquid', async () => {
    const marketDataRepository = {
      createHyperliquidUserOrdersMany: jest.fn().mockResolvedValue(1),
    }
    const hyperliquidApi = {
      getHistoricalOrders: jest.fn().mockResolvedValue([{ status: 'filled', order: {
        coin: 'ETH',
        side: 'B',
        limitPx: '2419.3',
        sz: '0.0',
        oid: 403960385339,
        timestamp: 1777496848915,
        origSz: '1000.0',
        orderType: 'Market',
        reduceOnly: false,
      } }]),
    }
    const job = new HyperliquidUserOrdersSyncJob(marketDataRepository as never, hyperliquidApi as never)

    const result = await job.run({
      taskId: 1,
      key: job.key,
      cursor: JSON.stringify({ userAddress: '0x0ddf9bae2af4b874b96d287a5ad42eb47138a902', lastSyncTime: 0 }),
      meta: null,
      now: new Date('2026-06-04T10:00:00.000Z'),
    })

    expect(result.fetchedCount).toBe(1)
    expect(marketDataRepository.createHyperliquidUserOrdersMany).toHaveBeenCalledWith([
      expect.objectContaining({
        coin: 'ETH',
        orderId: BigInt(403960385339),
        status: 'filled',
        timestamp: new Date(1777496848915),
      }),
    ])
  })

  it('maps nested funding delta payloads returned by Hyperliquid', async () => {
    const marketDataRepository = {
      createHyperliquidUserFundingMany: jest.fn().mockResolvedValue(1),
    }
    const hyperliquidApi = {
      getUserFunding: jest.fn().mockResolvedValue([{ time: 1779966000027, delta: {
        type: 'funding',
        coin: 'ETH',
        usdc: '396.768427',
        szi: '40000.5788',
        fundingRate: '-0.0000049837',
      } }]),
    }
    const job = new HyperliquidUserFundingSyncJob(marketDataRepository as never, hyperliquidApi as never)

    const result = await job.run({
      taskId: 1,
      key: job.key,
      cursor: JSON.stringify({ userAddress: '0x0ddf9bae2af4b874b96d287a5ad42eb47138a902', lastSyncTime: 0 }),
      meta: null,
      now: new Date('2026-06-04T10:00:00.000Z'),
    })

    expect(result.fetchedCount).toBe(1)
    expect(marketDataRepository.createHyperliquidUserFundingMany).toHaveBeenCalledWith([
      expect.objectContaining({
        coin: 'ETH',
        fundingRate: '-0.0000049837',
        szi: '40000.5788',
        usdc: '396.768427',
        time: new Date(1779966000027),
      }),
    ])
  })

  it('defaults missing fill liquidation flags to false', async () => {
    const marketDataRepository = {
      createHyperliquidUserFillsMany: jest.fn().mockResolvedValue(1),
    }
    const hyperliquidApi = {
      getUserFillsByTime: jest.fn().mockResolvedValue([{
        coin: 'ETH',
        px: '1885.3',
        sz: '0.0998',
        side: 'A',
        time: 1779966000027,
        startPosition: '-15103.1089',
        dir: 'Open Short',
        closedPnl: '0.0',
        hash: '0xabc',
        oid: 454811980657,
        crossed: false,
        fee: '0.015052',
        tid: 1001962798821134,
      }]),
    }
    const job = new HyperliquidUserFillsSyncJob(marketDataRepository as never, hyperliquidApi as never)

    const result = await job.run({
      taskId: 1,
      key: job.key,
      cursor: JSON.stringify({ userAddress: '0x0ddf9bae2af4b874b96d287a5ad42eb47138a902', lastSyncTime: 0 }),
      meta: null,
      now: new Date('2026-06-04T10:00:00.000Z'),
    })

    expect(result.fetchedCount).toBe(1)
    expect(marketDataRepository.createHyperliquidUserFillsMany).toHaveBeenCalledWith([
      expect.objectContaining({
        coin: 'ETH',
        liquidation: false,
        orderId: BigInt(454811980657),
        tradeId: BigInt(1001962798821134),
      }),
    ])
  })
})
