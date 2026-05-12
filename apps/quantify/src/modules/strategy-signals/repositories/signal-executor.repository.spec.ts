import { SignalExecutorRepository } from './signal-executor.repository'

describe('signalExecutorRepository.findRecoverableSignals', () => {
  it('limits recovery to aged, unexpired pending signals only', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const repo = new SignalExecutorRepository({
      tx: {
        tradingSignal: {
          findMany,
        },
      },
    } as any)

    const readyBefore = new Date('2026-04-22T00:00:00.000Z')
    await repo.findRecoverableSignals({
      limit: 50,
      readyBefore,
    })

    expect(findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: 'PENDING',
        createdAt: { lte: readyBefore },
        executions: {
          none: {},
        },
      }),
      orderBy: { createdAt: 'asc' },
      take: 50,
    })
  })
})

describe('signalExecutorRepository.hasPendingReconcileRequiredEntryExecution', () => {
  it('blocks admission for failed or pending reconcile-required entry executions', async () => {
    const count = jest.fn().mockResolvedValue(1)
    const repo = new SignalExecutorRepository({
      tx: {
        userSignalExecution: {
          count,
        },
      },
    } as any)

    await expect(repo.hasPendingReconcileRequiredEntryExecution('account-1')).resolves.toBe(true)

    expect(count).toHaveBeenCalledWith({
      where: {
        userStrategyAccountId: 'account-1',
        status: { in: ['FAILED', 'PENDING'] },
        orderSide: { in: ['BUY', 'SELL'] },
        signal: {
          signalType: 'ENTRY',
        },
        metadata: {
          path: ['reconcileRequired'],
          equals: true,
        },
      },
    })
  })
})
