import type { Bar } from '../types/backtesting.types'
import { RiskEvaluatorService } from './risk-evaluator.service'

function createBar(input: Partial<Bar> & Pick<Bar, 'symbol' | 'timeframe' | 'closeTime'>): Bar {
  return {
    symbol: input.symbol,
    timeframe: input.timeframe,
    openTime: input.openTime ?? input.closeTime - 1,
    closeTime: input.closeTime,
    open: input.open ?? 100,
    high: input.high ?? 100,
    low: input.low ?? 100,
    close: input.close ?? 100,
    volume: input.volume ?? 0,
  }
}

describe('riskEvaluatorService', () => {
  it('returns undefined when there is no open position', () => {
    const service = new RiskEvaluatorService()
    const decision = service.evaluate({
      symbol: 'BTCUSDT',
      bar: createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 100 }),
      position: { symbol: 'BTCUSDT', qty: 0, avgEntryPrice: 0, realizedPnl: 0, unrealizedPnl: 0 },
      riskRules: { maxFloatingLossPct: 5 },
    })

    expect(decision).toBeUndefined()
  })

  it('forces close when floating loss reaches maxFloatingLossPct', () => {
    const service = new RiskEvaluatorService()
    const decision = service.evaluate({
      symbol: 'BTCUSDT',
      bar: createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 94 }),
      position: { symbol: 'BTCUSDT', qty: 1, avgEntryPrice: 100, realizedPnl: 0, unrealizedPnl: -6 },
      riskRules: { maxFloatingLossPct: 5 },
    })

    expect(decision).toMatchObject({
      type: 'CLOSE',
      reason: 'risk.max_floating_loss',
      source: 'risk',
    })
  })

  it('forces close after 3 consecutive outside-band bars', () => {
    const service = new RiskEvaluatorService()
    const input = {
      symbol: 'BTCUSDT',
      position: { symbol: 'BTCUSDT', qty: 2, avgEntryPrice: 100, realizedPnl: 0, unrealizedPnl: 0 },
      riskRules: {
        outsideBand: {
          lowerBound: 95,
          upperBound: 105,
          consecutiveBars: 3,
          action: 'CLOSE',
        },
      },
    } as const

    const d1 = service.evaluate({
      ...input,
      bar: createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 106 }),
    })
    const d2 = service.evaluate({
      ...input,
      bar: createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, close: 107 }),
    })
    const d3 = service.evaluate({
      ...input,
      bar: createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, close: 108 }),
    })

    expect(d1).toBeUndefined()
    expect(d2).toBeUndefined()
    expect(d3).toMatchObject({
      type: 'CLOSE',
      reason: 'risk.consecutive_outside_band',
      source: 'risk',
    })
  })

  it('supports bollinger-based outside-band streak evaluation from history bars', () => {
    const service = new RiskEvaluatorService()
    const input = {
      symbol: 'BTCUSDT',
      position: { symbol: 'BTCUSDT', qty: 2, avgEntryPrice: 100, realizedPnl: 0, unrealizedPnl: 0 },
      riskRules: {
        outsideBand: {
          mode: 'BOLLINGER_BANDS' as const,
          lowerBound: 0,
          upperBound: 0,
          indicator: { kind: 'bollingerBands' as const, period: 3, stdDev: 0 },
          consecutiveBars: 3,
          action: 'CLOSE' as const,
        },
      },
    }

    const d1 = service.evaluate({
      ...input,
      bar: createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, close: 101 }),
      historyBars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 1, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, close: 101 }),
      ],
    })
    const d2 = service.evaluate({
      ...input,
      bar: createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 4, close: 102 }),
      historyBars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 2, close: 100 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, close: 101 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 4, close: 102 }),
      ],
    })
    const d3 = service.evaluate({
      ...input,
      bar: createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 5, close: 103 }),
      historyBars: [
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 3, close: 101 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 4, close: 102 }),
        createBar({ symbol: 'BTCUSDT', timeframe: '5m', closeTime: 5, close: 103 }),
      ],
    })

    expect(d1).toBeUndefined()
    expect(d2).toBeUndefined()
    expect(d3).toMatchObject({
      type: 'CLOSE',
      reason: 'risk.consecutive_outside_band',
      source: 'risk',
    })
  })
})
