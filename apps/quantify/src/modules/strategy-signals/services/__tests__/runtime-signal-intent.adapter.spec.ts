import { RuntimeSignalIntentAdapter } from '../runtime-signal-intent.adapter'

describe('RuntimeSignalIntentAdapter', () => {
  const adapter = new RuntimeSignalIntentAdapter()
  const expectSignal = (result: ReturnType<RuntimeSignalIntentAdapter['fromDecision']>) => {
    expect(result.kind).toBe('signal')
    if (result.kind !== 'signal') {
      throw new Error(`expected signal result, received ${result.kind}`)
    }

    return result.signal
  }

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

    expect(expectSignal(result)).toEqual(expect.objectContaining({
      direction: 'BUY',
      signalType: 'ENTRY',
      positionSizeRatio: 0.1,
      entryPrice: 4.728,
      reasoning: 'compiled.entry',
    }))
  })

  it('maps OPEN_SHORT ratio decisions to entry SELL signals', () => {
    const result = adapter.fromDecision({
      action: 'OPEN_SHORT',
      size: { mode: 'RATIO', value: 0.2 },
      reason: 'compiled.short-entry',
    }, {
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 4.728,
    })

    expect(expectSignal(result)).toEqual(expect.objectContaining({
      direction: 'SELL',
      signalType: 'ENTRY',
      positionSizeRatio: 0.2,
      entryPrice: 4.728,
      reasoning: 'compiled.short-entry',
    }))
  })

  it('maps OPEN_LONG quote decisions to entry BUY signals with positionSizeQuote', () => {
    const result = adapter.fromDecision({
      action: 'OPEN_LONG',
      size: { mode: 'QUOTE', value: 100 },
      reason: 'compiled.quote-entry',
    }, {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 4.728,
    })

    expect(expectSignal(result)).toEqual(expect.objectContaining({
      direction: 'BUY',
      signalType: 'ENTRY',
      positionSizeQuote: 100,
      entryPrice: 4.728,
      reasoning: 'compiled.quote-entry',
    }))
  })

  it('drops invalid optional numeric signal fields', () => {
    const result = adapter.fromDecision({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.1 },
      reason: 'compiled.entry',
      confidence: Infinity,
      risk: {
        stopLoss: 0,
        takeProfit: Number.NaN,
      },
    }, {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 4.728,
    })

    const signal = expectSignal(result)
    expect(signal.confidence).toBeUndefined()
    expect(signal.stopLoss).toBeUndefined()
    expect(signal.takeProfit).toBeUndefined()
  })

  it('maps CLOSE_LONG decisions to CLOSE_LONG exit signals', () => {
    const result = adapter.fromDecision({
      action: 'CLOSE_LONG',
      reason: 'compiled.long-exit',
    }, {
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 4.728,
    })

    expect(expectSignal(result)).toEqual(expect.objectContaining({
      direction: 'CLOSE_LONG',
      signalType: 'EXIT',
      entryPrice: 4.728,
      reasoning: 'compiled.long-exit',
    }))
  })

  it('maps CLOSE_SHORT decisions to CLOSE_SHORT exit signals', () => {
    const result = adapter.fromDecision({
      action: 'CLOSE_SHORT',
      reason: 'compiled.short-exit',
    }, {
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 4.728,
    })

    expect(expectSignal(result)).toEqual(expect.objectContaining({
      direction: 'CLOSE_SHORT',
      signalType: 'EXIT',
      entryPrice: 4.728,
      reasoning: 'compiled.short-exit',
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

  it('returns missing_required_truth when NOOP reason is missing', () => {
    const result = adapter.fromDecision({ action: 'NOOP' }, {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
    })

    expect(result).toEqual(expect.objectContaining({
      kind: 'missing_required_truth',
      reasonCode: 'RUNTIME_SIGNAL_REASONING_MISSING',
      fields: expect.arrayContaining(['reason']),
    }))
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

  it('returns missing_required_truth when referencePrice is Infinity', () => {
    const result = adapter.fromDecision({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.1 },
      reason: 'compiled.entry',
    }, {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: Infinity,
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

  it('returns missing_required_truth when entry size mode is QTY', () => {
    const result = adapter.fromDecision({
      action: 'OPEN_LONG',
      size: { mode: 'QTY', value: 1 },
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
      reasonCode: 'RUNTIME_SIGNAL_ENTRY_SIZE_MODE_UNSUPPORTED',
      fields: expect.arrayContaining(['size.mode']),
    }))
  })

  it('returns missing_required_truth when entry size value is 0', () => {
    const result = adapter.fromDecision({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0 },
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
      reasonCode: 'RUNTIME_SIGNAL_ENTRY_SIZE_VALUE_INVALID',
      fields: expect.arrayContaining(['size.value']),
    }))
  })

  it('returns missing_required_truth when entry size value is negative', () => {
    const result = adapter.fromDecision({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: -1 },
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
      reasonCode: 'RUNTIME_SIGNAL_ENTRY_SIZE_VALUE_INVALID',
      fields: expect.arrayContaining(['size.value']),
    }))
  })

  it('returns missing_required_truth when reason is missing', () => {
    const result = adapter.fromDecision({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.1 },
    }, {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 4.728,
    })

    expect(result).toEqual(expect.objectContaining({
      kind: 'missing_required_truth',
      reasonCode: 'RUNTIME_SIGNAL_REASONING_MISSING',
      fields: expect.arrayContaining(['reason']),
    }))
  })

  it('maps ADJUST_POSITION delta decisions to adjustment signals', () => {
    const result = adapter.fromDecision({
      action: 'ADJUST_POSITION',
      adjustMode: 'DELTA',
      size: { mode: 'QTY', value: -0.4 },
      reason: 'compiled.reduce',
    }, {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 100,
    })

    expect(expectSignal(result)).toEqual(expect.objectContaining({
      direction: 'SELL',
      signalType: 'ADJUSTMENT',
      positionSizeQuote: 40,
      entryPrice: 100,
      reasoning: 'compiled.reduce',
    }))
  })

  it('maps ADJUST_POSITION target decisions using current quantity', () => {
    const result = adapter.fromDecision({
      action: 'ADJUST_POSITION',
      adjustMode: 'TARGET',
      size: { mode: 'QTY', value: -1 },
      reason: 'compiled.reverse',
    }, {
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      referencePrice: 100,
      currentQty: 2,
    })

    expect(expectSignal(result)).toEqual(expect.objectContaining({
      direction: 'SELL',
      signalType: 'ADJUSTMENT',
      positionSizeQuote: 300,
      entryPrice: 100,
      reasoning: 'compiled.reverse',
    }))
  })

  it('returns missing_required_truth when ADJUST_POSITION target current quantity is missing', () => {
    const result = adapter.fromDecision({
      action: 'ADJUST_POSITION',
      adjustMode: 'TARGET',
      size: { mode: 'QTY', value: 1 },
      reason: 'compiled.adjust',
    }, {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 4.728,
    })

    expect(result).toEqual(expect.objectContaining({
      kind: 'missing_required_truth',
      reasonCode: 'RUNTIME_SIGNAL_CURRENT_QTY_MISSING',
      fields: expect.arrayContaining(['currentQty']),
    }))
  })
})
