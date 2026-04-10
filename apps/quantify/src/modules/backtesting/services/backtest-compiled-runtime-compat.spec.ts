import { evaluateExprPool } from '@ai/shared/script-engine/compiled-runtime/evaluate-expr-pool'
import { evaluateGuards } from '@ai/shared/script-engine/compiled-runtime/evaluate-guards'
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

  it('evaluates CROSS_OVER correctly for EMA series inputs', () => {
    const values = evaluateExprPool(
      {
        bars: [
          { time: 1, open: 100, high: 101, low: 99, close: 100 },
          { time: 2, open: 100, high: 101, low: 99, close: 100 },
          { time: 3, open: 100, high: 101, low: 99, close: 100 },
          { time: 4, open: 110, high: 111, low: 109, close: 110 },
        ],
      } as any,
      [
        {
          id: 'close_now',
          nodeType: 'series',
          sourceRef: 'close_1h',
          payload: { kind: 'PRICE', field: 'close', timeframe: '1h' },
        },
        {
          id: 'ema_fast',
          nodeType: 'series',
          sourceRef: 'ema_2',
          deps: ['close_now'],
          payload: { kind: 'EMA', inputs: ['close_1h'], params: { period: 2 } },
        },
        {
          id: 'ema_slow',
          nodeType: 'series',
          sourceRef: 'ema_3',
          deps: ['close_now'],
          payload: { kind: 'EMA', inputs: ['close_1h'], params: { period: 3 } },
        },
        {
          id: 'entry_cross',
          nodeType: 'predicate',
          deps: ['ema_fast', 'ema_slow'],
          payload: { kind: 'CROSS_OVER' },
        },
      ] as any,
      ['close_now', 'ema_fast', 'ema_slow', 'entry_cross'],
    )

    expect(values.ema_fast).toBeGreaterThan(values.ema_slow as number)
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

  it('evaluates RSI threshold series as numeric runtime values', () => {
    const bars = Array.from({ length: 20 }, (_unused, index) => {
      const close = 120 - index
      return { time: index + 1, open: close + 1, high: close + 2, low: close - 1, close }
    })

    const values = evaluateExprPool(
      { bars } as any,
      [
        {
          id: 'close_now',
          nodeType: 'series',
          sourceRef: 'close_1h',
          payload: { kind: 'PRICE', field: 'close', timeframe: '1h' },
        },
        {
          id: 'rsi_14',
          nodeType: 'series',
          sourceRef: 'rsi_14_1h',
          deps: ['close_now'],
          payload: { kind: 'RSI', inputs: ['close_1h'], params: { period: 14 } },
        },
        {
          id: 'rsi_threshold',
          nodeType: 'series',
          payload: { kind: 'CONST', value: 30 },
        },
        {
          id: 'entry_rsi',
          nodeType: 'predicate',
          deps: ['rsi_14', 'rsi_threshold'],
          payload: { kind: 'LTE' },
        },
      ] as any,
      ['close_now', 'rsi_14', 'rsi_threshold', 'entry_rsi'],
    )

    expect(typeof values.rsi_14).toBe('number')
    expect(values.entry_rsi).toBe(true)
  })

  it('evaluates MACD line and signal series as numeric runtime values', () => {
    const bars = Array.from({ length: 40 }, (_unused, index) => {
      const close = index < 25 ? 100 : 100 + (index - 24) * 3
      return { time: index + 1, open: close - 1, high: close + 1, low: close - 2, close }
    })

    const values = evaluateExprPool(
      { bars } as any,
      [
        {
          id: 'close_now',
          nodeType: 'series',
          sourceRef: 'close_1h',
          payload: { kind: 'PRICE', field: 'close', timeframe: '1h' },
        },
        {
          id: 'macd_line',
          nodeType: 'series',
          sourceRef: 'macd_line_12_26_9_1h',
          deps: ['close_now'],
          payload: { kind: 'MACD_LINE', inputs: ['close_1h'], params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
        },
        {
          id: 'macd_signal',
          nodeType: 'series',
          sourceRef: 'macd_signal_12_26_9_1h',
          deps: ['close_now'],
          payload: { kind: 'MACD_SIGNAL', inputs: ['close_1h'], params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
        },
      ] as any,
      ['close_now', 'macd_line', 'macd_signal'],
    )

    expect(typeof values.macd_line).toBe('number')
    expect(typeof values.macd_signal).toBe('number')
  })

  it('evaluates position average price and pnl pct series as numeric runtime values', () => {
    const values = evaluateExprPool(
      {
        currentPrice: 95,
        baseTimeframeBar: { close: 95 },
        position: { qty: 2, avgEntryPrice: 100 },
      } as any,
      [
        {
          id: 'position_avg_price',
          nodeType: 'series',
          payload: { kind: 'POSITION_AVG_PRICE' },
        },
        {
          id: 'position_pnl_pct',
          nodeType: 'series',
          payload: { kind: 'POSITION_PNL_PCT' },
        },
      ] as any,
      ['position_avg_price', 'position_pnl_pct'],
    )

    expect(values.position_avg_price).toBe(100)
    expect(values.position_pnl_pct).toBe(-5)
  })

  it('forces exit when TAKE_PROFIT_PCT is breached for a long position', () => {
    const guardState = evaluateGuards(
      {
        currentPrice: 105,
        baseTimeframeBar: { close: 105 },
        position: { qty: 1, avgEntryPrice: 100 },
      } as any,
      [
        {
          id: 'guard_take_profit',
          payload: {
            kind: 'TAKE_PROFIT_PCT',
            scope: 'position',
            value: 5,
            onBreach: 'FORCE_EXIT',
          },
        },
      ] as any,
      {},
      ['guard_take_profit'],
    )

    expect(guardState.forceExit).toBe(true)
    expect(guardState.triggered).toEqual(['guard_take_profit'])
  })

  it('forces exit when STOP_LOSS_PCT is breached for a long position', () => {
    const guardState = evaluateGuards(
      {
        currentPrice: 95,
        baseTimeframeBar: { close: 95 },
        position: { qty: 1, avgEntryPrice: 100 },
      } as any,
      [
        {
          id: 'guard_stop_loss',
          payload: {
            kind: 'STOP_LOSS_PCT',
            scope: 'position',
            value: 5,
            onBreach: 'FORCE_EXIT',
          },
        },
      ] as any,
      {},
      ['guard_stop_loss'],
    )

    expect(guardState.forceExit).toBe(true)
    expect(guardState.triggered).toEqual(['guard_stop_loss'])
  })

  it('forces exit when TRAILING_STOP_PCT is breached with explicit peak context', () => {
    const guardState = evaluateGuards(
      {
        currentPrice: 108,
        baseTimeframeBar: { close: 108 },
        position: {
          qty: 1,
          avgEntryPrice: 100,
          highestPriceSinceEntry: 120,
        },
      } as any,
      [
        {
          id: 'guard_trailing_stop',
          payload: {
            kind: 'TRAILING_STOP_PCT',
            scope: 'position',
            value: 10,
            onBreach: 'FORCE_EXIT',
          },
        },
      ] as any,
      {},
      ['guard_trailing_stop'],
    )

    expect(guardState.forceExit).toBe(true)
    expect(guardState.triggered).toEqual(['guard_trailing_stop'])
  })

  it('does not trigger TRAILING_STOP_PCT without an explicit trailing anchor', () => {
    const guardState = evaluateGuards(
      {
        currentPrice: 108,
        bars: [
          { time: 1, open: 100, high: 100, low: 99, close: 100 },
          { time: 2, open: 100, high: 120, low: 100, close: 120 },
          { time: 3, open: 120, high: 121, low: 107, close: 108 },
        ],
        baseTimeframeBar: { close: 108 },
        position: { qty: 1, avgEntryPrice: 100 },
      } as any,
      [
        {
          id: 'guard_trailing_stop',
          payload: {
            kind: 'TRAILING_STOP_PCT',
            scope: 'position',
            value: 10,
            onBreach: 'FORCE_EXIT',
          },
        },
      ] as any,
      {},
      ['guard_trailing_stop'],
    )

    expect(guardState.forceExit).toBe(false)
    expect(guardState.triggered).toEqual([])
  })

  it('evaluates grid level touch predicates against arithmetic level sets', () => {
    const entryBars = [
      { time: 1, open: 70200, high: 70500, low: 70100, close: 70300 },
      { time: 2, open: 70300, high: 70400, low: 69800, close: 69900 },
    ]
    const exitBars = [
      ...entryBars,
      { time: 3, open: 69900, high: 70800, low: 69850, close: 70750 },
    ]

    const exprPool = [
      {
        id: 'close_now',
        nodeType: 'series',
        sourceRef: 'close_15m',
        payload: { kind: 'PRICE', field: 'close', timeframe: '15m' },
      },
      {
        id: 'const_lower',
        nodeType: 'series',
        payload: { kind: 'CONST', value: 60000 },
      },
      {
        id: 'const_upper',
        nodeType: 'series',
        payload: { kind: 'CONST', value: 80000 },
      },
      {
        id: 'grid_levels',
        nodeType: 'level_set',
        deps: ['const_lower', 'const_lower', 'const_upper'],
        payload: {
          kind: 'ARITHMETIC_LEVEL_SET',
          anchorRef: 'const_lower',
          spacing: { mode: 'pct', value: 1 },
          levelsPerSide: { down: 0, up: 20 },
          hardBounds: { lowerRef: 'const_lower', upperRef: 'const_upper' },
        },
      },
    ] as any

    const entryValues = evaluateExprPool(
      { bars: entryBars } as any,
      [
        ...exprPool,
        {
          id: 'touch_down',
          nodeType: 'predicate',
          deps: ['close_now', 'grid_levels'],
          payload: { kind: 'TOUCH_LEVEL_DOWN' },
        },
      ] as any,
      ['close_now', 'const_lower', 'const_upper', 'grid_levels', 'touch_down'],
    )

    const exitValues = evaluateExprPool(
      { bars: exitBars } as any,
      [
        ...exprPool,
        {
          id: 'touch_up',
          nodeType: 'predicate',
          deps: ['close_now', 'grid_levels'],
          payload: { kind: 'TOUCH_LEVEL_UP' },
        },
      ] as any,
      ['close_now', 'const_lower', 'const_upper', 'grid_levels', 'touch_up'],
    )

    expect(entryValues.touch_down).toBe(true)
    expect(exitValues.touch_up).toBe(true)
  })

  it('evaluates breakout channel-high and channel-low series as numeric runtime values', () => {
    const bars = [
      { time: 1, open: 100, high: 101, low: 99, close: 100 },
      { time: 2, open: 101, high: 103, low: 100, close: 102 },
      { time: 3, open: 102, high: 105, low: 101, close: 104 },
      { time: 4, open: 104, high: 106, low: 98, close: 99 },
    ]

    const values = evaluateExprPool(
      { bars } as any,
      [
        {
          id: 'high_break',
          nodeType: 'series',
          payload: { kind: 'HIGHEST_HIGH', timeframe: '1h', params: { period: 3 } },
        },
        {
          id: 'low_break',
          nodeType: 'series',
          payload: { kind: 'LOWEST_LOW', timeframe: '1h', params: { period: 3 } },
        },
      ] as any,
      ['high_break', 'low_break'],
    )

    expect(values.high_break).toBe(105)
    expect(values.low_break).toBe(99)
  })

  it('evaluates position held bars as numeric runtime values', () => {
    const values = evaluateExprPool(
      {
        position: { qty: 1, barsHeld: 12 },
      } as any,
      [
        {
          id: 'held_bars',
          nodeType: 'series',
          payload: { kind: 'POSITION_BARS_HELD', timeframe: '1h' },
        },
      ] as any,
      ['held_bars'],
    )

    expect(values.held_bars).toBe(12)
  })

  it('forces exit using the active short position side when guards trigger', () => {
    const decision = runDecisionPrograms(
      {
        currentPrice: 100,
        baseTimeframeBar: { close: 100 },
        position: { qty: -2 },
        portfolio: { equity: 10000 },
      } as any,
      [],
      {},
      {
        blockNewEntry: false,
        forceExit: true,
        strategyHalt: false,
        cancelOrderPrograms: false,
        triggered: ['guard-trailing'],
      },
      [],
    )

    expect(decision).toEqual({
      action: 'CLOSE_SHORT',
      reason: 'compiled.force_exit',
    })
  })

  it('skips entry programs while cooldown bars are still in effect', () => {
    const decision = runDecisionPrograms(
      {
        currentPrice: 100,
        baseTimeframeBar: { close: 100 },
        position: { qty: 0 },
        portfolio: { equity: 10000 },
        __compiledDecisionState: {
          barIndex: 6,
          lastTriggeredByProgram: {
            decision_entry: 4,
          },
        },
      } as any,
      [
        {
          id: 'decision_entry',
          phase: 'entry',
          priority: 10,
          when: 'expr_entry',
          cooldownBars: 3,
          actions: [
            {
              kind: 'OPEN_LONG',
              quantity: { mode: 'pct_equity', value: 25 },
            },
          ],
        },
      ],
      { expr_entry: true },
      {
        blockNewEntry: false,
        forceExit: false,
        strategyHalt: false,
        cancelOrderPrograms: false,
        triggered: [],
      },
      ['decision_entry'],
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.noop',
    })
  })
})
