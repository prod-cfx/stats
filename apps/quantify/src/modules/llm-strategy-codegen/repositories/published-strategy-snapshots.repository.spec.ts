import { PublishedStrategySnapshotsRepository, __test__ } from './published-strategy-snapshots.repository'

describe('publishedStrategySnapshotsRepository', () => {
  it('persists script/spec snapshots with derived hashes and consistency report', async () => {
    const tx = {
      publishedStrategySnapshot: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'snapshot-1',
          createdAt: new Date('2026-04-03T10:00:00.000Z'),
          ...data,
        })),
      },
    }
    const txHost = {
      tx,
    }
    const repo = new PublishedStrategySnapshotsRepository(txHost)

    const result = await repo.create({
      sessionId: 'session-1',
      strategyInstanceId: 'instance-1',
      strategyTemplateId: 'template-1',
      scriptSnapshot: ' const strategy = { protocolVersion: "v1" }\nstrategy ',
      specSnapshot: {
        market: { exchange: 'okx', symbol: 'BTCUSDT', timeframe: '15m' },
        entries: [{ action: 'OPEN_SHORT', trigger: 'close > upper' }],
      },
      consistencyReport: {
        status: 'PASSED',
        summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
      },
      paramsSnapshot: { positionPct: 10 },
      executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
      dataRequirements: { primary: ['15m'] },
      userIntentSummary: {
        marketScope: ['BTCUSDT'],
        goals: ['mean-reversion'],
      },
      strategySummary: {
        thesis: 'sell near upper band and mean revert',
      },
      scriptSummary: {
        indicators: ['BBANDS'],
      },
      lockedParams: {
        leverage: 3,
      },
      snapshotVersion: 2,
    })

    expect(tx.publishedStrategySnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        session: { connect: { id: 'session-1' } },
        strategyInstanceId: 'instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: 'const strategy = { protocolVersion: "v1" }\nstrategy',
        specSnapshot: {
          market: { exchange: 'okx', symbol: 'BTCUSDT', timeframe: '15m' },
          entries: [{ action: 'OPEN_SHORT', trigger: 'close > upper' }],
        },
        consistencyReport: {
          status: 'PASSED',
          summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
        },
        userIntentSummary: {
          marketScope: ['BTCUSDT'],
          goals: ['mean-reversion'],
        },
        strategySummary: {
          thesis: 'sell near upper band and mean revert',
        },
        scriptSummary: {
          indicators: ['BBANDS'],
        },
        lockedParams: {
          leverage: 3,
        },
        snapshotVersion: 2,
        snapshotHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
        scriptHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
        specHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
    }))
    expect(result.id).toBe('snapshot-1')
  })

  it('includes new snapshot contract fields in snapshot hash', async () => {
    const tx = {
      publishedStrategySnapshot: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'snapshot-1',
          createdAt: new Date('2026-04-03T10:00:00.000Z'),
          ...data,
        })),
      },
    }
    const txHost = {
      tx,
    }
    const repo = new PublishedStrategySnapshotsRepository(txHost)

    const baseInput = {
      sessionId: 'session-1',
      strategyInstanceId: 'instance-1',
      strategyTemplateId: 'template-1',
      scriptSnapshot: 'const strategy = { protocolVersion: "v1" }\nstrategy',
      specSnapshot: {
        market: { exchange: 'okx', symbol: 'BTCUSDT', timeframe: '15m' },
      },
      consistencyReport: {
        status: 'PASSED',
      },
      paramsSnapshot: { positionPct: 10 },
      executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
      dataRequirements: { primary: ['15m'] },
      userIntentSummary: { marketScope: ['BTCUSDT'] },
      strategySummary: { thesis: 'mean-reversion' },
      scriptSummary: { indicators: ['BBANDS'] },
      lockedParams: { leverage: 3 },
      snapshotVersion: 2,
    }

    await repo.create(baseInput)
    await repo.create({
      ...baseInput,
      lockedParams: { leverage: 5 },
    })

    const firstCall = tx.publishedStrategySnapshot.create.mock.calls[0][0]
    const secondCall = tx.publishedStrategySnapshot.create.mock.calls[1][0]

    expect(firstCall.data.snapshotHash).not.toBe(secondCall.data.snapshotHash)
  })

  it('reads latest snapshot by session id', async () => {
    const latest = { id: 'snapshot-latest' }
    const tx = {
      publishedStrategySnapshot: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(latest),
        findUnique: jest.fn(),
      },
    }
    const txHost = { tx }
    const repo = new PublishedStrategySnapshotsRepository(txHost)

    await expect(repo.findLatestBySessionId('session-1')).resolves.toBe(latest)
    expect(tx.publishedStrategySnapshot.findFirst).toHaveBeenCalledWith({
      where: { sessionId: 'session-1' },
      orderBy: [{ createdAt: 'desc' }],
    })
  })

  it('reads snapshot by id within user ownership boundary', async () => {
    const snapshot = { id: 'snapshot-1' }
    const tx = {
      publishedStrategySnapshot: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(snapshot),
        findUnique: jest.fn(),
      },
    }
    const txHost = { tx }
    const repo = new PublishedStrategySnapshotsRepository(txHost)

    await expect(repo.findByIdForUser('snapshot-1', 'user-1')).resolves.toBe(snapshot)
    expect(tx.publishedStrategySnapshot.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'snapshot-1',
        session: {
          userId: 'user-1',
        },
      },
    })
  })

  it('produces stable hashes for objects with different key ordering', () => {
    const left = { b: 2, a: { d: 4, c: 3 } }
    const right = { a: { c: 3, d: 4 }, b: 2 }

    expect(__test__.stableJsonStringify(left)).toBe(__test__.stableJsonStringify(right))
    expect(__test__.sha256(__test__.stableJsonStringify(left))).toBe(
      __test__.sha256(__test__.stableJsonStringify(right)),
    )
  })
})
