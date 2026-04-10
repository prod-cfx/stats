import { normalizeGatewayBar, normalizeGatewayBars } from '../market-data-bar.mapper'

describe('market data bar mapper', () => {
  it('normalizes nullable volume to zero', () => {
    const normalized = normalizeGatewayBar({
      timestamp: 1000,
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: null,
      isFinal: false,
    })

    expect(normalized).toEqual({
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 0,
      timestamp: 1000,
      isFinal: false,
    })
  })

  it('normalizes a bar list', () => {
    const normalized = normalizeGatewayBars([
      {
        timestamp: 1,
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        volume: 10,
        isFinal: true,
      },
      {
        timestamp: 2,
        open: 1.5,
        high: 2.5,
        low: 1,
        close: 2,
        volume: 12,
        isFinal: false,
      },
    ])

    expect(normalized).toEqual([
      { open: 1, high: 2, low: 0.5, close: 1.5, volume: 10, timestamp: 1, isFinal: true },
      { open: 1.5, high: 2.5, low: 1, close: 2, volume: 12, timestamp: 2, isFinal: false },
    ])
  })
})
