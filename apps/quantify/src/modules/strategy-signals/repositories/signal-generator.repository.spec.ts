import { SignalGeneratorRepository } from './signal-generator.repository'

describe('signalGeneratorRepository.findRunningInstances', () => {
  it('includes TESTNET instances in the generation scan', async () => {
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
      }),
    }))
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
