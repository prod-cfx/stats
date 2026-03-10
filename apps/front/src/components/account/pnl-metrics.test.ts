import { derivePnlMetrics } from './pnl-metrics'

describe('pnl-metrics', () => {
  it('computes total amount with initial capital and today pnl', () => {
    const out = derivePnlMetrics(
      [
        { ts: '2026-03-06 09:00', value: 100 },
        { ts: '2026-03-06 10:00', value: 102 },
      ],
      10000,
    )
    expect(out.totalAmount).toBe(10002)
    expect(out.todayPnlAmount).toBe(2)
  })
})

