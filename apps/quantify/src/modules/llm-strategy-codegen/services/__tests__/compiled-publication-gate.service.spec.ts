import type { CanonicalStrategyIrV1 } from '../../types/canonical-strategy-ir'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CompiledPublicationGateService } from '../compiled-publication-gate.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'

describe('compiled publication gate service', () => {
  it('publishes canonical snapshot, semantic view, compiled artifacts, and merged consistency as one runtime snapshot', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'snapshot-1' }),
    }
    const gate = new CompiledPublicationGateService(
      publishedSnapshotsRepo as never,
      undefined,
    )
    const ir = createIrFixture()
    const ast = new CanonicalStrategyAstCompilerService().compile(ir)
    const executionEnvelope = {
      positionMode: 'long_only' as const,
      marginMode: 'cash' as const,
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict' as const,
    }
    const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope })
    const canonicalSnapshot = {
      version: 2,
      market: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '1h',
      },
      rules: [
        {
          id: 'entry-long',
          phase: 'entry',
          sideScope: 'long',
        },
      ],
    }
    const semanticView = {
      viewType: 'canonical-semantic-view.v1',
      canonicalDigest: 'sha256:canonical-1',
      confirmation: {
        required: true,
        digest: 'sha256:canonical-1',
      },
    }
    const graphSnapshot = {
      version: 3,
      status: 'confirmed' as const,
      trigger: [
        { id: 'trigger-entry-1', phase: 'entry' as const, operator: 'CROSS_OVER(EMA(CLOSE,7),EMA(CLOSE,21))' },
      ],
      actions: [
        { id: 'action-buy-1', action: 'BUY' as const, target: 'BTCUSDT', amount: '25%' },
      ],
      risk: ['stopLossPct: STOP_LOSS_PCT(4)'],
      meta: {
        exchange: 'binance' as const,
        symbol: 'BTCUSDT',
        timeframe: '1h',
        positionPct: 25,
        executionTags: [],
      },
    }

    const result = await gate.publish({
      sessionId: 'session-1',
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
      canonicalSnapshot,
      semanticView,
      graphSnapshot,
      ir,
      ast,
      executionEnvelope,
      script,
      semanticConsistencyReport: { status: 'PASSED', checks: [] },
      userIntentSummary: { marketScope: ['BTCUSDT'] },
      strategySummary: { thesis: 'ma-crossover' },
      scriptSummary: { indicators: ['EMA'] },
      lockedParams: { positionPct: 25 },
    })

    expect(result.snapshotId).toBe('snapshot-1')
    expect(publishedSnapshotsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-1',
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
      specSnapshot: canonicalSnapshot,
      semanticGraph: semanticView,
      irSnapshot: expect.objectContaining({ irVersion: 'csi.v1' }),
      astSnapshot: expect.objectContaining({ astVersion: 'csa.v1' }),
      compiledManifest: expect.objectContaining({ compileVersion: 'compiler.v1' }),
      consistencyReport: expect.objectContaining({
        status: 'PASSED',
        semanticConsistency: { status: 'PASSED', checks: [] },
        compilerConsistency: expect.any(Object),
      }),
      paramsSnapshot: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        marketType: 'spot',
        positionPct: 25,
      },
      executionEnvelope: expect.objectContaining({ marginMode: 'cash' }),
      snapshotVersion: 3,
    }))
  })

  it('keeps exchange, marketType, and pct_equity positionPct in paramsSnapshot for non-long-only execution envelopes', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'snapshot-2' }),
    }
    const gate = new CompiledPublicationGateService(publishedSnapshotsRepo as never)
    const ir = {
      ...createIrFixture(),
      market: {
        ...createIrFixture().market,
        instrumentType: 'perpetual' as const,
      },
      portfolio: {
        ...createIrFixture().portfolio,
        positionMode: 'long_short' as const,
        sizing: { mode: 'pct_equity' as const, value: 25 },
      },
    }
    const ast = new CanonicalStrategyAstCompilerService().compile(ir)
    const executionEnvelope = {
      positionMode: 'long_short' as const,
      marginMode: 'cross' as const,
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict' as const,
    }
    const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope })

    await gate.publish({
      sessionId: 'session-2',
      canonicalSnapshot: {
        version: 2,
        market: { exchange: 'binance', symbol: 'BTCUSDT', timeframe: '1h' },
        rules: [],
      },
      semanticView: {
        viewType: 'canonical-semantic-view.v1',
        canonicalDigest: 'sha256:non-long-only',
      },
      graphSnapshot: {
        version: 3,
        status: 'confirmed' as const,
        trigger: [],
        actions: [],
        risk: [],
        meta: {
          exchange: 'binance' as const,
          symbol: 'BTCUSDT',
          timeframe: '1h',
          positionPct: 25,
          executionTags: [],
        },
      },
      ir,
      ast,
      executionEnvelope,
      script,
      semanticConsistencyReport: { status: 'PASSED', checks: [] },
      userIntentSummary: { marketScope: ['BTCUSDT'] },
      strategySummary: { thesis: 'long-short' },
      scriptSummary: { indicators: ['EMA'] },
      lockedParams: {},
    })

    expect(publishedSnapshotsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      paramsSnapshot: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        marketType: 'perp',
        positionPct: 25,
      },
    }))
  })

  it('rejects publish when clarification items remain pending', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn(),
    }
    const gate = new CompiledPublicationGateService(publishedSnapshotsRepo as never)
    const ir = createIrFixture()
    const ast = new CanonicalStrategyAstCompilerService().compile(ir)
    const executionEnvelope = {
      positionMode: 'long_only' as const,
      marginMode: 'cash' as const,
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict' as const,
    }
    const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope })

    await expect(gate.publish({
      sessionId: 'session-clarification',
      canonicalSnapshot: {
        version: 2,
        market: { exchange: 'binance', symbol: 'BTCUSDT', timeframe: '1h' },
        rules: [],
      },
      semanticView: {
        viewType: 'canonical-semantic-view.v1',
        canonicalDigest: 'sha256:clarification',
      },
      graphSnapshot: {
        version: 3,
        status: 'confirmed' as const,
        trigger: [],
        actions: [],
        risk: [],
        meta: {
          exchange: 'binance' as const,
          symbol: 'BTCUSDT',
          timeframe: '1h',
          positionPct: 25,
          executionTags: [],
        },
      },
      clarificationState: {
        strategyType: 'grid',
        lastAskedItemId: 'grid:gridSpacingMode',
        items: [
          {
            id: 'grid:gridSpacingMode',
            kind: 'semantic_ambiguity',
            strategyType: 'grid',
            field: 'gridSpacingMode',
            reason: '当前网格间距仍有两种可编译解释',
            question: '这里的1%等距网格，是固定价差，还是按百分比递增的复利网格？',
            priority: 80,
            status: 'pending' as const,
          },
        ],
      },
      ir,
      ast,
      executionEnvelope,
      script,
      semanticConsistencyReport: { status: 'PASSED', checks: [] },
      userIntentSummary: { marketScope: ['BTCUSDT'] },
      strategySummary: { thesis: 'grid' },
      scriptSummary: { indicators: [] },
      lockedParams: { positionPct: 25 },
    } as any)).rejects.toThrow('clarification unresolved')

    expect(publishedSnapshotsRepo.create).not.toHaveBeenCalled()
  })

  it('rejects publish when confirmed exchange is okx but compiled artifact venue is binance', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn(),
    }
    const gate = new CompiledPublicationGateService(publishedSnapshotsRepo as never)
    const ir = createIrFixture()
    const ast = new CanonicalStrategyAstCompilerService().compile(ir)
    const executionEnvelope = {
      positionMode: 'long_only' as const,
      marginMode: 'cash' as const,
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict' as const,
    }
    const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope })

    await expect(gate.publish({
      sessionId: 'session-exchange-drift',
      canonicalSnapshot: {
        version: 2,
        market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'spot', timeframe: '1h' },
        rules: [],
      },
      semanticView: {
        viewType: 'canonical-semantic-view.v1',
        canonicalDigest: 'sha256:exchange-drift',
      },
      graphSnapshot: {
        version: 3,
        status: 'confirmed' as const,
        trigger: [],
        actions: [],
        risk: [],
        meta: {
          exchange: 'okx' as const,
          symbol: 'BTCUSDT',
          timeframe: '1h',
          positionPct: 25,
          executionTags: [],
        },
      },
      ir,
      ast,
      executionEnvelope,
      script,
      semanticConsistencyReport: { status: 'PASSED', checks: [] },
      userIntentSummary: { marketScope: ['BTCUSDT'] },
      strategySummary: { thesis: 'ma-crossover' },
      scriptSummary: { indicators: ['EMA'] },
      lockedParams: { positionPct: 25 },
    })).rejects.toThrow('publication gate blocked')

    expect(publishedSnapshotsRepo.create).not.toHaveBeenCalled()
  })

  it('rejects publish when early-stop reduce rule is absent from compiled artifact', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn(),
    }
    const gate = new CompiledPublicationGateService(publishedSnapshotsRepo as never)
    const ir = createIrFixture()
    const ast = new CanonicalStrategyAstCompilerService().compile(ir)
    const executionEnvelope = {
      positionMode: 'long_only' as const,
      marginMode: 'cash' as const,
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict' as const,
    }
    const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope })

    await expect(gate.publish({
      sessionId: 'session-outside-rule-missing',
      canonicalSnapshot: {
        version: 2,
        market: { exchange: 'binance', symbol: 'BTCUSDT', marketType: 'spot', timeframe: '1h' },
        rules: [
          {
            id: 'risk-outside-band-3-bars',
            phase: 'risk',
            sideScope: 'both',
            priority: 110,
            condition: {
              kind: 'atom',
              key: 'bollinger.bars_outside',
              semanticScope: 'market',
              op: 'GTE',
              value: 3,
              params: { bars: 3 },
            },
            actions: [{ type: 'REDUCE_LONG' }, { type: 'REDUCE_SHORT' }],
          },
        ],
      },
      semanticView: {
        viewType: 'canonical-semantic-view.v1',
        canonicalDigest: 'sha256:outside-band-missing',
      },
      graphSnapshot: {
        version: 3,
        status: 'confirmed' as const,
        trigger: [],
        actions: [],
        risk: ['价格连续3根K线在轨外时提前减仓'],
        meta: {
          exchange: 'binance' as const,
          symbol: 'BTCUSDT',
          timeframe: '1h',
          positionPct: 25,
          executionTags: [],
        },
      },
      ir,
      ast,
      executionEnvelope,
      script,
      semanticConsistencyReport: { status: 'PASSED', checks: [] },
      userIntentSummary: { marketScope: ['BTCUSDT'] },
      strategySummary: { thesis: 'outside-band-risk' },
      scriptSummary: { indicators: ['EMA'] },
      lockedParams: { positionPct: 25 },
    })).rejects.toThrow('publication gate blocked')

    expect(publishedSnapshotsRepo.create).not.toHaveBeenCalled()
  })

  it('publishes when outside-band reduce rule is present in compiled artifact', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'snapshot-outside-ok' }),
    }
    const gate = new CompiledPublicationGateService(publishedSnapshotsRepo as never)
    const ir = createIrFixtureWithOutsideBandRule()
    const ast = new CanonicalStrategyAstCompilerService().compile(ir)
    const executionEnvelope = {
      positionMode: 'long_short' as const,
      marginMode: 'cash' as const,
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict' as const,
    }
    const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope })

    await expect(gate.publish({
      sessionId: 'session-outside-rule-present',
      canonicalSnapshot: {
        version: 2,
        market: { exchange: 'binance', symbol: 'BTCUSDT', marketType: 'spot', timeframe: '1h' },
        rules: [
          {
            id: 'risk-outside-band-3-bars',
            phase: 'risk',
            sideScope: 'both',
            priority: 110,
            condition: {
              kind: 'atom',
              key: 'bollinger.bars_outside',
              semanticScope: 'market',
              op: 'GTE',
              value: 3,
              params: { bars: 3 },
            },
            actions: [{ type: 'REDUCE_LONG' }, { type: 'REDUCE_SHORT' }],
          },
        ],
      },
      semanticView: {
        viewType: 'canonical-semantic-view.v1',
        canonicalDigest: 'sha256:outside-band-present',
      },
      graphSnapshot: {
        version: 3,
        status: 'confirmed' as const,
        trigger: [],
        actions: [],
        risk: ['价格连续3根K线在轨外时提前减仓'],
        meta: {
          exchange: 'binance' as const,
          symbol: 'BTCUSDT',
          timeframe: '1h',
          positionPct: 25,
          executionTags: [],
        },
      },
      ir,
      ast,
      executionEnvelope,
      script,
      semanticConsistencyReport: { status: 'PASSED', checks: [] },
      userIntentSummary: { marketScope: ['BTCUSDT'] },
      strategySummary: { thesis: 'outside-band-risk' },
      scriptSummary: { indicators: ['EMA', 'BOLLINGER'] },
      lockedParams: { positionPct: 25 },
    })).resolves.toEqual({
      snapshotId: 'snapshot-outside-ok',
      consistencyReport: expect.objectContaining({
        status: 'PASSED',
        compilerConsistency: expect.objectContaining({
          publicationGate: expect.objectContaining({
            status: 'PASSED',
            checks: expect.arrayContaining([
              expect.objectContaining({
                key: 'risk.bollinger_bars_outside',
                status: 'passed',
              }),
            ]),
          }),
        }),
      }),
    })

    expect(publishedSnapshotsRepo.create).toHaveBeenCalled()
  })

  it('returns merged failed consistency report instead of throwing so caller can persist diagnostics', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'snapshot-failed' }),
    }
    const gate = new CompiledPublicationGateService(
      publishedSnapshotsRepo as never,
      undefined,
    )
    const ir = createIrFixture()
    const ast = new CanonicalStrategyAstCompilerService().compile(ir)
    const executionEnvelope = {
      positionMode: 'long_only' as const,
      marginMode: 'cash' as const,
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict' as const,
    }
    const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope })

    await expect(gate.publish({
      sessionId: 'session-consistency-failed',
      canonicalSnapshot: {
        version: 2,
        market: { exchange: 'binance', symbol: 'BTCUSDT', timeframe: '1h' },
        rules: [],
      },
      semanticView: {
        viewType: 'canonical-semantic-view.v1',
        canonicalDigest: 'sha256:failed',
      },
      graphSnapshot: {
        version: 3,
        status: 'confirmed' as const,
        trigger: [],
        actions: [],
        risk: [],
        meta: {
          exchange: 'binance' as const,
          symbol: 'BTCUSDT',
          timeframe: '1h',
          positionPct: 25,
          executionTags: [],
        },
      },
      ir,
      ast,
      executionEnvelope,
      script,
      semanticConsistencyReport: { status: 'FAILED', reasons: ['mismatch'] },
      userIntentSummary: { marketScope: ['BTCUSDT'] },
      strategySummary: { thesis: 'ma-crossover' },
      scriptSummary: { indicators: ['EMA'] },
      lockedParams: { positionPct: 25 },
    })).resolves.toEqual({
      snapshotId: 'snapshot-failed',
      consistencyReport: expect.objectContaining({
        status: 'FAILED',
        semanticConsistency: { status: 'FAILED', reasons: ['mismatch'] },
        compilerConsistency: expect.any(Object),
      }),
    })

    expect(publishedSnapshotsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-consistency-failed',
      consistencyReport: expect.objectContaining({
        status: 'FAILED',
        semanticConsistency: { status: 'FAILED', reasons: ['mismatch'] },
        compilerConsistency: expect.any(Object),
      }),
    }))
  })
})

