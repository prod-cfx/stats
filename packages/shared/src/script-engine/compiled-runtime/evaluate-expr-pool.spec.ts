import { evaluateExprPool } from './evaluate-expr-pool'

describe('evaluateExprPool', () => {
  it('evaluates state-gate equality predicates from runtime context values', () => {
    const exprPool: Array<{
      id: string
      nodeType: 'series' | 'predicate'
      sourceRef: string
      payload: { kind: string, value?: string }
      deps?: string[]
    }> = [
      {
        id: 'expr_01_market_regime',
        nodeType: 'series',
        sourceRef: 'market_regime',
        payload: {
          kind: 'MARKET_REGIME',
        },
      },
      {
        id: 'expr_02_const_range',
        nodeType: 'series',
        sourceRef: 'const_range',
        payload: {
          kind: 'CONST',
          value: 'range',
        },
      },
      {
        id: 'expr_03_gate_eq',
        nodeType: 'predicate',
        sourceRef: 'gate_eq',
        payload: {
          kind: 'EQ',
        },
        deps: ['expr_01_market_regime', 'expr_02_const_range'],
      },
    ]

    const values = evaluateExprPool(
      { marketRegime: 'range', bars: [] },
      exprPool,
      ['expr_01_market_regime', 'expr_02_const_range', 'expr_03_gate_eq'],
    )

    expect(values.expr_01_market_regime).toBe('range')
    expect(values.expr_03_gate_eq).toBe(true)
  })
})
