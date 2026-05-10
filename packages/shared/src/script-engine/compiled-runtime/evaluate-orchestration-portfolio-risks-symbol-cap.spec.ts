/**
 * Phase 5 S8 (#1119): evaluateOrchestrationPortfolioRisks — symbol exposure cap cases
 *
 * Coverage (≥12 cases):
 *  1.  empty risks → no block
 *  2.  enforce + ratio < cap → no block
 *  3.  enforce + ratio = cap (exact boundary) → block_new_entries
 *  4.  enforce + ratio > cap → block_new_entries
 *  5.  observe + ratio > cap → observedBreaches only (no block)
 *  6.  enforce + reduce_exposure: ratio > cap → reduceFactorBySymbolScope, no block
 *  7.  enforce + reduce_exposure: multi-risk same ref → minimum factor (most strict)
 *  8.  reduce_exposure factor ≤ 0 (impossible path via normal contract) → factor positive
 *  9.  enforce + missing exposure map → fail-closed block
 * 10.  observe + missing exposure map → complete no-op
 * 11.  enforce + equity missing → fail-closed block
 * 12.  enforce + equity ≤ 0 → fail-closed block
 * 13.  enforce + invalid notionalCapPct (0) → fail-closed block bound scope
 * 14.  enforce + invalid ref (empty) → no scoped block (no ref to block)
 * 15.  two distinct symbol refs blocked independently
 */
import {
  type CompiledPortfolioSymbolExposureCapRisk,
  evaluateOrchestrationPortfolioRisks,
} from './evaluate-orchestration-portfolio-risks'

const symRisk = (overrides: Partial<CompiledPortfolioSymbolExposureCapRisk> = {}): CompiledPortfolioSymbolExposureCapRisk => ({
  id: 'sym-risk-1',
  scope: 'symbol',
  mode: 'enforce',
  notionalCapPct: 30,
  symbolScopeRef: 'scope-btcusdt-1',
  effectWhenTriggered: 'block_new_entries',
  ...overrides,
})

const ctx = (
  notional: number | undefined,
  equity: number | undefined,
  ref = 'scope-btcusdt-1',
) => ({
  exposureNotionalBySymbolScope: notional !== undefined ? { [ref]: notional } : undefined,
  accountEquity: equity,
})

