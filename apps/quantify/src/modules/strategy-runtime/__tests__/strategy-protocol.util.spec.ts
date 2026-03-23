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
    expect(payload.signalType).toBe('ADJUSTMENT')
  })

  it('maps signalType by action category', () => {
    const openPayload = strategyDecisionToSignalPayload(
      { action: 'OPEN_LONG', size: { mode: 'QTY', value: 1 } },
      100,
    )
    const closePayload = strategyDecisionToSignalPayload(
      { action: 'CLOSE_LONG', size: { mode: 'QTY', value: 1 } },
      100,
    )
    const noopPayload = strategyDecisionToSignalPayload({ action: 'NOOP' }, 100)

    expect(openPayload.signalType).toBe('ENTRY')
    expect(closePayload.signalType).toBe('EXIT')
    expect(noopPayload.signalType).toBe('ALERT')
  })

  it('maps ADJUST_POSITION zero-delta to no-op payload', () => {
    const payload = strategyDecisionToSignalPayload(
      {
        action: 'ADJUST_POSITION',
        adjustMode: 'TARGET',
        size: { mode: 'QTY', value: 2 },
      },
      100,
      {
        currentQty: 2,
        equity: 1000,
        markPrice: 100,
      },
    )

    expect(payload.signalType).toBe('ALERT')
    expect(payload.direction).toBeUndefined()
    expect(payload.positionSizeQuote).toBeUndefined()
    expect(payload.positionSizeRatio).toBeUndefined()
  })
})
