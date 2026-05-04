import type { CanonicalStrategyIrV1 } from '../../types/canonical-strategy-ir'
import { createHash } from 'node:crypto'
import { canonicalSerialize } from '@ai/shared/script-engine/compiled-runtime'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CompiledPublicationGateService } from '../compiled-publication-gate.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'

describe('compiledPublicationGateService', () => {
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
      indicators: [{ kind: 'ema', params: { period: 20 } }],
      rules: [
        {
          id: 'entry-long',
          phase: 'entry',
          sideScope: 'long',
          priority: 200,
          condition: {
            kind: 'atom',
            key: 'ma.golden_cross',
            semanticScope: 'market',
            op: 'CROSS_OVER',
            params: { indicator: 'ema' },
          },
          actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.25 } }],
        },
        {
          id: 'exit-long',
          phase: 'exit',
          sideScope: 'long',
          priority: 100,
          condition: {
            kind: 'atom',
            key: 'ma.death_cross',
            semanticScope: 'market',
            op: 'CROSS_UNDER',
            params: { indicator: 'ema' },
          },
          actions: [{ type: 'CLOSE_LONG' }],
        },
        {
          id: 'risk-stop-loss',
          phase: 'risk',
          sideScope: 'both',
          priority: 90,
          condition: {
            kind: 'atom',
            key: 'position_loss_pct',
            semanticScope: 'position',
            op: 'GTE',
            value: 0.04,
            params: { basis: 'entry_avg_price' },
          },
          actions: [{ type: 'FORCE_EXIT' }],
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
      semanticPredicateGraph: createSemanticPredicateGraphFixture(),
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
      semanticGraph: createSemanticPredicateGraphFixture(),
      irSnapshot: expect.objectContaining({ irVersion: 'csi.v1' }),
      astSnapshot: expect.objectContaining({ astVersion: 'csa.v1' }),
      compiledManifest: expect.objectContaining({ compileVersion: 'compiler.v1' }),
      consistencyReport: expect.objectContaining({
        status: 'PASSED',
        semanticConsistency: { status: 'PASSED', checks: [] },
        compilerConsistency: expect.any(Object),
      }),
      scriptSummary: { indicators: ['EMA'] },
      paramsSnapshot: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        marketType: 'spot',
        positionPct: 25,
        positionSizing: { mode: 'pct_equity', value: 25 },
      },
      strategyConfig: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        baseTimeframe: '1h',
        stateTimeframes: [],
        positionPct: 25,
        positionSizing: { mode: 'pct_equity', value: 25 },
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
        effectiveAllowedLeverageRange: { min: 1, max: 1 },
        supportedPriceSources: ['close'],
        supportedOrderTypes: ['market'],
        supportedTimeInForce: ['gtc'],
        constraintExplanation: 'strategy/default constraints pending account-capability intersection',
      },
      executionEnvelope: expect.objectContaining({ marginMode: 'cash' }),
      snapshotVersion: 3,
    }))

    const payload = publishedSnapshotsRepo.create.mock.calls[0][0]
    expect(payload.deploymentExecutionDefaults).not.toHaveProperty('tdMode')
    expect(payload.deploymentExecutionConstraints).not.toHaveProperty('supportedTdModes')
  })

  it('publishes perp deployment execution truth with explicit cross tdMode', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'snapshot-perp-tdmode' }),
    }
    const gate = new CompiledPublicationGateService(
      publishedSnapshotsRepo as never,
      undefined,
    )
    const ir = createIrFixture({
      exchange: 'okx',
      symbol: 'BTC-USDT-SWAP',
      instrumentType: 'perpetual',
      timeframes: ['15m'],
    })
    const ast = new CanonicalStrategyAstCompilerService().compile(ir)
    const executionEnvelope = {
      positionMode: 'long_only' as const,
      marginMode: 'cross' as const,
      tickSize: 0.1,
      pricePrecision: 1,
      quantityPrecision: 2,
      fillAssumption: 'strict' as const,
    }
    const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope })

    await gate.publish({
      sessionId: 'session-perp-tdmode',
      strategyTemplateId: 'template-perp',
      strategyInstanceId: 'instance-perp',
      canonicalSnapshot: {
        version: 2,
        market: { exchange: 'okx', symbol: 'BTC-USDT-SWAP', timeframe: '15m' },
        indicators: [],
        rules: [],
      },
      semanticView: { viewType: 'canonical-semantic-view.v1', canonicalDigest: 'sha256:perp', confirmation: { required: false } },
      semanticPredicateGraph: createSemanticPredicateGraphFixture(),
      graphSnapshot: { version: 3, status: 'confirmed', trigger: [], actions: [], risk: [], meta: { exchange: 'okx', symbol: 'BTC-USDT-SWAP', timeframe: '15m', positionPct: 25, executionTags: [] } },
      ir,
      ast,
      executionEnvelope,
      script,
      semanticConsistencyReport: { status: 'PASSED', checks: [] },
      userIntentSummary: { marketScope: ['BTC-USDT-SWAP'] },
      strategySummary: { thesis: 'perp-cross' },
      scriptSummary: { indicators: [] },
      lockedParams: { positionPct: 25 },
    })

    expect(publishedSnapshotsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      strategyConfig: expect.objectContaining({ marketType: 'perp' }),
      deploymentExecutionDefaults: expect.objectContaining({
        leverage: 1,
        tdMode: 'cross',
      }),
      deploymentExecutionConstraints: expect.objectContaining({
        supportedTdModes: ['cross'],
      }),
    }))
  })

  it('fails compiler graph consistency when semantic predicate graph digest drifts from IR source', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'snapshot-graph-drift' }),
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

    await gate.publish({
      sessionId: 'session-graph-drift',
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
      canonicalSnapshot: {
        version: 2,
        market: { exchange: 'binance', symbol: 'BTCUSDT', timeframe: '1h' },
        indicators: [],
        rules: [],
      },
      semanticView: { viewType: 'canonical-semantic-view.v1' },
      semanticPredicateGraph: {
        version: 2,
        nodes: [{
          id: 'entry-drift',
          kind: 'predicate',
          phase: 'entry',
          op: 'GT',
          left: { kind: 'series', source: 'bar', field: 'close' },
          right: { kind: 'series', source: 'bar', field: 'open' },
        }],
        edges: [],
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
      strategySummary: { thesis: 'graph-drift' },
      scriptSummary: { indicators: ['EMA'] },
      lockedParams: { positionPct: 25 },
    })

    expect(publishedSnapshotsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      consistencyReport: expect.objectContaining({
        status: 'FAILED',
        compilerConsistency: expect.objectContaining({
          status: 'FAILED',
          graphVsIr: expect.objectContaining({
            passed: false,
            graphDigest: ir.source.graphDigest,
            semanticGraphDigest: expect.stringMatching(/^sha256:/),
          }),
        }),
      }),
    }))
  })

  it('fails compiler graph consistency when semantic predicate graph is missing', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'snapshot-missing-graph' }),
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

    await gate.publish({
      sessionId: 'session-missing-graph',
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
      canonicalSnapshot: {
        version: 2,
        market: { exchange: 'binance', symbol: 'BTCUSDT', timeframe: '1h' },
        indicators: [],
        rules: [],
      },
      semanticView: { viewType: 'canonical-semantic-view.v1' },
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
      strategySummary: { thesis: 'missing-graph' },
      scriptSummary: { indicators: ['EMA'] },
      lockedParams: { positionPct: 25 },
    })

    expect(publishedSnapshotsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      consistencyReport: expect.objectContaining({
        status: 'FAILED',
        compilerConsistency: expect.objectContaining({
          status: 'FAILED',
          graphVsIr: expect.objectContaining({
            passed: false,
            graphDigest: ir.source.graphDigest,
            semanticGraphDigest: null,
          }),
        }),
      }),
    }))
  })

  it('persists explicit on_start runtime execution semantics when ast source refs carry on_start markers', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'snapshot-on-start-1' }),
    }
    const gate = new CompiledPublicationGateService(publishedSnapshotsRepo as never)
    const ir = createIrFixture()
    const ast = new CanonicalStrategyAstCompilerService().compile(ir)
    ast.decisionPrograms[0] = {
      ...ast.decisionPrograms[0]!,
      sourceRef: 'entry-execution-on_start-210',
    }
    const executionEnvelope = {
      positionMode: 'long_only' as const,
      marginMode: 'cash' as const,
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict' as const,
    }
    const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope })

    await gate.publish({
      sessionId: 'session-on-start-1',
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
      canonicalSnapshot: {
        version: 2,
        market: { exchange: 'binance', symbol: 'BTCUSDT', timeframe: '1h' },
        indicators: [],
        rules: [],
      },
      semanticView: { viewType: 'canonical-semantic-view.v1' },
      semanticPredicateGraph: createSemanticPredicateGraphFixture(),
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
      strategySummary: { thesis: 'on-start' },
      scriptSummary: { indicators: ['EMA'] },
      lockedParams: { positionPct: 25 },
    })

    expect(publishedSnapshotsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      astSnapshot: expect.objectContaining({
        runtimeExecutionSemantics: [{
          semanticKey: 'on_start.entry.primary',
          trigger: 'on_start',
          phase: 'entry',
          consumePolicy: 'once',
          requiredRuntimeContext: {
            barIndex: 1,
            requiresReferenceBar: true,
            requiresSymbol: true,
            requiresTimeframe: true,
          },
          sourceRefs: ['entry-execution-on_start-210'],
        }],
      }),
    }))
  })

  it('publishes deploy leverage ranges for generated perpetual snapshots', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'snapshot-perp-1' }),
    }
    const gate = new CompiledPublicationGateService(publishedSnapshotsRepo as never)
    const ir = createShortOnlyIrFixture()
    const ast = new CanonicalStrategyAstCompilerService().compile(ir)
    const executionEnvelope = {
      positionMode: 'short_only' as const,
      marginMode: 'cross' as const,
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict' as const,
    }
    const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope })

    await gate.publish({
      sessionId: 'session-perp-1',
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
      canonicalSnapshot: {
        version: 2,
        market: { exchange: 'binance', symbol: 'BTCUSDT', timeframe: '1h' },
        indicators: [],
        rules: [],
      },
      semanticView: { viewType: 'canonical-semantic-view.v1' },
      semanticPredicateGraph: createSemanticPredicateGraphFixture(),
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
      strategySummary: { thesis: 'perp-short' },
      scriptSummary: { indicators: [] },
      lockedParams: { positionPct: 25 },
    })

    expect(publishedSnapshotsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      deploymentExecutionConstraints: expect.objectContaining({
        platformRiskMaxLeverage: 5,
        defaultLeverage: 1,
        effectiveAllowedLeverageRange: { min: 1, max: 5 },
      }),
    }))
  })

  it('collapses multiple on_start markers into a single snapshot runtime semantic', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'snapshot-on-start-2' }),
    }
    const gate = new CompiledPublicationGateService(publishedSnapshotsRepo as never)
    const ir = createIrFixture()
    const ast = new CanonicalStrategyAstCompilerService().compile(ir)
    ast.decisionPrograms[0] = {
      ...ast.decisionPrograms[0]!,
      sourceRef: 'entry-execution-on_start-210',
    }
    ast.decisionPrograms[1] = {
      ...ast.decisionPrograms[1]!,
      sourceRef: 'exit-execution-on_start-211',
    }
    const executionEnvelope = {
      positionMode: 'long_only' as const,
      marginMode: 'cash' as const,
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict' as const,
    }
    const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope })

    await gate.publish({
      sessionId: 'session-on-start-2',
      strategyTemplateId: 'template-1',
      strategyInstanceId: 'instance-1',
      canonicalSnapshot: {
        version: 2,
        market: { exchange: 'binance', symbol: 'BTCUSDT', timeframe: '1h' },
        indicators: [],
        rules: [],
      },
      semanticView: { viewType: 'canonical-semantic-view.v1' },
      semanticPredicateGraph: createSemanticPredicateGraphFixture(),
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
      strategySummary: { thesis: 'on-start-collapsed' },
      scriptSummary: { indicators: ['EMA'] },
      lockedParams: { positionPct: 25 },
    })

    expect(publishedSnapshotsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      astSnapshot: expect.objectContaining({
        runtimeExecutionSemantics: [{
          semanticKey: 'on_start.entry.primary',
          trigger: 'on_start',
          phase: 'entry',
          consumePolicy: 'once',
          requiredRuntimeContext: {
            barIndex: 1,
            requiresReferenceBar: true,
            requiresSymbol: true,
            requiresTimeframe: true,
          },
          sourceRefs: ['entry-execution-on_start-210'],
        }],
      }),
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
      semanticPredicateGraph: createSemanticPredicateGraphFixture(),
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
        positionSizing: { mode: 'pct_equity', value: 25 },
      },
      strategyConfig: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        baseTimeframe: '1h',
        stateTimeframes: [],
        positionPct: 25,
        positionSizing: { mode: 'pct_equity', value: 25 },
        strategyDeclaredLeverageRange: null,
      },
    }))
  })

  it('publishes fixed quote position sizing without fabricating a legacy positionPct', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'snapshot-fixed-quote' }),
    }
    const gate = new CompiledPublicationGateService(publishedSnapshotsRepo as never)
    const baseIr = createIrFixture()
    const ir = {
      ...baseIr,
      portfolio: {
        ...baseIr.portfolio,
        sizing: { mode: 'fixed_quote' as const, value: 10, asset: 'USDT' },
      },
      ruleBlocks: baseIr.ruleBlocks.map(rule => rule.phase === 'entry'
        ? {
            ...rule,
            actions: rule.actions.map(action => action.kind === 'OPEN_LONG'
              ? { ...action, quantity: { mode: 'fixed_quote' as const, value: 10, asset: 'USDT' } }
              : action),
          }
        : rule),
    }
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

    await gate.publish({
      sessionId: 'session-fixed-quote',
      canonicalSnapshot: {
        version: 2,
        market: { exchange: 'binance', symbol: 'BTCUSDT', defaultTimeframe: '1h' },
        rules: [],
      } as any,
      semanticView: {
        viewType: 'canonical-semantic-view.v1',
        canonicalDigest: 'sha256:fixed-quote',
      },
      semanticPredicateGraph: createSemanticPredicateGraphFixture(),
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
          positionPct: null,
          executionTags: [],
        },
      },
      ir,
      ast,
      executionEnvelope,
      script,
      semanticConsistencyReport: { status: 'PASSED', checks: [] },
      userIntentSummary: { marketScope: ['BTCUSDT'] },
      strategySummary: { thesis: 'fixed quote' },
      scriptSummary: { indicators: ['EMA'] },
      lockedParams: {},
    })

    expect(publishedSnapshotsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      paramsSnapshot: expect.objectContaining({
        positionPct: null,
        positionSizing: { mode: 'fixed_quote', value: 10, asset: 'USDT' },
      }),
      strategyConfig: expect.objectContaining({
        positionPct: null,
        positionSizing: { mode: 'fixed_quote', value: 10, asset: 'USDT' },
      }),
    }))
  })

  it('publishes state timeframes separately from base timeframe', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'snapshot-multi' }),
    }
    const gate = new CompiledPublicationGateService(publishedSnapshotsRepo as never)
    const ir = {
      ...createIrFixture(),
      market: {
        ...createIrFixture().market,
        venue: 'okx' as const,
        timeframes: ['3m', '15m'],
      },
      dataRequirements: {
        ...createIrFixture().dataRequirements,
        requiredTimeframes: ['3m', '15m'],
      },
    }
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

    await gate.publish({
      sessionId: 'session-multi',
      canonicalSnapshot: {
        version: 2,
        market: { exchange: 'okx', symbol: 'BTCUSDT', defaultTimeframe: '3m' },
        rules: [],
      } as any,
      semanticView: {
        viewType: 'canonical-semantic-view.v1',
        canonicalDigest: 'sha256:multi',
      },
      semanticPredicateGraph: createSemanticPredicateGraphFixture(),
      graphSnapshot: {
        version: 3,
        status: 'confirmed' as const,
        trigger: [],
        actions: [],
        risk: [],
        meta: {
          exchange: 'okx' as const,
          symbol: 'BTCUSDT',
          timeframe: '3m',
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
      strategySummary: { thesis: 'multi-timeframe' },
      scriptSummary: { indicators: ['EMA'] },
      lockedParams: { exchange: 'okx', positionPct: 25 },
    })

    expect(publishedSnapshotsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      strategyConfig: expect.objectContaining({
        baseTimeframe: '3m',
        stateTimeframes: ['15m'],
      }),
      paramsSnapshot: expect.objectContaining({ timeframe: '3m' }),
      dataRequirements: expect.objectContaining({ requiredTimeframes: ['3m', '15m'] }),
      consistencyReport: expect.objectContaining({ status: 'PASSED' }),
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

  it('rejects publish when confirmed single-direction positionMode drifts to long_short in compiled script', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn(),
    }
    const gate = new CompiledPublicationGateService(publishedSnapshotsRepo as never)
    const ir = createIrFixture()
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
      sessionId: 'session-position-mode-drift',
      canonicalSnapshot: {
        version: 2,
        market: { exchange: 'binance', symbol: 'BTCUSDT', marketType: 'spot', timeframe: '1h' },
        rules: [
          {
            id: 'entry-long',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'ma.golden_cross',
              semanticScope: 'market',
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.25 } }],
          },
          {
            id: 'exit-long',
            phase: 'exit',
            sideScope: 'long',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'ma.death_cross',
              semanticScope: 'market',
            },
            actions: [{ type: 'CLOSE_LONG' }],
          },
        ],
      },
      semanticView: {
        viewType: 'canonical-semantic-view.v1',
        canonicalDigest: 'sha256:position-mode-drift',
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
      strategySummary: { thesis: 'long-only' },
      scriptSummary: { indicators: ['EMA'] },
      lockedParams: { positionPct: 25 },
    })).rejects.toThrow('publication gate blocked')

    expect(publishedSnapshotsRepo.create).not.toHaveBeenCalled()
  })

  it('publishes when confirmed short_only positionMode matches IR and compiled script', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'snapshot-short-only' }),
    }
    const gate = new CompiledPublicationGateService(publishedSnapshotsRepo as never)
    const ir = createShortOnlyIrFixture()
    const ast = new CanonicalStrategyAstCompilerService().compile(ir)
    const executionEnvelope = {
      positionMode: 'short_only' as const,
      marginMode: 'cross' as const,
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict' as const,
    }
    const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope })

    await expect(gate.publish({
      sessionId: 'session-short-only',
      canonicalSnapshot: {
        version: 2,
        market: { exchange: 'binance', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '1h' },
        rules: [
          {
            id: 'entry-short',
            phase: 'entry',
            sideScope: 'short',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'ma.death_cross',
              semanticScope: 'market',
            },
            actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.25 } }],
          },
          {
            id: 'exit-short',
            phase: 'exit',
            sideScope: 'short',
            priority: 100,
            condition: {
              kind: 'atom',
              key: 'ma.golden_cross',
              semanticScope: 'market',
            },
            actions: [{ type: 'CLOSE_SHORT' }],
          },
        ],
      },
      semanticView: {
        viewType: 'canonical-semantic-view.v1',
        canonicalDigest: 'sha256:canonical-short-only',
        confirmation: {
          required: true,
          digest: 'sha256:canonical-short-only',
        },
      },
      semanticPredicateGraph: createSemanticPredicateGraphFixture(),
      graphSnapshot: {
        version: 3,
        status: 'confirmed' as const,
        trigger: [
          { id: 'trigger-entry-short', phase: 'entry' as const, operator: 'CROSS_UNDER(EMA(CLOSE,7),EMA(CLOSE,21))' },
        ],
        actions: [
          { id: 'action-sell-1', action: 'SELL' as const, target: 'BTCUSDT', amount: '25%' },
        ],
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
      strategySummary: { thesis: 'short-only mean reversion' },
      scriptSummary: { indicators: ['EMA'] },
      lockedParams: { positionPct: 25 },
    })).resolves.toEqual(expect.objectContaining({ snapshotId: 'snapshot-short-only' }))

    expect(publishedSnapshotsRepo.create).toHaveBeenCalled()
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
            id: 'entry-long',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'ma.golden_cross',
              semanticScope: 'market',
              op: 'CROSS_OVER',
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.25 } }],
          },
          {
            id: 'entry-short',
            phase: 'entry',
            sideScope: 'short',
            priority: 190,
            condition: {
              kind: 'atom',
              key: 'ma.death_cross',
              semanticScope: 'market',
              op: 'CROSS_UNDER',
            },
            actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.25 } }],
          },
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
            id: 'entry-long',
            phase: 'entry',
            sideScope: 'long',
            priority: 200,
            condition: {
              kind: 'atom',
              key: 'ma.golden_cross',
              semanticScope: 'market',
              op: 'CROSS_OVER',
            },
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.25 } }],
          },
          {
            id: 'entry-short',
            phase: 'entry',
            sideScope: 'short',
            priority: 190,
            condition: {
              kind: 'atom',
              key: 'ma.death_cross',
              semanticScope: 'market',
              op: 'CROSS_UNDER',
            },
            actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.25 } }],
          },
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
      semanticPredicateGraph: createSemanticPredicateGraphFixture(),
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

  it('publishes migrated bollinger snapshots without mutating middle-band or outside-band semantics', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'snapshot-bollinger' }),
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
    const canonicalSnapshot = {
      version: 2,
      market: { exchange: 'binance', symbol: 'BTCUSDT', marketType: 'spot', timeframe: '1h' },
      indicators: [{ kind: 'bollingerBands', params: { period: 20, stdDev: 2 } }],
      rules: [
        {
          id: 'entry-upper-short',
          phase: 'entry',
          sideScope: 'short',
          priority: 200,
          condition: {
            kind: 'atom',
            key: 'bollinger.upper_break',
            semanticScope: 'market',
            op: 'CROSS_OVER',
          },
          actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.25 } }],
        },
        {
          id: 'entry-lower-long',
          phase: 'entry',
          sideScope: 'long',
          priority: 190,
          condition: {
            kind: 'atom',
            key: 'bollinger.lower_break',
            semanticScope: 'market',
            op: 'CROSS_UNDER',
          },
          actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.25 } }],
        },
        {
          id: 'exit-middle-close',
          phase: 'exit',
          sideScope: 'both',
          priority: 140,
          condition: {
            kind: 'atom',
            key: 'bollinger.middle_revert',
            semanticScope: 'market',
          },
          actions: [{ type: 'CLOSE_LONG' }, { type: 'CLOSE_SHORT' }],
        },
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
    }

    await expect(gate.publish({
      sessionId: 'session-bollinger',
      canonicalSnapshot,
      semanticView: {
        viewType: 'canonical-semantic-view.v1',
        canonicalDigest: 'sha256:bollinger',
      },
      semanticPredicateGraph: createSemanticPredicateGraphFixture(),
      graphSnapshot: {
        version: 3,
        status: 'confirmed' as const,
        trigger: [],
        actions: [],
        risk: ['价格回到布林带中轨平仓', '价格连续3根K线在轨外时提前减仓'],
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
      strategySummary: { thesis: 'bollinger mean reversion' },
      scriptSummary: { indicators: ['EMA', 'BOLLINGER'] },
      lockedParams: { positionPct: 25 },
    })).resolves.toEqual(expect.objectContaining({ snapshotId: 'snapshot-bollinger' }))

    expect(publishedSnapshotsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      specSnapshot: canonicalSnapshot,
      scriptSummary: { indicators: ['EMA', 'BOLLINGER'] },
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
    }))
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
      semanticPredicateGraph: createSemanticPredicateGraphFixture(),
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

