import type { CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec'
import { ErrorCode } from '@ai/shared'
import { SizingEvidenceMissingException } from '../../exceptions/sizing-evidence-missing.exception'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'

/** Minimal spec helper — only entry rule, no sizing anywhere */
function buildSpecWithoutSizing(actionType: 'OPEN_LONG' | 'OPEN_SHORT' | 'ADD_LONG' | 'ADD_SHORT'): CanonicalStrategySpecV2 {
  return {
    version: 2,
    market: { exchange: 'binance', symbol: 'BTCUSDT', defaultTimeframe: '1h' },
    sizing: undefined,
    rules: [
      {
        id: 'entry_rule',
        priority: 200,
        condition: {
          kind: 'atom',
          atomKey: 'CROSS_OVER',
          params: {},
          expression: 'CROSS_OVER(CLOSE, EMA(CLOSE, 20))',
        },
        actions: [{ type: actionType }],
      },
    ],
  } as unknown as CanonicalStrategySpecV2
}

/** Minimal spec helper — entry rule with explicit sizing */
function buildSpecWithSizing(): CanonicalStrategySpecV2 {
  return {
    version: 2,
    market: { exchange: 'binance', symbol: 'BTCUSDT', defaultTimeframe: '1h' },
    sizing: { mode: 'QUOTE', value: 100, asset: 'USDT' },
    rules: [
      {
        id: 'entry_rule',
        priority: 200,
        condition: {
          kind: 'atom',
          atomKey: 'CROSS_OVER',
          params: {},
          expression: 'CROSS_OVER(CLOSE, EMA(CLOSE, 20))',
        },
        actions: [{ type: 'OPEN_LONG' }],
      },
    ],
  } as unknown as CanonicalStrategySpecV2
}

const FALLBACK = { exchange: 'binance' as const, symbol: 'BTCUSDT', baseTimeframe: '1h', positionPct: 10 }
const FALLBACK_ZERO = { ...FALLBACK, positionPct: 0 }

describe('CanonicalSpecV2IrCompilerService — sizing evidence compile-time guard (#1230)', () => {
  const compiler = new CanonicalSpecV2IrCompilerService()

  describe('throws SizingEvidenceMissingException', () => {
    it('when spec.sizing is absent and fallbackPositionPct is 0 — OPEN_LONG', () => {
      expect(() =>
        compiler.compile({ canonicalSpec: buildSpecWithoutSizing('OPEN_LONG'), fallback: FALLBACK_ZERO }),
      ).toThrow(SizingEvidenceMissingException)
    })

    it('carries SIZING_EVIDENCE_MISSING error code', () => {
      try {
        compiler.compile({ canonicalSpec: buildSpecWithoutSizing('OPEN_LONG'), fallback: FALLBACK_ZERO })
      }
      catch (err) {
        expect(err).toBeInstanceOf(SizingEvidenceMissingException)
        expect((err as SizingEvidenceMissingException).code).toBe(ErrorCode.SIZING_EVIDENCE_MISSING)
      }
    })

    it('when spec.sizing is absent and fallbackPositionPct is 0 — OPEN_SHORT', () => {
      expect(() =>
        compiler.compile({ canonicalSpec: buildSpecWithoutSizing('OPEN_SHORT'), fallback: FALLBACK_ZERO }),
      ).toThrow(SizingEvidenceMissingException)
    })

    it('when spec.sizing is absent and fallbackPositionPct is 0 — ADD_LONG (#1232 Round 1 M4)', () => {
      expect(() =>
        compiler.compile({ canonicalSpec: buildSpecWithoutSizing('ADD_LONG'), fallback: FALLBACK_ZERO }),
      ).toThrow(SizingEvidenceMissingException)
    })

    it('when spec.sizing is absent and fallbackPositionPct is 0 — ADD_SHORT (#1232 Round 1 M4)', () => {
      expect(() =>
        compiler.compile({ canonicalSpec: buildSpecWithoutSizing('ADD_SHORT'), fallback: FALLBACK_ZERO }),
      ).toThrow(SizingEvidenceMissingException)
    })
  })

  describe('does NOT throw', () => {
    it('when spec.sizing is present', () => {
      expect(() =>
        compiler.compile({ canonicalSpec: buildSpecWithSizing(), fallback: FALLBACK_ZERO }),
      ).not.toThrow(SizingEvidenceMissingException)
    })

    it('when fallbackPositionPct is non-zero and spec.sizing is absent', () => {
      expect(() =>
        compiler.compile({ canonicalSpec: buildSpecWithoutSizing('OPEN_LONG'), fallback: FALLBACK }),
      ).not.toThrow(SizingEvidenceMissingException)
    })
  })
})
