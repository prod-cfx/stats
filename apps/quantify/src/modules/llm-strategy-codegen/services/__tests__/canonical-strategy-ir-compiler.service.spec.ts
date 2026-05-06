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
