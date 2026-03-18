import { resolveFixedBinanceSmokeQuote } from './fixed-binance-smoke-quote'

describe('resolveFixedBinanceSmokeQuote', () => {
  it('returns explicit quote unchanged for entry steps', () => {
    expect(
      resolveFixedBinanceSmokeQuote(
        {
          signalType: 'ENTRY',
          positionSizeQuote: '8.25',
        },
        () => 0.5,
      ),
    ).toBe('8.25')
  })

  it('returns undefined for exit steps without explicit quote', () => {
    expect(
      resolveFixedBinanceSmokeQuote(
        {
          signalType: 'EXIT',
        },
        () => 0.5,
      ),
    ).toBeUndefined()
  })

  it('generates a bounded random quote for entry steps without explicit quote', () => {
    expect(
      resolveFixedBinanceSmokeQuote(
        {
          signalType: 'ENTRY',
        },
        () => 0,
      ),
    ).toBe('7.50')

    expect(
      resolveFixedBinanceSmokeQuote(
        {
          signalType: 'ENTRY',
        },
        () => 1,
      ),
    ).toBe('9.50')
  })
})
