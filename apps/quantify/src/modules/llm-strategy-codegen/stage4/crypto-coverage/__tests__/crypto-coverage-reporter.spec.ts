import type { CryptoAtomEvidence, CryptoCaseEvidence } from '../crypto-coverage-types'
import { buildCryptoCoverageReport } from '../crypto-coverage-reporter'
import { failureKindToBlockedStatus, runCryptoCoverageCase } from '../crypto-coverage-runner'
import { CRYPTO_STRATEGY_COVERAGE_CORPUS } from '../crypto-strategy-corpus'

const allLayers = {
  nl_dispatch: true,
  dialogue_slot: true,
  rules_emit: true,
  atom_contract: true,
  readiness_support: true,
  canonical_emit: true,
  ir_emit: true,
  runtime_data: true,
  execution_runtime: true,
  backtest_reachability: true,
  deploy_payload: true,
  unsupported_gate: true,
} as const

describe('crypto coverage reporter', () => {
  it('counts only supported executable B atoms in weighted coverage', () => {
    const atoms: CryptoAtomEvidence[] = [
      { atomKey: 'action.open_long', scope: 'B', weight: 3, status: 'supported_executable', layers: allLayers, failures: [] },
      { atomKey: 'execution.post_only', scope: 'B', weight: 2, status: 'blocked_by_missing_ir_emit', layers: { ...allLayers, ir_emit: false }, failures: ['missing_ir_emit'] },
      { atomKey: 'unsupported.cross_exchange', scope: 'C', weight: 1, status: 'unsupported_out_of_scope', layers: { ...allLayers, unsupported_gate: true }, failures: ['out_of_scope_C'] },
    ]
    const report = buildCryptoCoverageReport({ atoms, cases: [], unsupported: [] })
    expect(report.summary.weightedBCoveragePct).toBe(60)
    expect(report.backlog).toEqual([{ atomKey: 'execution.post_only', requiredPhase: 'P2', failureKind: 'missing_ir_emit', ownerLayer: 'ir_emit' }])
  })

  it('reports case pass rate and C unsupported count', () => {
    const cases: CryptoCaseEvidence[] = [
      { id: 'pass', labels: ['trend'], scope: 'B', passed: true, expectedAtomKeys: ['action.open_long'], observedAtomKeys: ['action.open_long'], failures: [] },
      { id: 'fail', labels: ['execution'], scope: 'B', passed: false, expectedAtomKeys: ['execution.post_only'], observedAtomKeys: [], failures: [{ caseId: 'fail', atomKey: 'execution.post_only', layer: 'ir_emit', kind: 'missing_ir_emit', evidence: 'not emitted' }] },
    ]
    const report = buildCryptoCoverageReport({ atoms: [], cases, unsupported: [{ caseId: 'c', matchedPhrase: 'HFT', status: 'unsupported_out_of_scope', publicReason: 'hft_market_making_out_of_scope' }] })
    expect(report.summary.totalCases).toBe(2)
    expect(report.summary.passCases).toBe(1)
    expect(report.summary.passPct).toBe(50)
    expect(report.summary.unsupportedCCount).toBe(1)
    expect(report.failures).toHaveLength(1)
  })

  it('keeps taxonomy B denominator weighted to 100 and excludes unsupported C families', () => {
    const cases: CryptoCaseEvidence[] = [
      { id: 'stage4-simple-trend-ema-cross-stop-sizing', labels: ['simple_trend'], scope: 'B', passed: true, expectedAtomKeys: ['indicator.cross_over'], observedAtomKeys: ['indicator.cross_over'], failures: [] },
      { id: 'crypto-c-hft-market-making', labels: ['unsupported', 'hft'], scope: 'C', passed: true, expectedAtomKeys: ['unsupported.hft_market_making'], observedAtomKeys: ['unsupported.hft_market_making'], failures: [] },
    ]
    const report = buildCryptoCoverageReport({ atoms: [], cases, unsupported: [{ caseId: 'crypto-c-hft-market-making', matchedPhrase: 'HFT', status: 'unsupported_out_of_scope', publicReason: 'hft_market_making_out_of_scope' }] })
    const bFamilies = report.taxonomy.families.filter(item => item.denominatorIncluded)
    const cFamilies = report.taxonomy.families.filter(item => item.scope === 'C')

    expect(bFamilies.reduce((sum, item) => sum + item.weightPct, 0)).toBe(100)
    expect(cFamilies.every(item => item.weightPct === 0 && !item.denominatorIncluded)).toBe(true)
    expect(report.taxonomy.denominator).toBe('B_supported_strategy_families')
    expect(report.taxonomy.sourceLimitations).toContain('Evidence proves repository corpus coverage, not market-share coverage from an external user dataset.')
  })

  it('maps all 50 corpus cases to taxonomy proof entries', async () => {
    const results = await Promise.all(CRYPTO_STRATEGY_COVERAGE_CORPUS.map(async caseItem => runCryptoCoverageCase(caseItem)))
    const report = buildCryptoCoverageReport({
      cases: results.map(item => item.caseEvidence),
      atoms: results.flatMap(item => item.atomEvidence),
      unsupported: results.flatMap(item => item.unsupported),
    })
    const unmapped = report.taxonomy.caseMappings.filter(item => item.familyIds.length === 0)
    const uncoveredBFamilies = report.taxonomy.families.filter(item => item.denominatorIncluded && !item.covered)

    expect(report.taxonomy.caseMappings).toHaveLength(50)
    expect(unmapped).toEqual([])
    expect(uncoveredBFamilies).toEqual([])
    expect(report.taxonomy.achievedCoveragePct).toBeGreaterThanOrEqual(90)
  })
})

