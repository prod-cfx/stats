import { PositionAdmissionService } from './position-admission.service'

describe('positionAdmissionService', () => {
  const service = new PositionAdmissionService()

  it('blocks duplicate long entries when pyramiding is disabled', () => {
    expect(service.evaluateEntry({
      direction: 'BUY',
      constraints: {
        positionMode: 'long_only',
        maxConcurrentPositions: 1,
        allowPyramiding: false,
      },
      openPositions: [{ positionSide: 'LONG' as any, quantity: '0.0359' }],
    })).toEqual({
      ok: false,
      reason: 'ENTRY_BLOCKED_BY_MAX_CONCURRENT_POSITIONS',
    })
  })

  it('blocks entries while an execution requires reconciliation', () => {
    expect(service.evaluateEntry({
      direction: 'BUY',
      constraints: {
        positionMode: 'long_only',
        maxConcurrentPositions: 1,
        allowPyramiding: false,
      },
      openPositions: [],
      hasPendingReconciliation: true,
    })).toEqual({
      ok: false,
      reason: 'ENTRY_BLOCKED_BY_RECONCILE_REQUIRED',
    })
  })

  it('allows exit directions because admission only governs entries', () => {
    expect(service.evaluateEntry({
      direction: 'CLOSE_LONG',
      constraints: {
        positionMode: 'long_only',
        maxConcurrentPositions: 1,
        allowPyramiding: false,
      },
      openPositions: [{ positionSide: 'LONG' as any, quantity: '0.0359' }],
      hasPendingReconciliation: true,
    })).toEqual({ ok: true })
  })
})
