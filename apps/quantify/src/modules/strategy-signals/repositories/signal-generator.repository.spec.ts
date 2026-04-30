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

  it('normalizes OKX native instrument ids to canonical codes for market-aware lookup', async () => {
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

    await repo.findSymbolByCodeForMarket('BTC-USDT-SWAP', 'perp')
    await repo.findSymbolByCodeForMarket('BTC-USDT', 'spot')

    expect(findUnique).toHaveBeenNthCalledWith(1, {
      where: { code: 'BTCUSDT:PERP' },
    })
    expect(findUnique).toHaveBeenNthCalledWith(2, {
      where: { code: 'BTCUSDT:SPOT' },
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

    await repo.findSymbolsByCodeForMarket(['BTCUSDT', 'BTCUSDT:PERP'], 'perp')

    expect(findMany).toHaveBeenCalledWith({
      where: { code: { in: ['BTCUSDT:PERP'] } },
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
    expect(() => repo.findSymbolByCodeForMarket('BTC-USDT-SWAP:SPOT', 'perp')).toThrow('market.symbol_unknown_suffix')
    expect(() => repo.findSymbolByCodeForMarket('BTC-USDT-SWAP', 'spot')).toThrow('market.symbol_unknown_suffix')
    expect(() => repo.findSymbolsByCodeForMarket(['BTCUSDT:PERP'], 'spot')).toThrow('market.symbol_unknown_suffix')
    expect(findUnique).not.toHaveBeenCalled()
    expect(findMany).not.toHaveBeenCalled()
  })

  it('rejects malformed explicit symbol suffixes before querying one symbol', async () => {
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

    expect(() => repo.findSymbolByCodeForMarket('BTCUSDT:SPOT:PERP', 'perp')).toThrow('market.symbol_unknown_suffix')
    expect(findUnique).not.toHaveBeenCalled()
    expect(findMany).not.toHaveBeenCalled()
  })

  it('excludes cancelled and failed signals from cooldown checks', async () => {
    const count = jest.fn().mockResolvedValue(0)
    const repo = new SignalGeneratorRepository({
      tx: {
        tradingSignal: { count },
      },
    } as any)

    await repo.countRecentSignals({
      strategyId: 'strategy-1',
      symbolId: 'symbol-1',
      since: new Date('2026-04-28T14:10:00.000Z'),
    })

    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: { in: ['PENDING', 'EXECUTED', 'PARTIAL'] },
      }),
    })
  })

  it('scopes cooldown checks by signal type and direction', async () => {
    const count = jest.fn().mockResolvedValue(0)
    const repo = new SignalGeneratorRepository({
      tx: {
        tradingSignal: { count },
      },
    } as any)

    await repo.countRecentSignals({
      strategyId: 'strategy-1',
      symbolId: 'symbol-1',
      since: new Date('2026-04-28T14:10:00.000Z'),
      signalType: 'EXIT',
      direction: 'CLOSE_LONG',
    })

    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        signalType: 'EXIT',
        direction: 'CLOSE_LONG',
      }),
    })
  })

  it('scopes exit admission to active subscriptions and exact closable side', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const repo = new SignalGeneratorRepository({
      tx: {
        position: { findMany },
      },
    } as any)

    await repo.findClosablePositionsForExitAdmission({
      strategyId: 'strategy-template-1',
      strategyInstanceId: 'strategy-instance-1',
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'BTCUSDT',
      positionSide: 'LONG',
    })

    expect(findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        symbol: 'BTCUSDT',
        exchangeId: 'okx',
        marketType: 'perp',
        positionSide: 'LONG',
        status: 'OPEN',
        quantity: { gt: 0 },
        account: expect.objectContaining({
          strategyId: 'strategy-template-1',
          user: {
            strategySubscriptions: {
              some: expect.objectContaining({
                strategyInstanceId: 'strategy-instance-1',
                status: 'active',
                exchangeAccount: { exchangeId: 'okx' },
              }),
            },
          },
        }),
      }),
      select: expect.objectContaining({
        positionSide: true,
        quantity: true,
      }),
    })
  })

  it('detects exit reconcile risk from pending or unreconciled entry executions', async () => {
    const count = jest.fn().mockResolvedValue(1)
    const repo = new SignalGeneratorRepository({
      tx: {
        userSignalExecution: { count },
      },
    } as any)

    await expect(repo.hasExitReconcileRisk({
      strategyId: 'strategy-template-1',
      strategyInstanceId: 'strategy-instance-1',
      exchangeId: 'okx',
      marketType: 'perp',
      symbol: 'BTCUSDT',
      positionSide: 'LONG',
    })).resolves.toBe(true)

    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        orderSide: { in: ['BUY', 'SELL'] },
        positionSide: 'LONG',
        OR: expect.arrayContaining([
          { status: 'PENDING' },
          expect.objectContaining({
            status: 'FAILED',
            OR: expect.arrayContaining([
              { metadata: { path: ['reconcileRequired'], equals: true } },
              { metadata: { path: ['ledgerApplied'], equals: false } },
            ]),
          }),
        ]),
        signal: expect.objectContaining({
          strategyInstanceId: 'strategy-instance-1',
          signalType: 'ENTRY',
          symbol: { code: { in: ['BTCUSDT', 'BTCUSDT:PERP'] } },
        }),
      }),
    })
  })
})
