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

  it('evaluates rolling range-position percent from prior channel bounds', () => {
    const exprPool: Array<{
      id: string
      nodeType: 'series'
      sourceRef: string
      payload: {
        kind: string
        field?: 'close'
        timeframe?: string
        params?: Record<string, number>
        inputs?: string[]
      }
      deps?: string[]
    }> = [
      {
        id: 'close_15m',
        nodeType: 'series',
        sourceRef: 'close_15m',
        payload: {
          kind: 'PRICE',
          field: 'close',
          timeframe: '15m',
        },
      },
      {
        id: 'highest_high_3_15m',
        nodeType: 'series',
        sourceRef: 'highest_high_3_15m',
        payload: {
          kind: 'HIGHEST_HIGH',
          timeframe: '15m',
          params: { period: 3 },
        },
      },
      {
        id: 'lowest_low_3_15m',
        nodeType: 'series',
        sourceRef: 'lowest_low_3_15m',
        payload: {
          kind: 'LOWEST_LOW',
          timeframe: '15m',
          params: { period: 3 },
        },
      },
      {
        id: 'range_position_pct_3_15m',
        nodeType: 'series',
        sourceRef: 'range_position_pct_3_15m',
        deps: ['close_15m', 'highest_high_3_15m', 'lowest_low_3_15m'],
        payload: {
          kind: 'RANGE_POSITION_PCT',
          timeframe: '15m',
          inputs: ['close_15m', 'highest_high_3_15m', 'lowest_low_3_15m'],
          params: { period: 3 },
        },
      },
    ]

    const values = evaluateExprPool(
      {
        bars: [
          { open: 100, high: 110, low: 90, close: 100, volume: 1, timestamp: 1 },
          { open: 100, high: 120, low: 80, close: 110, volume: 1, timestamp: 2 },
          { open: 100, high: 115, low: 85, close: 105, volume: 1, timestamp: 3 },
          { open: 100, high: 105, low: 88, close: 90, volume: 1, timestamp: 4 },
        ],
      },
      exprPool,
      ['close_15m', 'highest_high_3_15m', 'lowest_low_3_15m', 'range_position_pct_3_15m'],
    )

    expect(values.range_position_pct_3_15m).toBe(0.25)
  })
})
