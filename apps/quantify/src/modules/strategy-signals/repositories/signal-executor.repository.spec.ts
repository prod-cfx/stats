import { SignalExecutorRepository } from './signal-executor.repository'

describe('signalExecutorRepository.findRecoverableSignals', () => {
  it('limits recovery to aged, unexpired pending/failed signals and excludes NO_SUBSCRIBERS failures', async () => {
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
        status: { in: ['PENDING', 'FAILED'] },
        createdAt: { lte: readyBefore },
        NOT: {
          metadata: {
            path: ['reason'],
            equals: 'NO_SUBSCRIBERS',
          },
        },
      }),
      orderBy: { createdAt: 'asc' },
      take: 50,
    })
  })
})
