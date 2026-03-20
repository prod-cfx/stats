import { parseFixedBinanceTestnetCliOptions } from './fixed-binance-testnet-signal-cli'

describe('parseFixedBinanceTestnetCliOptions', () => {
  it('maps open-spot preset to an executable single-step entry action', () => {
    const plan = parseFixedBinanceTestnetCliOptions(['--preset', 'open-spot'])

    expect(plan.mode).toBe('preset')
    expect(plan.steps).toEqual([
      expect.objectContaining({
        marketType: 'spot',
        signalType: 'ENTRY',
        direction: 'BUY',
        execute: true,
      }),
    ])
  })

  it('maps open-close-roundtrip preset with perp market to two executable steps', () => {
    const plan = parseFixedBinanceTestnetCliOptions([
      '--preset',
      'open-close-roundtrip',
      '--market',
      'perp',
      '--position-size-quote',
      '80',
    ])

    expect(plan.mode).toBe('preset')
    expect(plan.steps).toEqual([
      expect.objectContaining({
        marketType: 'perp',
        signalType: 'ENTRY',
        direction: 'BUY',
        positionSizeQuote: '80',
        execute: true,
      }),
      expect.objectContaining({
        marketType: 'perp',
        signalType: 'EXIT',
        direction: 'CLOSE_LONG',
        execute: true,
      }),
    ])
  })

  it('keeps legacy single-step mode when no preset is provided', () => {
    const plan = parseFixedBinanceTestnetCliOptions([
      '--market',
      'spot',
      '--signal-type',
      'ENTRY',
      '--direction',
      'BUY',
      '--execute',
    ])

    expect(plan.mode).toBe('single')
    expect(plan.steps).toEqual([
      expect.objectContaining({
        marketType: 'spot',
        signalType: 'ENTRY',
        direction: 'BUY',
        execute: true,
      }),
    ])
  })
})
