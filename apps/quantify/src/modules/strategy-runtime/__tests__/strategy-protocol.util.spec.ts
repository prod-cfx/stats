import { strategyDecisionToSignalPayload } from '../strategy-protocol.util'

describe('strategyProtocolUtil', () => {
  it('rejects ADJUST_POSITION conversion when context is missing', () => {
    expect(() =>
      strategyDecisionToSignalPayload(
        {
          action: 'ADJUST_POSITION',
          adjustMode: 'TARGET',
          size: { mode: 'QTY', value: 2 },
        },
        100,
      ),
    ).toThrow('ADJUST_POSITION requires explicit context')
  })

  it('converts ADJUST_POSITION with explicit context', () => {
    const payload = strategyDecisionToSignalPayload(
      {
        action: 'ADJUST_POSITION',
        adjustMode: 'TARGET',
        size: { mode: 'QTY', value: 1 },
      },
      100,
      {
        currentQty: 3,
        equity: 1000,
        markPrice: 100,
      },
    )

    expect(payload.direction).toBe('SELL')
    expect(payload.positionSizeQuote).toBe(200)
  })
})
