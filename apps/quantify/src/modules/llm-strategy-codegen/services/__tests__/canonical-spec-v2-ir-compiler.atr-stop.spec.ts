import type { CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'

describe('canonicalSpecV2IrCompilerService risk.atr_stop (Lane C)', () => {
  const fallback = {
    exchange: 'binance' as const,
    symbol: 'BTCUSDT',
    baseTimeframe: '1m',
    positionPct: 10,
  }

  function buildSpecWithAtrStop(params: { period?: number; multiplier?: number }): CanonicalStrategySpecV2 {
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
      rules: [
        {
          id: 'entry-close-above-open',
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
          id: 'risk-atr-stop',
          phase: 'risk',
          sideScope: 'both',
          priority: 100,
          condition: {
            kind: 'atom',
            key: 'risk.atr_stop',
            semanticScope: 'position',
            ...(params.period !== undefined || params.multiplier !== undefined
              ? {
                  params: {
                    ...(params.period !== undefined ? { period: params.period } : {}),
                    ...(params.multiplier !== undefined ? { multiplier: params.multiplier } : {}),
                  },
                }
              : {}),
          },
          actions: [{ type: 'FORCE_EXIT' }],
        },
      ],
    } satisfies CanonicalStrategySpecV2
  }

  it('emits an atrTrailingStop riskPredicate into riskPolicy.riskPredicates with period+multiplier', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithAtrStop({ period: 14, multiplier: 2 })
    const result = compiler.compile({ canonicalSpec: spec, fallback })

    const predicates = result.ir.riskPolicy.riskPredicates ?? []
    const atrPred = predicates.find(p => p.kind === 'atrTrailingStop')
    expect(atrPred).toBeDefined()
    expect(atrPred?.id).toBe('risk-atr-stop')
    expect(atrPred?.params.period).toBe(14)
    expect(atrPred?.params.multiplier).toBe(2)
    expect(atrPred?.actions).toEqual([{ kind: 'FORCE_EXIT' }])
  })

  it('defaults period to 14 when not supplied', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithAtrStop({ multiplier: 3 })
    const result = compiler.compile({ canonicalSpec: spec, fallback })

    const predicates = result.ir.riskPolicy.riskPredicates ?? []
    const atrPred = predicates.find(p => p.kind === 'atrTrailingStop')
    expect(atrPred).toBeDefined()
    expect(atrPred?.params.period).toBe(14)
    expect(atrPred?.params.multiplier).toBe(3)
  })

  it('accepts multiple alias as multiplier fallback', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithAtrStop({})
    // 直接构造 multiple 字段（仿照 risk.atr_multiple_stop 的 alias 习惯）
    spec.rules[1]!.condition = {
      kind: 'atom',
      key: 'risk.atr_stop',
      semanticScope: 'position',
      params: { multiple: 2.5 },
    }
    const result = compiler.compile({ canonicalSpec: spec, fallback })

    const predicates = result.ir.riskPolicy.riskPredicates ?? []
    const atrPred = predicates.find(p => p.kind === 'atrTrailingStop')
    expect(atrPred).toBeDefined()
    expect(atrPred?.params.multiplier).toBe(2.5)
    expect(atrPred?.params.period).toBe(14)
  })

  it('fails-closed (throws condition_unsupported) when multiplier <= 0 (mirrors risk.atr_multiple_stop behavior)', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithAtrStop({ multiplier: 0 })
    expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(/codegen\.canonical_spec_v2_condition_unsupported:risk\.atr_stop/)
  })

  it('registers atr helper in runtimeRequirements when atr_stop is compiled', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithAtrStop({ multiplier: 2 })
    const result = compiler.compile({ canonicalSpec: spec, fallback })

    expect(result.ir.runtimeRequirements.helpers).toContain('atr')
  })

  it('does not emit rule into ruleBlocks or guards (risk-predicate path only)', () => {
    const compiler = new CanonicalSpecV2IrCompilerService()
    const spec = buildSpecWithAtrStop({ multiplier: 2 })
    const result = compiler.compile({ canonicalSpec: spec, fallback })

    const ruleIds = result.ir.ruleBlocks.map(b => b.id)
    expect(ruleIds).not.toContain('risk-atr-stop')
    const guardIds = result.ir.riskPolicy.guards.map(g => g.id)
    expect(guardIds).not.toContain('guard_risk-atr-stop')
  })
})
