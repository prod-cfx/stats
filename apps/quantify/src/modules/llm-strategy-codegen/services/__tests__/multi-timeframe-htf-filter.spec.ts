import type { CanonicalConditionNode, CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec-v2'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'

const fallback = {
  exchange: 'binance' as const,
  symbol: 'BTCUSDT',
  baseTimeframe: '15m',
  positionPct: 10,
}

function makeMultiTimeframeSpec(condition: CanonicalConditionNode): CanonicalStrategySpecV2 {
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
        actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
      },
      {
        id: 'gate-multi-timeframe',
        phase: 'gate',
        sideScope: 'both',
        priority: 100,
        condition,
        actions: [{ type: 'BLOCK_NEW_ENTRY' }],
      },
    ],
  }
}

describe('Phase 3 multi_timeframe HTF filter', () => {
  describe('semantic atom registry', () => {
    const registry = new SemanticAtomRegistryService()

    it('registers strategy.multi_timeframe as supported_requires_slot with HTF open slots', () => {
      const atom = registry.get('strategy.multi_timeframe')
      expect(atom).toMatchObject({
        key: 'strategy.multi_timeframe',
        category: 'trigger',
        supportStatus: 'supported_requires_slot',
        executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
      })
      expect(atom.requiredParams).toEqual(expect.arrayContaining(['htfTimeframe', 'htfCondition']))
      const slotKeys = atom.openSlots.map(slot => slot.slotKey)
      expect(slotKeys).toEqual(expect.arrayContaining([
        'strategy.multi_timeframe.htfTimeframe',
        'strategy.multi_timeframe.htfCondition',
      ]))
      expect(atom.contractSubstrate?.runtimeRequirements).toEqual(expect.arrayContaining([
        expect.objectContaining({
          domain: 'runtime',
          verb: 'feed',
          object: 'multi_timeframe',
          shape: expect.objectContaining({ aligned: true }),
        }),
      ]))
    })
  })

  describe('canonical spec v2 ir compiler', () => {
    it('compiles HTF MA filter with full params into EXPRESSION_GUARD + BLOCK_NEW_ENTRY', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = makeMultiTimeframeSpec({
        kind: 'atom',
        key: 'strategy.multi_timeframe',
        semanticScope: 'market',
        op: 'GT',
        params: {
          htfTimeframe: '4h',
          htfIndicator: 'ma',
          htfPeriod: 50,
          htfOp: 'GT',
          htfRhs: 'price',
          htfCondition: 'close>SMA(50)@4h',
        },
      })
      const result = compiler.compile({ canonicalSpec: spec, fallback })

      expect(result.ir.riskPolicy.guards).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: 'EXPRESSION_GUARD',
          scope: 'strategy',
          appliesTo: 'both',
          onBreach: 'BLOCK_NEW_ENTRY',
        }),
      ]))
      // GT is flipped to LTE so the guard fires (block) when HTF MA is NOT above price.
      expect(result.ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'LTE' }),
      ]))
    })

    it('forces all multi_timeframe series operands onto htfTimeframe', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = makeMultiTimeframeSpec({
        kind: 'atom',
        key: 'strategy.multi_timeframe',
        semanticScope: 'market',
        op: 'GT',
        params: {
          htfTimeframe: '4h',
          htfIndicator: 'ma',
          htfPeriod: 50,
          htfOp: 'GT',
          htfRhs: 'price',
        },
      })
      const result = compiler.compile({ canonicalSpec: spec, fallback })

      const htfSeries = result.ir.signalCatalog.series.filter(series =>
        series.kind === 'SMA' && series.timeframe === '4h',
      )
      expect(htfSeries.length).toBeGreaterThan(0)
      const htfClose = result.ir.signalCatalog.series.filter(series =>
        series.kind === 'PRICE' && series.timeframe === '4h' && series.field === 'close',
      )
      expect(htfClose.length).toBeGreaterThan(0)
      // No SMA(50) leaked onto LTF 15m timeframe.
      const ltfMaLeak = result.ir.signalCatalog.series.find(series =>
        series.kind === 'SMA'
        && series.timeframe === '15m'
        && (series.params?.period === 50),
      )
      expect(ltfMaLeak).toBeUndefined()
    })

    it('does not emit a multi_timeframe EXPRESSION_GUARD when htfTimeframe is missing (fail closed)', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = makeMultiTimeframeSpec({
        kind: 'atom',
        key: 'strategy.multi_timeframe',
        semanticScope: 'market',
        op: 'GT',
        params: {
          htfIndicator: 'ma',
          htfPeriod: 50,
          htfOp: 'GT',
          htfRhs: 'price',
        },
      })

      // 与既有 phase-1 gate 行为一致：参数不完整时 compilePhase1GateAtom 返回 null，
      // 既不会落地 EXPRESSION_GUARD，也不会通过 compileCondition 编出未知 atom。
      // 上游 readiness 必须先把 supported_requires_slot open slots 解决，否则不应进入 IR 编译。
      // 这里以抛错形式断言 fail-closed：避免悄悄静默吞掉缺参 multi_timeframe 规则。
      expect(() => compiler.compile({ canonicalSpec: spec, fallback })).toThrow(
        /codegen\.canonical_spec_v2_condition_unsupported:strategy\.multi_timeframe/,
      )
    })

    it('compiles HTF RSI threshold filter into EXPRESSION_GUARD with flipped predicate', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec = makeMultiTimeframeSpec({
        kind: 'atom',
        key: 'strategy.multi_timeframe',
        semanticScope: 'market',
        op: 'LT',
        params: {
          htfTimeframe: '4h',
          htfIndicator: 'rsi',
          htfPeriod: 14,
          htfOp: 'LT',
          htfRhs: 'value',
          htfValue: 30,
        },
      })
      const result = compiler.compile({ canonicalSpec: spec, fallback })

      const rsiSeries = result.ir.signalCatalog.series.find(series =>
        series.kind === 'RSI' && series.timeframe === '4h',
      )
      expect(rsiSeries).toBeDefined()
      // LT flips to GTE so the guard fires when RSI >= 30 (i.e. HTF condition not satisfied).
      expect(result.ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'GTE' }),
      ]))
      expect(result.ir.riskPolicy.guards).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: 'EXPRESSION_GUARD',
          onBreach: 'BLOCK_NEW_ENTRY',
        }),
      ]))
    })

    it('does not regress legacy single-timeframe specs (no multi_timeframe guard emitted)', () => {
      const compiler = new CanonicalSpecV2IrCompilerService()
      const spec: CanonicalStrategySpecV2 = {
        version: 2,
        market: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'spot',
          defaultTimeframe: '15m',
        },
        indicators: [],
        sizing: { mode: 'RATIO', value: 0.1 },
        executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
        dataRequirements: { requiredTimeframes: ['15m'] },
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
            actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
          },
        ],
      }
      const result = compiler.compile({ canonicalSpec: spec, fallback })

      const expressionGuards = result.ir.riskPolicy.guards.filter(guard =>
        guard.kind === 'EXPRESSION_GUARD',
      )
      expect(expressionGuards).toEqual([])
    })
  })
})
