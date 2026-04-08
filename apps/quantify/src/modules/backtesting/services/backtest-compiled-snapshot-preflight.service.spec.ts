import type { CanonicalStrategyIrV1 } from '@/modules/llm-strategy-codegen/types/canonical-strategy-ir'
import { CanonicalStrategyAstCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '@/modules/llm-strategy-codegen/services/compiled-script-emitter.service'
import { BacktestCompiledSnapshotPreflightService } from './backtest-compiled-snapshot-preflight.service'

function createCompiledSnapshotFixture() {
  const ir = createIrFixture()
  const ast = new CanonicalStrategyAstCompilerService().compile(ir)
  const executionEnvelope = {
    positionMode: 'long_only',
    marginMode: 'cash',
    tickSize: 0.01,
    pricePrecision: 2,
    quantityPrecision: 6,
    fillAssumption: 'strict',
  } as const
  const emitter = new CompiledScriptEmitterService()
  const scriptSnapshot = emitter.emit({ ast, executionEnvelope })
  const projection = emitter.buildProjection({ ast, executionEnvelope })

  return {
    id: 'snapshot-1',
    scriptSnapshot,
    irSnapshot: ir,
    astSnapshot: ast,
    compiledManifest: projection.compiledManifest,
  }
}

describe('backtestCompiledSnapshotPreflightService', () => {
  const service = new BacktestCompiledSnapshotPreflightService()

  it('accepts bare hex digests in snapshot manifests after sha256 normalization', () => {
    const fixture = createCompiledSnapshotFixture()

    expect(() => service.validate({
      ...fixture,
      compiledManifest: {
        ...fixture.compiledManifest,
        specHash: fixture.compiledManifest.specHash.replace('sha256:', ''),
        irHash: fixture.compiledManifest.irHash.replace('sha256:', ''),
        astDigest: fixture.compiledManifest.astDigest.replace('sha256:', ''),
        structuralDigest: fixture.compiledManifest.structuralDigest.replace('sha256:', ''),
      },
    })).not.toThrow()
  })
})

function createIrFixture(): CanonicalStrategyIrV1 {
  return {
    irVersion: 'csi.v1',
    source: {
      graphVersion: 18,
      graphDigest: `sha256:${'1'.repeat(64)}`,
      specHash: `sha256:${'2'.repeat(64)}`,
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
