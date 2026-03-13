import { marketDataConfig } from '@/config/configuration'
import { mapTimeframe } from './prisma-enum-mappers'

describe('mapTimeframe', () => {
  it('supports every default configured market timeframe', () => {
    for (const timeframe of marketDataConfig().timeframes) {
      expect(() => mapTimeframe(timeframe)).not.toThrow()
    }
  })
})
