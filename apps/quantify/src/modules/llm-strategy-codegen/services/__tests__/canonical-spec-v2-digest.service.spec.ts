import { CanonicalSpecV2DigestService } from '../canonical-spec-v2-digest.service'

describe('canonicalSpecV2DigestService', () => {
  const service = new CanonicalSpecV2DigestService()

  it('hashes canonical spec v2 deterministically for confirmation', () => {
    const digest = service.hash({
      version: 2,
      rules: [
        {
          id: 'entry-1',
          phase: 'entry',
          sideScope: 'long',
          priority: 200,
          condition: { kind: 'atom', key: 'ema_cross_up' },
          actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
        },
      ],
      executionPolicy: { signalEvaluation: 'bar_close' },
      dataRequirements: { primaryTimeframe: '15m' },
    } as never)

    expect(digest).toMatch(/^sha256:/)
    expect(service.hash({
      version: 2,
      rules: [
        {
          id: 'entry-1',
          phase: 'entry',
          sideScope: 'long',
          priority: 200,
          condition: { kind: 'atom', key: 'ema_cross_up' },
          actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
        },
      ],
      executionPolicy: { signalEvaluation: 'bar_close' },
      dataRequirements: { primaryTimeframe: '15m' },
    } as never)).toBe(digest)
  })
})
