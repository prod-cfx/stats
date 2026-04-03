import { MARKET_TIMEFRAMES } from '@ai/shared'
import { marketDataConfig } from '@/config/configuration'
import { mapTimeframe, reverseMapTimeframe, SUPPORTED_MARKET_TIMEFRAMES } from './prisma-enum-mappers'

describe('market timeframe mappers', () => {
  it('keeps quantify supported timeframes aligned with shared market timeframes', () => {
    expect(SUPPORTED_MARKET_TIMEFRAMES).toEqual(MARKET_TIMEFRAMES)
  })

  it('supports every default configured market timeframe', () => {
    for (const timeframe of marketDataConfig().timeframes) {
      expect(() => mapTimeframe(timeframe)).not.toThrow()
    }
  })

  it('round-trips every supported timeframe', () => {
    for (const timeframe of SUPPORTED_MARKET_TIMEFRAMES) {
      expect(reverseMapTimeframe(mapTimeframe(timeframe))).toBe(timeframe)
    }
  })
})
