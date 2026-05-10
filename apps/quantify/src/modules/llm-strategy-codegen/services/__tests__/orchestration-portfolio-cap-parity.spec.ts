import type { CompiledOrchestrationPortfolioRisk } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks'
import { evaluateOrchestrationPortfolioRisks } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks'

/**
 * Phase 5 S8 (#1119): portfolioRisk exposure cap — backtest vs live-signal parity
 *
 * 5 parity cases comparing backtest (full evaluate) vs live-signal (observe-only filter) behavior:
 *  P1. symbol enforce + breach → backtest blocks scope, live-signal filters enforce → no scope block
 *  P2. symbol observe + breach → both return observedBreaches (observe passes through in both)
 *  P3. substrategy enforce + breach → backtest pauses scope, live-signal filters enforce → no scope pause
 *  P4. substrategy observe + breach → both return observedBreaches
 *  P5. mixed enforce+observe: backtest enforces both; live-signal: enforce filtered out, observe remains
 *
 * "live-signal" behavior is simulated by filtering out mode='enforce' symbol/subStrategy risks
 * before calling the evaluator (matching filterPortfolioRisksForLiveSignal() logic from T14).
 */

const SYMBOL_SCOPE = 'scope-btcusdt-1'
const SUBSTRATEGY_SCOPE = 'scope-trend-1'

/** Mirrors filterPortfolioRisksForLiveSignal() from signal-generator.service.ts */
function filterForLiveSignal(risks: CompiledOrchestrationPortfolioRisk[]): CompiledOrchestrationPortfolioRisk[] {
  return risks.filter((r) => {
    if (r.scope === 'symbol' || r.scope === 'subStrategy') {
      return r.mode === 'observe'
    }
    return true
  })
}

