import { evaluateRiskPredicates } from './evaluate-risk-predicates'

describe('evaluateRiskPredicates', () => {
  it('forces a long exit when price breaches an ATR multiple stop', () => {
    const guardState = evaluateRiskPredicates(
      {
        position: { qty: 1, avgEntryPrice: 100 },
        currentPrice: 75,
        bars: Array.from({ length: 16 }, (_, index) => ({
          open: 100,
          high: 105,
          low: 95,
          close: index === 15 ? 75 : 100,
          volume: 1,
          timestamp: index + 1,
        })),
      },
      [
        {
          id: 'risk_predicate_01_stop',
          payload: {
            id: 'risk-atr-stop',
            kind: 'atrMultipleStop',
            params: { multiple: 2 },
          },
        },
      ],
      {
        strategyHalt: false,
        blockNewEntry: false,
        forceExit: false,
        cancelOrderPrograms: false,
        triggered: [],
      },
      ['risk_predicate_01_stop'],
    )

    expect(guardState.forceExit).toBe(true)
    expect(guardState.triggered).toEqual(['risk_predicate_01_stop'])
  })

  it('forces a long exit when price loses a remembered semantic level', () => {
    const guardState = evaluateRiskPredicates(
      {
        position: { qty: 1, avgEntryPrice: 100 },
        currentPrice: 98,
        semanticRuntimeState: {
          breakout: { rememberedLevel: 99 },
        },
        bars: [],
      },
      [
        {
          id: 'risk_predicate_01_remembered_level',
          payload: {
            id: 'risk-remembered-level-stop',
            kind: 'rememberedLevelStop',
            params: { levelKey: 'breakout' },
          },
        },
      ],
      {
        strategyHalt: false,
        blockNewEntry: false,
        forceExit: false,
        cancelOrderPrograms: false,
        triggered: [],
      },
      ['risk_predicate_01_remembered_level'],
    )

    expect(guardState.forceExit).toBe(true)
    expect(guardState.triggered).toEqual(['risk_predicate_01_remembered_level'])
  })

  describe('timeStopBars', () => {
    const baseGuardState = {
      strategyHalt: false,
      blockNewEntry: false,
      forceExit: false,
      cancelOrderPrograms: false,
      triggered: [],
    }

    it('forces an exit when bars_held reaches maxBars (long position, scope both)', () => {
      const guardState = evaluateRiskPredicates(
        {
          timeframe: '15m',
          position: { qty: 1, avgEntryPrice: 100, barsHeld: 11, entryTimeframe: '15m' } as Record<string, unknown>,
          bars: [],
        },
        [
          {
            id: 'risk_time_stop',
            payload: {
              id: 'risk-time-stop',
              kind: 'timeStopBars',
              params: { maxBars: 10, scope: 'both' },
            },
          },
        ],
        baseGuardState,
        ['risk_time_stop'],
      )
      expect(guardState.forceExit).toBe(true)
      expect(guardState.triggered).toEqual(['risk_time_stop'])
    })

    it('does not trigger when scope=long but the position is short', () => {
      const guardState = evaluateRiskPredicates(
        {
          timeframe: '15m',
          position: { qty: -1, avgEntryPrice: 100, barsHeld: 50, entryTimeframe: '15m' } as Record<string, unknown>,
          bars: [],
        },
        [
          {
            id: 'risk_time_stop',
            payload: { kind: 'timeStopBars', params: { maxBars: 10, scope: 'long' } },
          },
        ],
        baseGuardState,
        ['risk_time_stop'],
      )
      expect(guardState.forceExit).toBe(false)
      expect(guardState.triggered).toEqual([])
    })

    it('fail-closed when there is no position', () => {
      const guardState = evaluateRiskPredicates(
        { timeframe: '15m', bars: [] },
        [
          {
            id: 'risk_time_stop',
            payload: { kind: 'timeStopBars', params: { maxBars: 10, scope: 'both' } },
          },
        ],
        baseGuardState,
        ['risk_time_stop'],
      )
      expect(guardState.forceExit).toBe(false)
    })

    it('fail-closed when entryTimeframe does not match ctx.timeframe', () => {
      const guardState = evaluateRiskPredicates(
        {
          timeframe: '15m',
          position: { qty: 1, avgEntryPrice: 100, barsHeld: 50, entryTimeframe: '1h' } as Record<string, unknown>,
          bars: [],
        },
        [
          {
            id: 'risk_time_stop',
            payload: { kind: 'timeStopBars', params: { maxBars: 10, scope: 'both' } },
          },
        ],
        baseGuardState,
        ['risk_time_stop'],
      )
      expect(guardState.forceExit).toBe(false)
    })
  })

  it('does not force a short exit when an ATR take-profit only declares CLOSE_LONG', () => {
    const guardState = evaluateRiskPredicates(
      {
        position: { qty: -1, avgEntryPrice: 100 },
        currentPrice: 75,
        bars: Array.from({ length: 16 }, (_, index) => ({
          open: 100,
          high: 105,
          low: 95,
          close: index === 15 ? 75 : 100,
          volume: 1,
          timestamp: index + 1,
        })),
      },
      [
        {
          id: 'risk_predicate_01_take_profit',
          payload: {
            id: 'risk-atr-take-profit',
            kind: 'atrMultipleTakeProfit',
            params: { multiple: 2 },
            actions: [{ kind: 'CLOSE_LONG' }],
          },
        },
      ],
      {
        strategyHalt: false,
        blockNewEntry: false,
        forceExit: false,
        cancelOrderPrograms: false,
        triggered: [],
      },
      ['risk_predicate_01_take_profit'],
    )

    expect(guardState.forceExit).toBe(false)
    expect(guardState.triggered).toEqual([])
  })
})
