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

  it('evaluates generic volume relative-average predicates', () => {
    const exprPool: Array<{
      id: string
      nodeType: 'series' | 'predicate'
      sourceRef: string
      payload: {
        kind: string
        timeframe?: string
        inputs?: string[]
        params?: Record<string, number | string>
      }
      deps?: string[]
    }> = [
      {
        id: 'volume_15m',
        nodeType: 'series',
        sourceRef: 'volume_15m',
        payload: {
          kind: 'VOLUME',
          timeframe: '15m',
        },
      },
      {
        id: 'sma_volume_3_1_5_15m',
        nodeType: 'series',
        sourceRef: 'sma_volume_3_1_5_15m',
        deps: ['volume_15m'],
        payload: {
          kind: 'SMA_VOLUME',
          timeframe: '15m',
          inputs: ['volume_15m'],
          params: { period: 3, multiplier: 1.5 },
        },
      },
      {
        id: 'volume_spike',
        nodeType: 'predicate',
        sourceRef: 'volume.relative_average',
        deps: ['volume_15m', 'sma_volume_3_1_5_15m'],
        payload: {
          kind: 'compare',
          params: { op: 'GT' },
        },
      },
    ]

    const values = evaluateExprPool(
      {
        bars: [
          { open: 100, high: 101, low: 99, close: 100, volume: 100, timestamp: 1 },
          { open: 100, high: 101, low: 99, close: 100, volume: 120, timestamp: 2 },
          { open: 100, high: 101, low: 99, close: 100, volume: 110, timestamp: 3 },
          { open: 100, high: 101, low: 99, close: 100, volume: 300, timestamp: 4 },
        ],
      },
      exprPool,
      ['volume_15m', 'sma_volume_3_1_5_15m', 'volume_spike'],
    )

    expect(values.volume_15m).toBe(300)
    expect(values.sma_volume_3_1_5_15m).toBe(165)
    expect(values.volume_spike).toBe(true)
  })

  it('evaluates generic allOf and anyOf predicates', () => {
    const exprPool: Array<{
      id: string
      nodeType: 'series' | 'predicate'
      sourceRef: string
      payload: { kind: string, value?: number, params?: Record<string, string> }
      deps?: string[]
    }> = [
      { id: 'left', nodeType: 'series', sourceRef: 'left', payload: { kind: 'CONST', value: 3 } },
      { id: 'right', nodeType: 'series', sourceRef: 'right', payload: { kind: 'CONST', value: 2 } },
      {
        id: 'is_gt',
        nodeType: 'predicate',
        sourceRef: 'is_gt',
        payload: { kind: 'compare', params: { op: 'GT' } },
        deps: ['left', 'right'],
      },
      {
        id: 'is_lt',
        nodeType: 'predicate',
        sourceRef: 'is_lt',
        payload: { kind: 'compare', params: { op: 'LT' } },
        deps: ['left', 'right'],
      },
      {
        id: 'all_true',
        nodeType: 'predicate',
        sourceRef: 'all_true',
        payload: { kind: 'allOf' },
        deps: ['is_gt'],
      },
      {
        id: 'any_true',
        nodeType: 'predicate',
        sourceRef: 'any_true',
        payload: { kind: 'anyOf' },
        deps: ['is_lt', 'is_gt'],
      },
    ]

    const values = evaluateExprPool(
      { bars: [] },
      exprPool,
      ['left', 'right', 'is_gt', 'is_lt', 'all_true', 'any_true'],
    )

    expect(values.is_gt).toBe(true)
    expect(values.is_lt).toBe(false)
    expect(values.all_true).toBe(true)
    expect(values.any_true).toBe(true)
  })

  it('fails sequence predicates closed when runtime state is empty and no deps exist', () => {
    const exprPool: Array<{
      id: string
      nodeType: 'predicate'
      sourceRef: string
      payload: { kind: string, params?: Record<string, string> }
      deps?: string[]
    }> = [
      {
        id: 'breakout_retest',
        nodeType: 'predicate',
        sourceRef: 'condition.sequence',
        payload: { kind: 'sequence', params: { memoryKey: 'breakout' } },
        deps: [],
      },
    ]

    const values = evaluateExprPool(
      { bars: [], semanticRuntimeState: { breakout: {} } },
      exprPool,
      ['breakout_retest'],
    )

    expect(values.breakout_retest).toBe(false)
  })

  it('evaluates sequence predicates from explicit runtime state decisions', () => {
    const exprPool: Array<{
      id: string
      nodeType: 'predicate'
      sourceRef: string
      payload: { kind: string, params?: Record<string, string> }
      deps?: string[]
    }> = [
      {
        id: 'breakout_retest',
        nodeType: 'predicate',
        sourceRef: 'condition.sequence',
        payload: { kind: 'sequence', params: { memoryKey: 'breakout' } },
        deps: [],
      },
    ]

    const values = evaluateExprPool(
      { bars: [], semanticRuntimeState: { breakout: { confirmed: true } } },
      exprPool,
      ['breakout_retest'],
    )

    expect(values.breakout_retest).toBe(true)
  })

  it('fails unknown generic compare and cross operators closed', () => {
    const exprPool: Array<{
      id: string
      nodeType: 'series' | 'predicate'
      sourceRef: string
      payload: { kind: string, value?: number, params?: Record<string, string> }
      deps?: string[]
    }> = [
      { id: 'left', nodeType: 'series', sourceRef: 'left', payload: { kind: 'CONST', value: 3 } },
      { id: 'right', nodeType: 'series', sourceRef: 'right', payload: { kind: 'CONST', value: 2 } },
      {
        id: 'unknown_compare',
        nodeType: 'predicate',
        sourceRef: 'unknown_compare',
        payload: { kind: 'compare', params: { op: 'ABOVEISH' } },
        deps: ['left', 'right'],
      },
      {
        id: 'unknown_cross',
        nodeType: 'predicate',
        sourceRef: 'unknown_cross',
        payload: { kind: 'cross', params: { direction: 'sideways' } },
        deps: ['left', 'right'],
      },
    ]

    const values = evaluateExprPool(
      { bars: [] },
      exprPool,
      ['left', 'right', 'unknown_compare', 'unknown_cross'],
    )

    expect(values.unknown_compare).toBe(false)
    expect(values.unknown_cross).toBe(false)
  })

  it('fails generic cross predicates closed when direction uses a compare operator', () => {
    const exprPool: Array<{
      id: string
      nodeType: 'series' | 'predicate'
      sourceRef: string
      payload: { kind: string, field?: 'close', value?: number, params?: Record<string, string> }
      deps?: string[]
    }> = [
      { id: 'left', nodeType: 'series', sourceRef: 'left', payload: { kind: 'PRICE', field: 'close' } },
      { id: 'right', nodeType: 'series', sourceRef: 'right', payload: { kind: 'CONST', value: 100 } },
      {
        id: 'malformed_cross',
        nodeType: 'predicate',
        sourceRef: 'malformed_cross',
        payload: { kind: 'cross', params: { direction: 'GT' } },
        deps: ['left', 'right'],
      },
    ]

    const values = evaluateExprPool(
      {
        bars: [
          { open: 100, high: 101, low: 99, close: 99, volume: 1, timestamp: 1 },
          { open: 100, high: 102, low: 99, close: 101, volume: 1, timestamp: 2 },
        ],
      },
      exprPool,
      ['left', 'right', 'malformed_cross'],
    )

    expect(values.malformed_cross).toBe(false)
  })

  it('defaults missing generic compare operators to GT', () => {
    const exprPool: Array<{
      id: string
      nodeType: 'series' | 'predicate'
      sourceRef: string
      payload: { kind: string, value?: number, params?: Record<string, string> }
      deps?: string[]
    }> = [
      { id: 'left', nodeType: 'series', sourceRef: 'left', payload: { kind: 'CONST', value: 3 } },
      { id: 'right', nodeType: 'series', sourceRef: 'right', payload: { kind: 'CONST', value: 2 } },
      {
        id: 'default_compare',
        nodeType: 'predicate',
        sourceRef: 'default_compare',
        payload: { kind: 'compare' },
        deps: ['left', 'right'],
      },
    ]

    const values = evaluateExprPool(
      { bars: [] },
      exprPool,
      ['left', 'right', 'default_compare'],
    )

    expect(values.default_compare).toBe(true)
  })

  it('evaluates generic rolling-high compare predicates against the previous channel', () => {
    const exprPool: Array<{
      id: string
      nodeType: 'series' | 'predicate'
      sourceRef: string
      payload: {
        kind: string
        field?: 'close'
        timeframe?: string
        params?: Record<string, number | string>
      }
      deps?: string[]
    }> = [
      {
        id: 'close_1h',
        nodeType: 'series',
        sourceRef: 'close_1h',
        payload: { kind: 'PRICE', field: 'close', timeframe: '1h' },
      },
      {
        id: 'highest_high_3_1h',
        nodeType: 'series',
        sourceRef: 'highest_high_3_1h',
        payload: { kind: 'HIGHEST_HIGH', timeframe: '1h', params: { period: 3 } },
      },
      {
        id: 'breakout',
        nodeType: 'predicate',
        sourceRef: 'price.rolling_extrema_breakout',
        payload: { kind: 'compare', params: { op: 'GT' } },
        deps: ['close_1h', 'highest_high_3_1h'],
      },
    ]

    const values = evaluateExprPool(
      {
        bars: [
          { open: 100, high: 101, low: 95, close: 100, volume: 1, timestamp: 1 },
          { open: 100, high: 103, low: 96, close: 102, volume: 1, timestamp: 2 },
          { open: 102, high: 104, low: 100, close: 103, volume: 1, timestamp: 3 },
          { open: 103, high: 108, low: 102, close: 106, volume: 1, timestamp: 4 },
        ],
      },
      exprPool,
      ['close_1h', 'highest_high_3_1h', 'breakout'],
    )

    expect(values.highest_high_3_1h).toBe(104)
    expect(values.breakout).toBe(true)
  })
})
