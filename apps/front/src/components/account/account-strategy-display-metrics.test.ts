import { resolveDisplayMetrics } from './account-strategy-display-metrics'

describe('account-strategy-display-metrics', () => {
  it('uses backend totalPnl when present', () => {
    const out = resolveDisplayMetrics({
      totalPnl: 320.12,
      todayPnl: null,
      series: [{ ts: '2026-03-20T00:00:00.000Z', value: 10000 }],
      initialCapital: 10000,
    })

    expect(out.displayTotalPnl).toBe(320.12)
  })

  it('falls back totalPnl to pure pnl with series first/last delta', () => {
    const out = resolveDisplayMetrics({
      totalPnl: null,
      todayPnl: null,
      series: [
        { ts: '2026-03-20T00:00:00.000Z', value: 10000 },
        { ts: '2026-03-20T12:00:00.000Z', value: 10120 },
        { ts: '2026-03-20T23:00:00.000Z', value: 10070 },
      ],
      initialCapital: 10000,
    })

    expect(out.displayTotalPnl).toBe(70)
  })

  it('uses backend todayPnl when present', () => {
    const out = resolveDisplayMetrics({
      totalPnl: null,
      todayPnl: 18.34,
      series: [
        { ts: '2026-03-20T00:00:00.000Z', value: 10000 },
        { ts: '2026-03-20T23:00:00.000Z', value: 10070 },
      ],
      initialCapital: 10000,
    })

    expect(out.displayTodayPnl).toBe(18.34)
  })

  it('falls back todayPnl by UTC day series', () => {
    const out = resolveDisplayMetrics({
      totalPnl: null,
      todayPnl: null,
      series: [
        { ts: '2026-03-19T23:00:00.000Z', value: 9990 },
        { ts: '2026-03-20T01:00:00.000Z', value: 10000 },
        { ts: '2026-03-20T16:00:00.000Z', value: 10080 },
        { ts: '2026-03-20T23:00:00.000Z', value: 10050 },
      ],
      initialCapital: 10000,
    })

    expect(out.displayTodayPnl).toBe(50)
  })

  it('handles equitySeries length = 1 with initialCapital', () => {
    const out = resolveDisplayMetrics({
      totalPnl: null,
      todayPnl: null,
      series: [{ ts: '2026-03-20T08:00:00.000Z', value: 10070 }],
      initialCapital: 10000,
    })

    expect(out.displayTotalPnl).toBe(70)
    expect(out.displayTodayPnl).toBe(0)
  })

  it('treats NaN and Infinity as missing and falls back safely', () => {
    const out = resolveDisplayMetrics({
      totalPnl: Number.NaN,
      todayPnl: Number.POSITIVE_INFINITY,
      series: [
        { ts: '2026-03-20T00:00:00.000Z', value: 10000 },
        { ts: '2026-03-20T23:00:00.000Z', value: 10050 },
      ],
      initialCapital: 10000,
    })

    expect(out.displayTotalPnl).toBe(50)
    expect(out.displayTodayPnl).toBe(50)
  })

  it('rounds display values to 2 decimals', () => {
    const out = resolveDisplayMetrics({
      totalPnl: 10.005,
      todayPnl: 2.675,
      series: [],
      initialCapital: 10000,
    })

    expect(out.displayTotalPnl).toBe(10.01)
    expect(out.displayTodayPnl).toBe(2.67)
  })

  it('uses UTC day boundary for cross-day points', () => {
    const out = resolveDisplayMetrics({
      totalPnl: null,
      todayPnl: null,
      series: [
        { ts: '2026-03-20T23:50:00.000Z', value: 10000 },
        { ts: '2026-03-21T00:10:00.000Z', value: 10020 },
        { ts: '2026-03-21T23:00:00.000Z', value: 10030 },
      ],
      initialCapital: 10000,
    })

    expect(out.displayTodayPnl).toBe(10)
  })
})

