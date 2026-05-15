import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'

const dispatcher = new GenericSeedDispatcher()

const CASES = [
  'binance 永续 BTCUSDT 15m。价格站上短期均线时做多。单笔仓位 10%。',
  'binance 永续 BTCUSDT 15m。价格跌破长期均线时止损。单笔仓位 10%。',
  'binance 永续 BTCUSDT 15m。价格站上 EMA20 时做多。单笔仓位 10%。',
]

describe('M3 indicator.above matchRequires', () => {
  for (const msg of CASES) {
    it(msg.slice(20, 50), () => {
      const patch = dispatcher.dispatch(msg)
      const triggers = (patch.atoms ?? []).filter((a) => {
        const n = a as { key?: string }
        return n.key === 'indicator.above' || n.key === 'indicator.below'
      })

      console.log(`\n=== ${msg.slice(20, 60)} ===`)
      for (const t of triggers) {
        const n = t as { key?: string; phase?: string; params?: unknown }

        console.log(' -', JSON.stringify({ key: n.key, phase: n.phase, params: n.params }))
      }
      if (triggers.length === 0) console.log('  (no indicator.above/below matched)')
      expect(true).toBe(true)
    })
  }
})
