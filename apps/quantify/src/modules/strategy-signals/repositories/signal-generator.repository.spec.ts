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

  it('normalizes raw symbol codes by explicit market type when querying one symbol', async () => {
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

    await repo.findSymbolByCodeForMarket('BTCUSDT', 'perp')
    await repo.findSymbolByCodeForMarket('ETHUSDT', 'spot')

    expect(findUnique).toHaveBeenNthCalledWith(1, {
      where: { code: 'BTCUSDT:PERP' },
    })
    expect(findUnique).toHaveBeenNthCalledWith(2, {
      where: { code: 'ETHUSDT:SPOT' },
    })
  })

  it('normalizes raw symbol codes by explicit market type when querying multiple symbols', async () => {
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

    await repo.findSymbolsByCodeForMarket(['BTCUSDT', 'ETHUSDT:PERP'], 'perp')

    expect(findMany).toHaveBeenCalledWith({
      where: { code: { in: ['BTCUSDT:PERP', 'ETHUSDT:PERP'] } },
    })
  })

  it('rejects explicit symbol suffixes that conflict with the requested market type', async () => {
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

    expect(() => repo.findSymbolByCodeForMarket('BTCUSDT:SPOT', 'perp')).toThrow('market.symbol_unknown_suffix')
    expect(() => repo.findSymbolsByCodeForMarket(['BTCUSDT:PERP'], 'spot')).toThrow('market.symbol_unknown_suffix')
    expect(findUnique).not.toHaveBeenCalled()
    expect(findMany).not.toHaveBeenCalled()
  })
})
