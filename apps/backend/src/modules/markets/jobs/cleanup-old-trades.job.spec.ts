import { CleanupOldTradesJob } from './cleanup-old-trades.job'

type TxEventsMock = {
  withAfterCommit: jest.Mock<Promise<unknown>, [() => Promise<unknown>]>
}

function createHarness(groups = [
  { exchange: 'BINANCE', instrumentType: 'SPOT', symbol: 'BTCUSDT' },
]) {
  const marketTradesRepository = {
    getTradeCount: jest.fn()
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(7),
    getDistinctSymbolGroups: jest.fn().mockResolvedValue(groups),
    deleteExcessTrades: jest.fn().mockResolvedValue(5),
  }
  const configService = {
    get: jest.fn().mockReturnValue('5000'),
  }
  const txEvents: TxEventsMock = {
    withAfterCommit: jest.fn(async fn => fn()),
  }
  const CleanupJobWithTx = CleanupOldTradesJob as unknown as new (
    marketTradesRepository: unknown,
    configService: unknown,
    txEvents: TxEventsMock,
  ) => CleanupOldTradesJob
  const job = new CleanupJobWithTx(marketTradesRepository, configService, txEvents)

  return { job, marketTradesRepository, txEvents }
}

describe('CleanupOldTradesJob', () => {
  it('runs cleanup inside TransactionEventsService.withAfterCommit', async () => {
    const { job, marketTradesRepository, txEvents } = createHarness()

    await job.handleCron()

    expect(txEvents.withAfterCommit).toHaveBeenCalledTimes(1)
    expect(marketTradesRepository.deleteExcessTrades).toHaveBeenCalledWith(
      'BINANCE',
      'SPOT',
      'BTCUSDT',
      5000,
    )
  })

  it('uses a separate transaction boundary for each symbol cleanup', async () => {
    const { job, txEvents } = createHarness([
      { exchange: 'BINANCE', instrumentType: 'SPOT', symbol: 'BTCUSDT' },
      { exchange: 'OKX', instrumentType: 'FUTURES', symbol: 'ETHUSDT' },
    ])

    await job.handleCron()

    expect(txEvents.withAfterCommit).toHaveBeenCalledTimes(2)
  })
})
