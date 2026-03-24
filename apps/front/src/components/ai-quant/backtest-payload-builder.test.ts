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
    symbol: 'BTCUSDT',
    baseTimeframe: '15m',
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
      scriptCode: 'return { type: "NOOP" }',
      params: { buyDropPct: 1, sellRisePct: 2 },
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

  it('includes strategy protocolVersion=v1, scriptCode and params', () => {
    const payload = buildBacktestPayload(createInput(), now)

    expect(payload.strategy).toEqual({
      id: 'strategy-1',
      protocolVersion: 'v1',
      scriptCode: 'return { type: "NOOP" }',
      params: { buyDropPct: 1, sellRisePct: 2 },
    })
  })

  it('keeps bars fixed to empty list', () => {
    const payload = buildBacktestPayload(createInput(), now)

    expect(payload.bars).toEqual([])
  })

  it('throws when scriptCode is missing', () => {
    expectBuildErrorCode(() => {
      buildBacktestPayload(createInput({
        strategy: {
          id: 'strategy-1',
          scriptCode: '   ',
          params: {},
        },
      }), now)
    }, 'missing_script_code')
  })
})
