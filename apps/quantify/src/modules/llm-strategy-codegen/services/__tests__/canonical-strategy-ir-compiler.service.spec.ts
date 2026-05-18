import type { StrategyLogicGraphSnapshot } from '../../types/strategy-logic-graph-snapshot'
import { CanonicalStrategyIrCanonicalizerService } from '../canonical-strategy-ir-canonicalizer.service'
import { CanonicalStrategyIrCompilerService } from '../canonical-strategy-ir-compiler.service'
import { CanonicalStrategyIrValidatorService } from '../canonical-strategy-ir-validator.service'
import { GraphOperatorParserService } from '../graph-operator-parser.service'
import { GraphSemanticProjectionService } from '../graph-semantic-projection.service'

describe('canonicalStrategyIrCompilerService', () => {
  const buildCompiler = () => new CanonicalStrategyIrCompilerService(
    new GraphOperatorParserService(),
    new GraphSemanticProjectionService(),
    new CanonicalStrategyIrValidatorService(),
    new CanonicalStrategyIrCanonicalizerService(),
  )

  it('compiles a moving-average crossover graph snapshot into canonical IR', () => {
    const compiler = buildCompiler()

    const graph: StrategyLogicGraphSnapshot = {
      version: 18,
      status: 'confirmed',
      trigger: [
        {
          id: 'trigger-entry-18-0',
          phase: 'entry',
          operator: 'CROSS_OVER(EMA(CLOSE,7),EMA(CLOSE,21))',
        },
        {
          id: 'trigger-exit-18-0',
          phase: 'exit',
          operator: 'CROSS_UNDER(EMA(CLOSE,7),EMA(CLOSE,21))',
          join: 'AND',
        },
      ],
      actions: [
        { id: 'action-buy-18', action: 'BUY', target: 'BTCUSDT', amount: '25%' },
        { id: 'action-sell-18', action: 'SELL', target: 'BTCUSDT', amount: '25%' },
      ],
      risk: ['stopLoss: STOP_LOSS_PCT(4)'],
      meta: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        positionPct: 25,
        executionTags: [],
      },
    }

    const ir = compiler.compile(graph)

    expect(ir.market.symbol).toBe('BTCUSDT')
    expect(ir.market.timeframes).toEqual(['1h'])
    expect(ir.signalCatalog.series.map(item => item.kind)).toEqual(['PRICE', 'EMA', 'EMA'])
    expect(ir.ruleBlocks.map(item => item.phase)).toEqual(['entry', 'exit'])
    expect(ir.riskPolicy.guards).toEqual([
      expect.objectContaining({
        kind: 'STOP_LOSS_PCT',
        value: 4,
      }),
    ])
  })

  it('rejects mixed join without explicit nesting', () => {
    const compiler = buildCompiler()

    const graph: StrategyLogicGraphSnapshot = {
      version: 3,
      status: 'confirmed',
      trigger: [
        {
          id: 'trigger-entry-3-0',
          phase: 'entry',
          operator: 'GT(CLOSE,EMA(CLOSE,7))',
        },
        {
          id: 'trigger-entry-3-1',
          phase: 'entry',
          operator: 'LT(RSI(CLOSE,14),30)',
          join: 'AND',
        },
        {
          id: 'trigger-entry-3-2',
          phase: 'entry',
          operator: 'CROSS_OVER(EMA(CLOSE,7),EMA(CLOSE,21))',
          join: 'OR',
        },
      ],
      actions: [
        { id: 'action-buy-3', action: 'BUY', target: 'BTCUSDT', amount: '10%' },
      ],
      risk: [],
      meta: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        positionPct: 10,
        executionTags: [],
      },
    }

    expect(() => compiler.compile(graph)).toThrow('codegen.graph_join_ambiguous')
  })

  // ============================================================
  // Issue #1457 闸 2 — entry rule 事件叶子 invariant（review round 1: m5 中文用例名）
  // ============================================================
  describe('#1457 entry rule 事件叶子 invariant', () => {
    const baseMeta = {
      exchange: 'binance' as const,
      symbol: 'BTCUSDT',
      timeframe: '1h',
      positionPct: 25,
      executionTags: [] as string[],
    }

    const buildGraph = (operator: string, version = 1): StrategyLogicGraphSnapshot => ({
      version,
      status: 'confirmed',
      trigger: [{ id: `trigger-entry-${version}`, phase: 'entry', operator }],
      actions: [{ id: 'action-buy', action: 'BUY', target: 'BTCUSDT', amount: '25%' }],
      risk: [],
      meta: baseMeta,
    })

    it('纯状态谓词 allOf[GTE×3] 必须被拒绝', () => {
      const compiler = buildCompiler()
      const graph = buildGraph('allOf(GTE(CLOSE,EMA(CLOSE,20)),GTE(CLOSE,EMA(CLOSE,60)),GTE(CLOSE,EMA(CLOSE,144)))')
      expect(() => compiler.compile(graph)).toThrow(/entry_rule_requires_event_leaf/)
    })

    it('混合 state + event 叶子时放行', () => {
      const compiler = buildCompiler()
      const graph = buildGraph('allOf(GTE(CLOSE,EMA(CLOSE,20)),GTE(CLOSE,EMA(CLOSE,60)),CROSS_OVER(EMA(CLOSE,7),EMA(CLOSE,21)))', 2)
      expect(() => compiler.compile(graph)).not.toThrow()
    })

    it('单一 event 叶子时放行', () => {
      const compiler = buildCompiler()
      const graph = buildGraph('CROSS_OVER(EMA(CLOSE,7),EMA(CLOSE,21))', 3)
      expect(() => compiler.compile(graph)).not.toThrow()
    })

    // ── review round 1 M5 边界 case ──
    it('M5 anyOf[GTE, GTE] 纯状态 → 拒绝', () => {
      const compiler = buildCompiler()
      const graph = buildGraph('anyOf(GTE(CLOSE,EMA(CLOSE,20)),GTE(CLOSE,EMA(CLOSE,60)))', 4)
      expect(() => compiler.compile(graph)).toThrow(/entry_rule_requires_event_leaf/)
    })

    it('M5 anyOf[GTE, CROSS_OVER] 含 event → 通过', () => {
      const compiler = buildCompiler()
      const graph = buildGraph('anyOf(GTE(CLOSE,EMA(CLOSE,20)),CROSS_OVER(EMA(CLOSE,7),EMA(CLOSE,21)))', 5)
      expect(() => compiler.compile(graph)).not.toThrow()
    })

    it('M5/M3 单独 NOT(CROSS_OVER) → 拒绝（NOT 翻转视为 state）', () => {
      const compiler = buildCompiler()
      const graph = buildGraph('NOT(CROSS_OVER(EMA(CLOSE,7),EMA(CLOSE,21)))', 6)
      expect(() => compiler.compile(graph)).toThrow(/entry_rule_requires_event_leaf/)
    })

    it('M5/M3 allOf[GTE, NOT(CROSS_OVER)] → 拒绝（NOT(event) 翻为 state）', () => {
      const compiler = buildCompiler()
      const graph = buildGraph('allOf(GTE(CLOSE,EMA(CLOSE,20)),NOT(CROSS_OVER(EMA(CLOSE,7),EMA(CLOSE,21))))', 7)
      expect(() => compiler.compile(graph)).toThrow(/entry_rule_requires_event_leaf/)
    })

    it('M5 嵌套 allOf[anyOf[GTE, CROSS_OVER], GTE] → 通过', () => {
      const compiler = buildCompiler()
      const graph = buildGraph('allOf(anyOf(GTE(CLOSE,EMA(CLOSE,20)),CROSS_OVER(EMA(CLOSE,7),EMA(CLOSE,21))),GTE(CLOSE,EMA(CLOSE,60)))', 8)
      expect(() => compiler.compile(graph)).not.toThrow()
    })

    // m6 time_window 等效形态：纯 GT/LT 时间比较 → 仍是 state → 拒绝
    it('m6 纯 time_window 风格 entry rule (LT 比较, 无 event leaf) → 拒绝', () => {
      const compiler = buildCompiler()
      const graph = buildGraph('allOf(GT(CLOSE,EMA(CLOSE,20)),LT(CLOSE,EMA(CLOSE,144)))', 9)
      expect(() => compiler.compile(graph)).toThrow(/entry_rule_requires_event_leaf/)
    })
  })

  it('accepts generic predicate operators on the legacy graph IR path', () => {
    const compiler = buildCompiler()

    const graph: StrategyLogicGraphSnapshot = {
      version: 4,
      status: 'confirmed',
      trigger: [
        {
          id: 'trigger-entry-generic',
          phase: 'entry',
          operator: 'allOf(compare(CLOSE,EMA(CLOSE,20)),cross(EMA(CLOSE,7),EMA(CLOSE,21)))',
        },
        {
          id: 'trigger-exit-sequence',
          phase: 'exit',
          operator: 'sequence()',
        },
      ],
      actions: [
        { id: 'action-buy-4', action: 'BUY', target: 'BTCUSDT', amount: '10%' },
        { id: 'action-sell-4', action: 'SELL', target: 'BTCUSDT', amount: '10%' },
      ],
      risk: [],
      meta: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        positionPct: 10,
        executionTags: [],
      },
    }

    const ir = compiler.compile(graph)

    expect(ir.signalCatalog.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'allOf' }),
      expect.objectContaining({ kind: 'compare' }),
      expect.objectContaining({ kind: 'cross' }),
      expect.objectContaining({ kind: 'sequence' }),
    ]))
  })
})
