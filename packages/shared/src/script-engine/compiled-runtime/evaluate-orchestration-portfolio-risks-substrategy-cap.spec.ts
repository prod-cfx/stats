/**
 * Phase 5 S8 (#1119): evaluateOrchestrationPortfolioRisks — substrategy exposure cap cases
 *
 * Coverage (≥12 cases):
 *  1.  empty risks → no block
 *  2.  enforce + ratio < cap → no pause/block
 *  3.  enforce + ratio ≥ cap + pause_substrategy → pausedSubStrategyScopeRefs
 *  4.  enforce + ratio ≥ cap + block_new_entries → blockedSubStrategyScopeRefs
 *  5.  observe + ratio > cap → observedBreaches only (no pause/block)
 *  6.  enforce + missing exposure map + pause_substrategy → fail-closed pause
 *  7.  enforce + missing exposure map + block_new_entries → fail-closed block
 *  8.  observe + missing exposure map → complete no-op
 *  9.  enforce + equity missing → fail-closed pause
 * 10.  enforce + equity ≤ 0 → fail-closed pause
 * 11.  enforce + invalid notionalCapPct (0) → fail-closed pause bound scope
 * 12.  enforce + empty subStrategyScopeRef → no scoped block added
 * 13.  two distinct substrategy refs paused independently
 * 14.  pause and block refs are independent sets (no cross-contamination)
 */
import {
  type CompiledPortfolioSubStrategyExposureCapRisk,
  evaluateOrchestrationPortfolioRisks,
} from './evaluate-orchestration-portfolio-risks'

const subRisk = (
  overrides: Partial<CompiledPortfolioSubStrategyExposureCapRisk> = {},
): CompiledPortfolioSubStrategyExposureCapRisk => ({
  id: 'sub-risk-1',
  scope: 'subStrategy',
  mode: 'enforce',
  notionalCapPct: 40,
  subStrategyScopeRef: 'scope-trend-1',
  effectWhenTriggered: 'pause_substrategy',
  ...overrides,
})

const ctx = (
  notional: number | undefined,
  equity: number | undefined,
  ref = 'scope-trend-1',
) => ({
  exposureNotionalBySubStrategyScope: notional !== undefined ? { [ref]: notional } : undefined,
  accountEquity: equity,
})

