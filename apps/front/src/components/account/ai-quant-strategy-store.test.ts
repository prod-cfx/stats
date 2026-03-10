import { ensureStrategyStore, getStrategyById } from './ai-quant-strategy-store'

describe('ai-quant-strategy-store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('seeds and returns strategy by id', () => {
    const list = ensureStrategyStore()
    expect(list.length).toBeGreaterThanOrEqual(3)
    expect(getStrategyById(list[0].id)?.id).toBe(list[0].id)
  })

  it('falls back to seed on invalid payload', () => {
    localStorage.setItem('ai_quant_strategy_store_v1', '{bad json')
    const list = ensureStrategyStore()
    expect(list.length).toBeGreaterThanOrEqual(3)
  })

  it('migrates legacy ts and fills initial capital', () => {
    localStorage.setItem(
      'ai_quant_strategy_store_v1',
      JSON.stringify([
        {
          id: 'legacy-1',
          name: 'legacy',
          status: 'running',
          exchange: 'binance',
          symbol: 'BTCUSDT',
          timeframe: '3m',
          positionPct: 10,
          metrics: { returnPct: 1, maxDrawdownPct: 1, winRatePct: 1, tradeCount: 1 },
          equitySeries: [{ ts: 'T1', value: 100 }, { ts: 'T2', value: 101 }],
          timeline: [],
          updatedAt: new Date().toISOString(),
        },
      ]),
    )
    const list = ensureStrategyStore()
    expect(list[0].initialCapital).toBe(10000)
    expect(list[0].equitySeries[0].ts).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })
})
