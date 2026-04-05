import { PublishedStrategySnapshotsRepository, __test__ } from './published-strategy-snapshots.repository'

describe('publishedStrategySnapshotsRepository', () => {
  it('persists script/spec snapshots with derived hashes and consistency report', async () => {
    const tx = {
      publishedStrategySnapshot: {
        create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'snapshot-1',
          createdAt: new Date('2026-04-03T10:00:00.000Z'),
          ...data,
        })),
      },
    }
    const txHost = {
      tx,
    }
    const repo = new PublishedStrategySnapshotsRepository(txHost as never)

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
        snapshotHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
        scriptHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
        specHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
      }),
    }))
    expect(result.id).toBe('snapshot-1')
  })

  it('persists compiled snapshot fields with stable hashes', async () => {
    const tx = {
      publishedStrategySnapshot: {
        create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'snapshot-compiled-1',
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          ...data,
        })),
      },
    }
    const txHost = {
      tx,
    }
    const repo = new PublishedStrategySnapshotsRepository(txHost as never)

    await repo.create({
      sessionId: 'session-1',
      scriptSnapshot: 'const strategy = {}',
      specSnapshot: { graphDigest: 'sha256:graph' },
      irSnapshot: { irVersion: 'csi.v1' },
      astSnapshot: { astVersion: 'csa.v1' },
      compiledManifest: {
        irVersion: 'csi.v1',
        astVersion: 'csa.v1',
        compileVersion: 'compiler.v1',
        irHash: 'sha256:ir',
        specHash: 'sha256:spec',
        astDigest: 'sha256:ast',
        structuralDigest: 'sha256:struct',
      },
      consistencyReport: {
        graphVsIr: { passed: true },
        irVsScript: { passed: true },
        manifestSelfCheck: { passed: true },
      },
      executionEnvelope: {
        positionMode: 'long_only',
        marginMode: 'cash',
        tickSize: 0.01,
        pricePrecision: 2,
        quantityPrecision: 6,
        fillAssumption: 'strict',
      },
    } as any)

    expect(tx.publishedStrategySnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        irHash: 'sha256:ir',
        astDigest: 'sha256:ast',
        structuralDigest: 'sha256:struct',
        irSnapshot: { irVersion: 'csi.v1' },
        astSnapshot: { astVersion: 'csa.v1' },
        executionEnvelope: expect.objectContaining({
          positionMode: 'long_only',
          marginMode: 'cash',
        }),
        compiledManifest: expect.objectContaining({
          compileVersion: 'compiler.v1',
          structuralDigest: 'sha256:struct',
        }),
      }),
    }))
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
    const repo = new PublishedStrategySnapshotsRepository(txHost as never)

    await expect(repo.findLatestBySessionId('session-1')).resolves.toBe(latest)
    expect(tx.publishedStrategySnapshot.findFirst).toHaveBeenCalledWith({
      where: { sessionId: 'session-1' },
      orderBy: [{ createdAt: 'desc' }],
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
