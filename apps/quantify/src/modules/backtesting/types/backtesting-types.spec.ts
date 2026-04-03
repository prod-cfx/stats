import type { BacktestRunInput, SignalIntent } from './backtesting.types'

describe('backtesting types', () => {
  it('should allow target-position intent', () => {
    const intent: SignalIntent = { type: 'TARGET_POSITION', targetQty: 1 }
    expect(intent.type).toBe('TARGET_POSITION')
  })

  it('should shape run input', () => {
    const input: BacktestRunInput = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      initialCash: 10000,
      leverage: 2,
      execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
      strategy: { id: 's1', params: {}, fn: () => ({ type: 'NOOP' }) },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [],
    }

    expect(input.symbols).toHaveLength(1)
  })

  it('should allow strategy execution policy and risk rules fields', () => {
    const input: BacktestRunInput = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '5m',
      stateTimeframes: ['1h'],
      initialCash: 10000,
      leverage: 2,
      execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
      strategy: {
        id: 's2',
        params: {},
        executionPolicy: {
          signalTiming: 'BAR_CLOSE',
          fillTiming: 'NEXT_BAR_OPEN',
        },
        riskRules: {
          maxFloatingLossPct: 5,
          outsideBand: {
            lowerBound: 95,
            upperBound: 105,
            consecutiveBars: 3,
            action: 'CLOSE',
          },
        },
        scriptMetadata: {
          source: 'llm_codegen',
        },
        snapshotId: 'snapshot-1',
        snapshotHash: 'hash-a',
        scriptHash: 'hash-b',
        specHash: 'hash-c',
        dataRequirements: { primary: ['5m'] },
        specSnapshot: { market: { symbol: 'BTCUSDT' } },
        fn: () => ({ type: 'NOOP' }),
      },
      dataRange: { fromTs: 1, toTs: 2 },
      bars: [],
    }

    expect(input.strategy.executionPolicy?.fillTiming).toBe('NEXT_BAR_OPEN')
    expect(input.strategy.riskRules?.maxFloatingLossPct).toBe(5)
    expect(input.strategy.scriptMetadata?.source).toBe('llm_codegen')
    expect(input.strategy.snapshotId).toBe('snapshot-1')
    expect(input.strategy.snapshotHash).toBe('hash-a')
  })
})
