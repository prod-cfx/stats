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
})
