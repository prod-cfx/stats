import { CanonicalSpecV2DigestService } from '../canonical-spec-v2-digest.service'

describe('canonicalSpecV2DigestService', () => {
  const service = new CanonicalSpecV2DigestService()

  it('hashes canonical spec v2 deterministically for confirmation', () => {
    const digest = service.hash({
      version: 2,
      market: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        timeframe: '15m',
      },
      indicators: [
        {
          kind: 'ema',
          params: { fast: 7, slow: 21 },
        },
      ],
      sizing: {
        mode: 'RATIO',
        value: 0.1,
      },
      rules: [
        {
          id: 'entry-1',
          phase: 'entry',
          sideScope: 'long',
          priority: 200,
          condition: {
            kind: 'atom',
            key: 'ema_cross_up',
            params: { fast: 7, slow: 21 },
          },
          actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
        },
      ],
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: { requiredTimeframes: ['15m'] },
    } as never)

    expect(digest).toMatch(/^sha256:/)
    expect(service.hash({
      version: 2,
      dataRequirements: { requiredTimeframes: ['15m'] },
      executionPolicy: {
        fillTiming: 'NEXT_BAR_OPEN',
        signalTiming: 'BAR_CLOSE',
      },
      sizing: {
        value: 0.1,
        mode: 'RATIO',
      },
      indicators: [
        {
          params: { slow: 21, fast: 7 },
          kind: 'ema',
        },
      ],
      market: {
        timeframe: '15m',
        marketType: 'perp',
        symbol: 'BTCUSDT',
        exchange: 'okx',
      },
      rules: [
        {
          actions: [{ sizing: { value: 0.1, mode: 'RATIO' }, type: 'OPEN_LONG' }],
          condition: {
            params: { slow: 21, fast: 7 },
            key: 'ema_cross_up',
            kind: 'atom',
          },
          priority: 200,
          sideScope: 'long',
          phase: 'entry',
          id: 'entry-1',
        },
      ],
    } as never)).toBe(digest)
  })

  it('rejects non-v2 canonical specs', () => {
    expect(() => service.hash({
      version: 1,
      market: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        timeframe: '15m',
      },
      indicators: [],
      entries: [],
      exits: [],
      riskRules: [],
      sizing: null,
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        primary: ['15m'],
      },
    } as never)).toThrow('canonical_spec_v2_required')
  })
})