describe('crypto coverage runner helpers', () => {
  it('maps B-scope failures to blocked statuses', () => {
    expect(failureKindToBlockedStatus('missing_nl_dispatch')).toBe('blocked_by_missing_nl_dispatch')
    expect(failureKindToBlockedStatus('missing_runtime_data')).toBe('blocked_by_missing_runtime_data')
    expect(failureKindToBlockedStatus('missing_deploy_payload')).toBe('blocked_by_missing_deploy_payload')
    expect(failureKindToBlockedStatus('out_of_scope_C')).toBe('unsupported_out_of_scope')
  })

  it('routes C-scope cases to unsupported gate instead of supported executable', async () => {
    const result = await runCryptoCoverageCase({
      id: 'c-triangular',
      labels: ['unsupported'],
      scope: 'C',
      initialUserMessage: '三角套利自动撮合三条腿',
      clarificationTurns: [],
      expectedAtomKeys: ['unsupported.triangular_arbitrage_matching'],
      expectedUnsupportedReason: 'triangular_arbitrage_matching_out_of_scope',
    })

    expect(result.caseEvidence.scope).toBe('C')
    expect(result.atomEvidence).toEqual([
      expect.objectContaining({
        atomKey: 'unsupported.triangular_arbitrage_matching',
        scope: 'C',
        status: 'unsupported_out_of_scope',
        failures: ['out_of_scope_C'],
      }),
    ])
    expect(result.atomEvidence[0]?.layers.unsupported_gate).toBe(true)
    expect(result.unsupported).toEqual([
      expect.objectContaining({
        status: 'unsupported_out_of_scope',
        publicReason: 'triangular_arbitrage_matching_out_of_scope',
      }),
    ])
  })

  it('emits P1 B-scope atoms into rules and keeps contracts registered', async () => {
    const targetIds = [
      'crypto-b-orderbook-spread-post-only',
      'crypto-b-portfolio-daily-loss-kill-switch',
      'crypto-b-limit-chase-reduce-only',
    ]
    const results = await Promise.all(targetIds.map(async (id) => {
      const caseItem = CRYPTO_STRATEGY_COVERAGE_CORPUS.find(item => item.id === id)
      expect(caseItem).toBeDefined()
      return runCryptoCoverageCase(caseItem!)
    }))

    const failures = results.flatMap(result => result.caseEvidence.failures)
    expect(failures.filter(item => item.kind === 'missing_rules_emit')).toEqual([])
    expect(failures.filter(item => item.kind === 'missing_canonical_emit')).toEqual([])
    expect(failures.filter(item => item.kind === 'missing_dialogue_slot')).toEqual([])
    const missingContracts = [...new Set(failures.filter(item => item.kind === 'missing_atom_contract').map(item => item.atomKey))].sort()
    expect(missingContracts).toEqual([])
  })

  it('closes P1 B-scope fail-closed atoms through executable evidence', async () => {
    const targetIds = [
      'crypto-b-orderbook-spread-post-only',
      'crypto-b-portfolio-daily-loss-kill-switch',
      'crypto-b-limit-chase-reduce-only',
    ]
    const results = await Promise.all(targetIds.map(async (id) => {
      const caseItem = CRYPTO_STRATEGY_COVERAGE_CORPUS.find(item => item.id === id)
      expect(caseItem).toBeDefined()
      return runCryptoCoverageCase(caseItem!)
    }))

    const failures = results.flatMap(result => result.caseEvidence.failures)
    expect(failures).toEqual([])
  })

  it('closes P2 structural atoms through canonical and IR layers', async () => {
    const targetIds = [
      'stage4-reduce-limit-conditional-order',
      'stage4-program-rebalance',
      'stage4-multi-leg-pair-spread',
      'stage4-time-cooldown-window',
    ]
    const results = await Promise.all(targetIds.map(async (id) => {
      const caseItem = CRYPTO_STRATEGY_COVERAGE_CORPUS.find(item => item.id === id)
      expect(caseItem).toBeDefined()
      return runCryptoCoverageCase(caseItem!)
    }))

    const failures = results.flatMap(result => result.caseEvidence.failures)
    expect(failures.filter(item => item.kind === 'missing_atom_contract')).toEqual([])
    expect(failures.filter(item => item.kind === 'missing_canonical_emit')).toEqual([])
    expect(failures.filter(item => item.kind === 'missing_ir_emit')).toEqual([])
  })

  it('uses corpus clarification turns to clear entry and exit dialogue slots for executable B cases', async () => {
    const targetIds = [
      'stage4-mean-reversion-rsi-partial-tp',
      'stage4-grid-range-risk-sizing',
      'stage4-multi-leg-pair-spread',
    ]
    const results = await Promise.all(targetIds.map(async (id) => {
      const caseItem = CRYPTO_STRATEGY_COVERAGE_CORPUS.find(item => item.id === id)
      expect(caseItem).toBeDefined()
      return runCryptoCoverageCase(caseItem!)
    }))

    expect(results.flatMap(result => result.caseEvidence.failures).filter(item => item.kind === 'missing_dialogue_slot')).toEqual([])
  })

  it('keeps DCA schedule percent-change stable through deploy payload evidence', async () => {
    const caseItem = CRYPTO_STRATEGY_COVERAGE_CORPUS.find(item => item.id === 'stage4-dca-schedule-budget')
    expect(caseItem).toBeDefined()

    const result = await runCryptoCoverageCase(caseItem!)
    const failureKinds = [...new Set(result.caseEvidence.failures.map(item => item.kind))]

    expect(failureKinds).toEqual([])
  })

  it('treats fixed notional sizing and limit order execution atoms as registered executable atoms', async () => {
    const fixedNotionalCase = CRYPTO_STRATEGY_COVERAGE_CORPUS.find(item => item.id === 'stage4-boundary-atr-fixed-notional-leverage')
    const limitOrderCase = CRYPTO_STRATEGY_COVERAGE_CORPUS.find(item => item.id === 'crypto-b-limit-chase-reduce-only')
    expect(fixedNotionalCase).toBeDefined()
    expect(limitOrderCase).toBeDefined()

    const fixedNotionalResult = await runCryptoCoverageCase(fixedNotionalCase!)
    expect(fixedNotionalResult.caseEvidence.failures.filter(item => item.atomKey === 'position.fixed_notional' && item.kind === 'missing_atom_contract')).toEqual([])

    const limitOrderResult = await runCryptoCoverageCase(limitOrderCase!)
    const limitOrderFailures = limitOrderResult.caseEvidence.failures.filter(item => item.atomKey === 'action.limit_order')
    expect(limitOrderFailures.map(item => item.kind)).not.toContain('missing_atom_contract')
    expect(limitOrderFailures).toEqual([])
  })

  it('routes generic execution programs past atom contract registration into downstream fail-closed layers', async () => {
    const targetIds = [
      'stage4-program-twap',
      'stage4-program-dca',
      'stage4-program-martingale',
      'stage4-program-rebalance',
      'stage4-program-iceberg',
    ]
    const results = await Promise.all(targetIds.map(async (id) => {
      const caseItem = CRYPTO_STRATEGY_COVERAGE_CORPUS.find(item => item.id === id)
      expect(caseItem).toBeDefined()
      return runCryptoCoverageCase(caseItem!)
    }))

    const programFailures = results.flatMap(result => result.caseEvidence.failures)
      .filter(item => item.atomKey.startsWith('program.'))
    expect(programFailures.map(item => item.kind)).not.toContain('missing_atom_contract')
    expect(programFailures.map(item => item.kind)).not.toContain('missing_dialogue_slot')
    expect(programFailures.map(item => item.kind)).not.toContain('missing_canonical_emit')
  })

  it('closes P3 deploy payload evidence for remaining atom-first crypto gaps', async () => {
    const targetIds = [
      'stage4-dca-schedule-budget',
      'stage4-dca-schedule-fixed-ratio',
      'stage4-boundary-atr-fixed-notional-leverage',
      'stage4-program-rebalance',
      'stage4-multi-leg-pair-spread',
    ]
    const results = await Promise.all(targetIds.map(async (id) => {
      const caseItem = CRYPTO_STRATEGY_COVERAGE_CORPUS.find(item => item.id === id)
      expect(caseItem).toBeDefined()
      return runCryptoCoverageCase(caseItem!)
    }))

    expect(results.flatMap(result => result.caseEvidence.failures)).toEqual([])
  })
})
