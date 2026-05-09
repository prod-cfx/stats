import type { StrategyDecisionV1 } from '@ai/shared'
import type { CompiledOrchestrationProgram } from '@ai/shared/script-engine/compiled-runtime/compiled-orchestration-program'
import type { ProgramLifecycleState } from '@ai/shared/script-engine/compiled-runtime/program-lifecycle-state'
import { evaluateExprPool } from '@ai/shared/script-engine/compiled-runtime/evaluate-expr-pool'
import { evaluateGuards } from '@ai/shared/script-engine/compiled-runtime/evaluate-guards'
import { evaluateOrchestrationGates } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'
import { evaluateOrchestrationPortfolioRisks } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks'
import { runDecisionPrograms } from '@ai/shared/script-engine/compiled-runtime/run-decision-programs'
import { runOrderPrograms } from '@ai/shared/script-engine/compiled-runtime/run-order-programs'
import { buildStrategyContext } from '@ai/shared/script-engine/helpers/context-builder'
import { validateStrategyDecision } from '@/modules/strategy-runtime/strategy-protocol.util'

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

  it('evaluates PRICE_CHANGE_PCT as relative change so entry programs are not shadowed by always-true exits', () => {
    const ctx = {
      bars: [
        { time: 1, open: 100, high: 101, low: 99, close: 100 },
        { time: 2, open: 100, high: 100, low: 98, close: 98.5 },
      ],
      currentPrice: 98.5,
      baseTimeframeBar: { close: 98.5 },
      position: { qty: 0 },
      portfolio: { equity: 1000 },
      __compiledDecisionState: { barIndex: 2, lastTriggeredByProgram: {} },
    } as any

    const exprPool = [
      {
        id: 'close_now',
        nodeType: 'series',
        sourceRef: 'close_3m',
        payload: { kind: 'PRICE', field: 'close', timeframe: '3m' },
      },
      {
        id: 'close_prev',
        nodeType: 'series',
        sourceRef: 'close_3m_1',
        payload: { kind: 'PRICE', field: 'close', timeframe: '3m', offsetBars: 1 },
      },
      {
        id: 'const_entry',
        nodeType: 'series',
        payload: { kind: 'CONST', value: -0.01 },
      },
      {
        id: 'const_exit',
        nodeType: 'series',
        payload: { kind: 'CONST', value: 0.02 },
      },
      {
        id: 'price_change_pct',
        nodeType: 'series',
        deps: ['close_now', 'close_prev'],
        payload: {
          kind: 'PRICE_CHANGE_PCT',
          timeframe: '3m',
          inputs: ['close_3m', 'close_3m_1'],
          params: { lookbackBars: 1 },
        },
      },
      {
        id: 'entry_hit',
        nodeType: 'predicate',
        deps: ['price_change_pct', 'const_entry'],
        payload: { kind: 'LTE' },
      },
      {
        id: 'exit_hit',
        nodeType: 'predicate',
        deps: ['price_change_pct', 'const_exit'],
        payload: { kind: 'GTE' },
      },
    ] as any

    const values = evaluateExprPool(
      ctx,
      exprPool,
      ['close_now', 'close_prev', 'const_entry', 'const_exit', 'price_change_pct', 'entry_hit', 'exit_hit'],
    )

    expect(values.price_change_pct).toBeCloseTo(-0.015)
    expect(values.entry_hit).toBe(true)
    expect(values.exit_hit).toBe(false)

    const decision = runDecisionPrograms(
      ctx,
      [
        {
          id: 'decision_exit',
          phase: 'exit',
          priority: 100,
          when: 'exit_hit',
          actions: [{ kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } }],
        },
        {
          id: 'decision_entry',
          phase: 'entry',
          priority: 200,
          when: 'entry_hit',
          actions: [{ kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 10 } }],
        },
      ] as any,
      values,
      {
        blockNewEntry: false,
        forceExit: false,
        strategyHalt: false,
        cancelOrderPrograms: false,
        triggered: [],
      },
      ['decision_exit', 'decision_entry'],
    )

    expect(decision).toEqual({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.1 },
      reason: 'compiled.decision_entry',
    })
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

  it('evaluates state-gate equality predicates from explicit execution context fields', () => {
    const values = evaluateExprPool(
      {
        marketRegime: 'range',
      } as any,
      [
        {
          id: 'market_regime',
          nodeType: 'series',
          payload: { kind: 'MARKET_REGIME' },
        },
        {
          id: 'regime_range',
          nodeType: 'series',
          payload: { kind: 'CONST', value: 'range' },
        },
        {
          id: 'entry_gate',
          nodeType: 'predicate',
          deps: ['market_regime', 'regime_range'],
          payload: { kind: 'EQ' },
        },
      ] as any,
      ['market_regime', 'regime_range', 'entry_gate'],
    )

    expect(values.market_regime).toBe('range')
    expect(values.entry_gate).toBe(true)
  })

  it('derives state-gate execution context fields from bars when explicit values are absent', () => {
    const ctx = buildStrategyContext({
      bars: [
        { time: 1, open: 100, high: 102, low: 99, close: 100, volume: 1_000 },
        { time: 2, open: 100, high: 101, low: 99, close: 100.5, volume: 1_000 },
        { time: 3, open: 100.5, high: 101, low: 100, close: 100.2, volume: 1_000 },
        { time: 4, open: 100.2, high: 101, low: 100, close: 100.6, volume: 1_000 },
        { time: 5, open: 100.6, high: 101, low: 100, close: 100.4, volume: 1_000 },
        { time: 6, open: 100.4, high: 101, low: 100, close: 100.5, volume: 1_000 },
        { time: 7, open: 100.5, high: 101, low: 100, close: 100.3, volume: 1_000 },
        { time: 8, open: 100.3, high: 101, low: 100, close: 100.4, volume: 1_000 },
        { time: 9, open: 100.4, high: 101, low: 100, close: 100.6, volume: 1_000 },
        { time: 10, open: 100.6, high: 101, low: 100, close: 100.5, volume: 1_000 },
        { time: 11, open: 100.5, high: 101, low: 100, close: 100.4, volume: 1_000 },
        { time: 12, open: 100.4, high: 101, low: 100, close: 100.5, volume: 1_000 },
        { time: 13, open: 100.5, high: 101, low: 100, close: 100.6, volume: 1_000 },
        { time: 14, open: 100.6, high: 101, low: 100, close: 100.5, volume: 1_000 },
        { time: 15, open: 100.5, high: 101, low: 100, close: 100.4, volume: 1_000 },
        { time: 16, open: 100.4, high: 101, low: 100, close: 100.5, volume: 1_000 },
        { time: 17, open: 100.5, high: 101, low: 100, close: 100.4, volume: 1_000 },
        { time: 18, open: 100.4, high: 101, low: 100, close: 100.5, volume: 1_000 },
        { time: 19, open: 100.5, high: 101, low: 100, close: 100.4, volume: 1_000 },
        { time: 20, open: 100.4, high: 101, low: 100, close: 100.5, volume: 1_000 },
      ] as any,
      symbol: 'BTCUSDT',
      timeframe: '1h',
      indicators: {},
      currentPrice: 100.5,
    }) as any

    expect(ctx.marketRegime).toBe('range')
    expect(ctx.trendDirection).toBe('sideways')
    expect(typeof ctx.volatilityState).toBe('string')
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

  it('does not trigger side-specific risk guards for the opposite position side', () => {
    const stopLossState = evaluateGuards(
      {
        currentPrice: 105,
        baseTimeframeBar: { close: 105 },
        position: { qty: -1, avgEntryPrice: 100 },
      } as any,
      [
        {
          id: 'guard_long_stop_loss',
          payload: {
            kind: 'STOP_LOSS_PCT',
            scope: 'position',
            appliesTo: 'long',
            value: 5,
            onBreach: 'FORCE_EXIT',
          },
        },
      ] as any,
      {},
      ['guard_long_stop_loss'],
    )

    expect(stopLossState.forceExit).toBe(false)
    expect(stopLossState.triggered).toEqual([])

    const takeProfitState = evaluateGuards(
      {
        currentPrice: 105,
        baseTimeframeBar: { close: 105 },
        position: { qty: 1, avgEntryPrice: 100 },
      } as any,
      [
        {
          id: 'guard_short_take_profit',
          payload: {
            kind: 'TAKE_PROFIT_PCT',
            scope: 'position',
            appliesTo: 'short',
            value: 5,
            onBreach: 'FORCE_EXIT',
          },
        },
      ] as any,
      {},
      ['guard_short_take_profit'],
    )

    expect(takeProfitState.forceExit).toBe(false)
    expect(takeProfitState.triggered).toEqual([])
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

  it('does not trigger side-specific trailing stops for the opposite position side', () => {
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
          id: 'guard_short_trailing_stop',
          payload: {
            kind: 'TRAILING_STOP_PCT',
            scope: 'position',
            appliesTo: 'short',
            value: 10,
            onBreach: 'FORCE_EXIT',
          },
        },
      ] as any,
      {},
      ['guard_short_trailing_stop'],
    )

    expect(guardState.forceExit).toBe(false)
    expect(guardState.triggered).toEqual([])
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
      size: { mode: 'QTY', value: 2 },
      reason: 'compiled.force_exit',
    })
    expect(validateStrategyDecision(decision)).toMatchObject({ valid: true })
  })

  it('forces exit using the active long position side when guards trigger', () => {
    const decision = runDecisionPrograms(
      {
        currentPrice: 100,
        baseTimeframeBar: { close: 100 },
        position: { qty: 3 },
        portfolio: { equity: 10000 },
      } as any,
      [],
      {},
      {
        blockNewEntry: false,
        forceExit: true,
        strategyHalt: false,
        cancelOrderPrograms: false,
        triggered: ['guard-stop-loss'],
      },
      [],
    )

    expect(decision).toEqual({
      action: 'CLOSE_LONG',
      size: { mode: 'QTY', value: 3 },
      reason: 'compiled.force_exit',
    })
    expect(validateStrategyDecision(decision)).toMatchObject({ valid: true })
  })

  it('keeps force exit above strategy halt when both guards trigger', () => {
    const decision = runDecisionPrograms(
      {
        currentPrice: 100,
        baseTimeframeBar: { close: 100 },
        position: { qty: 1 },
        portfolio: { equity: 10000 },
      } as any,
      [],
      {},
      {
        blockNewEntry: false,
        forceExit: true,
        strategyHalt: true,
        cancelOrderPrograms: false,
        triggered: ['guard-stop-loss', 'guard-daily-loss'],
      },
      [],
    )

    expect(decision).toEqual({
      action: 'CLOSE_LONG',
      size: { mode: 'QTY', value: 1 },
      reason: 'compiled.force_exit',
    })
    expect(validateStrategyDecision(decision)).toMatchObject({ valid: true })
  })

  it('does not emit a close decision when force exit triggers without an active position', () => {
    const decision = runDecisionPrograms(
      {
        currentPrice: 100,
        baseTimeframeBar: { close: 100 },
        position: { qty: 0 },
        portfolio: { equity: 10000 },
      } as any,
      [],
      {},
      {
        blockNewEntry: false,
        forceExit: true,
        strategyHalt: false,
        cancelOrderPrograms: false,
        triggered: ['guard-stop-loss'],
      },
      [],
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.force_exit.noop',
    })
    expect(validateStrategyDecision(decision)).toMatchObject({ valid: true })
  })

  it('selects the applicable reduce action for the active position side', () => {
    const decision = runDecisionPrograms(
      {
        currentPrice: 100,
        baseTimeframeBar: { close: 100 },
        position: { qty: -2 },
        portfolio: { equity: 10000 },
      } as any,
      [
        {
          id: 'decision_reduce',
          phase: 'rebalance',
          priority: 10,
          when: 'expr_reduce',
          actions: [
            {
              kind: 'REDUCE_LONG',
              quantity: { mode: 'position_pct', value: 50 },
            },
            {
              kind: 'REDUCE_SHORT',
              quantity: { mode: 'position_pct', value: 50 },
            },
          ],
        },
      ],
      { expr_reduce: true },
      {
        blockNewEntry: false,
        forceExit: false,
        strategyHalt: false,
        cancelOrderPrograms: false,
        triggered: [],
      },
      ['decision_reduce'],
    )

    expect(decision).toEqual({
      action: 'ADJUST_POSITION',
      adjustMode: 'DELTA',
      size: { mode: 'QTY', value: 1 },
      reason: 'compiled.decision_reduce',
    })
    expect(validateStrategyDecision(decision)).toMatchObject({ valid: true })
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

  it('opens long when regime orchestration gate is true (close > EMA50)', () => {
    const bars = Array.from({ length: 60 }, (_unused, index) => {
      const close = 100 + index
      return { time: index + 1, open: close - 1, high: close + 1, low: close - 2, close }
    })
    const ctx = {
      bars,
      currentPrice: bars[bars.length - 1].close,
      baseTimeframeBar: { close: bars[bars.length - 1].close },
      position: { qty: 0 },
      portfolio: { equity: 10000 },
    } as any

    const regimeValues = evaluateExprPool(
      ctx,
      [
        {
          id: 'close_now',
          nodeType: 'series',
          sourceRef: 'close_1h',
          payload: { kind: 'PRICE', field: 'close', timeframe: '1h' },
        },
        {
          id: 'ema_50',
          nodeType: 'series',
          sourceRef: 'ema_50_1h',
          deps: ['close_now'],
          payload: { kind: 'EMA', inputs: ['close_1h'], params: { period: 50 } },
        },
        {
          id: 'gate_entry_regime',
          nodeType: 'predicate',
          deps: ['close_now', 'ema_50'],
          payload: { kind: 'GT' },
        },
      ] as any,
      ['close_now', 'ema_50', 'gate_entry_regime'],
    )

    expect(regimeValues.gate_entry_regime).toBe(true)

    const exprValues = { ...regimeValues, entry_hit: true }

    const gateState = evaluateOrchestrationGates(
      [
        {
          id: 'gate_entry_regime',
          exprId: 'gate_entry_regime',
          target: { phase: 'entry', sideScope: 'both' },
          effectWhenFalse: 'block_new_entries',
        },
      ],
      exprValues,
    )
    expect(gateState).toEqual({ blockEntryLong: false, blockEntryShort: false })

    const decision = runDecisionPrograms(
      ctx,
      [
        {
          id: 'decision_entry',
          phase: 'entry',
          priority: 100,
          when: 'entry_hit',
          actions: [{ kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 10 } }],
        },
      ] as any,
      exprValues,
      {
        blockNewEntry: false,
        forceExit: false,
        strategyHalt: false,
        cancelOrderPrograms: false,
        triggered: [],
      },
      ['decision_entry'],
      gateState,
    )

    expect(decision).toEqual({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.1 },
      reason: 'compiled.decision_entry',
    })
  })

  it('blocks long entry with NOOP when regime orchestration gate is false (close <= EMA50)', () => {
    const bars = Array.from({ length: 60 }, (_unused, index) => {
      const close = 200 - index
      return { time: index + 1, open: close - 1, high: close + 1, low: close - 2, close }
    })
    const ctx = {
      bars,
      currentPrice: bars[bars.length - 1].close,
      baseTimeframeBar: { close: bars[bars.length - 1].close },
      position: { qty: 0 },
      portfolio: { equity: 10000 },
    } as any

    const regimeValues = evaluateExprPool(
      ctx,
      [
        {
          id: 'close_now',
          nodeType: 'series',
          sourceRef: 'close_1h',
          payload: { kind: 'PRICE', field: 'close', timeframe: '1h' },
        },
        {
          id: 'ema_50',
          nodeType: 'series',
          sourceRef: 'ema_50_1h',
          deps: ['close_now'],
          payload: { kind: 'EMA', inputs: ['close_1h'], params: { period: 50 } },
        },
        {
          id: 'gate_entry_regime',
          nodeType: 'predicate',
          deps: ['close_now', 'ema_50'],
          payload: { kind: 'GT' },
        },
      ] as any,
      ['close_now', 'ema_50', 'gate_entry_regime'],
    )

    expect(regimeValues.gate_entry_regime).toBe(false)

    const exprValues = { ...regimeValues, entry_hit: true }

    const gateState = evaluateOrchestrationGates(
      [
        {
          id: 'gate_entry_regime',
          exprId: 'gate_entry_regime',
          target: { phase: 'entry', sideScope: 'long' },
          effectWhenFalse: 'block_new_entries',
        },
      ],
      exprValues,
    )
    expect(gateState).toEqual({ blockEntryLong: true, blockEntryShort: false })

    const decision = runDecisionPrograms(
      ctx,
      [
        {
          id: 'decision_entry',
          phase: 'entry',
          priority: 100,
          when: 'entry_hit',
          actions: [{ kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 10 } }],
        },
      ] as any,
      exprValues,
      {
        blockNewEntry: false,
        forceExit: false,
        strategyHalt: false,
        cancelOrderPrograms: false,
        triggered: [],
      },
      ['decision_entry'],
      gateState,
    )

    expect(decision).toEqual({
      action: 'NOOP',
      reason: 'compiled.orchestration.gate.block_entry_long',
    })
  })

  it('still emits CLOSE_SHORT when entry orchestration gate is false but program closes existing short position', () => {
    const ctx = {
      currentPrice: 100,
      baseTimeframeBar: { close: 100 },
      position: { qty: -2 },
      portfolio: { equity: 10000 },
    } as any

    const exprValues = { exit_short_hit: true, gate_entry_regime: false }

    const gateState = evaluateOrchestrationGates(
      [
        {
          id: 'gate_entry_regime',
          exprId: 'gate_entry_regime',
          target: { phase: 'entry', sideScope: 'both' },
          effectWhenFalse: 'block_new_entries',
        },
      ],
      exprValues,
    )
    expect(gateState).toEqual({ blockEntryLong: true, blockEntryShort: true })

    const decision = runDecisionPrograms(
      ctx,
      [
        {
          id: 'decision_exit_short',
          phase: 'exit',
          priority: 100,
          when: 'exit_short_hit',
          actions: [{ kind: 'CLOSE_SHORT', quantity: { mode: 'position_pct', value: 100 } }],
        },
      ] as any,
      exprValues,
      {
        blockNewEntry: false,
        forceExit: false,
        strategyHalt: false,
        cancelOrderPrograms: false,
        triggered: [],
      },
      ['decision_exit_short'],
      gateState,
    )

    expect(decision).toEqual({
      action: 'CLOSE_SHORT',
      size: { mode: 'RATIO', value: 1 },
      reason: 'compiled.decision_exit_short',
    })
  })

  describe('orchestration portfolio risk integration (backtest)', () => {
    const baseCtx = () => ({
      currentPrice: 100,
      baseTimeframeBar: { close: 100 },
      position: { qty: 0 },
      portfolio: { equity: 10000 },
    } as any)

    const entryProgram = [{
      id: 'decision_entry',
      phase: 'entry',
      priority: 100,
      when: 'entry_hit',
      actions: [{ kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 10 } }],
    }] as any

    const guardState = {
      blockNewEntry: false,
      forceExit: false,
      strategyHalt: false,
      cancelOrderPrograms: false,
      triggered: [],
    }

    it('drawdown 5% < threshold 10% (enforce) → OPEN_LONG flows', () => {
      const portfolioRiskState = evaluateOrchestrationPortfolioRisks(
        [{ id: 'risk-dd', scope: 'portfolio', mode: 'enforce', thresholdPct: 10, effectWhenTriggered: 'block_new_entries' }],
        { drawdownPct: 5 },
      )
      expect(portfolioRiskState).toEqual({ blockEntryLong: false, blockEntryShort: false, observedBreaches: [] })

      const decision = runDecisionPrograms(
        baseCtx(),
        entryProgram,
        { entry_hit: true },
        guardState,
        ['decision_entry'],
        undefined,
        portfolioRiskState,
      )

      expect(decision).toEqual({
        action: 'OPEN_LONG',
        size: { mode: 'RATIO', value: 0.1 },
        reason: 'compiled.decision_entry',
      })
    })

    it('drawdown 12% > threshold 10% (enforce) → NOOP block_entry_long', () => {
      const portfolioRiskState = evaluateOrchestrationPortfolioRisks(
        [{ id: 'risk-dd', scope: 'portfolio', mode: 'enforce', thresholdPct: 10, effectWhenTriggered: 'block_new_entries' }],
        { drawdownPct: 12 },
      )
      expect(portfolioRiskState).toEqual({ blockEntryLong: true, blockEntryShort: true, observedBreaches: [] })

      const decision = runDecisionPrograms(
        baseCtx(),
        entryProgram,
        { entry_hit: true },
        guardState,
        ['decision_entry'],
        undefined,
        portfolioRiskState,
      )

      expect(decision).toEqual({
        action: 'NOOP',
        reason: 'compiled.orchestration.portfolio_risk.block_entry_long',
      })
    })

    it('drawdown 12% (observe mode) → OPEN_LONG flows + decision.meta.observedBreaches contains risk id', () => {
      const portfolioRiskState = evaluateOrchestrationPortfolioRisks(
        [{ id: 'risk-dd', scope: 'portfolio', mode: 'observe', thresholdPct: 10, effectWhenTriggered: 'block_new_entries' }],
        { drawdownPct: 12 },
      )
      expect(portfolioRiskState).toEqual({ blockEntryLong: false, blockEntryShort: false, observedBreaches: ['risk-dd'] })

      const decision = runDecisionPrograms(
        baseCtx(),
        entryProgram,
        { entry_hit: true },
        guardState,
        ['decision_entry'],
        undefined,
        portfolioRiskState,
      )

      expect(decision).toMatchObject({
        action: 'OPEN_LONG',
        size: { mode: 'RATIO', value: 0.1 },
        reason: 'compiled.decision_entry',
        meta: { observedBreaches: ['risk-dd'] },
      })
    })

    it('drawdown undefined + enforce → fail-closed double block (NOOP)', () => {
      const portfolioRiskState = evaluateOrchestrationPortfolioRisks(
        [{ id: 'risk-dd', scope: 'portfolio', mode: 'enforce', thresholdPct: 10, effectWhenTriggered: 'block_new_entries' }],
        { drawdownPct: undefined },
      )
      expect(portfolioRiskState).toEqual({ blockEntryLong: true, blockEntryShort: true, observedBreaches: [] })

      const decision = runDecisionPrograms(
        baseCtx(),
        entryProgram,
        { entry_hit: true },
        guardState,
        ['decision_entry'],
        undefined,
        portfolioRiskState,
      )

      expect(decision).toEqual({
        action: 'NOOP',
        reason: 'compiled.orchestration.portfolio_risk.block_entry_long',
      })
    })
  })

  describe('orchestration program lifecycle integration (backtest T12)', () => {
    const guardState = Object.freeze({
      blockNewEntry: false,
      forceExit: false,
      strategyHalt: false,
      cancelOrderPrograms: false,
      triggered: Object.freeze([] as string[]),
    })

    function makeProgram(overrides: Partial<Extract<CompiledOrchestrationProgram, { programKind: 'fixed_grid_gated' }>> = {}): Extract<CompiledOrchestrationProgram, { programKind: 'fixed_grid_gated' }> {
      return {
        id: 'orch_grid_1',
        programKind: 'fixed_grid_gated',
        activeWhenExprId: 'gate_regime',
        onDeactivate: 'cancel',
        rebuildPolicy: 'static',
        gridParams: { anchorPrice: 50000, levelCount: 3, stepPct: 5 },
        sizing: { mode: 'fixed_quote', value: 100 },
        ...overrides,
      }
    }

    function synthesizeCloseDecision(
      qty: number,
      closeProgramIds: readonly string[],
    ): StrategyDecisionV1 {
      if (qty > 0) {
        return {
          action: 'CLOSE_LONG',
          reason: 'compiled.orchestration.program.close_position',
          meta: { closeProgramIds: [...closeProgramIds] },
        }
      }
      if (qty < 0) {
        return {
          action: 'CLOSE_SHORT',
          reason: 'compiled.orchestration.program.close_position',
          meta: { closeProgramIds: [...closeProgramIds] },
        }
      }
      return {
        action: 'NOOP',
        reason: 'compiled.orchestration.program.no_position_to_close',
      }
    }

    function mergeAdapterDecision(
      decision: StrategyDecisionV1,
      orderState: { closeProgramIds: readonly string[] },
      qty: number,
    ): StrategyDecisionV1 {
      if (
        orderState.closeProgramIds.length > 0
        && decision.action === 'NOOP'
        && qty !== 0
      ) {
        return synthesizeCloseDecision(qty, orderState.closeProgramIds)
      }
      return decision
    }

    it('Test 1: orchestrationPrograms active=true → workingOrders 含该 program; decision 不动', () => {
      const program = makeProgram({ onDeactivate: 'close' })
      const orderState = runOrderPrograms(
        {} as any,
        [],
        { gate_regime: true },
        guardState,
        [],
        undefined,
        [program],
      )
      expect(orderState.activeProgramIds).toEqual([program.id])
      expect(orderState.workingOrders).toHaveLength(1)
      expect(orderState.closeProgramIds).toEqual([])

      const decision: StrategyDecisionV1 = { action: 'NOOP', reason: 'compiled.noop' }
      const merged = mergeAdapterDecision(decision, orderState, 1)
      expect(merged).toEqual(decision)
    })

    it('Test 2: active=false + onDeactivate=cancel → cancelledProgramIds 含 program; closeProgramIds 空; decision 不动', () => {
      const program = makeProgram({ onDeactivate: 'cancel' })
      const orderState = runOrderPrograms(
        {} as any,
        [],
        { gate_regime: false },
        guardState,
        [],
        undefined,
        [program],
      )
      expect(orderState.cancelledProgramIds).toEqual([program.id])
      expect(orderState.closeProgramIds).toEqual([])
      expect(orderState.workingOrders).toEqual([])

      const decision: StrategyDecisionV1 = { action: 'NOOP', reason: 'compiled.noop' }
      const merged = mergeAdapterDecision(decision, orderState, 0)
      expect(merged).toEqual(decision)
    })

    it('Test 3: active=false + onDeactivate=keep → workingOrders 含 program (保单); decision 不动', () => {
      const program = makeProgram({ onDeactivate: 'keep' })
      const orderState = runOrderPrograms(
        {} as any,
        [],
        { gate_regime: false },
        guardState,
        [],
        undefined,
        [program],
      )
      expect(orderState.workingOrders).toHaveLength(1)
      expect(orderState.workingOrders[0].id).toBe(program.id)
      expect(orderState.closeProgramIds).toEqual([])

      const decision: StrategyDecisionV1 = { action: 'NOOP', reason: 'compiled.noop' }
      const merged = mergeAdapterDecision(decision, orderState, 1)
      expect(merged).toEqual(decision)
    })

    it('Test 4: onDeactivate=close + decision=NOOP + ctx 持仓 long → CLOSE_LONG with reason close_position; meta.closeProgramIds 含 id', () => {
      const program = makeProgram({ onDeactivate: 'close' })
      const orderState = runOrderPrograms(
        {} as any,
        [],
        { gate_regime: false },
        guardState,
        [],
        undefined,
        [program],
      )
      expect(orderState.closeProgramIds).toEqual([program.id])

      const decision: StrategyDecisionV1 = { action: 'NOOP', reason: 'compiled.noop' }
      const merged = mergeAdapterDecision(decision, orderState, 2)
      expect(merged).toEqual({
        action: 'CLOSE_LONG',
        reason: 'compiled.orchestration.program.close_position',
        meta: { closeProgramIds: [program.id] },
      })
    })

    it('Test 5: onDeactivate=close + decision=NOOP + ctx 持仓 short → CLOSE_SHORT', () => {
      const program = makeProgram({ onDeactivate: 'close' })
      const orderState = runOrderPrograms(
        {} as any,
        [],
        { gate_regime: false },
        guardState,
        [],
        undefined,
        [program],
      )
      expect(orderState.closeProgramIds).toEqual([program.id])

      const decision: StrategyDecisionV1 = { action: 'NOOP', reason: 'compiled.noop' }
      const merged = mergeAdapterDecision(decision, orderState, -2)
      expect(merged).toEqual({
        action: 'CLOSE_SHORT',
        reason: 'compiled.orchestration.program.close_position',
        meta: { closeProgramIds: [program.id] },
      })
    })

    it('Test 6: onDeactivate=close + decision=NOOP + ctx 持仓=0 → NOOP no_position_to_close (skip 合成)', () => {
      const program = makeProgram({ onDeactivate: 'close' })
      const orderState = runOrderPrograms(
        {} as any,
        [],
        { gate_regime: false },
        guardState,
        [],
        undefined,
        [program],
      )
      expect(orderState.closeProgramIds).toEqual([program.id])

      const decision: StrategyDecisionV1 = { action: 'NOOP', reason: 'compiled.noop' }
      const merged = mergeAdapterDecision(decision, orderState, 0)
      // qty=0：merge skip 合成；decision 保持原 NOOP（不携带 closeProgramIds）
      expect(merged).toEqual(decision)
    })

    it('Test 7 (W5): onDeactivate=close + decision=OPEN_LONG → decision 仍 OPEN_LONG，绝不被改写', () => {
      const program = makeProgram({ onDeactivate: 'close' })
      const orderState = runOrderPrograms(
        {} as any,
        [],
        { gate_regime: false },
        guardState,
        [],
        undefined,
        [program],
      )
      expect(orderState.closeProgramIds).toEqual([program.id])

      const decision: StrategyDecisionV1 = {
        action: 'OPEN_LONG',
        size: { mode: 'RATIO', value: 0.1 },
        reason: 'compiled.decision_entry',
      }
      const merged = mergeAdapterDecision(decision, orderState, 0)
      expect(merged).toEqual(decision)
    })

    it('Test 8 (W5): onDeactivate=close + decision=CLOSE_LONG (已 close) → decision 仍 CLOSE_LONG，不重复合成', () => {
      const program = makeProgram({ onDeactivate: 'close' })
      const orderState = runOrderPrograms(
        {} as any,
        [],
        { gate_regime: false },
        guardState,
        [],
        undefined,
        [program],
      )
      expect(orderState.closeProgramIds).toEqual([program.id])

      const decision: StrategyDecisionV1 = {
        action: 'CLOSE_LONG',
        size: { mode: 'QTY', value: 2 },
        reason: 'compiled.decision_exit',
      }
      const merged = mergeAdapterDecision(decision, orderState, 2)
      expect(merged).toEqual(decision)
    })
  })

  describe('program lifecycle substrate (Phase 5 S0a)', () => {
    const guardState = Object.freeze({
      blockNewEntry: false,
      forceExit: false,
      strategyHalt: false,
      cancelOrderPrograms: false,
      triggered: Object.freeze([] as string[]),
    })

    function makeProgram(overrides: Partial<Extract<CompiledOrchestrationProgram, { programKind: 'fixed_grid_gated' }>> = {}): Extract<CompiledOrchestrationProgram, { programKind: 'fixed_grid_gated' }> {
      return {
        id: 'orch_grid_1',
        programKind: 'fixed_grid_gated',
        activeWhenExprId: 'gate_regime',
        onDeactivate: 'cancel',
        rebuildPolicy: 'static',
        gridParams: { anchorPrice: 50000, levelCount: 3, stepPct: 5 },
        sizing: { mode: 'fixed_quote', value: 100 },
        ...overrides,
      }
    }

    it('fixed_grid_gated 跨连续 5 根 K 线：lifecycleStateBySymbol 持续含 program key（noop placeholder）', () => {
      const program = makeProgram({ id: 'orch_grid_persistent' })
      // 模拟 backtest-strategy-adapter 闭包：按 symbol 维护跨 bar lifecycle map
      const lifecycleBySymbol = new Map<string, Record<string, ProgramLifecycleState>>()
      const symbol = 'BTCUSDT'

      for (let bar = 0; bar < 5; bar++) {
        const stateIn = lifecycleBySymbol.get(symbol)
        const orderState = runOrderPrograms(
          { symbol, bars: [{ open: 100, high: 110, low: 95, close: 105, volume: 1, timestamp: bar }] } as any,
          [],
          { gate_regime: bar % 2 === 0 }, // 交替 active/inactive，验证 lifecycle 在两种分支均持续
          guardState,
          [],
          undefined,
          [program],
          stateIn,
        )
        // 第 8 参穿透到 runtime；fixed_grid_gated placeholder 写入 next state
        expect(orderState.programLifecycleStateNext[program.id]).toEqual({
          kind: 'fixed_grid_gated',
        })
        // 回写 next 到 map（adapter 闭包行为）
        lifecycleBySymbol.set(symbol, { ...orderState.programLifecycleStateNext })
      }

      // 5 根 K 线后，map 仍含 program key
      expect(lifecycleBySymbol.get(symbol)?.[program.id]).toEqual({
        kind: 'fixed_grid_gated',
      })
    })

    it('多 symbol 隔离：BTCUSDT 与 ETHUSDT 各自维护独立 lifecycle 桶', () => {
      const program = makeProgram({ id: 'orch_grid_multi' })
      const lifecycleBySymbol = new Map<string, Record<string, ProgramLifecycleState>>()

      for (const symbol of ['BTCUSDT', 'ETHUSDT']) {
        const stateIn = lifecycleBySymbol.get(symbol)
        const orderState = runOrderPrograms(
          { symbol, bars: [] } as any,
          [],
          { gate_regime: true },
          guardState,
          [],
          undefined,
          [program],
          stateIn,
        )
        lifecycleBySymbol.set(symbol, { ...orderState.programLifecycleStateNext })
      }

      expect(lifecycleBySymbol.get('BTCUSDT')?.[program.id]).toEqual({ kind: 'fixed_grid_gated' })
      expect(lifecycleBySymbol.get('ETHUSDT')?.[program.id]).toEqual({ kind: 'fixed_grid_gated' })
    })
  })
})