describe('evaluateOrchestrationPortfolioRisks (substrategy_exposure_cap)', () => {
  it('1. empty risks → no block, empty observedBreaches', () => {
    expect(evaluateOrchestrationPortfolioRisks([], ctx(1000, 10000))).toEqual({
      blockEntryLong: false,
      blockEntryShort: false,
      observedBreaches: [],
    })
  })

  it('2. enforce + ratio 30% < cap 40% → no pause/block', () => {
    // notional=3000, equity=10000 → ratio=30%
    const result = evaluateOrchestrationPortfolioRisks([subRisk()], ctx(3000, 10000))
    expect(result.pausedSubStrategyScopeRefs?.size ?? 0).toBe(0)
    expect(result.blockedSubStrategyScopeRefs?.size ?? 0).toBe(0)
    expect(result.observedBreaches).toEqual([])
    expect(result.blockEntryLong).toBe(false)
  })

  it('3. enforce + ratio ≥ cap + pause_substrategy → pausedSubStrategyScopeRefs', () => {
    // notional=5000, equity=10000 → ratio=50% ≥ cap 40%
    const result = evaluateOrchestrationPortfolioRisks(
      [subRisk({ effectWhenTriggered: 'pause_substrategy' })],
      ctx(5000, 10000),
    )
    expect(result.pausedSubStrategyScopeRefs?.has('scope-trend-1')).toBe(true)
    expect(result.blockedSubStrategyScopeRefs?.size ?? 0).toBe(0)
    expect(result.blockEntryLong).toBe(false) // scoped not global
  })

  it('4. enforce + ratio ≥ cap + block_new_entries → blockedSubStrategyScopeRefs', () => {
    const result = evaluateOrchestrationPortfolioRisks(
      [subRisk({ effectWhenTriggered: 'block_new_entries' })],
      ctx(5000, 10000),
    )
    expect(result.blockedSubStrategyScopeRefs?.has('scope-trend-1')).toBe(true)
    expect(result.pausedSubStrategyScopeRefs?.size ?? 0).toBe(0)
    expect(result.blockEntryLong).toBe(false)
  })

  it('5. observe + ratio > cap → observedBreaches only, no pause/block', () => {
    const result = evaluateOrchestrationPortfolioRisks(
      [subRisk({ mode: 'observe' })],
      ctx(5000, 10000),
    )
    expect(result.observedBreaches).toContain('sub-risk-1')
    expect(result.pausedSubStrategyScopeRefs?.size ?? 0).toBe(0)
    expect(result.blockedSubStrategyScopeRefs?.size ?? 0).toBe(0)
  })

  it('6. enforce + missing exposure map + pause_substrategy → fail-closed pause', () => {
    const result = evaluateOrchestrationPortfolioRisks([subRisk()], ctx(undefined, 10000))
    expect(result.pausedSubStrategyScopeRefs?.has('scope-trend-1')).toBe(true)
  })

  it('7. enforce + missing exposure map + block_new_entries → fail-closed block', () => {
    const result = evaluateOrchestrationPortfolioRisks(
      [subRisk({ effectWhenTriggered: 'block_new_entries' })],
      ctx(undefined, 10000),
    )
    expect(result.blockedSubStrategyScopeRefs?.has('scope-trend-1')).toBe(true)
  })

  it('8. observe + missing exposure map → complete no-op (not in observedBreaches)', () => {
    const result = evaluateOrchestrationPortfolioRisks(
      [subRisk({ mode: 'observe' })],
      ctx(undefined, 10000),
    )
    expect(result.observedBreaches).toEqual([])
    expect(result.pausedSubStrategyScopeRefs?.size ?? 0).toBe(0)
  })

  it('9. enforce + equity missing → fail-closed pause', () => {
    const result = evaluateOrchestrationPortfolioRisks([subRisk()], ctx(5000, undefined))
    expect(result.pausedSubStrategyScopeRefs?.has('scope-trend-1')).toBe(true)
  })

  it('10. enforce + equity ≤ 0 → fail-closed pause', () => {
    const result = evaluateOrchestrationPortfolioRisks([subRisk()], ctx(5000, 0))
    expect(result.pausedSubStrategyScopeRefs?.has('scope-trend-1')).toBe(true)
    const result2 = evaluateOrchestrationPortfolioRisks([subRisk()], ctx(5000, -100))
    expect(result2.pausedSubStrategyScopeRefs?.has('scope-trend-1')).toBe(true)
  })

  it('11. enforce + invalid notionalCapPct (0) → fail-closed pause bound scope', () => {
    const result = evaluateOrchestrationPortfolioRisks(
      [subRisk({ notionalCapPct: 0 })],
      ctx(5000, 10000),
    )
    expect(result.pausedSubStrategyScopeRefs?.has('scope-trend-1')).toBe(true)
  })

  it('12. enforce + empty subStrategyScopeRef → no scoped set added', () => {
    const result = evaluateOrchestrationPortfolioRisks(
      [subRisk({ subStrategyScopeRef: '' })],
      ctx(5000, 10000),
    )
    expect(result.pausedSubStrategyScopeRefs?.size ?? 0).toBe(0)
    expect(result.blockedSubStrategyScopeRefs?.size ?? 0).toBe(0)
  })

  it('13. two distinct substrategy refs paused independently', () => {
    const riskA = subRisk({ id: 'risk-a', subStrategyScopeRef: 'scope-trend-1' })
    const riskB = subRisk({ id: 'risk-b', subStrategyScopeRef: 'scope-mean-revert-1' })
    const result = evaluateOrchestrationPortfolioRisks([riskA, riskB], {
      exposureNotionalBySubStrategyScope: {
        'scope-trend-1': 5000,
        'scope-mean-revert-1': 6000,
      },
      accountEquity: 10000,
    })
    expect(result.pausedSubStrategyScopeRefs?.has('scope-trend-1')).toBe(true)
    expect(result.pausedSubStrategyScopeRefs?.has('scope-mean-revert-1')).toBe(true)
    expect(result.blockEntryLong).toBe(false) // scoped not global
  })

  it('14. pause and block refs are independent sets', () => {
    const riskPause = subRisk({ id: 'risk-pause', subStrategyScopeRef: 'scope-trend-1', effectWhenTriggered: 'pause_substrategy' })
    const riskBlock = subRisk({ id: 'risk-block', subStrategyScopeRef: 'scope-osc-1', effectWhenTriggered: 'block_new_entries' })
    const result = evaluateOrchestrationPortfolioRisks([riskPause, riskBlock], {
      exposureNotionalBySubStrategyScope: {
        'scope-trend-1': 5000,
        'scope-osc-1': 5000,
      },
      accountEquity: 10000,
    })
    expect(result.pausedSubStrategyScopeRefs?.has('scope-trend-1')).toBe(true)
    expect(result.pausedSubStrategyScopeRefs?.has('scope-osc-1')).toBe(false)
    expect(result.blockedSubStrategyScopeRefs?.has('scope-osc-1')).toBe(true)
    expect(result.blockedSubStrategyScopeRefs?.has('scope-trend-1')).toBe(false)
  })
})
