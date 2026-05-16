import type { CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec'
import { ATOM_CONTRACT_REGISTRY } from '../../atom-contracts/atom-contract-registry'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'

/**
 * Issue #1395 — 3 个新 atom 的 IR emit 路径 spec
 *
 *   - condition.sequence            → PredicateDef.kind='sequence'
 *   - price.previous_extrema_retest → PredicateDef.kind='sequence'（breakout + retest）
 *   - risk.atr_take_profit          → RiskPredicateDef.kind='atrMultipleTakeProfit'
 *
 * 同时断言 registry 中三 atom 的 supportStatus 已从 unsupported_atom_emit_pending_*
 * 升级为 supported_executable。
 */

const fallback = {
  exchange: 'binance' as const,
  symbol: 'BTCUSDT',
  baseTimeframe: '1m',
  positionPct: 10,
}

function baseEntryExitRule(condition: CanonicalStrategySpecV2['rules'][number]['condition']): CanonicalStrategySpecV2['rules'][number] {
  return {
    id: 'entry-rule',
    phase: 'entry',
    sideScope: 'long',
    priority: 200,
    condition,
    actions: [{ type: 'OPEN_LONG' }],
  }
}

function buildSpec(rules: CanonicalStrategySpecV2['rules']): CanonicalStrategySpecV2 {
  return {
    version: 2,
    market: {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      defaultTimeframe: '1m',
    },
    indicators: [],
    sizing: { mode: 'QUOTE', value: 10 },
    executionPolicy: {
      signalTiming: 'BAR_CLOSE',
      fillTiming: 'NEXT_BAR_OPEN',
    },
    dataRequirements: {
      requiredTimeframes: ['1m'],
    },
    rules,
  } satisfies CanonicalStrategySpecV2
}

describe('Issue #1395 — atom-contract-registry supportStatus 升级', () => {
  it.each([
    'condition.sequence',
    'price.previous_extrema_retest',
    'risk.atr_take_profit',
  ] as const)('%s.classifier.supportStatus === supported_executable', (key) => {
    const entry = ATOM_CONTRACT_REGISTRY[key]
    expect(entry).toBeDefined()
    expect(entry.classifier.supportStatus).toBe('supported_executable')
  })
})

describe('Issue #1395 — condition.sequence IR emit', () => {
  const compiler = new CanonicalSpecV2IrCompilerService()

  it('consecutive_body × count=3 × up → sequence with 3 GT[close,open] steps', () => {
    const spec = buildSpec([
      baseEntryExitRule({
        kind: 'atom',
        key: 'condition.sequence',
        params: { sequenceKind: 'consecutive_body', count: 3, direction: 'up' },
      }),
    ])
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const seqPred = result.ir.signalCatalog.predicates.find(p => p.kind === 'sequence')
    expect(seqPred).toBeDefined()
    expect(seqPred?.args.length).toBe(3)
    const stepPreds = seqPred!.args.map(id => result.ir.signalCatalog.predicates.find(p => p.id === id))
    for (const step of stepPreds) {
      expect(step?.kind).toBe('GT')
    }
  })

  it('breakout_then_retest direction=up → sequence with breakout + retest steps (GT then GTE)', () => {
    const spec = buildSpec([
      baseEntryExitRule({
        kind: 'atom',
        key: 'condition.sequence',
        params: { sequenceKind: 'breakout_then_retest', direction: 'up', lookbackBars: 24 },
      }),
    ])
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const seqPred = result.ir.signalCatalog.predicates.find(p => p.kind === 'sequence')
    expect(seqPred).toBeDefined()
    expect(seqPred?.args.length).toBe(2)
    const [s1, s2] = seqPred!.args.map(id => result.ir.signalCatalog.predicates.find(p => p.id === id)!)
    expect(s1.kind).toBe('GT')
    expect(s2.kind).toBe('GTE')
    expect(result.ir.runtimeRequirements.helpers).toContain('rollingHigh')
  })

  it('withinBars / nextBarOnly transparent → encoded into sequence params', () => {
    const spec = buildSpec([
      baseEntryExitRule({
        kind: 'atom',
        key: 'condition.sequence',
        params: { sequenceKind: 'consecutive_body', count: 2, direction: 'down', withinBars: 5, nextBarOnly: 'true' },
      }),
    ])
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const seqPred = result.ir.signalCatalog.predicates.find(p => p.kind === 'sequence')
    expect(seqPred?.params?.withinBars).toBe(5)
    expect(seqPred?.params?.nextBarOnly).toBe(true)
  })

  it('unknown sequenceKind → 兜底空 args sequence（向后兼容）', () => {
    const spec = buildSpec([
      baseEntryExitRule({
        kind: 'atom',
        key: 'condition.sequence',
        params: { sequenceKind: 'invalid_kind' },
      }),
    ])
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const seqPred = result.ir.signalCatalog.predicates.find(p => p.kind === 'sequence')
    expect(seqPred).toBeDefined()
    expect(seqPred?.args.length).toBe(0)
    expect(seqPred?.params?.sequenceKind).toBe('invalid_kind')
  })

  it('consecutive_body with count<=0 → fail-closed', () => {
    const spec = buildSpec([
      baseEntryExitRule({
        kind: 'atom',
        key: 'condition.sequence',
        params: { sequenceKind: 'consecutive_body', count: 0, direction: 'up' },
      }),
    ])
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(/condition_unsupported:condition\.sequence:count/)
  })
})

describe('Issue #1395 — price.previous_extrema_retest IR emit', () => {
  const compiler = new CanonicalSpecV2IrCompilerService()

  it('breakout(high)+retest(not_break) → sequence with GT then GTE steps; HIGHEST_HIGH series registered', () => {
    const spec = buildSpec([
      baseEntryExitRule({
        kind: 'atom',
        key: 'price.previous_extrema_retest',
        params: { lookbackBars: 24, extremaType: 'high', retestKind: 'not_break', tolerancePct: 0.2, maxBars: 6 },
      }),
    ])
    const result = compiler.compile({ canonicalSpec: spec, fallback })

    const seqPred = result.ir.signalCatalog.predicates.find(p => p.kind === 'sequence')
    expect(seqPred).toBeDefined()
    expect(seqPred?.args.length).toBe(2)
    const [breakoutStep, retestStep] = seqPred!.args.map(id => result.ir.signalCatalog.predicates.find(p => p.id === id)!)
    expect(breakoutStep.kind).toBe('GT')
    expect(retestStep.kind).toBe('GTE')
    expect(seqPred?.params?.withinBars).toBe(6)
    expect(seqPred?.params?.tolerancePct).toBe(0.2)
    expect(seqPred?.params?.extremaType).toBe('high')
    expect(seqPred?.params?.retestKind).toBe('not_break')

    const hasHighestHigh = result.ir.signalCatalog.series.some(s => s.kind === 'HIGHEST_HIGH' && s.params?.period === 24)
    expect(hasHighestHigh).toBe(true)
    expect(result.ir.runtimeRequirements.helpers).toContain('rollingHigh')
  })

  it('extremaType=low + retestKind=break_through → LT breakout + GT retest', () => {
    const spec = buildSpec([
      baseEntryExitRule({
        kind: 'atom',
        key: 'price.previous_extrema_retest',
        params: { lookbackBars: 12, extremaType: 'low', retestKind: 'break_through' },
      }),
    ])
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const seqPred = result.ir.signalCatalog.predicates.find(p => p.kind === 'sequence')
    expect(seqPred).toBeDefined()
    const [breakoutStep, retestStep] = seqPred!.args.map(id => result.ir.signalCatalog.predicates.find(p => p.id === id)!)
    expect(breakoutStep.kind).toBe('LT')
    expect(retestStep.kind).toBe('GT')
    expect(result.ir.runtimeRequirements.helpers).toContain('rollingLow')
  })

  it('invalid lookbackBars → fail-closed', () => {
    const spec = buildSpec([
      baseEntryExitRule({
        kind: 'atom',
        key: 'price.previous_extrema_retest',
        params: { lookbackBars: 0, extremaType: 'high' },
      }),
    ])
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(/condition_unsupported:price\.previous_extrema_retest:lookbackBars/)
  })
})

describe('Issue #1395 — risk.atr_take_profit IR emit', () => {
  const compiler = new CanonicalSpecV2IrCompilerService()

  function buildSpecWithAtrTp(params: { period?: number; multiple?: number; multiplier?: number }): CanonicalStrategySpecV2 {
    return buildSpec([
      {
        id: 'entry-close-gt-open',
        phase: 'entry',
        sideScope: 'long',
        priority: 200,
        condition: {
          kind: 'expression',
          op: 'GT',
          left: { kind: 'series', source: 'bar', field: 'close' },
          right: { kind: 'series', source: 'bar', field: 'open' },
        },
        actions: [{ type: 'OPEN_LONG' }],
      },
      {
        id: 'risk-atr-tp',
        phase: 'risk',
        sideScope: 'both',
        priority: 100,
        condition: {
          kind: 'atom',
          key: 'risk.atr_take_profit',
          semanticScope: 'position',
          params: {
            ...(params.period !== undefined ? { period: params.period } : {}),
            ...(params.multiple !== undefined ? { multiple: params.multiple } : {}),
            ...(params.multiplier !== undefined ? { multiplier: params.multiplier } : {}),
          },
        },
        actions: [{ type: 'FORCE_EXIT' }],
      },
    ])
  }

  it('emits atrMultipleTakeProfit riskPredicate with period=14 default + multiple', () => {
    const spec = buildSpecWithAtrTp({ multiple: 3 })
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const preds = result.ir.riskPolicy.riskPredicates ?? []
    const tp = preds.find(p => p.kind === 'atrMultipleTakeProfit')
    expect(tp).toBeDefined()
    expect(tp?.params.multiple).toBe(3)
    expect(tp?.params.period).toBe(14)
    expect(tp?.actions).toEqual([{ kind: 'FORCE_EXIT' }])
    expect(result.ir.runtimeRequirements.helpers).toContain('atr')
  })

  it('accepts multiplier alias as multiple fallback', () => {
    const spec = buildSpecWithAtrTp({ multiplier: 2.5, period: 10 })
    const result = compiler.compile({ canonicalSpec: spec, fallback })
    const tp = (result.ir.riskPolicy.riskPredicates ?? []).find(p => p.kind === 'atrMultipleTakeProfit')
    expect(tp?.params.multiple).toBe(2.5)
    expect(tp?.params.period).toBe(10)
  })

  it('fails-closed when multiple ≤ 0', () => {
    const spec = buildSpecWithAtrTp({ multiple: 0 })
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(/condition_unsupported:risk\.atr_take_profit:multiple/)
  })
})
