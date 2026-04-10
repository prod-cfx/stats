import type { CanonicalStrategyIrV1 } from '../../types/canonical-strategy-ir'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'

describe('compiledScriptParserService', () => {
  it('parses a generated compiled script and returns its manifest projection', () => {
    const emitter = new CompiledScriptEmitterService()
    const parser = new CompiledScriptParserService()
    const script = emitter.emit({
      ast: createAstFixture(),
      executionEnvelope: createExecutionEnvelope(),
    })

    expect(parser.parse(script)).toEqual(expect.objectContaining({
      compiledManifest: expect.objectContaining({
        compileVersion: 'compiler.v1',
        irVersion: 'csi.v1',
        astVersion: 'csa.v1',
      }),
      decisionPrograms: expect.arrayContaining([
        expect.objectContaining({
          sourceRef: 'entry_long',
          cooldownBars: 5,
        }),
      ]),
    }))
  })

  it('rejects a compiled script whose wrapper was modified', () => {
    const emitter = new CompiledScriptEmitterService()
    const parser = new CompiledScriptParserService()
    const validCompiledScript = emitter.emit({
      ast: createAstFixture(),
      executionEnvelope: createExecutionEnvelope(),
    })

    const tamperedScript = validCompiledScript.replace("protocolVersion: 'v1'", 'protocolVersion: "v1"')

    expect(() => parser.parse(tamperedScript)).toThrow('codegen.compiled_script_invalid')
  })
})

function createAstFixture() {
  const compiler = new CanonicalStrategyAstCompilerService()

  const ir: CanonicalStrategyIrV1 = {
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
        cooldownBars: 5,
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

  return compiler.compile(ir)
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
