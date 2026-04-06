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
        symbol: 'BTCUSDT',
        timeframe: '15m',
        marketType: 'spot',
        exchange: 'okx',
        positionPct: 25,
      },
    })
    expect(strategy).toMatchObject({
      id: 'instance-1',
      strategyInstanceId: 'instance-1',
      strategyTemplateId: 'template-1',
      params: {
        symbol: 'BTCUSDT',
        timeframe: '15m',
        marketType: 'spot',
        exchange: 'okx',
        positionPct: 25,
      },
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
      executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
      riskRules: {
        maxFloatingLossPct: 5,
        outsideBand: expect.objectContaining({
          mode: 'BOLLINGER_BANDS',
          action: 'REDUCE',
          consecutiveBars: 3,
          indicator: { kind: 'bollingerBands', period: 20, stdDev: 2 },
        }),
      },
      dataRequirements: { primary: ['15m'] },
      specSnapshot: { market: { exchange: 'okx' } },
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

  it('fails fast when snapshot does not contain strict params', async () => {
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        strategyInstanceId: 'instance-1',
        strategyTemplateId: 'template-1',
        snapshotHash: 'snapshot-hash',
        scriptHash: 'script-hash',
        specHash: 'spec-hash',
        scriptSnapshot: 'const strategy = { protocolVersion: "v1", onBar: () => ({ action: "NOOP" }) }\nstrategy',
        paramsSnapshot: null,
        lockedParams: null,
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
      message: 'backtest.snapshot_params_missing',
    })
    expect(strategyAdapter.build).not.toHaveBeenCalled()
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
