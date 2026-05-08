import type { CanonicalConditionNode, CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec-v2'
import type { SemanticTriggerState } from '../../types/semantic-state'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { normalizeTriggerCombinationContracts } from '../semantic-state-normalization'

const fallback = {
  exchange: 'binance' as const,
  symbol: 'BTCUSDT',
  baseTimeframe: '15m',
  positionPct: 10,
}

function makePreviousExtremaSpec(condition: CanonicalConditionNode): CanonicalStrategySpecV2 {
  return {
    version: 2,
    market: {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      defaultTimeframe: '15m',
    },
    indicators: [],
    sizing: { mode: 'RATIO', value: 0.1 },
    executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
    dataRequirements: { requiredTimeframes: ['15m'] },
    rules: [
      {
        id: 'entry-previous-extrema',
        phase: 'entry',
        sideScope: 'long',
        priority: 200,
        condition,
        actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
      },
    ],
  }
}

function makeTrigger(params: Record<string, unknown>): SemanticTriggerState {
  return {
    id: 'previous-extrema',
    key: 'price.previous_extrema',
    phase: 'entry',
    sideScope: 'long',
    params,
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
  }
}

describe('phase 3 price.previous_extrema', () => {
  describe('semantic atom registry', () => {
    const registry = new SemanticAtomRegistryService()

    it('registers price.previous_extrema as supported_requires_slot with kind/lookback/memoryKey open slots', () => {
      const atom = registry.get('price.previous_extrema')
      expect(atom).toMatchObject({
        key: 'price.previous_extrema',
        category: 'trigger',
        supportStatus: 'supported_requires_slot',
        executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
      })
      expect(atom.requiredParams).toEqual(expect.arrayContaining(['kind', 'lookback', 'memoryKey']))
      expect(atom.defaultableParams).toEqual(expect.arrayContaining(['pivotStrength', 'confirmationBars']))
      const slotKeys = atom.openSlots.map(slot => slot.slotKey)
      expect(slotKeys).toEqual(expect.arrayContaining([
        'price.previous_extrema.kind',
        'price.previous_extrema.lookback',
        'price.previous_extrema.memoryKey',
      ]))
      expect(atom.contractSubstrate?.runtimeRequirements).toEqual(expect.arrayContaining([
        expect.objectContaining({ domain: 'runtime', verb: 'compute', object: 'rolling_extrema' }),
      ]))
      expect(atom.contractSubstrate?.stateRequirements).toEqual(expect.arrayContaining([
        expect.objectContaining({ domain: 'state', verb: 'write', object: 'memoryKey' }),
      ]))
    })
  })

  describe('ir compiler', () => {
    it('compiles a prev_high breakout into a HIGHEST_HIGH GTE predicate', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = makePreviousExtremaSpec({
        kind: 'atom',
        key: 'price.previous_extrema',
        semanticScope: 'market',
        op: 'GT',
        params: {
          kind: 'prev_high',
          lookback: 20,
          memoryKey: 'previous_extrema_test_high',
        },
      })

      const program = compiler.compile({ canonicalSpec: spec, fallback })
      // 期望声明 HIGHEST_HIGH 序列，period=lookback=20。
      expect(program.ir.signalCatalog.series).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'HIGHEST_HIGH', params: expect.objectContaining({ period: 20 }) }),
      ]))
      // 期望生成 GTE(close, channel) 类型的 predicate。
      expect(program.ir.signalCatalog.predicates.some(predicate => predicate.kind === 'GTE')).toBe(true)
    })

    it('compiles a swing_low breakdown into a LOWEST_LOW LTE predicate', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = makePreviousExtremaSpec({
        kind: 'atom',
        key: 'price.previous_extrema',
        semanticScope: 'market',
        op: 'LT',
        params: {
          kind: 'swing_low',
          lookback: 30,
          memoryKey: 'previous_extrema_test_low',
        },
      })

      const program = compiler.compile({ canonicalSpec: spec, fallback })
      expect(program.ir.signalCatalog.series).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'LOWEST_LOW', params: expect.objectContaining({ period: 30 }) }),
      ]))
      expect(program.ir.signalCatalog.predicates.some(predicate => predicate.kind === 'LTE')).toBe(true)
    })

    it('treats prev_high and swing_high identically (both compile to HIGHEST_HIGH GTE)', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const prevHigh = compiler.compile({
        canonicalSpec: makePreviousExtremaSpec({
          kind: 'atom',
          key: 'price.previous_extrema',
          semanticScope: 'market',
          op: 'GT',
          params: { kind: 'prev_high', lookback: 20, memoryKey: 'm1' },
        }),
        fallback,
      })
      const swingHigh = compiler.compile({
        canonicalSpec: makePreviousExtremaSpec({
          kind: 'atom',
          key: 'price.previous_extrema',
          semanticScope: 'market',
          op: 'GT',
          params: { kind: 'swing_high', lookback: 20, memoryKey: 'm2' },
        }),
        fallback,
      })
      expect(prevHigh.ir.signalCatalog.series.some(series => series.kind === 'HIGHEST_HIGH')).toBe(true)
      expect(swingHigh.ir.signalCatalog.series.some(series => series.kind === 'HIGHEST_HIGH')).toBe(true)
    })

    it('fails closed when lookback is missing (drops to default unsupported throw)', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = makePreviousExtremaSpec({
        kind: 'atom',
        key: 'price.previous_extrema',
        semanticScope: 'market',
        op: 'GT',
        params: { kind: 'prev_high', memoryKey: 'mX' },
      })
      // lookback 缺失 -> compileConditionAtom 返回 null -> compileCondition 走 default 抛
      // codegen.canonical_spec_v2_condition_unsupported:price.previous_extrema 路径。
      expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
        /codegen\.canonical_spec_v2_condition_unsupported:price\.previous_extrema/,
      )
    })

    it('fails closed when kind is missing or invalid', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = makePreviousExtremaSpec({
        kind: 'atom',
        key: 'price.previous_extrema',
        semanticScope: 'market',
        op: 'GT',
        params: { lookback: 20, memoryKey: 'mY' },
      })
      expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
        /codegen\.canonical_spec_v2_condition_unsupported:price\.previous_extrema/,
      )
    })

    it('fails closed when lookback is not a positive integer (fractional / negative)', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      for (const badLookback of [2.5, -3, 0]) {
        const spec = makePreviousExtremaSpec({
          kind: 'atom',
          key: 'price.previous_extrema',
          semanticScope: 'market',
          op: 'GT',
          params: { kind: 'prev_high', lookback: badLookback, memoryKey: 'mZ' },
        })
        expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
          /codegen\.canonical_spec_v2_condition_unsupported:price\.previous_extrema/,
        )
      }
    })
  })

  describe('semantic state normalization', () => {
    it('auto-fills memoryKey with hash when missing on price.previous_extrema trigger', () => {
      const trigger = makeTrigger({ kind: 'prev_high', lookback: 20, sourceText: '前高突破' })
      const [normalized] = normalizeTriggerCombinationContracts([trigger])
      expect(typeof normalized.params.memoryKey).toBe('string')
      expect(normalized.params.memoryKey as string).toMatch(/^previous_extrema_[0-9a-f]{16}$/)
    })

    it('produces identical memoryKey for equivalent triggers (cross-atom remembered level reuse)', () => {
      const triggerA = makeTrigger({ kind: 'prev_high', lookback: 20, sourceText: '前高突破' })
      const triggerB = makeTrigger({ kind: 'prev_high', lookback: 20, sourceText: '前高突破' })
      const [a] = normalizeTriggerCombinationContracts([triggerA])
      const [b] = normalizeTriggerCombinationContracts([triggerB])
      expect(a.params.memoryKey).toBe(b.params.memoryKey)
    })

    it('keeps an explicitly provided memoryKey intact', () => {
      const trigger = makeTrigger({ kind: 'prev_high', lookback: 20, memoryKey: 'user_supplied_key' })
      const [normalized] = normalizeTriggerCombinationContracts([trigger])
      expect(normalized.params.memoryKey).toBe('user_supplied_key')
    })

    it('treats empty / whitespace memoryKey as missing and auto-fills hash', () => {
      for (const blank of ['', '   ']) {
        const trigger = makeTrigger({ kind: 'prev_high', lookback: 20, sourceText: '前高突破', memoryKey: blank })
        const [normalized] = normalizeTriggerCombinationContracts([trigger])
        expect(normalized.params.memoryKey as string).toMatch(/^previous_extrema_[0-9a-f]{16}$/)
      }
    })

    it('does not touch triggers with other keys', () => {
      const other: SemanticTriggerState = {
        ...makeTrigger({}),
        key: 'indicator.cross_over',
      }
      const [normalized] = normalizeTriggerCombinationContracts([other])
      expect(normalized.params.memoryKey).toBeUndefined()
    })
  })
})
