import { canConfirmSemanticView, readCanonicalDigest } from './canonical-confirmation'

describe('canonicalConfirmation', () => {
  const graph = {
    version: 1,
    status: 'draft' as const,
    trigger: [],
    actions: [],
    risk: [],
    meta: {
      exchange: 'okx' as const,
      symbol: 'BTCUSDT',
      timeframe: '15m',
      positionPct: 10,
    },
  }

  it('reads canonicalDigest directly from semantic view payload', () => {
    expect(readCanonicalDigest({
      canonicalDigest: 'sha256:canonical-1',
    })).toBe('sha256:canonical-1')
  })

  it('falls back to confirmation.digest when direct canonicalDigest is absent', () => {
    expect(readCanonicalDigest({
      confirmation: {
        digest: 'sha256:canonical-2',
      },
    })).toBe('sha256:canonical-2')
  })

  it('allows semantic view confirmation only when both graph and pending digest exist', () => {
    expect(canConfirmSemanticView({
      logicGraph: graph,
      pendingCanonicalDigest: 'sha256:canonical-1',
    })).toBe(true)

    expect(canConfirmSemanticView({
      logicGraph: null,
      pendingCanonicalDigest: 'sha256:canonical-1',
    })).toBe(false)

    expect(canConfirmSemanticView({
      logicGraph: graph,
      pendingCanonicalDigest: null,
    })).toBe(false)
  })
})
