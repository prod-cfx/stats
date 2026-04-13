import { PublishedStrategySnapshotsRepository, __test__ } from './published-strategy-snapshots.repository'

function createTxHost(tx: unknown): ConstructorParameters<typeof PublishedStrategySnapshotsRepository>[0] {
  return { tx } as ConstructorParameters<typeof PublishedStrategySnapshotsRepository>[0]
}

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
    const repo = new PublishedStrategySnapshotsRepository(createTxHost(tx))

    const result = await repo.create({
      sessionId: 'session-1',
      strategyInstanceId: 'instance-1',
      strategyTemplateId: 'template-1',
      scriptSnapshot: 'const strategy = { protocolVersion: "v1" }\nstrategy\n',
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
      strategyConfig: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        baseTimeframe: '15m',
        positionPct: 10,
        strategyDeclaredLeverageRange: null,
      },
      backtestConfigDefaults: {
        initialCash: 10000,
        leverage: 1,
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
        allowPartial: false,
      },
      deploymentExecutionDefaults: {
        leverage: 1,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'gtc',
      },
      deploymentExecutionConstraints: {
        platformRiskMaxLeverage: 1,
        strategyDeclaredLeverageRange: null,
        defaultLeverage: 1,
        supportedPriceSources: ['close'],
        supportedOrderTypes: ['market'],
        supportedTimeInForce: ['gtc'],
        constraintExplanation: 'default spot execution constraints',
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
    })

    expect(tx.publishedStrategySnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        session: { connect: { id: 'session-1' } },
        strategyInstanceId: 'instance-1',
        strategyTemplateId: 'template-1',
        scriptSnapshot: 'const strategy = { protocolVersion: "v1" }\nstrategy\n',
        specSnapshot: {
          market: { exchange: 'okx', symbol: 'BTCUSDT', timeframe: '15m' },
          entries: [{ action: 'OPEN_SHORT', trigger: 'close > upper' }],
        },
        consistencyReport: {
          status: 'PASSED',
          summary: { criticalFailed: 0, warningFailed: 0, unprovable: 0 },
        },
        strategyConfig: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          baseTimeframe: '15m',
          positionPct: 10,
          strategyDeclaredLeverageRange: null,
        },
        backtestConfigDefaults: {
          initialCash: 10000,
          leverage: 1,
          slippageBps: 10,
          feeBps: 5,
          priceSource: 'close',
          allowPartial: false,
        },
        deploymentExecutionDefaults: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'market',
          timeInForce: 'gtc',
        },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 1,
          strategyDeclaredLeverageRange: null,
          defaultLeverage: 1,
          supportedPriceSources: ['close'],
          supportedOrderTypes: ['market'],
          supportedTimeInForce: ['gtc'],
          constraintExplanation: 'default spot execution constraints',
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
        specHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      }),
    }))
    expect(result.id).toBe('snapshot-1')
  })

  it('persists compiled snapshot fields with stable hashes', async () => {
    const tx = {
      publishedStrategySnapshot: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'snapshot-compiled-1',
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          ...data,
        })),
      },
    }
    const repo = new PublishedStrategySnapshotsRepository(createTxHost(tx))

    await repo.create({
      sessionId: 'session-1',
      scriptSnapshot: 'const strategy = {}',
      specSnapshot: { graphDigest: 'sha256:graph' },
      semanticGraph: { version: 1, nodes: [{ id: 'entry-1' }] },
      compiledIr: { irVersion: 'csi.v1', rules: [{ id: 'rule-1' }] },
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
      userIntentSummary: { marketScope: ['BTCUSDT'] },
      strategySummary: { thesis: 'ma-crossover' },
      scriptSummary: { indicators: ['EMA'] },
      lockedParams: { positionPct: 25 },
      snapshotVersion: 2,
      strategyConfig: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        baseTimeframe: '15m',
        positionPct: 10,
        strategyDeclaredLeverageRange: null,
      },
      backtestConfigDefaults: {
        initialCash: 10000,
        leverage: 1,
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
        allowPartial: false,
      },
      deploymentExecutionDefaults: {
        leverage: 1,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'gtc',
      },
      deploymentExecutionConstraints: {
        platformRiskMaxLeverage: 1,
        strategyDeclaredLeverageRange: null,
        defaultLeverage: 1,
        supportedPriceSources: ['close'],
        supportedOrderTypes: ['market'],
        supportedTimeInForce: ['gtc'],
        constraintExplanation: 'default spot execution constraints',
      },
      executionEnvelope: {
        positionMode: 'long_only',
        marginMode: 'cash',
        tickSize: 0.01,
        pricePrecision: 2,
        quantityPrecision: 6,
        fillAssumption: 'strict',
      },
    })

    expect(tx.publishedStrategySnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        semanticGraph: { version: 1, nodes: [{ id: 'entry-1' }] },
        compiledIr: { irVersion: 'csi.v1', rules: [{ id: 'rule-1' }] },
        specHash: 'sha256:spec',
        irSnapshot: { irVersion: 'csi.v1' },
        astSnapshot: { astVersion: 'csa.v1' },
        executionEnvelope: expect.objectContaining({
          positionMode: 'long_only',
          marginMode: 'cash',
        }),
        compiledManifest: expect.objectContaining({
          astDigest: 'sha256:ast',
          compileVersion: 'compiler.v1',
          irHash: 'sha256:ir',
          specHash: 'sha256:spec',
          structuralDigest: 'sha256:struct',
        }),
      }),
    }))
  })

  it('preserves compiled script bytes exactly, including terminal newline', async () => {
    const tx = {
      publishedStrategySnapshot: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'snapshot-compiled-newline-1',
          createdAt: new Date('2026-04-07T08:00:00.000Z'),
          ...data,
        })),
      },
    }
    const repo = new PublishedStrategySnapshotsRepository(createTxHost(tx))
    const scriptSnapshot = [
      '/* @generated by compiler.v1 */',
      'const strategy = { protocolVersion: "v1" }',
      'export default strategy',
      '',
    ].join('\n')

    await repo.create({
      sessionId: 'session-1',
      scriptSnapshot,
      specSnapshot: { market: { exchange: 'okx', symbol: 'BTCUSDT', timeframe: '15m' } },
      consistencyReport: { status: 'PASSED' },
      userIntentSummary: { marketScope: ['BTCUSDT'] },
      strategySummary: { thesis: 'compiled-script-byte-preservation' },
      scriptSummary: { indicators: ['BBANDS'] },
      lockedParams: { positionPct: 10 },
    })

    expect(tx.publishedStrategySnapshot.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        scriptSnapshot,
      }),
    }))
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
    const repo = new PublishedStrategySnapshotsRepository(createTxHost(tx))

    const baseInput = {
      sessionId: 'session-1',
      strategyInstanceId: 'instance-1',
      strategyTemplateId: 'template-1',
      scriptSnapshot: 'const strategy = { protocolVersion: "v1" }\nstrategy',
      specSnapshot: {
        market: { exchange: 'okx', symbol: 'BTCUSDT', timeframe: '15m' },
      },
      semanticGraph: {
        version: 1,
        nodes: [{ id: 'entry-1' }],
      },
      compiledIr: {
        irVersion: 'csi.v1',
        rules: [{ id: 'rule-1' }],
      },
      consistencyReport: {
        status: 'PASSED',
      },
      paramsSnapshot: { positionPct: 10 },
      executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
      dataRequirements: { primary: ['15m'] },
      strategyConfig: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        baseTimeframe: '15m',
        positionPct: 10,
        strategyDeclaredLeverageRange: null,
      },
      backtestConfigDefaults: {
        initialCash: 10000,
        leverage: 1,
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
        allowPartial: false,
      },
      deploymentExecutionDefaults: {
        leverage: 1,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'gtc',
      },
      deploymentExecutionConstraints: {
        platformRiskMaxLeverage: 1,
        strategyDeclaredLeverageRange: null,
        defaultLeverage: 1,
        supportedPriceSources: ['close'],
        supportedOrderTypes: ['market'],
        supportedTimeInForce: ['gtc'],
        constraintExplanation: 'default spot execution constraints',
      },
      userIntentSummary: { marketScope: ['BTCUSDT'] },
      strategySummary: { thesis: 'mean-reversion' },
      scriptSummary: { indicators: ['BBANDS'] },
      lockedParams: { leverage: 3 },
      snapshotVersion: 2,
    }

    await repo.create(baseInput)
    await repo.create({
      ...baseInput,
      semanticGraph: {
        version: 1,
        nodes: [{ id: 'entry-2' }],
      },
    })

    const firstCall = tx.publishedStrategySnapshot.create.mock.calls[0][0]
    const secondCall = tx.publishedStrategySnapshot.create.mock.calls[1][0]

    expect(firstCall.data.snapshotHash).not.toBe(secondCall.data.snapshotHash)
  })

  it('includes structured formal snapshot truth fields in snapshot hash', async () => {
    const tx = {
      publishedStrategySnapshot: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'snapshot-structured',
          createdAt: new Date('2026-04-12T10:00:00.000Z'),
          ...data,
        })),
      },
    }
    const repo = new PublishedStrategySnapshotsRepository(createTxHost(tx))

    const baseInput = {
      sessionId: 'session-1',
      scriptSnapshot: 'const strategy = { protocolVersion: "v1" }\nstrategy',
      specSnapshot: {
        market: { exchange: 'okx', symbol: 'BTCUSDT', timeframe: '15m' },
      },
      consistencyReport: { status: 'PASSED' },
      strategyConfig: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        baseTimeframe: '15m',
        positionPct: 10,
        strategyDeclaredLeverageRange: null,
      },
      backtestConfigDefaults: {
        initialCash: 10000,
        leverage: 1,
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
        allowPartial: false,
      },
      deploymentExecutionDefaults: {
        leverage: 1,
        priceSource: 'close',
        orderType: 'market',
        timeInForce: 'gtc',
      },
      deploymentExecutionConstraints: {
        platformRiskMaxLeverage: 1,
        strategyDeclaredLeverageRange: null,
        defaultLeverage: 1,
        supportedPriceSources: ['close'],
        supportedOrderTypes: ['market'],
        supportedTimeInForce: ['gtc'],
        constraintExplanation: 'default spot execution constraints',
      },
      userIntentSummary: { marketScope: ['BTCUSDT'] },
      strategySummary: { thesis: 'mean-reversion' },
      scriptSummary: { indicators: ['BBANDS'] },
      lockedParams: { leverage: 3 },
      snapshotVersion: 3,
    }

    await repo.create(baseInput)
    await repo.create({
      ...baseInput,
      backtestConfigDefaults: {
        ...baseInput.backtestConfigDefaults,
        leverage: 2,
      },
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
    const repo = new PublishedStrategySnapshotsRepository(createTxHost(tx))

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
    const repo = new PublishedStrategySnapshotsRepository(createTxHost(tx))

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
