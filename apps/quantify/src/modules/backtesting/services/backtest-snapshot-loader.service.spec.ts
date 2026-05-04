import type { CanonicalStrategyIrV1 } from '@/modules/llm-strategy-codegen/types/canonical-strategy-ir'
import { CanonicalStrategyAstCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '@/modules/llm-strategy-codegen/services/compiled-script-emitter.service'
import { BacktestSnapshotLoaderService } from './backtest-snapshot-loader.service'

function createCompiledSnapshotFixture() {
  const ir = createIrFixture()
  const ast = new CanonicalStrategyAstCompilerService().compile(ir)
  const executionEnvelope = createExecutionEnvelope()
  const emitter = new CompiledScriptEmitterService()
  const scriptSnapshot = emitter.emit({ ast, executionEnvelope })
  const projection = emitter.buildProjection({ ast, executionEnvelope })

  return {
    ir,
    ast,
    executionEnvelope,
    scriptSnapshot,
    compiledManifest: projection.compiledManifest,
  }
}

describe('backtestSnapshotLoaderService', () => {
  it('maps compiled order-program exchange update policy into strict backtest execution policy', () => {
    const service = new BacktestSnapshotLoaderService({} as never, {} as never)

    expect((service as any).resolveExecutionPolicy({
      signalEvaluation: 'bar_close',
      fillPolicy: 'exchange_order_update',
      timeframeAlignment: 'strict',
      orderTypeDefault: 'limit',
      timeInForce: 'gtc',
      allowPartialFill: true,
    })).toEqual({
      signalTiming: 'BAR_CLOSE',
      fillTiming: 'BAR_CLOSE',
      noNextBarHandling: 'KEEP_PENDING',
    })
  })

  it('falls back to AST execution model when a strict snapshot has no persisted execution policy', () => {
    const service = new BacktestSnapshotLoaderService({} as never, {} as never)

    expect((service as any).resolveExecutionPolicy(null, {
      signalEvaluation: 'bar_close',
      fillPolicy: 'exchange_order_update',
      timeframeAlignment: 'strict',
      defaultOrderType: 'limit',
      allowPartialFill: true,
    })).toEqual({
      signalTiming: 'BAR_CLOSE',
      fillTiming: 'BAR_CLOSE',
      noNextBarHandling: 'KEEP_PENDING',
    })
  })

  it('loads snapshot-backed strategy via published snapshot id', async () => {
    const compiledSnapshot = createCompiledSnapshotFixture()
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        strategyInstanceId: 'instance-1',
        strategyTemplateId: 'template-1',
        snapshotHash: 'snapshot-hash',
        scriptHash: 'script-hash',
        specHash: compiledSnapshot.compiledManifest.specHash,
        irHash: compiledSnapshot.compiledManifest.irHash,
        astDigest: compiledSnapshot.compiledManifest.astDigest,
        structuralDigest: compiledSnapshot.compiledManifest.structuralDigest,
        scriptSnapshot: compiledSnapshot.scriptSnapshot,
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          marketType: 'spot',
        },
        strategyConfig: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          baseTimeframe: '3m',
          stateTimeframes: ['15m'],
          positionPct: 25,
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
          constraintExplanation: 'strategy/default constraints pending account-capability intersection',
        },
        lockedParams: {
          exchange: 'okx',
          positionPct: 25,
        },
        executionPolicy: {
          signalEvaluation: 'bar_close',
          fillPolicy: 'next_bar_open',
          timeframeAlignment: 'strict',
          orderTypeDefault: 'market',
          timeInForce: 'gtc',
          allowPartialFill: false,
        },
        dataRequirements: { primary: ['3m'], requiredTimeframes: ['3m', '15m'] },
        irSnapshot: compiledSnapshot.ir,
        astSnapshot: compiledSnapshot.ast,
        compiledManifest: compiledSnapshot.compiledManifest,
        executionEnvelope: compiledSnapshot.executionEnvelope,
        specSnapshot: {
          market: { exchange: 'okx' },
          indicators: [{ kind: 'bollingerBands', params: { period: 20, stdDev: 2 } }],
          riskRules: [
            { id: 'risk-stop-loss', trigger: 'lossPct >= 0.0500', effect: 'FORCE_STOP' },
            { id: 'risk-outside-band-3-bars', trigger: '价格连续3根K线在轨外时考虑提前止损或减仓', effect: 'REDUCE_POSITION' },
          ],
        },
      }),
    }
    const adaptedStrategy = {
      id: 'strategy-1',
      params: {
        positionPct: 25,
        exchange: 'okx',
      },
      fn: jest.fn(),
    }
    const strategyAdapter = {
      build: jest.fn().mockResolvedValue(adaptedStrategy),
    }
    const service = new BacktestSnapshotLoaderService(snapshotsRepository as never, strategyAdapter as never)

    const strategy = await service.load({
      id: 'strategy-1',
      protocolVersion: 'v1',
      publishedSnapshotId: 'snapshot-1',
      userId: 'user-1',
    })

    expect(snapshotsRepository.findByIdForUser).toHaveBeenCalledWith('snapshot-1', 'user-1')
    expect(strategyAdapter.build).toHaveBeenCalledWith({
      id: 'instance-1',
      protocolVersion: 'v1',
      scriptCode: compiledSnapshot.scriptSnapshot,
        params: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          timeframe: '3m',
          positionPct: 25,
          positionSizing: { mode: 'pct_equity', value: 25 },
        },
    })
    expect(strategy).toMatchObject({
      id: 'instance-1',
      strategyInstanceId: 'instance-1',
      strategyTemplateId: 'template-1',
      params: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        timeframe: '3m',
        positionPct: 25,
        positionSizing: { mode: 'pct_equity', value: 25 },
      },
      stateTimeframes: ['15m'],
      snapshotId: 'snapshot-1',
      snapshotHash: 'snapshot-hash',
      scriptHash: 'script-hash',
      specHash: compiledSnapshot.compiledManifest.specHash,
      irHash: compiledSnapshot.compiledManifest.irHash,
      astDigest: compiledSnapshot.compiledManifest.astDigest,
      structuralDigest: compiledSnapshot.compiledManifest.structuralDigest,
      irSnapshot: compiledSnapshot.ir,
      astSnapshot: compiledSnapshot.ast,
      executionEnvelope: compiledSnapshot.executionEnvelope,
      bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
        noNextBarHandling: 'KEEP_PENDING',
      },
      riskRules: {
        maxFloatingLossPct: 5,
        outsideBand: expect.objectContaining({
          mode: 'BOLLINGER_BANDS',
          action: 'REDUCE',
          consecutiveBars: 3,
          indicator: { kind: 'bollingerBands', period: 20, stdDev: 2 },
        }),
      },
      dataRequirements: { primary: ['3m'], requiredTimeframes: ['3m', '15m'] },
      specSnapshot: { market: { exchange: 'okx' } },
    })
  })

  it('derives backtest risk rules from graph snapshot triggers when published spec snapshot is not canonical spec', async () => {
    const compiledSnapshot = createBollingerCompiledSnapshotFixture()
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-graph-spec',
        strategyInstanceId: 'instance-graph-spec',
        strategyTemplateId: 'template-graph-spec',
        snapshotHash: 'snapshot-hash',
        scriptHash: 'script-hash',
        specHash: compiledSnapshot.compiledManifest.specHash,
        irHash: compiledSnapshot.compiledManifest.irHash,
        astDigest: compiledSnapshot.compiledManifest.astDigest,
        structuralDigest: compiledSnapshot.compiledManifest.structuralDigest,
        scriptSnapshot: compiledSnapshot.scriptSnapshot,
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          marketType: 'spot',
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
          constraintExplanation: 'strategy/default constraints pending account-capability intersection',
        },
        lockedParams: {
          exchange: 'okx',
          positionPct: 10,
        },
        executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
        dataRequirements: { primary: ['15m'] },
        irSnapshot: compiledSnapshot.ir,
        astSnapshot: compiledSnapshot.ast,
        compiledManifest: compiledSnapshot.compiledManifest,
        executionEnvelope: compiledSnapshot.executionEnvelope,
        specSnapshot: {
          version: 1,
          status: 'confirmed',
          meta: {
            exchange: 'okx',
            symbol: 'BTCUSDT',
            timeframe: '15m',
            positionPct: 10,
            executionTags: [],
          },
          risk: ['positionPct: 10'],
          actions: [
            { id: 'action-buy-1', action: 'BUY', amount: '10%', target: 'BTCUSDT' },
            { id: 'action-sell-1', action: 'SELL', amount: '10%', target: 'BTCUSDT' },
          ],
          trigger: [
            { id: 'trigger-entry-1-0', phase: 'entry', operator: '突破布林带上轨做空' },
            { id: 'trigger-entry-1-1', phase: 'entry', join: 'AND', operator: '突破布林带下轨做多' },
            { id: 'trigger-exit-1-0', phase: 'exit', join: 'AND', operator: '价格回到布林带中轨（MA20）平仓' },
            { id: 'trigger-exit-1-1', phase: 'exit', join: 'AND', operator: '亏损≥5%强制止损' },
            { id: 'trigger-exit-1-2', phase: 'exit', join: 'AND', operator: '连续3根K线都在轨外时，先减仓50%；如果第4根K线收盘时仍未回到布林带轨内，则全部平仓止损' },
          ],
        },
      }),
    }
    const strategyAdapter = {
      build: jest.fn().mockResolvedValue({
        id: 'strategy-graph-spec',
        params: { positionPct: 10, exchange: 'okx' },
        fn: jest.fn(),
      }),
    }
    const service = new BacktestSnapshotLoaderService(snapshotsRepository as never, strategyAdapter as never)

    await expect(service.load({
      id: 'strategy-graph-spec',
      protocolVersion: 'v1',
      publishedSnapshotId: 'snapshot-graph-spec',
      userId: 'user-1',
    })).resolves.toMatchObject({
      id: 'instance-graph-spec',
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
        noNextBarHandling: 'KEEP_PENDING',
      },
      riskRules: {
        maxFloatingLossPct: 5,
        outsideBand: expect.objectContaining({
          mode: 'BOLLINGER_BANDS',
          indicator: { kind: 'bollingerBands', period: 20, stdDev: 2 },
          consecutiveBars: 3,
          action: 'REDUCE',
          reduceRatio: 0.5,
        }),
      },
    })
  })

  it('rejects a snapshot whose script structural digest mismatches the manifest', async () => {
    const compiledSnapshot = createCompiledSnapshotFixture()
    const tamperedScript = compiledSnapshot.scriptSnapshot.replace(
      '"sourceRef":"entry_cross"',
      '"sourceRef":"entry_cross_mutated"',
    )
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        strategyInstanceId: 'instance-1',
        strategyTemplateId: 'template-1',
        snapshotHash: 'snapshot-hash',
        scriptHash: 'script-hash',
        specHash: compiledSnapshot.compiledManifest.specHash,
        irHash: compiledSnapshot.compiledManifest.irHash,
        astDigest: compiledSnapshot.compiledManifest.astDigest,
        structuralDigest: compiledSnapshot.compiledManifest.structuralDigest,
        scriptSnapshot: tamperedScript,
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          marketType: 'spot',
        },
        strategyConfig: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          baseTimeframe: '15m',
          positionPct: 25,
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
          constraintExplanation: 'strategy/default constraints pending account-capability intersection',
        },
        lockedParams: {
          exchange: 'okx',
          positionPct: 25,
        },
        executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
        dataRequirements: { primary: ['15m'] },
        irSnapshot: compiledSnapshot.ir,
        astSnapshot: compiledSnapshot.ast,
        compiledManifest: compiledSnapshot.compiledManifest,
        executionEnvelope: compiledSnapshot.executionEnvelope,
        specSnapshot: {
          market: { exchange: 'okx' },
          indicators: [],
          riskRules: [],
        },
      }),
    }
    const strategyAdapter = {
      build: jest.fn(),
    }
    const service = new BacktestSnapshotLoaderService(snapshotsRepository as never, strategyAdapter as never)

    expect(tamperedScript).not.toBe(compiledSnapshot.scriptSnapshot)
    await expect(service.load({
      id: 'strategy-1',
      protocolVersion: 'v1',
      publishedSnapshotId: 'snapshot-1',
      userId: 'user-1',
    })).rejects.toMatchObject({
      message: 'backtest.compiled_snapshot_invalid',
    })
    expect(strategyAdapter.build).not.toHaveBeenCalled()
  })

  it('throws when published snapshot does not exist', async () => {
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue(null),
    }
    const strategyAdapter = {
      build: jest.fn(),
    }
    const service = new BacktestSnapshotLoaderService(snapshotsRepository as never, strategyAdapter as never)

    await expect(service.load({
      id: 'strategy-1',
      protocolVersion: 'v1',
      publishedSnapshotId: 'snapshot-missing',
      userId: 'user-1',
    })).rejects.toMatchObject({
      message: 'backtest.snapshot_not_found',
    })
    expect(strategyAdapter.build).not.toHaveBeenCalled()
  })

  it('fails fast when legacy snapshot does not contain formal structured fields required for backtest', async () => {
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        strategyInstanceId: 'instance-1',
        strategyTemplateId: 'template-1',
        snapshotHash: 'snapshot-hash',
        scriptHash: 'script-hash',
        specHash: 'spec-hash',
        scriptSnapshot: 'const strategy = { protocolVersion: "v1", onBar: () => ({ action: "NOOP" }) }\nstrategy',
        paramsSnapshot: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          timeframe: '15m',
          marketType: 'spot',
          positionPct: 25,
        },
        lockedParams: {},
        executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
        dataRequirements: { primary: ['15m'] },
        specSnapshot: {
          market: { exchange: 'okx' },
          indicators: [],
          riskRules: [],
        },
      }),
    }
    const strategyAdapter = {
      build: jest.fn(),
    }
    const service = new BacktestSnapshotLoaderService(snapshotsRepository as never, strategyAdapter as never)

    await expect(service.load({
      id: 'strategy-1',
      protocolVersion: 'v1',
      publishedSnapshotId: 'snapshot-1',
      userId: 'user-1',
    })).rejects.toMatchObject({
      message: 'backtest.invalid_snapshot_execution_config',
    })
    expect(strategyAdapter.build).not.toHaveBeenCalled()
  })

  it('accepts legacy snapshots whose spec hash was stored without the sha256 prefix', async () => {
    const baseIr = createIrFixture()
    const ir: CanonicalStrategyIrV1 = {
      ...baseIr,
      source: {
        ...baseIr.source,
        graphDigest: `sha256:${'1'.repeat(64)}`,
        specHash: `sha256:${'2'.repeat(64)}`,
      },
    }
    const ast = new CanonicalStrategyAstCompilerService().compile(ir)
    const executionEnvelope = createExecutionEnvelope()
    const emitter = new CompiledScriptEmitterService()
    const scriptSnapshot = emitter.emit({ ast, executionEnvelope })
    const compiledManifest = emitter.buildProjection({ ast, executionEnvelope }).compiledManifest
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-legacy-spec-hash',
        strategyInstanceId: 'instance-1',
        strategyTemplateId: 'template-1',
        snapshotHash: 'snapshot-hash',
        scriptHash: 'script-hash',
        specHash: compiledManifest.specHash.replace(/^sha256:/u, ''),
        irHash: compiledManifest.irHash,
        astDigest: compiledManifest.astDigest,
        structuralDigest: compiledManifest.structuralDigest,
        scriptSnapshot,
        paramsSnapshot: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          marketType: 'spot',
        },
        strategyConfig: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          baseTimeframe: '15m',
          positionPct: 25,
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
          constraintExplanation: 'strategy/default constraints pending account-capability intersection',
        },
        lockedParams: {
          exchange: 'okx',
          positionPct: 25,
        },
        executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
        dataRequirements: { primary: ['15m'] },
        irSnapshot: ir,
        astSnapshot: ast,
        compiledManifest: {
          ...compiledManifest,
          specHash: compiledManifest.specHash.replace(/^sha256:/u, ''),
        },
        executionEnvelope,
        specSnapshot: {
          market: { exchange: 'okx' },
          indicators: [],
          riskRules: [],
        },
      }),
    }
    const strategyAdapter = {
      build: jest.fn().mockResolvedValue({
        id: 'strategy-1',
        params: { positionPct: 25, exchange: 'okx' },
        fn: jest.fn(),
      }),
    }
    const service = new BacktestSnapshotLoaderService(snapshotsRepository as never, strategyAdapter as never)

    await expect(service.load({
      id: 'strategy-1',
      protocolVersion: 'v1',
      publishedSnapshotId: 'snapshot-legacy-spec-hash',
      userId: 'user-1',
    })).resolves.toMatchObject({
      id: 'instance-1',
      specHash: compiledManifest.specHash,
    })
    expect(strategyAdapter.build).toHaveBeenCalled()
  })

  it('loads fixed quote sizing snapshots without requiring legacy positionPct', async () => {
    const baseIr = createIrFixture()
    const ir: CanonicalStrategyIrV1 = {
      ...baseIr,
      portfolio: {
        ...baseIr.portfolio,
        sizing: { mode: 'fixed_quote', value: 10 },
      },
      ruleBlocks: baseIr.ruleBlocks.map(rule => rule.phase === 'entry'
        ? {
            ...rule,
            actions: rule.actions.map(action => action.kind === 'OPEN_LONG'
              ? { ...action, quantity: { mode: 'fixed_quote' as const, value: 10 } }
              : action),
          }
        : rule),
    }
    const ast = new CanonicalStrategyAstCompilerService().compile(ir)
    const executionEnvelope = createExecutionEnvelope()
    const emitter = new CompiledScriptEmitterService()
    const scriptSnapshot = emitter.emit({ ast, executionEnvelope })
    const compiledManifest = emitter.buildProjection({ ast, executionEnvelope }).compiledManifest
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-fixed-quote',
        strategyInstanceId: 'instance-fixed-quote',
        strategyTemplateId: 'template-fixed-quote',
        snapshotHash: 'snapshot-hash',
        scriptHash: 'script-hash',
        specHash: compiledManifest.specHash,
        irHash: compiledManifest.irHash,
        astDigest: compiledManifest.astDigest,
        structuralDigest: compiledManifest.structuralDigest,
        scriptSnapshot,
        paramsSnapshot: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          timeframe: '1h',
          marketType: 'perp',
          positionPct: null,
        },
        strategyConfig: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          marketType: 'perp',
          baseTimeframe: '1h',
          stateTimeframes: [],
          positionPct: null,
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
          platformRiskMaxLeverage: 5,
          strategyDeclaredLeverageRange: null,
          defaultLeverage: 1,
          supportedPriceSources: ['close'],
          supportedOrderTypes: ['market'],
          supportedTimeInForce: ['gtc'],
          constraintExplanation: 'strategy/default constraints pending account-capability intersection',
        },
        lockedParams: {},
        executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
        dataRequirements: { primary: ['1h'] },
        irSnapshot: ir,
        astSnapshot: ast,
        compiledManifest,
        executionEnvelope,
        specSnapshot: {
          market: { exchange: 'okx' },
          indicators: [],
          riskRules: [],
        },
      }),
    }
    const strategyAdapter = {
      build: jest.fn().mockResolvedValue({
        id: 'strategy-fixed-quote',
        params: { exchange: 'okx' },
        fn: jest.fn(),
      }),
    }
    const service = new BacktestSnapshotLoaderService(snapshotsRepository as never, strategyAdapter as never)

    await expect(service.load({
      id: 'strategy-fixed-quote',
      protocolVersion: 'v1',
      publishedSnapshotId: 'snapshot-fixed-quote',
      userId: 'user-1',
    })).resolves.toMatchObject({
      id: 'instance-fixed-quote',
      params: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        timeframe: '1h',
      },
      bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
    })
    expect(strategyAdapter.build).toHaveBeenCalledWith(expect.objectContaining({
      params: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        timeframe: '1h',
      },
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

function createExecutionEnvelope() {
  return {
    positionMode: 'long_only' as const,
    marginMode: 'cash' as const,
    tickSize: 0.01,
    pricePrecision: 2,
    quantityPrecision: 6,
    fillAssumption: 'strict' as const,
  }
}

function createBollingerCompiledSnapshotFixture() {
  const ir: CanonicalStrategyIrV1 = {
    irVersion: 'csi.v1',
    source: {
      graphVersion: 1,
      graphDigest: `sha256:${'3'.repeat(64)}`,
      specHash: `sha256:${'4'.repeat(64)}`,
    },
    market: {
      venue: 'okx',
      instrumentType: 'spot',
      symbol: 'BTCUSDT',
      timeframes: ['15m'],
      priceFeed: 'close',
    },
    portfolio: {
      positionMode: 'long_short',
      sizing: { mode: 'position_pct', value: 10 },
      maxConcurrentPositions: 1,
      allowPyramiding: false,
      maxPyramidingLayers: 1,
    },
    dataRequirements: {
      warmupBars: 1,
      maxLookback: 1,
      requiredTimeframes: ['15m'],
    },
    signalCatalog: {
      series: [
        { id: 'bollinger_bars_outside_risk-bollinger-outside-3', kind: 'BOLLINGER_BARS_OUTSIDE', timeframe: '15m', params: { bars: 3, bandSide: 'outside' } },
        { id: 'close_15m_0', kind: 'PRICE', timeframe: '15m', field: 'close', offsetBars: 0 },
        { id: 'const_3', kind: 'CONST', value: 3 },
        { id: 'lower_band_15m_20_2', kind: 'LOWER_BAND', timeframe: '15m', inputs: ['close_15m_0'], params: { period: 20, stdDev: 2 } },
        { id: 'mid_band_15m_20_2', kind: 'MID_BAND', timeframe: '15m', inputs: ['close_15m_0'], params: { period: 20, stdDev: 2 } },
        { id: 'upper_band_15m_20_2', kind: 'UPPER_BAND', timeframe: '15m', inputs: ['close_15m_0'], params: { period: 20, stdDev: 2 } },
      ],
      levelSets: [],
      predicates: [
        { id: 'entry_and_predicate_entry-boll-upper-short-1_predicate_entry-boll-lower-long-2', kind: 'AND', args: ['predicate_entry-boll-upper-short-1', 'predicate_entry-boll-lower-long-2'] },
        { id: 'predicate_entry-boll-lower-long-2', kind: 'CROSS_UNDER', args: ['close_15m_0', 'lower_band_15m_20_2'] },
        { id: 'predicate_entry-boll-upper-short-1', kind: 'CROSS_OVER', args: ['close_15m_0', 'upper_band_15m_20_2'] },
        { id: 'predicate_exit-boll-middle-close-3', kind: 'OR', args: ['predicate_exit-boll-middle-close-3_above', 'predicate_exit-boll-middle-close-3_below'] },
        { id: 'predicate_exit-boll-middle-close-3_above', kind: 'CROSS_OVER', args: ['close_15m_0', 'mid_band_15m_20_2'] },
        { id: 'predicate_exit-boll-middle-close-3_below', kind: 'CROSS_UNDER', args: ['close_15m_0', 'mid_band_15m_20_2'] },
        { id: 'predicate_risk-bollinger-outside-3', kind: 'GTE', args: ['bollinger_bars_outside_risk-bollinger-outside-3', 'const_3'] },
      ],
    },
    ruleBlocks: [
      {
        id: 'entry_rule',
        when: 'entry_and_predicate_entry-boll-upper-short-1_predicate_entry-boll-lower-long-2',
        phase: 'entry',
        actions: [
          { kind: 'OPEN_LONG', quantity: { mode: 'position_pct', value: 10 } },
          { kind: 'OPEN_SHORT', quantity: { mode: 'position_pct', value: 10 } },
        ],
        priority: 200,
      },
      {
        id: 'exit_rule',
        when: 'predicate_exit-boll-middle-close-3',
        phase: 'exit',
        actions: [
          { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
          { kind: 'CLOSE_SHORT', quantity: { mode: 'position_pct', value: 100 } },
        ],
        priority: 100,
      },
      {
        id: 'rebalance_risk-bollinger-outside-3',
        when: 'predicate_risk-bollinger-outside-3',
        phase: 'rebalance',
        actions: [
          { kind: 'REDUCE_LONG', quantity: { mode: 'position_pct', value: 50 } },
          { kind: 'REDUCE_SHORT', quantity: { mode: 'position_pct', value: 50 } },
        ],
        priority: 50,
      },
    ],
    orderPrograms: [],
    riskPolicy: {
      guards: [],
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
  const ast = new CanonicalStrategyAstCompilerService().compile(ir)
  const executionEnvelope = createExecutionEnvelope()
  const emitter = new CompiledScriptEmitterService()
  const scriptSnapshot = emitter.emit({ ast, executionEnvelope })
  const projection = emitter.buildProjection({ ast, executionEnvelope })

  return {
    ir,
    ast,
    executionEnvelope,
    scriptSnapshot,
    compiledManifest: projection.compiledManifest,
  }
}