describe('evaluateOrchestrationPortfolioRisks (symbol_exposure_cap)', () => {
  it('1. empty risks → no block, empty observedBreaches', () => {
    expect(evaluateOrchestrationPortfolioRisks([], ctx(1000, 10000))).toEqual({
      blockEntryLong: false,
      blockEntryShort: false,
      observedBreaches: [],
    })
  })

  it('2. enforce + ratio 20% < cap 30% → no block', () => {
    // notional=2000, equity=10000 → ratio=20%
    const result = evaluateOrchestrationPortfolioRisks([symRisk()], ctx(2000, 10000))
    expect(result.blockEntryLong).toBe(false)
    expect(result.blockEntryShort).toBe(false)
    expect(result.blockedSymbolScopeRefs?.size ?? 0).toBe(0)
    expect(result.observedBreaches).toEqual([])
  })

  it('3. enforce + ratio = cap exactly (30%) → block_new_entries', () => {
    // notional=3000, equity=10000 → ratio=30% = cap
    const result = evaluateOrchestrationPortfolioRisks([symRisk()], ctx(3000, 10000))
    expect(result.blockedSymbolScopeRefs?.has('scope-btcusdt-1')).toBe(true)
  })

  it('4. enforce + ratio 40% > cap 30% → block_new_entries', () => {
    // notional=4000, equity=10000 → ratio=40%
    const result = evaluateOrchestrationPortfolioRisks([symRisk()], ctx(4000, 10000))
    expect(result.blockedSymbolScopeRefs?.has('scope-btcusdt-1')).toBe(true)
    expect(result.blockEntryLong).toBe(false) // scoped block not global
    expect(result.blockEntryShort).toBe(false)
  })

  it('5. observe + ratio > cap → observedBreaches only, no block', () => {
    const result = evaluateOrchestrationPortfolioRisks(
      [symRisk({ mode: 'observe' })],
      ctx(4000, 10000),
    )
    expect(result.observedBreaches).toContain('sym-risk-1')
    expect(result.blockedSymbolScopeRefs?.size ?? 0).toBe(0)
    expect(result.blockEntryLong).toBe(false)
  })

  it('6. enforce + reduce_exposure: ratio > cap → reduceFactorBySymbolScope', () => {
    // notional=4000, equity=10000 → ratio=40%, cap=30% → factor=30/40=0.75
    const result = evaluateOrchestrationPortfolioRisks(
      [symRisk({ effectWhenTriggered: 'reduce_exposure' })],
      ctx(4000, 10000),
    )
    expect(result.blockedSymbolScopeRefs?.size ?? 0).toBe(0)
    const factor = result.reduceFactorBySymbolScope?.['scope-btcusdt-1']
    expect(factor).toBeCloseTo(0.75, 5)
    expect(result.blockEntryLong).toBe(false)
  })

  it('7. reduce_exposure: two risks same ref → minimum factor (most strict)', () => {
    // risk-a: cap=30, ratio=40 → factor=0.75
    // risk-b: cap=20, ratio=40 → factor=0.5 (more strict)
    const riskA = symRisk({ id: 'risk-a', notionalCapPct: 30, effectWhenTriggered: 'reduce_exposure' })
    const riskB = symRisk({ id: 'risk-b', notionalCapPct: 20, effectWhenTriggered: 'reduce_exposure' })
    const result = evaluateOrchestrationPortfolioRisks([riskA, riskB], ctx(4000, 10000))
    const factor = result.reduceFactorBySymbolScope?.['scope-btcusdt-1']
    expect(factor).toBeCloseTo(0.5, 5) // min(0.75, 0.5)
  })

  it('8. reduce_exposure: factor is always positive when cap > 0 and ratio > 0', () => {
    // cap=1%, ratio=100% → factor=0.01 (positive)
    const result = evaluateOrchestrationPortfolioRisks(
      [symRisk({ notionalCapPct: 1, effectWhenTriggered: 'reduce_exposure' })],
      ctx(10000, 10000),
    )
    const factor = result.reduceFactorBySymbolScope?.['scope-btcusdt-1']
    expect(factor).toBeGreaterThan(0)
    expect(factor).toBeCloseTo(0.01, 5)
  })

  it('9. enforce + missing exposure map → fail-closed block', () => {
    const result = evaluateOrchestrationPortfolioRisks([symRisk()], ctx(undefined, 10000))
    expect(result.blockedSymbolScopeRefs?.has('scope-btcusdt-1')).toBe(true)
  })

  it('10. observe + missing exposure map → complete no-op (not in observedBreaches)', () => {
    const result = evaluateOrchestrationPortfolioRisks(
      [symRisk({ mode: 'observe' })],
      ctx(undefined, 10000),
    )
    expect(result.observedBreaches).toEqual([])
    expect(result.blockedSymbolScopeRefs?.size ?? 0).toBe(0)
  })

  it('11. enforce + equity missing → fail-closed block', () => {
    const result = evaluateOrchestrationPortfolioRisks([symRisk()], ctx(4000, undefined))
    expect(result.blockedSymbolScopeRefs?.has('scope-btcusdt-1')).toBe(true)
  })

  it('12. enforce + equity ≤ 0 → fail-closed block', () => {
    const result = evaluateOrchestrationPortfolioRisks([symRisk()], ctx(4000, 0))
    expect(result.blockedSymbolScopeRefs?.has('scope-btcusdt-1')).toBe(true)
    const result2 = evaluateOrchestrationPortfolioRisks([symRisk()], ctx(4000, -100))
    expect(result2.blockedSymbolScopeRefs?.has('scope-btcusdt-1')).toBe(true)
  })

  it('13. enforce + invalid notionalCapPct (0) → fail-closed block bound scope', () => {
    const result = evaluateOrchestrationPortfolioRisks(
      [symRisk({ notionalCapPct: 0 })],
      ctx(4000, 10000),
    )
    expect(result.blockedSymbolScopeRefs?.has('scope-btcusdt-1')).toBe(true)
  })

  it('14. enforce + empty symbolScopeRef → no scoped block added', () => {
    const result = evaluateOrchestrationPortfolioRisks(
      [symRisk({ symbolScopeRef: '' })],
      ctx(4000, 10000),
    )
    expect(result.blockedSymbolScopeRefs?.size ?? 0).toBe(0)
  })

  it('15. two distinct symbol refs blocked independently', () => {
    const riskA = symRisk({ id: 'risk-a', symbolScopeRef: 'scope-btcusdt-1' })
    const riskB = symRisk({ id: 'risk-b', symbolScopeRef: 'scope-ethusdt-1' })
    const result = evaluateOrchestrationPortfolioRisks([riskA, riskB], {
      exposureNotionalBySymbolScope: {
        'scope-btcusdt-1': 4000,
        'scope-ethusdt-1': 5000,
      },
      accountEquity: 10000,
    })
    expect(result.blockedSymbolScopeRefs?.has('scope-btcusdt-1')).toBe(true)
    expect(result.blockedSymbolScopeRefs?.has('scope-ethusdt-1')).toBe(true)
    expect(result.blockEntryLong).toBe(false) // scoped not global
  })
})
