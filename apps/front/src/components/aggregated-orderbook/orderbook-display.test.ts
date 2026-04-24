import type { AggregatedOrderbookLevel } from '@/lib/api'
import { describe, expect, it } from '@jest/globals'

import { sampleLevelsForDisplay } from './orderbook-display'

function makeLevels(start: number, count: number, direction: 'asc' | 'desc'): AggregatedOrderbookLevel[] {
  return Array.from({ length: count }).map((_, idx) => {
    const n = direction === 'asc' ? start + idx : start - idx
    return {
      price: n,
      sizeTotal: 1,
      details: [],
    }
  })
}

describe('sampleLevelsForDisplay', () => {
  it('在固定行数下应覆盖更宽价格区间（而不是只取最靠近盘口的档位）', () => {
    const asks = makeLevels(1900, 100, 'asc') // 1900..1999
    const sampled = sampleLevelsForDisplay(asks, 13)

    expect(sampled).toHaveLength(13)
    expect(sampled[0].price).toBe(1900)
    expect(sampled[sampled.length - 1].price).toBe(1999)
  })

  it('当原始档位少于限制时应原样返回', () => {
    const bids = makeLevels(2000, 8, 'desc')
    const sampled = sampleLevelsForDisplay(bids, 13)

    expect(sampled).toHaveLength(8)
    expect(sampled.map(x => x.price)).toEqual(bids.map(x => x.price))
  })
})
