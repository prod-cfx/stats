import { resolveBacktestRange, validateBacktestRange } from './backtest-range'

describe('backtest-range', () => {
  const now = new Date('2026-03-24T12:00:00.000Z')

  it('resolves 7D preset range', () => {
    const range = resolveBacktestRange({ preset: '7D' }, now)
    expect(range.startAt).toBe('2026-03-17T12:00:00.000Z')
    expect(range.endAt).toBe('2026-03-24T12:00:00.000Z')
  })

  it('resolves 30D preset range', () => {
    const range = resolveBacktestRange({ preset: '30D' }, now)
    expect(range.startAt).toBe('2026-02-22T12:00:00.000Z')
    expect(range.endAt).toBe('2026-03-24T12:00:00.000Z')
  })

  it('resolves 90D preset range', () => {
    const range = resolveBacktestRange({ preset: '90D' }, now)
    expect(range.startAt).toBe('2025-12-24T12:00:00.000Z')
    expect(range.endAt).toBe('2026-03-24T12:00:00.000Z')
  })

  it('resolves 1Y preset range', () => {
    const range = resolveBacktestRange({ preset: '1Y' }, now)
    expect(range.startAt).toBe('2025-03-24T12:00:00.000Z')
    expect(range.endAt).toBe('2026-03-24T12:00:00.000Z')
  })

  it('normalizes custom range to ISO', () => {
    const range = resolveBacktestRange({
      preset: 'CUSTOM',
      startAt: '2026-03-01T08:30',
      endAt: '2026-03-20T09:45',
    }, now)

    expect(range.startAt).toBe(new Date('2026-03-01T08:30').toISOString())
    expect(range.endAt).toBe(new Date('2026-03-20T09:45').toISOString())
  })

  it('validates valid custom range', () => {
    const result = validateBacktestRange({
      preset: 'CUSTOM',
      startAt: '2026-03-01T08:30',
      endAt: '2026-03-20T09:45',
    })

    expect(result).toEqual({ ok: true })
  })

  it('rejects missing custom range', () => {
    const result = validateBacktestRange({
      preset: 'CUSTOM',
      startAt: '',
      endAt: '',
    })

    expect(result).toEqual({ ok: false, reason: 'missing_range' })
  })

  it('rejects start equal to end', () => {
    const result = validateBacktestRange({
      preset: 'CUSTOM',
      startAt: '2026-03-20T09:45',
      endAt: '2026-03-20T09:45',
    })

    expect(result).toEqual({ ok: false, reason: 'start_after_end' })
  })

  it('rejects start after end', () => {
    const result = validateBacktestRange({
      preset: 'CUSTOM',
      startAt: '2026-03-21T09:45',
      endAt: '2026-03-20T09:45',
    })

    expect(result).toEqual({ ok: false, reason: 'start_after_end' })
  })

  it('accepts 365 days span', () => {
    const result = validateBacktestRange({
      preset: 'CUSTOM',
      startAt: '2025-03-24T12:00:00.000Z',
      endAt: '2026-03-24T12:00:00.000Z',
    })

    expect(result).toEqual({ ok: true })
  })

  it('rejects 366 days span', () => {
    const result = validateBacktestRange({
      preset: 'CUSTOM',
      startAt: '2025-03-23T12:00:00.000Z',
      endAt: '2026-03-24T12:00:00.000Z',
    })

    expect(result).toEqual({ ok: false, reason: 'range_too_large' })
  })
})
