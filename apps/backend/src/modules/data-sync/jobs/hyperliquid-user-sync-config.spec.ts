import { ErrorCode } from '@ai/shared'
import { HttpStatus } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { HyperliquidUserFillsSyncJob } from './hyperliquid-user-fills-sync.job'
import { HyperliquidUserFundingSyncJob } from './hyperliquid-user-funding-sync.job'
import { HyperliquidUserOrdersSyncJob } from './hyperliquid-user-orders-sync.job'

describe('hyperliquid user sync job config validation', () => {
  const txEvents = {
    withAfterCommit: (fn: () => Promise<unknown>) => fn(),
  }
  const txHost = { tx: {} }
  const hyperliquidApi = {}
  type JobClass = typeof HyperliquidUserFillsSyncJob

  it.each([
    ['fills', HyperliquidUserFillsSyncJob],
    ['orders', HyperliquidUserOrdersSyncJob],
    ['funding', HyperliquidUserFundingSyncJob],
  ])('returns bad request for %s template task without userAddress', async (_name, JobClass) => {
    const ctor = JobClass as JobClass
    const [txHostArg, hyperliquidApiArg, txEventsArg] = [
      txHost,
      hyperliquidApi,
      txEvents,
    ] as unknown as ConstructorParameters<JobClass>
    const job = new ctor(txHostArg, hyperliquidApiArg, txEventsArg)

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
    const txHost = {
      tx: {
        hyperliquidUserOrder: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      },
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
    const job = new HyperliquidUserOrdersSyncJob(txHost as never, hyperliquidApi as never, txEvents as never)

    const result = await job.run({
      taskId: 1,
      key: job.key,
      cursor: JSON.stringify({ userAddress: '0x0ddf9bae2af4b874b96d287a5ad42eb47138a902', lastSyncTime: 0 }),
      meta: null,
      now: new Date('2026-06-04T10:00:00.000Z'),
    })

    expect(result.fetchedCount).toBe(1)
    expect(txHost.tx.hyperliquidUserOrder.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        coin: 'ETH',
        orderId: BigInt(403960385339),
        status: 'filled',
        timestamp: new Date(1777496848915),
      })],
    }))
  })

  it('maps nested funding delta payloads returned by Hyperliquid', async () => {
    const txHost = {
      tx: {
        hyperliquidUserFunding: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      },
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
    const job = new HyperliquidUserFundingSyncJob(txHost as never, hyperliquidApi as never, txEvents as never)

    const result = await job.run({
      taskId: 1,
      key: job.key,
      cursor: JSON.stringify({ userAddress: '0x0ddf9bae2af4b874b96d287a5ad42eb47138a902', lastSyncTime: 0 }),
      meta: null,
      now: new Date('2026-06-04T10:00:00.000Z'),
    })

    expect(result.fetchedCount).toBe(1)
    expect(txHost.tx.hyperliquidUserFunding.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        coin: 'ETH',
        fundingRate: '-0.0000049837',
        szi: '40000.5788',
        usdc: '396.768427',
        time: new Date(1779966000027),
      })],
    }))
  })
})
