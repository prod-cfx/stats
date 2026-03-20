import { parseFixedHyperliquidTestnetCliOptions } from './fixed-hyperliquid-testnet-signal-cli'

describe('parseFixedHyperliquidTestnetCliOptions', () => {
  it('maps open-perp preset to a single executable entry step', () => {
    const plan = parseFixedHyperliquidTestnetCliOptions(['--preset', 'open-perp'])

    expect(plan.mode).toBe('preset')
    expect(plan.steps).toEqual([
      expect.objectContaining({
        marketType: 'perp',
        signalType: 'ENTRY',
        direction: 'BUY',
        execute: true,
      }),
    ])
  })

  it('maps open-close-roundtrip preset to entry and exit steps', () => {
    const plan = parseFixedHyperliquidTestnetCliOptions([
      '--preset',
      'open-close-roundtrip',
      '--position-size-quote',
      '20',
    ])

    expect(plan.mode).toBe('preset')
    expect(plan.steps).toEqual([
      expect.objectContaining({
        marketType: 'perp',
        signalType: 'ENTRY',
        direction: 'BUY',
        execute: true,
        positionSizeQuote: '20',
      }),
      expect.objectContaining({
        marketType: 'perp',
        signalType: 'EXIT',
        direction: 'CLOSE_LONG',
        execute: true,
      }),
    ])
  })

  it('maps open-close-spot-roundtrip preset to spot entry and exit steps', () => {
    const plan = parseFixedHyperliquidTestnetCliOptions([
      '--preset',
      'open-close-spot-roundtrip',
      '--position-size-quote',
      '12',
    ])

    expect(plan.mode).toBe('preset')
    expect(plan.steps).toEqual([
      expect.objectContaining({
        marketType: 'spot',
        signalType: 'ENTRY',
        direction: 'BUY',
        execute: true,
        positionSizeQuote: '12',
      }),
      expect.objectContaining({
        marketType: 'spot',
        signalType: 'EXIT',
        direction: 'CLOSE_LONG',
        execute: true,
      }),
    ])
  })

  it('returns single-step mode when no preset provided', () => {
    const plan = parseFixedHyperliquidTestnetCliOptions([
      '--market',
      'perp',
      '--signal-type',
      'ENTRY',
      '--direction',
      'BUY',
      '--execute',
    ])

    expect(plan.mode).toBe('single')
    expect(plan.steps).toEqual([
      expect.objectContaining({
        marketType: 'perp',
        signalType: 'ENTRY',
        direction: 'BUY',
        execute: true,
      }),
    ])
  })
})
