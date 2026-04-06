import {
  ExchangeId,
  SignalDirection,
  SignalType,
  SubscriptionStatus,
  WhaleNotificationRuleType,
} from '@ai/shared'

describe('shared prisma enums', () => {
  it('exports quantify enums from @ai/shared for cross-service consumers', () => {
    expect(Object.values(ExchangeId)).toEqual(['binance', 'okx', 'hyperliquid'])
    expect(Object.values(SignalDirection)).toEqual(['BUY', 'SELL', 'CLOSE_LONG', 'CLOSE_SHORT'])
    expect(Object.values(SignalType)).toEqual(['ENTRY', 'EXIT', 'ADJUSTMENT', 'ALERT'])
    expect(Object.values(SubscriptionStatus)).toEqual(['active', 'paused', 'cancelled'])
  })

  it('exports backend enums from @ai/shared for frontend consumers', () => {
    expect(Object.values(WhaleNotificationRuleType)).toEqual(['ADDRESS', 'SYMBOL'])
  })
})
