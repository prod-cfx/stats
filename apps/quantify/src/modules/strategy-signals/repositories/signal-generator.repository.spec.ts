import { SignalGeneratorRepository } from './signal-generator.repository'

describe('signalGeneratorRepository.findRunningInstances', () => {
  it('only scans runtime-ready LIVE/TESTNET instances', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const repo = new SignalGeneratorRepository({
      tx: {
        strategyInstance: {
          findMany,
        },
      },
    } as any)

    await repo.findRunningInstances()

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'running',
        mode: {
          in: ['LIVE', 'TESTNET'],
        },
        runtimeBindingStatus: 'READY',
      }),
    }))
  })

  it('does not treat plain running status as sufficient scheduler visibility', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const repo = new SignalGeneratorRepository({
      tx: {
        strategyInstance: {
          findMany,
        },
      },
    } as any)

    await repo.findRunningInstances()

    const where = findMany.mock.calls[0]?.[0]?.where
    expect(where.status).toBe('running')
    expect(where.runtimeBindingStatus).toBe('READY')
  })

  it('normalizes raw symbol codes to SPOT when querying symbols', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const findUnique = jest.fn().mockResolvedValue(null)
    const repo = new SignalGeneratorRepository({
      tx: {
        strategyInstance: { findMany: jest.fn() },
        symbol: {
          findMany,
          findUnique,
        },
      },
    } as any)

    await repo.findSymbolsByCode(['SOLUSDT'])
    await repo.findSymbolByCode('BTCUSDT')

    expect(findMany).toHaveBeenCalledWith({
      where: { code: { in: ['SOLUSDT:SPOT'] } },
    })
    expect(findUnique).toHaveBeenCalledWith({
      where: { code: 'BTCUSDT:SPOT' },
    })
  })
})
