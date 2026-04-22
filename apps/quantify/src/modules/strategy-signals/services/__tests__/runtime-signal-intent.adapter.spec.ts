import { RuntimeSignalIntentAdapter } from '../runtime-signal-intent.adapter'

describe('RuntimeSignalIntentAdapter', () => {
  const adapter = new RuntimeSignalIntentAdapter()

  it('returns signal for OPEN_LONG ratio decisions from published runtime', () => {
    const result = adapter.fromDecision({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.1 },
      reason: 'compiled.entry',
    }, {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 4.728,
    })

    expect(result).toEqual({
      kind: 'signal',
      signal: {
        direction: 'BUY',
        signalType: 'ENTRY',
        positionSizeRatio: 0.1,
        entryPrice: 4.728,
      },
    })
  })

  it('returns noop for NOOP decisions', () => {
    const result = adapter.fromDecision({ action: 'NOOP', reason: 'compiled.noop' }, {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 4.728,
    })

    expect(result).toEqual({ kind: 'noop', reason: 'compiled.noop' })
  })

  it('returns missing_required_truth when referencePrice is missing', () => {
    const result = adapter.fromDecision({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.1 },
      reason: 'compiled.entry',
    }, {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: undefined,
    })

    expect(result).toEqual({
      kind: 'missing_required_truth',
      reasonCode: 'RUNTIME_SIGNAL_REFERENCE_PRICE_MISSING',
    })
  })
})