function createIrFixture(): CanonicalStrategyIrV1 {
  return {
    irVersion: 'csi.v1',
    source: {
      graphVersion: 18,
      graphDigest: 'sha256:11aa',
      specHash: 'sha256:11aa',
    },
    market: {
      venue: 'binance',
      instrumentType: 'spot',
      symbol: 'BTCUSDT',
      timeframes: ['1h'],
      priceFeed: 'close',
    },
    portfolio: {
      positionMode: 'long_only',
      sizing: { mode: 'pct_equity', value: 25 },
      maxConcurrentPositions: 1,
      allowPyramiding: false,
      maxPyramidingLayers: 1,
    },
    dataRequirements: {
      warmupBars: 21,
      maxLookback: 21,
      requiredTimeframes: ['1h'],
    },
    signalCatalog: {
      series: [
        { id: 'close_1h', kind: 'PRICE', timeframe: '1h', field: 'close' },
        { id: 'ema_7', kind: 'EMA', inputs: ['close_1h'], params: { period: 7 } },
        { id: 'ema_21', kind: 'EMA', inputs: ['close_1h'], params: { period: 21 } },
      ],
      levelSets: [],
      predicates: [
        { id: 'entry_cross', kind: 'CROSS_OVER', args: ['ema_7', 'ema_21'] },
        { id: 'exit_cross', kind: 'CROSS_UNDER', args: ['ema_7', 'ema_21'] },
      ],
    },
    ruleBlocks: [
      {
        id: 'entry_long',
        phase: 'entry',
        when: 'entry_cross',
        priority: 200,
        actions: [
          { kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 25 } },
        ],
      },
      {
        id: 'exit_long',
        phase: 'exit',
        when: 'exit_cross',
        priority: 100,
        actions: [
          { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
        ],
      },
    ],
    orderPrograms: [],
    riskPolicy: {
      guards: [
        { id: 'stop_loss_4', kind: 'STOP_LOSS_PCT', scope: 'position', value: 4, onBreach: 'FORCE_EXIT' },
      ],
    },
    executionPolicy: {
      signalEvaluation: 'bar_close',
      fillPolicy: 'next_bar_open',
      timeframeAlignment: 'strict',
      orderTypeDefault: 'market',
      timeInForce: 'gtc',
      allowPartialFill: false,
    },
  }
}

function createIrFixtureWithOutsideBandRule(): CanonicalStrategyIrV1 {
  const base = createIrFixture()

  return {
    ...base,
    portfolio: {
      ...base.portfolio,
      positionMode: 'long_short',
    },
    signalCatalog: {
      series: [
        ...base.signalCatalog.series,
        {
          id: 'outside_band_3',
          kind: 'BOLLINGER_BARS_OUTSIDE',
          inputs: ['close_1h'],
          params: { bars: 3 },
        },
      ],
      levelSets: base.signalCatalog.levelSets,
      predicates: [
        ...base.signalCatalog.predicates,
        {
          id: 'risk_outside_band_3',
          kind: 'GTE',
          args: ['outside_band_3'],
        },
      ],
    },
    ruleBlocks: [
      ...base.ruleBlocks,
      {
        id: 'rebalance_outside_band_3',
        phase: 'rebalance',
        when: 'risk_outside_band_3',
        priority: 110,
        actions: [
          { kind: 'REDUCE_LONG', quantity: { mode: 'position_pct', value: 50 } },
          { kind: 'REDUCE_SHORT', quantity: { mode: 'position_pct', value: 50 } },
        ],
      },
    ],
  }
}