type IrMarketFixtureOverrides = Partial<CanonicalStrategyIrV1['market']> & {
  exchange?: CanonicalStrategyIrV1['market']['venue']
}

function createIrFixture(overrides: IrMarketFixtureOverrides = {}): CanonicalStrategyIrV1 {
  const { exchange, ...marketOverrides } = overrides

  return {
    irVersion: 'csi.v1',
    source: {
      graphVersion: 18,
      graphDigest: hashFixtureSemanticPredicateGraph(),
      specHash: 'sha256:11aa',
    },
    market: {
      venue: 'binance',
      instrumentType: 'spot',
      symbol: 'BTCUSDT',
      timeframes: ['1h'],
      priceFeed: 'close',
      ...marketOverrides,
      ...(exchange ? { venue: exchange } : {}),
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

function createSemanticPredicateGraphFixture(): Record<string, unknown> {
  return {
    version: 2,
    nodes: [],
    edges: [],
  }
}

function hashFixtureSemanticPredicateGraph(): `sha256:${string}` {
  return `sha256:${createHash('sha256')
    .update(canonicalSerialize(createSemanticPredicateGraphFixture()))
    .digest('hex')}`
}

function createShortOnlyIrFixture(): CanonicalStrategyIrV1 {
  const base = createIrFixture()

  return {
    ...base,
    market: {
      ...base.market,
      instrumentType: 'perpetual',
    },
    portfolio: {
      ...base.portfolio,
      positionMode: 'short_only',
    },
    ruleBlocks: [
      {
        id: 'entry_short',
        phase: 'entry',
        when: 'entry_cross',
        priority: 200,
        actions: [
          { kind: 'OPEN_SHORT', quantity: { mode: 'pct_equity', value: 25 } },
        ],
      },
      {
        id: 'exit_short',
        phase: 'exit',
        when: 'exit_cross',
        priority: 100,
        actions: [
          { kind: 'CLOSE_SHORT', quantity: { mode: 'position_pct', value: 100 } },
        ],
      },
    ],
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
