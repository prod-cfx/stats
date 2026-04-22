import { RuntimeSignalIntentAdapter } from '../runtime-signal-intent.adapter'

describe('RuntimeSignalIntentAdapter', () => {
  const adapter = new RuntimeSignalIntentAdapter()

  it('maps OPEN_LONG ratio decisions to entry BUY signals', () => {
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

    expect(result.kind).toBe('signal')
    expect(result.signal).toEqual(expect.objectContaining({
      direction: 'BUY',
      signalType: 'ENTRY',
      positionSizeRatio: 0.1,
      entryPrice: 4.728,
    }))
  })

  it('maps OPEN_SHORT ratio decisions to entry SELL signals', () => {
    const result = adapter.fromDecision({
      action: 'OPEN_SHORT',
      size: { mode: 'RATIO', value: 0.2 },
      reason: 'compiled.short-entry',
    }, {
      exchange: 'okx',
      marketType: 'swap',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 4.728,
    })

    expect(result.kind).toBe('signal')
    expect(result.signal).toEqual(expect.objectContaining({
      direction: 'SELL',
      signalType: 'ENTRY',
      positionSizeRatio: 0.2,
      entryPrice: 4.728,
    }))
  })

  it('maps CLOSE_LONG decisions to CLOSE_LONG exit signals', () => {
    const result = adapter.fromDecision({
      action: 'CLOSE_LONG',
      reason: 'compiled.long-exit',
    }, {
      exchange: 'okx',
      marketType: 'swap',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 4.728,
    })

    expect(result.kind).toBe('signal')
    expect(result.signal).toEqual(expect.objectContaining({
      direction: 'CLOSE_LONG',
      signalType: 'EXIT',
      entryPrice: 4.728,
    }))
  })

  it('maps CLOSE_SHORT decisions to CLOSE_SHORT exit signals', () => {
    const result = adapter.fromDecision({
      action: 'CLOSE_SHORT',
      reason: 'compiled.short-exit',
    }, {
      exchange: 'okx',
      marketType: 'swap',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 4.728,
    })

    expect(result.kind).toBe('signal')
    expect(result.signal).toEqual(expect.objectContaining({
      direction: 'CLOSE_SHORT',
      signalType: 'EXIT',
      entryPrice: 4.728,
    }))
  })

  it('returns noop for NOOP decisions without requiring referencePrice', () => {
    const result = adapter.fromDecision({ action: 'NOOP', reason: 'compiled.noop' }, {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
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

    expect(result).toEqual(expect.objectContaining({
      kind: 'missing_required_truth',
      reasonCode: 'RUNTIME_SIGNAL_REFERENCE_PRICE_MISSING',
      fields: expect.arrayContaining(['referencePrice']),
    }))
  })

  it('returns missing_required_truth when referencePrice is 0', () => {
    const result = adapter.fromDecision({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.1 },
      reason: 'compiled.entry',
    }, {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 0,
    })

    expect(result).toEqual(expect.objectContaining({
      kind: 'missing_required_truth',
      reasonCode: 'RUNTIME_SIGNAL_REFERENCE_PRICE_MISSING',
      fields: expect.arrayContaining(['referencePrice']),
    }))
  })

  it('returns missing_required_truth when size is missing', () => {
    const result = adapter.fromDecision({
      action: 'OPEN_LONG',
      reason: 'compiled.entry',
    }, {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 4.728,
    })

    expect(result).toEqual(expect.objectContaining({
      kind: 'missing_required_truth',
      reasonCode: 'RUNTIME_SIGNAL_SIZE_MISSING',
      fields: expect.arrayContaining(['size']),
    }))
  })

  it('returns missing_required_truth when action is unsupported', () => {
    const result = adapter.fromDecision({
      action: 'REBALANCE',
      reason: 'compiled.unsupported',
    }, {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 4.728,
    })

    expect(result).toEqual(expect.objectContaining({
      kind: 'missing_required_truth',
      reasonCode: 'RUNTIME_SIGNAL_ACTION_UNSUPPORTED',
      fields: expect.arrayContaining(['action']),
    }))
  })
})
