import { evaluateExprPool, invalidateMemoryOperand } from './evaluate-expr-pool'

describe('evaluateExprPool', () => {
  it('evaluates CANDLE_PATTERN series and predicate from runtime bars', () => {
    const exprPool: Array<{
      id: string
      nodeType: 'series' | 'predicate'
      sourceRef: string
      payload: {
        kind: string
        value?: number
        params?: Record<string, number | string>
      }
      deps?: string[]
    }> = [
      {
        id: 'candle_pattern_engulfing_bullish_15m',
        nodeType: 'series',
        sourceRef: 'candle_pattern_engulfing_bullish_15m',
        payload: {
          kind: 'CANDLE_PATTERN',
          params: { pattern: 'engulfing', direction: 'bullish' },
        },
      },
      {
        id: 'const_one',
        nodeType: 'series',
        sourceRef: 'const_one',
        payload: {
          kind: 'CONST',
          value: 1,
        },
      },
      {
        id: 'candle_pattern_eq',
        nodeType: 'predicate',
        sourceRef: 'price.candle_pattern',
        payload: {
          kind: 'EQ',
        },
        deps: ['candle_pattern_engulfing_bullish_15m', 'const_one'],
      },
    ]

    const values = evaluateExprPool(
      {
        bars: [
          { open: 10, high: 10.5, low: 7.5, close: 8, volume: 1, timestamp: 1 },
          { open: 7.8, high: 11, low: 7.5, close: 10.6, volume: 1, timestamp: 2 },
        ],
      },
      exprPool,
      ['candle_pattern_engulfing_bullish_15m', 'const_one', 'candle_pattern_eq'],
    )

    expect(values.candle_pattern_engulfing_bullish_15m).toBe(1)
    expect(values.candle_pattern_eq).toBe(true)
  })

  it('evaluates candle patterns from the required tail window only', () => {
    const values = evaluateExprPool(
      {
        bars: [
          { open: Number.NaN, high: Number.NaN, low: Number.NaN, close: Number.NaN, volume: 1, timestamp: 0 },
          { open: 10, high: 10.5, low: 7.5, close: 8, volume: 1, timestamp: 1 },
          { open: 7.8, high: 11, low: 7.5, close: 10.6, volume: 1, timestamp: 2 },
        ],
      },
      [
        {
          id: 'candle_pattern_engulfing_bullish_15m',
          nodeType: 'series',
          sourceRef: 'candle_pattern_engulfing_bullish_15m',
          payload: {
            kind: 'CANDLE_PATTERN',
            params: { pattern: 'engulfing', direction: 'bullish' },
          },
        },
      ],
      ['candle_pattern_engulfing_bullish_15m'],
    )

    expect(values.candle_pattern_engulfing_bullish_15m).toBe(1)
  })

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

  describe('INDICATOR_DIVERGENCE series', () => {
    function linear(start: number, end: number, count: number): number[] {
      return Array.from({ length: count }, (_item, index) => start + ((end - start) * index) / (count - 1))
    }

    function buildBars(closes: number[]) {
      return closes.map((close, index) => ({
        open: close,
        high: close + 0.2,
        low: close - 0.2,
        close,
        volume: 1,
        timestamp: index + 1,
      }))
    }

    function buildDivergenceExprPool(indicator: 'rsi' | 'macd', direction: 'bullish' | 'bearish', offsetBars?: number) {
      return [
        {
          id: 'indicator_divergence',
          nodeType: 'series' as const,
          sourceRef: 'indicator_divergence',
          payload: {
            kind: 'INDICATOR_DIVERGENCE',
            offsetBars,
            params: {
              indicator,
              direction,
              pivotWindow: indicator === 'rsi' ? 2 : 3,
              confirmationBars: 2,
            },
          },
        },
        {
          id: 'const_one',
          nodeType: 'series' as const,
          sourceRef: 'const_one',
          payload: { kind: 'CONST', value: 1 },
        },
        {
          id: 'divergence_predicate',
          nodeType: 'predicate' as const,
          sourceRef: 'divergence_predicate',
          deps: ['indicator_divergence', 'const_one'],
          payload: { kind: 'EQ' },
        },
      ]
    }

    it.each([
      {
        name: 'RSI bearish',
        indicator: 'rsi' as const,
        direction: 'bearish' as const,
        closes: [
          ...linear(80, 108, 15),
          ...linear(104, 90, 6),
          ...linear(94, 112, 5),
          109,
          107,
        ],
      },
      {
        name: 'RSI bullish',
        indicator: 'rsi' as const,
        direction: 'bullish' as const,
        closes: [
          ...linear(120, 92, 15),
          ...linear(96, 110, 6),
          ...linear(106, 88, 5),
          91,
          93,
        ],
      },
      {
        name: 'MACD bearish',
        indicator: 'macd' as const,
        direction: 'bearish' as const,
        closes: [
          ...linear(80, 119, 40),
          ...linear(115, 95, 15),
          ...linear(99, 123, 15),
          120,
          118,
        ],
      },
      {
        name: 'MACD bullish',
        indicator: 'macd' as const,
        direction: 'bullish' as const,
        closes: [
          ...linear(130, 91, 40),
          ...linear(95, 115, 15),
          ...linear(111, 87, 15),
          90,
          92,
        ],
      },
    ])('evaluates $name divergence as numeric signal consumed by EQ predicate', ({ indicator, direction, closes }) => {
      const values = evaluateExprPool(
        { bars: buildBars(closes) },
        buildDivergenceExprPool(indicator, direction),
        ['indicator_divergence', 'const_one', 'divergence_predicate'],
      )

      expect(values.indicator_divergence).toBe(1)
      expect(values.divergence_predicate).toBe(true)
    })

    it('returns 1 on the confirmationBars boundary and 0 after the window expires', () => {
      const closes = [
        ...linear(80, 108, 15),
        ...linear(104, 90, 6),
        ...linear(94, 112, 5),
        109,
        107,
      ]
      const exprPool = buildDivergenceExprPool('rsi', 'bearish')

      const boundary = evaluateExprPool(
        { bars: buildBars(closes) },
        exprPool,
        ['indicator_divergence'],
      )
      const expired = evaluateExprPool(
        { bars: buildBars([...closes, 106]) },
        exprPool,
        ['indicator_divergence'],
      )

      expect(boundary.indicator_divergence).toBe(1)
      expect(expired.indicator_divergence).toBe(0)
    })

    it('applies offsetBars before evaluating divergence history', () => {
      const closes = [
        ...linear(80, 108, 15),
        ...linear(104, 90, 6),
        ...linear(94, 112, 5),
        109,
        107,
      ]
      const exprPool = buildDivergenceExprPool('rsi', 'bearish', 1)

      const values = evaluateExprPool(
        { bars: buildBars([...closes, 106]) },
        exprPool,
        ['indicator_divergence'],
      )

      expect(values.indicator_divergence).toBe(1)
    })

    it('uses runtime previous offsets when predicates resolve prior divergence values', () => {
      const closes = [
        ...linear(80, 108, 15),
        ...linear(104, 90, 6),
        ...linear(94, 112, 5),
        109,
        107,
      ]
      const exprPool = [
        ...buildDivergenceExprPool('rsi', 'bearish'),
        {
          id: 'const_half',
          nodeType: 'series' as const,
          sourceRef: 'const_half',
          payload: { kind: 'CONST', value: 0.5 },
        },
        {
          id: 'divergence_crossed',
          nodeType: 'predicate' as const,
          sourceRef: 'divergence_crossed',
          deps: ['indicator_divergence', 'const_half'],
          payload: { kind: 'CROSS_OVER' },
        },
      ]

      const values = evaluateExprPool(
        { bars: buildBars(closes) },
        exprPool,
        ['indicator_divergence', 'const_half', 'divergence_crossed'],
      )

      expect(values.indicator_divergence).toBe(1)
      expect(values.divergence_crossed).toBe(true)
    })
  })

  describe('CHART_PATTERN series', () => {
    function buildBars(closes: number[]) {
      return closes.map((close, index) => ({
        open: close,
        high: close,
        low: close,
        close,
        volume: 1,
        timestamp: index + 1,
      }))
    }

    function buildChartPatternExprPool(pattern: string, direction: string) {
      return [
        {
          id: 'chart_pattern',
          nodeType: 'series' as const,
          sourceRef: 'chart_pattern',
          payload: {
            kind: 'CHART_PATTERN',
            params: {
              pattern,
              direction,
              pivotWindow: 1,
              confirmationBars: 1,
            },
          },
        },
        {
          id: 'const_one',
          nodeType: 'series' as const,
          sourceRef: 'const_one',
          payload: { kind: 'CONST', value: 1 },
        },
        {
          id: 'chart_pattern_predicate',
          nodeType: 'predicate' as const,
          sourceRef: 'chart_pattern_predicate',
          deps: ['chart_pattern', 'const_one'],
          payload: { kind: 'EQ' },
        },
      ]
    }

    it('consumes CHART_PATTERN series as a numeric signal in EQ predicates', () => {
      const values = evaluateExprPool(
        { bars: buildBars([100, 112, 104, 124, 103, 111, 98]) },
        buildChartPatternExprPool('head_and_shoulders', 'bearish'),
        ['chart_pattern', 'const_one', 'chart_pattern_predicate'],
      )

      expect(values.chart_pattern).toBe(1)
      expect(values.chart_pattern_predicate).toBe(true)
    })

    it('fails closed for unsupported intrinsic direction combinations', () => {
      const values = evaluateExprPool(
        { bars: buildBars([100, 112, 104, 113, 101]) },
        buildChartPatternExprPool('double_top', 'bullish'),
        ['chart_pattern', 'const_one', 'chart_pattern_predicate'],
      )

      expect(values.chart_pattern).toBe(0)
      expect(values.chart_pattern_predicate).toBe(false)
    })
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

  it('evaluates consecutive candle sequences from the latest matching candle window', () => {
    const exprPool: Array<{
      id: string
      nodeType: 'predicate'
      sourceRef: string
      payload: { kind: string, params?: Record<string, number | string> }
      deps?: string[]
    }> = [
      {
        id: 'consecutive_down',
        nodeType: 'predicate',
        sourceRef: 'condition.sequence',
        payload: {
          kind: 'sequence',
          params: {
            sequenceKind: 'consecutive_candles',
            count: 3,
            direction: 'down',
          },
        },
        deps: [],
      },
    ]

    const values = evaluateExprPool(
      {
        bars: [
          { open: 110, high: 111, low: 104, close: 105, volume: 100, timestamp: 1 },
          { open: 105, high: 106, low: 99, close: 100, volume: 100, timestamp: 2 },
          { open: 100, high: 101, low: 94, close: 95, volume: 110, timestamp: 3 },
          { open: 95, high: 96, low: 89, close: 90, volume: 120, timestamp: 4 },
        ],
      },
      exprPool,
      ['consecutive_down'],
    )

    expect(values.consecutive_down).toBe(true)
  })

  it('evaluates breakout retest sequences from bar history when runtime state is absent', () => {
    const exprPool: Array<{
      id: string
      nodeType: 'predicate'
      sourceRef: string
      payload: { kind: string, params?: Record<string, number | string> }
      deps?: string[]
    }> = [
      {
        id: 'breakout_retest',
        nodeType: 'predicate',
        sourceRef: 'condition.sequence',
        payload: {
          kind: 'sequence',
          params: {
            sequenceKind: 'breakout_retest',
            lookbackBars: 3,
          },
        },
        deps: [],
      },
    ]

    const values = evaluateExprPool(
      {
        bars: [
          { open: 90, high: 100, low: 88, close: 95, volume: 100, timestamp: 1 },
          { open: 95, high: 102, low: 94, close: 99, volume: 100, timestamp: 2 },
          { open: 99, high: 101, low: 96, close: 100, volume: 100, timestamp: 3 },
          { open: 100, high: 108, low: 99, close: 106, volume: 180, timestamp: 4 },
          { open: 106, high: 107, low: 101, close: 103, volume: 140, timestamp: 5 },
          { open: 103, high: 105, low: 101, close: 104, volume: 130, timestamp: 6 },
        ],
      },
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

  it('evaluates LIQUIDITY_SWEEP series as a consumable EQ predicate signal', () => {
    const values = evaluateExprPool(
      {
        bars: [
          { open: 100, high: 101, low: 99, close: 100, volume: 1, timestamp: 1 },
          { open: 100, high: 100.5, low: 98.5, close: 99.5, volume: 1, timestamp: 2 },
        ],
      },
      [
        {
          id: 'liquidity_sweep',
          nodeType: 'series',
          sourceRef: 'liquidity_sweep',
          payload: {
            kind: 'LIQUIDITY_SWEEP',
            timeframe: '15m',
            params: { direction: 'bullish', reference: 'prev_low', reclaimBars: 3 },
          },
        },
        {
          id: 'const_one',
          nodeType: 'series',
          sourceRef: 'const_one',
          payload: { kind: 'CONST', value: 1 },
        },
        {
          id: 'sweep_confirmed',
          nodeType: 'predicate',
          sourceRef: 'sweep_confirmed',
          deps: ['liquidity_sweep', 'const_one'],
          payload: { kind: 'EQ' },
        },
      ],
      ['liquidity_sweep', 'const_one', 'sweep_confirmed'],
    )

    expect(values.liquidity_sweep).toBe(1)
    expect(values.sweep_confirmed).toBe(true)
  })

  it('fails LIQUIDITY_SWEEP closed when the current runtime bar is invalid', () => {
    const values = evaluateExprPool(
      {
        bars: [
          { open: 100, high: 101, low: 99, close: 100, volume: 1, timestamp: 1 },
          { open: 100, high: 100.5, low: 98.5, close: 99.5, volume: 1, timestamp: 2 },
          { open: 99.5, high: Number.NaN, low: 99, close: 99.2, volume: 1, timestamp: 3 },
        ],
      },
      [
        {
          id: 'liquidity_sweep',
          nodeType: 'series',
          sourceRef: 'liquidity_sweep',
          payload: {
            kind: 'LIQUIDITY_SWEEP',
            timeframe: '15m',
            params: { direction: 'bullish', reference: 'prev_low', reclaimBars: 3 },
          },
        },
      ],
      ['liquidity_sweep'],
    )

    expect(values.liquidity_sweep).toBe(0)
  })

  describe('MEMORY operand', () => {
    function buildMemoryNode(id: string, memoryKey: string, path?: string[]) {
      return {
        id,
        nodeType: 'series' as const,
        sourceRef: id,
        payload: { kind: 'MEMORY', memoryKey, path },
      }
    }

    it('returns null when memoryKey missing in semanticRuntimeState', () => {
      const node = buildMemoryNode('mem_missing', 'absent_key')
      const values = evaluateExprPool(
        { bars: [], semanticRuntimeState: {} },
        [node],
        ['mem_missing'],
      )
      expect(values.mem_missing).toBeNull()
    })

    it('reads primitive leaf via single-segment path', () => {
      const node = buildMemoryNode('mem_simple', 'phase_state', ['count'])
      const values = evaluateExprPool(
        { bars: [], semanticRuntimeState: { phase_state: { count: 3 } } },
        [node],
        ['mem_simple'],
      )
      expect(values.mem_simple).toBe(3)
    })

    it('walks nested object path to leaf primitive', () => {
      const node = buildMemoryNode('mem_nested', 'breakout', ['confirmation', 'tier1', 'fired'])
      const values = evaluateExprPool(
        {
          bars: [],
          semanticRuntimeState: {
            breakout: { confirmation: { tier1: { fired: true } } },
          },
        },
        [node],
        ['mem_nested'],
      )
      expect(values.mem_nested).toBe(true)
    })

    it('returns null when path breaks at intermediate undefined segment', () => {
      const node = buildMemoryNode('mem_broken', 'breakout', ['confirmation', 'missing', 'fired'])
      const values = evaluateExprPool(
        {
          bars: [],
          semanticRuntimeState: { breakout: { confirmation: {} } },
        },
        [node],
        ['mem_broken'],
      )
      expect(values.mem_broken).toBeNull()
    })

    it('returns null after invalidateMemoryOperand clears the slot', () => {
      const ctx: { bars: never[], semanticRuntimeState: Record<string, Record<string, unknown>> } = {
        bars: [],
        semanticRuntimeState: { breakout: { fired: true } },
      }
      const node = buildMemoryNode('mem_after_inv', 'breakout', ['fired'])

      const before = evaluateExprPool(ctx, [node], ['mem_after_inv'])
      expect(before.mem_after_inv).toBe(true)

      invalidateMemoryOperand(ctx, 'breakout')

      const after = evaluateExprPool(ctx, [node], ['mem_after_inv'])
      expect(after.mem_after_inv).toBeNull()
      expect(Object.prototype.hasOwnProperty.call(ctx.semanticRuntimeState, 'breakout')).toBe(false)
    })

    it('invalidate does not affect other memoryKeys', () => {
      const ctx: { bars: never[], semanticRuntimeState: Record<string, Record<string, unknown>> } = {
        bars: [],
        semanticRuntimeState: {
          alpha: { score: 1 },
          beta: { score: 2 },
        },
      }

      invalidateMemoryOperand(ctx, 'alpha')

      const node = buildMemoryNode('mem_beta', 'beta', ['score'])
      const values = evaluateExprPool(ctx, [node], ['mem_beta'])
      expect(values.mem_beta).toBe(2)
      expect(Object.prototype.hasOwnProperty.call(ctx.semanticRuntimeState, 'alpha')).toBe(false)
      expect(Object.prototype.hasOwnProperty.call(ctx.semanticRuntimeState, 'beta')).toBe(true)
    })
  })

  describe('IN_TIME_WINDOW series', () => {
    // 2024-01-15T14:30:00Z = Monday
    //   UTC          → Mon 14:30
    //   Asia/Tokyo   → Tue 23:30  (UTC+9)
    //   America/New_York → Mon 09:30 (UTC-5, January = EST)
    const MON_1430_UTC = new Date('2024-01-15T14:30:00Z').getTime()

    function buildNode(timezone: string, windows: Array<{ daysOfWeek?: number[]; start: string; end: string }>) {
      return {
        id: 'in_time_window_node',
        nodeType: 'series' as const,
        sourceRef: 'in_time_window_node',
        payload: { kind: 'IN_TIME_WINDOW', timezone, windows },
      }
    }

    it('returns true when timestamp is inside a UTC window', () => {
      const values = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('UTC', [{ start: '14:00', end: '15:00' }])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(true)
    })

    it('returns false when timestamp is outside the UTC window', () => {
      const values = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('UTC', [{ start: '10:00', end: '12:00' }])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(false)
    })

    it('uses timezone conversion — Asia/Tokyo shifts Mon 14:30 UTC to Tue 23:30', () => {
      // In Tokyo, 14:30 UTC = 23:30 local (Tuesday)
      // 24:00 is not valid HH:MM → parseHHMM returns null → window skipped → false
      const values = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('Asia/Tokyo', [{ start: '23:00', end: '24:00' }])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(false)

      // 23:59 is valid — Tokyo 23:30 falls inside [23:00, 23:59)
      const values2 = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('Asia/Tokyo', [{ start: '23:00', end: '23:59' }])],
        ['in_time_window_node'],
      )
      expect(values2.in_time_window_node).toBe(true)
    })

    it('uses timezone conversion — America/New_York shifts Mon 14:30 UTC to Mon 09:30', () => {
      const values = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('America/New_York', [{ start: '09:00', end: '10:00' }])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(true)
    })

    it('respects daysOfWeek — allows matching day', () => {
      // Monday = 1; timestamp is Monday UTC → Monday New_York (09:30)
      const values = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('America/New_York', [{ daysOfWeek: [1], start: '09:00', end: '10:00' }])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(true)
    })

    it('daysOfWeek: [] (empty array) skips the window — vacuous-truth quirk locked in', () => {
      // [].every(...) is vacuously true so the range check passes, but
      // [].includes(localDayOfWeek) is always false → continue → window never matches.
      // This is distinct from "daysOfWeek omitted" (which allows all days).
      const values = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('America/New_York', [{ daysOfWeek: [], start: '09:00', end: '10:00' }])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(false)
    })

    it('respects daysOfWeek — rejects non-matching day', () => {
      // Wednesday = 3; timestamp is Monday → rejected
      const values = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('America/New_York', [{ daysOfWeek: [3, 4, 5], start: '09:00', end: '10:00' }])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(false)
    })

    it('handles overnight window (end < start) — inside', () => {
      // 22:00–02:00 window; timestamp UTC 14:30 falls outside overnight window
      // But 23:30 Tokyo time falls inside 22:00–24:00 → use 22:00–02:00
      const tokyoTs = MON_1430_UTC // 23:30 Tokyo
      const values = evaluateExprPool(
        { timestamp: tokyoTs, bars: [] },
        [buildNode('Asia/Tokyo', [{ start: '22:00', end: '02:00' }])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(true)
    })

    it('handles overnight window (end < start) — outside the gap', () => {
      // 22:00–02:00 overnight; 09:30 NY (Monday) falls outside
      const values = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('America/New_York', [{ start: '22:00', end: '02:00' }])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(false)
    })

    it('falls back to last bar timestamp when ctx.timestamp is absent', () => {
      const values = evaluateExprPool(
        {
          bars: [
            { open: 1, high: 1, low: 1, close: 1, volume: 1, timestamp: MON_1430_UTC },
          ],
        },
        [buildNode('UTC', [{ start: '14:00', end: '15:00' }])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(true)
    })

    it('returns false when no timestamp is available', () => {
      const values = evaluateExprPool(
        { bars: [] },
        [buildNode('UTC', [{ start: '00:00', end: '23:59' }])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(false)
    })

    it('returns false when windows array is empty', () => {
      const values = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('UTC', [])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(false)
    })

    it('returns false when window has invalid start/end', () => {
      const values = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('UTC', [{ start: 'not-a-time', end: 'also-bad' }])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(false)
    })

    it('returns false when timezone is invalid', () => {
      const values = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('Not/A/Timezone', [{ start: '00:00', end: '23:59' }])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(false)
    })

    it('returns true for the first matching window among multiple', () => {
      const values = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('UTC', [
          { start: '10:00', end: '11:00' }, // not matching
          { start: '14:00', end: '15:00' }, // matches
          { start: '16:00', end: '17:00' }, // not matching
        ])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(true)
    })

    it('window end is exclusive — exactly at end time returns false', () => {
      // 14:30 is not inside [13:00, 14:30) since end is exclusive
      const values = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('UTC', [{ start: '13:00', end: '14:30' }])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(false)
    })

    it('uses timezone conversion — Asia/Shanghai (UTC+8, no DST) shifts Mon 14:30 UTC to Mon 22:30', () => {
      // Asia/Shanghai is UTC+8 year-round (no DST), distinct from Asia/Tokyo (UTC+9).
      const values = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('Asia/Shanghai', [{ start: '22:00', end: '23:00' }])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(true)

      // Outside the Shanghai window
      const outside = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('Asia/Shanghai', [{ start: '09:00', end: '10:00' }])],
        ['in_time_window_node'],
      )
      expect(outside.in_time_window_node).toBe(false)
    })

    it('handles DST: America/New_York summer (EDT, UTC-4) vs winter (EST, UTC-5) on same UTC clock-time', () => {
      // Both timestamps are Mon 14:30 UTC. EDT pushes local to 10:30, EST to 09:30.
      // The 09:30-10:00 window should match winter but NOT summer.
      const SUMMER_MON_1430_UTC = new Date('2024-07-15T14:30:00Z').getTime() // Mon, EDT
      const WINTER_MON_1430_UTC = MON_1430_UTC                                // Mon, EST

      const summer = evaluateExprPool(
        { timestamp: SUMMER_MON_1430_UTC, bars: [] },
        [buildNode('America/New_York', [{ start: '09:00', end: '10:00' }])],
        ['in_time_window_node'],
      )
      expect(summer.in_time_window_node).toBe(false)

      const winter = evaluateExprPool(
        { timestamp: WINTER_MON_1430_UTC, bars: [] },
        [buildNode('America/New_York', [{ start: '09:00', end: '10:00' }])],
        ['in_time_window_node'],
      )
      expect(winter.in_time_window_node).toBe(true)

      // Symmetrically, the 10:00-11:00 window matches only summer
      const summerTen = evaluateExprPool(
        { timestamp: SUMMER_MON_1430_UTC, bars: [] },
        [buildNode('America/New_York', [{ start: '10:00', end: '11:00' }])],
        ['in_time_window_node'],
      )
      expect(summerTen.in_time_window_node).toBe(true)
    })

    it('handles DST spring-forward boundary — local 02:30 does not exist, falls in skipped hour', () => {
      // 2024-03-10 02:00 EST → 03:00 EDT; local 02:00-03:00 is skipped that day.
      // A UTC timestamp landing in that gap should map to 03:xx EDT not throw.
      // 2024-03-10T07:30:00Z = either 02:30 EST (didn't happen) or 03:30 EDT (real).
      // ICU consistently resolves to EDT (03:30).
      const SPRING_FORWARD_UTC = new Date('2024-03-10T07:30:00Z').getTime()

      // Forward assertion: 03:00-04:00 EDT window matches (real local time)
      const matched = evaluateExprPool(
        { timestamp: SPRING_FORWARD_UTC, bars: [] },
        [buildNode('America/New_York', [{ start: '03:00', end: '04:00' }])],
        ['in_time_window_node'],
      )
      expect(matched.in_time_window_node).toBe(true)

      // Reverse assertion: 02:00-03:00 "vanished" window does NOT match —
      // proves ICU resolves to EDT (post-jump) not EST (pre-jump phantom)
      const skipped = evaluateExprPool(
        { timestamp: SPRING_FORWARD_UTC, bars: [] },
        [buildNode('America/New_York', [{ start: '02:00', end: '03:00' }])],
        ['in_time_window_node'],
      )
      expect(skipped.in_time_window_node).toBe(false)
    })

    it('falls back to last bar timestamp when ctx.timestamp is NaN (not just absent)', () => {
      // !Number.isFinite(NaN) === true so we must fall through to bar fallback,
      // not return false outright. Previously this path was uncovered by tests.
      const values = evaluateExprPool(
        {
          timestamp: Number.NaN,
          bars: [
            { open: 1, high: 1, low: 1, close: 1, volume: 1, timestamp: MON_1430_UTC },
          ],
        },
        [buildNode('UTC', [{ start: '14:00', end: '15:00' }])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(true)
    })

    it('handles bar.timestamp = 0 (1970-01-01 epoch) without rejecting as falsy', () => {
      // Number.isFinite(0) === true → 0 is a legal timestamp (UTC 00:00 Thu 1970-01-01).
      // Make sure the `?? null` fallback chain doesn't short-circuit on the falsy zero.
      const values = evaluateExprPool(
        {
          bars: [
            { open: 1, high: 1, low: 1, close: 1, volume: 1, timestamp: 0 },
          ],
        },
        [buildNode('UTC', [{ start: '00:00', end: '00:01' }])],
        ['in_time_window_node'],
      )
      expect(values.in_time_window_node).toBe(true)
    })

    it('handles overnight window ending at 00:00 (= midnight = end of day)', () => {
      // {start:'22:00', end:'00:00'} means 22:00 through end of day (24h boundary as exclusive).
      // end < start (0 < 1320), overnight branch: localMinutes >= 1320 || localMinutes < 0.
      // Second sub-range is unreachable (minutes never < 0), effectively becomes "after 22:00".

      // Tokyo 23:30 → inside 22:00–00:00 window
      const insideTokyo = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('Asia/Tokyo', [{ start: '22:00', end: '00:00' }])],
        ['in_time_window_node'],
      )
      expect(insideTokyo.in_time_window_node).toBe(true)

      // UTC 14:30 → outside 22:00–00:00 window (not in the 22:00-24:00 stretch)
      const outsideUtc = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('UTC', [{ start: '22:00', end: '00:00' }])],
        ['in_time_window_node'],
      )
      expect(outsideUtc.in_time_window_node).toBe(false)
    })

    it('returns false for zero-duration window (end === start)', () => {
      // Both 14:30 (matching local time) and 09:00 (non-matching) start===end → never match.
      // Previously this collapsed to `localMinutes >= 14:30 || localMinutes < 14:30` which
      // was tautologically true (all-day match) — that's the M1 chasing-tail trap fixed here.
      const matching = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('UTC', [{ start: '14:30', end: '14:30' }])],
        ['in_time_window_node'],
      )
      expect(matching.in_time_window_node).toBe(false)

      const nonMatching = evaluateExprPool(
        { timestamp: MON_1430_UTC, bars: [] },
        [buildNode('UTC', [{ start: '09:00', end: '09:00' }])],
        ['in_time_window_node'],
      )
      expect(nonMatching.in_time_window_node).toBe(false)
    })
  })
})
