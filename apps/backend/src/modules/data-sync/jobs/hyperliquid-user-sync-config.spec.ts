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
})
