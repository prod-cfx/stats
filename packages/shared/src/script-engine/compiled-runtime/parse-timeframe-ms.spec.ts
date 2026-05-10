import { parseTimeframeMs, SUPPORTED_TIMEFRAMES, TIMEFRAME_MS } from './parse-timeframe-ms'

describe('parseTimeframeMs (Phase 5 S3 #1109)', () => {
  it('round-trips all 14 supported timeframes to milliseconds', () => {
    expect(parseTimeframeMs('1m')).toBe(60_000)
    expect(parseTimeframeMs('3m')).toBe(180_000)
    expect(parseTimeframeMs('5m')).toBe(300_000)
    expect(parseTimeframeMs('15m')).toBe(900_000)
    expect(parseTimeframeMs('30m')).toBe(1_800_000)
    expect(parseTimeframeMs('1h')).toBe(3_600_000)
    expect(parseTimeframeMs('2h')).toBe(7_200_000)
    expect(parseTimeframeMs('4h')).toBe(14_400_000)
    expect(parseTimeframeMs('6h')).toBe(21_600_000)
    expect(parseTimeframeMs('8h')).toBe(28_800_000)
    expect(parseTimeframeMs('12h')).toBe(43_200_000)
    expect(parseTimeframeMs('1d')).toBe(86_400_000)
    expect(parseTimeframeMs('3d')).toBe(259_200_000)
    expect(parseTimeframeMs('1w')).toBe(604_800_000)
  })

  it('returns null for unknown timeframes', () => {
    expect(parseTimeframeMs('2m')).toBeNull()
    expect(parseTimeframeMs('99h')).toBeNull()
    expect(parseTimeframeMs('1y')).toBeNull()
    expect(parseTimeframeMs('')).toBeNull()
  })

  it('returns null for non-string input', () => {
    expect(parseTimeframeMs(undefined as unknown)).toBeNull()
    expect(parseTimeframeMs(null as unknown)).toBeNull()
    expect(parseTimeframeMs(15 as unknown)).toBeNull()
    expect(parseTimeframeMs({} as unknown)).toBeNull()
  })

  it('rejects prototype-chain pollution lookups', () => {
    expect(parseTimeframeMs('__proto__')).toBeNull()
    expect(parseTimeframeMs('constructor')).toBeNull()
    expect(parseTimeframeMs('hasOwnProperty')).toBeNull()
    expect(parseTimeframeMs('toString')).toBeNull()
  })

  it('SUPPORTED_TIMEFRAMES is derived from TIMEFRAME_MS keys', () => {
    expect([...SUPPORTED_TIMEFRAMES].sort()).toEqual(Object.keys(TIMEFRAME_MS).sort())
    expect(SUPPORTED_TIMEFRAMES.length).toBe(14)
  })

  it('TIMEFRAME_MS values strictly increase by canonical order', () => {
    const ordered = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w']
    for (let i = 1; i < ordered.length; i++) {
      expect(TIMEFRAME_MS[ordered[i]]).toBeGreaterThan(TIMEFRAME_MS[ordered[i - 1]])
    }
  })
})
