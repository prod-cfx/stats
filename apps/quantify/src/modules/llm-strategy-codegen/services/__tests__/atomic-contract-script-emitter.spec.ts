import type { StrategyAstV1 } from '../../types/canonical-strategy-ast'
import type { CompiledScriptExecutionEnvelope, CompiledScriptProjection } from '../../types/compiled-script-projection'
import type { SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'

type LockedAtomicStateName = 'bollinger-volume-entry' | 'breakout-retest' | 'atr-risk'

const emptyRuleEffects = () => ({
  actions: [],
  risks: [],
  positions: [],
  orchestration: [],
  programs: [],
})

function lockedContextSlot(slotKey: string, fieldPath: string, value: string) {
  return {
    slotKey,
    fieldPath,
    value,
    status: 'locked' as const,
    priority: 'context' as const,
    questionHint: '',
    affectsExecution: true,
  }
}

function baseLockedAtomicState(): SemanticState {
  return {
    version: 1,
    families: ['single-leg'],
    position: {
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    },
    orchestrationContracts: [],
    contextSlots: {
      exchange: lockedContextSlot('exchange', 'contextSlots.exchange', 'okx'),
      symbol: lockedContextSlot('symbol', 'contextSlots.symbol', 'BTCUSDT'),
      marketType: lockedContextSlot('marketType', 'contextSlots.marketType', 'perp'),
      timeframe: lockedContextSlot('timeframe', 'contextSlots.timeframe', '1h'),
    },
    normalizationNotes: [],
    updatedAt: '2026-05-06T00:00:00.000Z',
    rules: [],
  }
}

function buildLockedAtomicState(name: LockedAtomicStateName): SemanticState {
  const base = baseLockedAtomicState()

  if (name === 'bollinger-volume-entry') {
    return {
      ...base,
      contextSlots: {
        ...base.contextSlots,
        timeframe: lockedContextSlot('timeframe', 'contextSlots.timeframe', '15m'),
      },
      rules: [
        {
          id: 'entry-bollinger-volume-confirmation',
          phase: 'entry',
          sideScope: 'long',
          condition: {
            kind: 'and',
            children: [
              {
                kind: 'atom',
                key: 'price.detect.indicator_boundary',
                params: {
                  boundaryRole: 'lower',
                  confirmationMode: 'touch',
                  indicator: { name: 'bollinger', period: 20, stdDev: 2 },
                },
              },
              {
                kind: 'atom',
                key: 'volume.relative_average',
                params: { lookbackBars: 20, multiplier: 1.5, comparator: 'gt' },
              },
            ],
          },
          effects: {
            ...emptyRuleEffects(),
            actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          },
        },
        {
          id: 'exit-bollinger-upper-touch',
          phase: 'exit',
          sideScope: 'long',
          condition: {
            kind: 'atom',
            key: 'price.detect.indicator_boundary',
            params: {
              boundaryRole: 'upper',
              confirmationMode: 'touch',
              indicator: { name: 'bollinger', period: 20, stdDev: 2 },
            },
          },
          effects: {
            ...emptyRuleEffects(),
            actions: [{ kind: 'atom', key: 'action.close_long', params: {} }],
          },
        },
      ],
    }
  }

  if (name === 'breakout-retest') {
    return {
      ...base,
      rules: [
        {
          id: 'entry-breakout-retest',
          phase: 'entry',
          sideScope: 'long',
          condition: {
            kind: 'atom',
            key: 'condition.sequence',
            params: {
              sequenceKind: 'breakout_retest',
              lookbackWindow: '24h',
              memoryKey: 'breakout',
            },
          },
          effects: {
            ...emptyRuleEffects(),
            actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
            risks: [{ kind: 'atom', key: 'risk.remembered_level_stop', params: { levelKey: 'breakout' } }],
          },
        },
      ],
    }
  }

  return {
    ...base,
    rules: [
      {
        id: 'entry-ma-above-with-atr-risk',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'atom',
          key: 'indicator.above',
          params: {
            indicator: 'ma',
            referenceRole: 'trend',
            'reference.period': 20,
            reference: { indicator: 'ma', period: 20 },
          },
        },
        effects: {
          ...emptyRuleEffects(),
          actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          risks: [
            { kind: 'atom', key: 'risk.atr_multiple_stop', params: { multiple: 2 } },
            { kind: 'atom', key: 'risk.atr_multiple_take_profit', params: { multiple: 3 } },
          ],
        },
      },
    ],
  }
}

function compileAtomicAst(name: LockedAtomicStateName): StrategyAstV1 {
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
  const baseState = buildLockedAtomicState('breakout-retest')
  const entryRule = baseState.rules?.[0]
  if (!entryRule) {
    throw new Error('missing breakout rule fixture')
  }
  const state: SemanticState = {
    ...baseState,
    rules: [
      {
        ...entryRule,
        condition: {
          kind: 'and',
          children: [
            entryRule.condition,
            {
              kind: 'atom',
              key: 'price.rolling_extrema_breakout',
              params: {
                extrema: 'high',
                event: 'breakout_up',
                lookbackBars: 55,
              },
            },
          ],
        },
      },
      {
        id: 'gate-rolling-high-breakout',
        phase: 'gate',
        sideScope: 'long',
        condition: {
          kind: 'atom',
          key: 'price.rolling_extrema_breakout',
          params: {
            extrema: 'high',
            event: 'breakout_up',
            lookbackBars: 55,
          },
        },
        effects: emptyRuleEffects(),
      },
    ],
  }

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