describe('orchestration portfolio cap — backtest vs live-signal parity (Phase 5 S8 #1119)', () => {
  it('P1. symbol enforce + breach: backtest blocks scope; live-signal observe-only → no scope block', () => {
    const risks: CompiledOrchestrationPortfolioRisk[] = [{
      id: 'risk-sym-enforce-1',
      scope: 'symbol',
      mode: 'enforce',
      notionalCapPct: 30,
      symbolScopeRef: SYMBOL_SCOPE,
      effectWhenTriggered: 'block_new_entries',
    }]

    const ctx = {
      exposureNotionalBySymbolScope: { [SYMBOL_SCOPE]: 4000 },
      accountEquity: 10000,
    }

    // Backtest: enforce fully applied → scope blocked
    const backtestResult = evaluateOrchestrationPortfolioRisks(risks, ctx)
    expect(backtestResult.blockedSymbolScopeRefs?.has(SYMBOL_SCOPE)).toBe(true)
    expect(backtestResult.observedBreaches).toEqual([])

    // Live-signal: enforce filtered out → evaluator sees empty list → no block
    const liveRisks = filterForLiveSignal(risks)
    expect(liveRisks).toHaveLength(0)
    const liveResult = evaluateOrchestrationPortfolioRisks(liveRisks, ctx)
    expect(liveResult.blockedSymbolScopeRefs?.size ?? 0).toBe(0)
    expect(liveResult.blockEntryLong).toBe(false)
  })

  it('P2. symbol observe + breach: both backtest and live-signal produce observedBreaches', () => {
    const risks: CompiledOrchestrationPortfolioRisk[] = [{
      id: 'risk-sym-observe-1',
      scope: 'symbol',
      mode: 'observe',
      notionalCapPct: 30,
      symbolScopeRef: SYMBOL_SCOPE,
      effectWhenTriggered: 'block_new_entries',
    }]

    const ctx = {
      exposureNotionalBySymbolScope: { [SYMBOL_SCOPE]: 4000 },
      accountEquity: 10000,
    }

    // Backtest: observe → no block, only observedBreaches
    const backtestResult = evaluateOrchestrationPortfolioRisks(risks, ctx)
    expect(backtestResult.observedBreaches).toContain('risk-sym-observe-1')
    expect(backtestResult.blockedSymbolScopeRefs?.size ?? 0).toBe(0)

    // Live-signal: observe passes filter → same result
    const liveRisks = filterForLiveSignal(risks)
    expect(liveRisks).toHaveLength(1) // observe risk passes through
    const liveResult = evaluateOrchestrationPortfolioRisks(liveRisks, ctx)
    expect(liveResult.observedBreaches).toContain('risk-sym-observe-1')
    expect(liveResult.blockedSymbolScopeRefs?.size ?? 0).toBe(0)
  })

  it('P3. substrategy enforce + breach: backtest pauses scope; live-signal filters enforce → no pause', () => {
    const risks: CompiledOrchestrationPortfolioRisk[] = [{
      id: 'risk-sub-enforce-1',
      scope: 'subStrategy',
      mode: 'enforce',
      notionalCapPct: 40,
      subStrategyScopeRef: SUBSTRATEGY_SCOPE,
      effectWhenTriggered: 'pause_substrategy',
    }]

    const ctx = {
      exposureNotionalBySubStrategyScope: { [SUBSTRATEGY_SCOPE]: 5000 },
      accountEquity: 10000,
    }

    // Backtest: enforce fully applied → scope paused
    const backtestResult = evaluateOrchestrationPortfolioRisks(risks, ctx)
    expect(backtestResult.pausedSubStrategyScopeRefs?.has(SUBSTRATEGY_SCOPE)).toBe(true)
    expect(backtestResult.observedBreaches).toEqual([])

    // Live-signal: enforce filtered out → no pause
    const liveRisks = filterForLiveSignal(risks)
    expect(liveRisks).toHaveLength(0)
    const liveResult = evaluateOrchestrationPortfolioRisks(liveRisks, ctx)
    expect(liveResult.pausedSubStrategyScopeRefs?.size ?? 0).toBe(0)
  })

  it('P4. substrategy observe + breach: both backtest and live-signal produce observedBreaches', () => {
    const risks: CompiledOrchestrationPortfolioRisk[] = [{
      id: 'risk-sub-observe-1',
      scope: 'subStrategy',
      mode: 'observe',
      notionalCapPct: 40,
      subStrategyScopeRef: SUBSTRATEGY_SCOPE,
      effectWhenTriggered: 'pause_substrategy',
    }]

    const ctx = {
      exposureNotionalBySubStrategyScope: { [SUBSTRATEGY_SCOPE]: 5000 },
      accountEquity: 10000,
    }

    // Backtest: observe → observedBreaches only
    const backtestResult = evaluateOrchestrationPortfolioRisks(risks, ctx)
    expect(backtestResult.observedBreaches).toContain('risk-sub-observe-1')
    expect(backtestResult.pausedSubStrategyScopeRefs?.size ?? 0).toBe(0)

    // Live-signal: observe passes filter → same result
    const liveRisks = filterForLiveSignal(risks)
    expect(liveRisks).toHaveLength(1)
    const liveResult = evaluateOrchestrationPortfolioRisks(liveRisks, ctx)
    expect(liveResult.observedBreaches).toContain('risk-sub-observe-1')
    expect(liveResult.pausedSubStrategyScopeRefs?.size ?? 0).toBe(0)
  })

  it('P5. mixed enforce+observe: backtest enforces both; live-signal strips enforce, observe remains', () => {
    const risks: CompiledOrchestrationPortfolioRisk[] = [
      {
        id: 'risk-sym-enforce',
        scope: 'symbol',
        mode: 'enforce',
        notionalCapPct: 30,
        symbolScopeRef: SYMBOL_SCOPE,
        effectWhenTriggered: 'block_new_entries',
      },
      {
        id: 'risk-sym-observe',
        scope: 'symbol',
        mode: 'observe',
        notionalCapPct: 20,
        symbolScopeRef: SYMBOL_SCOPE,
        effectWhenTriggered: 'block_new_entries',
      },
      {
        // portfolio drawdown risk always passes through in live-signal
        id: 'risk-drawdown',
        scope: 'portfolio',
        mode: 'enforce',
        thresholdPct: 15,
        effectWhenTriggered: 'block_new_entries',
      },
    ]

    const ctx = {
      exposureNotionalBySymbolScope: { [SYMBOL_SCOPE]: 4000 },
      accountEquity: 10000,
      drawdownPct: 5, // below drawdown threshold
    }

    // Backtest: enforce symbol risk blocks scope; observe risk in observedBreaches
    const backtestResult = evaluateOrchestrationPortfolioRisks(risks, ctx)
    expect(backtestResult.blockedSymbolScopeRefs?.has(SYMBOL_SCOPE)).toBe(true)
    expect(backtestResult.observedBreaches).toContain('risk-sym-observe')

    // Live-signal: enforce symbol stripped; observe symbol remains; portfolio drawdown passes
    const liveRisks = filterForLiveSignal(risks)
    expect(liveRisks.map(r => r.id)).not.toContain('risk-sym-enforce')
    expect(liveRisks.map(r => r.id)).toContain('risk-sym-observe')
    expect(liveRisks.map(r => r.id)).toContain('risk-drawdown')
    expect(liveRisks).toHaveLength(2)

    const liveResult = evaluateOrchestrationPortfolioRisks(liveRisks, ctx)
    // Enforce symbol block is gone
    expect(liveResult.blockedSymbolScopeRefs?.size ?? 0).toBe(0)
    // Observe symbol breach still reported (ratio 40% > cap 20%)
    expect(liveResult.observedBreaches).toContain('risk-sym-observe')
    // Drawdown not triggered (5% < 15%)
    expect(liveResult.blockEntryLong).toBe(false)
  })
})
