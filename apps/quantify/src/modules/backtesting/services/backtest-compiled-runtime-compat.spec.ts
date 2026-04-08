import { evaluateExprPool } from '@ai/shared/script-engine/compiled-runtime/evaluate-expr-pool'
import { runDecisionPrograms } from '@ai/shared/script-engine/compiled-runtime/run-decision-programs'

describe('backtestCompiledRuntimeCompat', () => {
  it('evaluates CROSS_OVER using previous and current series values', () => {
    const values = evaluateExprPool(
      {
        bars: [
          { time: 1, open: 100, high: 101, low: 99, close: 100 },
          { time: 2, open: 100, high: 111, low: 100, close: 110 },
        ],
      } as any,
      [
        {
          id: 'close_now',
          nodeType: 'series',
          payload: { kind: 'PRICE', field: 'close', offsetBars: 0 },
        },
        {
          id: 'threshold',
          nodeType: 'series',
          payload: { kind: 'CONST', value: 105 },
        },
        {
          id: 'entry_cross',
          nodeType: 'predicate',
          deps: ['close_now', 'threshold'],
          payload: { kind: 'CROSS_OVER' },
        },
      ] as any,
      ['close_now', 'threshold', 'entry_cross'],
    )

    expect(values.entry_cross).toBe(true)
  })

  it('converts REDUCE_SHORT into a valid ADJUST_POSITION delta decision', () => {
    const decision = runDecisionPrograms(
      {
        currentPrice: 100,
        baseTimeframeBar: { close: 100 },
        position: { qty: -2 },
        portfolio: { equity: 10000 },
      } as any,
      [
        {
          id: 'decision_reduce_short',
          phase: 'rebalance',
          priority: 50,
          when: 'expr_reduce_short',
          actions: [
            {
              kind: 'REDUCE_SHORT',
              quantity: { mode: 'position_pct', value: 50 },
            },
          ],
        },
      ],
      { expr_reduce_short: true },
      {
        blockNewEntry: false,
        forceExit: false,
        strategyHalt: false,
        cancelOrderPrograms: false,
        triggered: [],
      },
      ['decision_reduce_short'],
    )

    expect(decision).toEqual({
      action: 'ADJUST_POSITION',
      adjustMode: 'DELTA',
      size: { mode: 'QTY', value: 1 },
      reason: 'compiled.decision_reduce_short',
    })
  })
})
