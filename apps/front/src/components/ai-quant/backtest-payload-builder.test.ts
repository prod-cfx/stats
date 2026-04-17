import type {
  BacktestPayloadBuilderErrorCode,
  BuildBacktestPayloadInput,
} from './backtest-payload-builder'
import {
  buildBacktestPayload,
  isBacktestPayloadBuilderError,
} from './backtest-payload-builder'

function createInput(overrides: Partial<BuildBacktestPayloadInput> = {}): BuildBacktestPayloadInput {
  return {
    marketType: 'perp',
    symbol: 'BTCUSDT',
    baseTimeframe: '15m',
    capabilities: {
      allowedSymbols: ['BTCUSDT', 'ETHUSDT'],
      allowedBaseTimeframes: ['15m', '1h'],
    },
    stateTimeframes: ['15m'],
    initialCash: 10000,
    leverage: 1,
    execution: {
      slippageBps: 10,
      feeBps: 5,
      priceSource: 'close',
    },
    strategy: {
      id: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
    },
    range: {
      preset: '30D',
    },
    ...overrides,
  }
}

describe('backtest-payload-builder', () => {
  const now = new Date('2026-03-24T12:00:00.000Z')

  function expectBuildErrorCode(fn: () => unknown, code: BacktestPayloadBuilderErrorCode) {
    try {
      fn()
      throw new Error('expected buildBacktestPayload to throw')
    } catch (error) {
      expect(isBacktestPayloadBuilderError(error)).toBe(true)
      if (isBacktestPayloadBuilderError(error)) {
        expect(error.code).toBe(code)
      }
    }
  }

  it('maps symbol into symbols[0]', () => {
    const payload = buildBacktestPayload(createInput(), now)

    expect(payload.symbols).toEqual(['BTCUSDT'])
  })

  it('maps preset range into valid fromTs/toTs', () => {
    const payload = buildBacktestPayload(createInput({ range: { preset: '7D' } }), now)

    expect(payload.dataRange).toEqual({
      fromTs: Date.parse('2026-03-17T12:00:00.000Z'),
      toTs: Date.parse('2026-03-24T12:00:00.000Z'),
    })
    expect(payload.dataRange.fromTs).toBeLessThan(payload.dataRange.toTs)
  })

  it('aligns preset range to the selected base timeframe boundary', () => {
    const payload = buildBacktestPayload(createInput({ range: { preset: '30D' } }), new Date('2026-04-02T09:37:12.000Z'))

    expect(payload.dataRange).toEqual({
      fromTs: Date.parse('2026-03-03T09:30:00.000Z'),
      toTs: Date.parse('2026-04-02T09:30:00.000Z'),
    })
  })

  it('aligns preset range with the trimmed base timeframe value', () => {
    const payload = buildBacktestPayload(
      createInput({
        baseTimeframe: ' 15m ',
        range: { preset: '30D' },
      }),
      new Date('2026-04-02T09:37:12.000Z'),
    )

    expect(payload.baseTimeframe).toBe('15m')
    expect(payload.dataRange).toEqual({
      fromTs: Date.parse('2026-03-03T09:30:00.000Z'),
      toTs: Date.parse('2026-04-02T09:30:00.000Z'),
    })
  })

  it('validates custom range ordering', () => {
    expectBuildErrorCode(() => {
      buildBacktestPayload(createInput({
        range: {
          preset: 'CUSTOM',
          startAt: '2026-03-25T12:00:00.000Z',
          endAt: '2026-03-24T12:00:00.000Z',
        },
      }), now)
    }, 'start_after_end')
  })

  it('maps valid custom range into fromTs/toTs', () => {
    const payload = buildBacktestPayload(createInput({
      range: {
        preset: 'CUSTOM',
        startAt: '2026-03-01T08:30:00.000Z',
        endAt: '2026-03-20T09:45:00.000Z',
      },
    }), now)

    expect(payload.dataRange).toEqual({
      fromTs: Date.parse('2026-03-01T08:30:00.000Z'),
      toTs: Date.parse('2026-03-20T09:45:00.000Z'),
    })
  })

  it('rejects custom range when timeframe normalization collapses it to an empty interval', () => {
    expectBuildErrorCode(() => {
      buildBacktestPayload(createInput({
        baseTimeframe: '3m',
        capabilities: {
          allowedSymbols: ['BTCUSDT', 'ETHUSDT'],
          allowedBaseTimeframes: ['3m', '15m', '1h'],
        },
        range: {
          preset: 'CUSTOM',
          startAt: '2026-03-15T04:24:01.000Z',
          endAt: '2026-03-15T04:24:49.000Z',
        },
      }), now)
    }, 'start_after_end')
  })

  it('includes strategy protocolVersion=v1 and publishedSnapshotId only', () => {
    const payload = buildBacktestPayload(createInput(), now)

    expect(payload.strategy).toEqual({
      id: 'strategy-1',
      protocolVersion: 'v1',
      publishedSnapshotId: 'snapshot-1',
      params: {
        marketType: 'perp',
      },
    })
  })

  it('does not include legacy bars payload field', () => {
    const payload = buildBacktestPayload(createInput(), now)

    expect('bars' in payload).toBe(false)
  })

  it('includes allowPartial only when explicitly enabled', () => {
    const withPartial = buildBacktestPayload(createInput({ allowPartial: true }), now)
    const withoutPartial = buildBacktestPayload(createInput(), now)

    expect(withPartial.allowPartial).toBe(true)
    expect('allowPartial' in withoutPartial).toBe(false)
  })

  it('throws when published snapshot id is missing', () => {
    expectBuildErrorCode(() => {
      buildBacktestPayload(createInput({
        strategy: {
          id: 'strategy-1',
          publishedSnapshotId: '   ',
        },
      }), now)
    }, 'missing_published_snapshot')
  })

  it('throws when execution config is invalid', () => {
    expectBuildErrorCode(() => {
      buildBacktestPayload(createInput({
        initialCash: Number.NaN,
      }), now)
    }, 'invalid_execution_config')
  })

  it('keeps strategy symbol even when capability symbols are narrower', () => {
    const payload = buildBacktestPayload(createInput({
      symbol: 'ETHUSDC',
      capabilities: {
        allowedSymbols: ['BTCUSDT'],
        allowedBaseTimeframes: ['15m', '1h'],
      },
    }), now)

    expect(payload.symbols).toEqual(['ETHUSDC'])
  })

  it('throws when baseTimeframe is not allowed by capability constraints', () => {
    expectBuildErrorCode(() => {
      buildBacktestPayload(createInput({
        baseTimeframe: '4h',
      }), now)
    }, 'timeframe_not_allowed')
  })
})
