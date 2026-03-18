interface FixedBinanceSmokeQuoteInput {
  signalType: 'ENTRY' | 'EXIT'
  positionSizeQuote?: string
}

const FIXED_BINANCE_SMOKE_QUOTE_MIN = 7.5
const FIXED_BINANCE_SMOKE_QUOTE_MAX = 9.5

export function resolveFixedBinanceSmokeQuote(
  input: FixedBinanceSmokeQuoteInput,
  random: () => number = Math.random,
): string | undefined {
  if (input.positionSizeQuote)
    return input.positionSizeQuote

  if (input.signalType !== 'ENTRY')
    return undefined

  const normalizedRandom = Math.min(1, Math.max(0, random()))
  const quote =
    FIXED_BINANCE_SMOKE_QUOTE_MIN
    + (FIXED_BINANCE_SMOKE_QUOTE_MAX - FIXED_BINANCE_SMOKE_QUOTE_MIN) * normalizedRandom

  return quote.toFixed(2)
}

export const FIXED_BINANCE_SMOKE_QUOTE_RANGE = {
  min: FIXED_BINANCE_SMOKE_QUOTE_MIN,
  max: FIXED_BINANCE_SMOKE_QUOTE_MAX,
}
