import type { StrategyAstV1 } from '../../types/canonical-strategy-ast'
import type { CompiledScriptExecutionEnvelope, CompiledScriptProjection } from '../../types/compiled-script-projection'
import { buildLockedAtomicState } from './fixtures/semantic-state-golden-cases'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'

function compileAtomicAst(name: Parameters<typeof buildLockedAtomicState>[0]): StrategyAstV1 {
  const spec = new CanonicalSpecBuilderService().buildFromSemanticState(buildLockedAtomicState(name))
  const ir = new CanonicalSpecV2IrCompilerService().compile({
    canonicalSpec: spec,
    fallback: {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      baseTimeframe: '1h',
      positionPct: 10,
    },
  }).ir
  return new CanonicalStrategyAstCompilerService().compile(ir)
}

function compileBreakoutWithRollingHighAst(): StrategyAstV1 {
  const state = buildLockedAtomicState('breakout-retest')
  state.triggers.push({
    id: 'gate-rolling-high-breakout',
    key: 'price.rolling_extrema_breakout',
    phase: 'gate',
    sideScope: 'long',
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
    params: {
      extrema: 'high',
      event: 'breakout_up',
      lookbackBars: 55,
    },
  })

  const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)
  const ir = new CanonicalSpecV2IrCompilerService().compile({
    canonicalSpec: spec,
    fallback: {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      baseTimeframe: '1h',
      positionPct: 10,
    },
  }).ir
  return new CanonicalStrategyAstCompilerService().compile(ir)
}

function emitProjection(ast: StrategyAstV1): {
  parsed: CompiledScriptProjection
  projection: CompiledScriptProjection
  script: string
} {
  const emitter = new CompiledScriptEmitterService()
  const script = emitter.emit({ ast, executionEnvelope: createExecutionEnvelope() })
  const projection = emitter.buildProjection({ ast, executionEnvelope: createExecutionEnvelope() })
  const parsed = new CompiledScriptParserService().parse(script)

  return { parsed, projection, script }
}

function createExecutionEnvelope(): CompiledScriptExecutionEnvelope {
  return {
    positionMode: 'long_only',
    marginMode: 'cash',
    tickSize: 0.01,
    pricePrecision: 2,
    quantityPrecision: 6,
    fillAssumption: 'strict',
  }
}

describe('atomic contract compiled script emission', () => {
  it('emits rolling extrema and breakout sequence requirements into the script projection', () => {
    const { parsed, projection, script } = emitProjection(compileBreakoutWithRollingHighAst())

    expect(projection.runtimeRequirements?.helpers).toEqual(expect.arrayContaining(['rollingHigh']))
    expect(projection.runtimeRequirements?.stateKeys).toEqual(expect.arrayContaining(['breakout']))
    expect(projection.exprPool).toEqual(expect.arrayContaining([
      expect.objectContaining({ payload: expect.objectContaining({ kind: 'sequence' }) }),
      expect.objectContaining({ payload: expect.objectContaining({ kind: 'compare' }) }),
    ]))

    expect(script).toContain('const RUNTIME_REQUIREMENTS = ')
    expect(script).toContain('"rollingHigh"')
    expect(script).toContain('"breakout"')
    expect(parsed.runtimeRequirements).toEqual(projection.runtimeRequirements)
    expect(parsed.exprPool).toEqual(expect.arrayContaining([
      expect.objectContaining({ payload: expect.objectContaining({ kind: 'sequence' }) }),
      expect.objectContaining({ payload: expect.objectContaining({ kind: 'compare' }) }),
    ]))
  })

  it('emits Bollinger and volume SMA helper requirements with generic predicate shape', () => {
    const { parsed, projection, script } = emitProjection(compileAtomicAst('bollinger-volume-entry'))

    expect(projection.runtimeRequirements?.helpers).toEqual(expect.arrayContaining(['bollinger', 'smaVolume']))
    expect(projection.exprPool).toEqual(expect.arrayContaining([
      expect.objectContaining({ payload: expect.objectContaining({ kind: 'allOf' }) }),
      expect.objectContaining({ payload: expect.objectContaining({ kind: 'compare' }) }),
    ]))

    expect(script).toContain('"bollinger"')
    expect(script).toContain('"smaVolume"')
    expect(parsed.runtimeRequirements).toEqual(projection.runtimeRequirements)
  })

  it('emits ATR risk predicates and helper requirements into the script projection', () => {
    const { parsed, projection, script } = emitProjection(compileAtomicAst('atr-risk'))

    expect(projection.runtimeRequirements?.helpers).toEqual(expect.arrayContaining(['atr']))
    expect(projection.riskPredicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ payload: expect.objectContaining({ kind: 'atrMultipleStop' }) }),
      expect.objectContaining({ payload: expect.objectContaining({ kind: 'atrMultipleTakeProfit' }) }),
    ]))

    expect(script).toContain('const RISK_PREDICATES = ')
    expect(script).toContain('"atrMultipleStop"')
    expect(script).toContain('"atrMultipleTakeProfit"')
    expect(parsed.riskPredicates).toEqual(projection.riskPredicates)
  })
})
