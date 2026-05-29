import type { Stage4AtomCoverageRow } from '../atom-coverage-matrix'
import { buildStage4CoverageReport } from '../stage4-coverage-reporter'

const atomRow = (
  atomKey: string,
  status: Stage4AtomCoverageRow['status'],
  overrides: Partial<Stage4AtomCoverageRow> = {},
): Stage4AtomCoverageRow => ({
  atomKey,
  family: 'predicate',
  rulePath: 'rules[].condition',
  paramsSchema: [],
  requiredSlots: [],
  utteranceExamples: [],
  displayShape: 'display predicate',
  canonicalShape: 'canonical predicate',
  irShape: 'ir predicate',
  runtimeRequirement: 'runtime predicate',
  requiredDataSources: ['ohlcv'],
  deployPayloadImpact: ['strategy.dataRequirements'],
  corpusCases: [],
  status,
  unsupportedReason: null,
  prBatch: 'pr2-predicate',
  reachesBacktest: status === 'deploy_ready' || status === 'corpus_pass',
  reachesDeployPayload: status === 'deploy_ready' || status === 'corpus_pass',
  ...overrides,
})

describe('Stage 4 coverage reporter', () => {
  it('counts only deploy-ready atoms that reach backtest and deploy payload', () => {
    const report = buildStage4CoverageReport({
      atoms: [
        atomRow('planned', 'planned'),
        atomRow('deploy-ready', 'deploy_ready'),
        atomRow('corpus-pass', 'corpus_pass'),
        atomRow('false-ready', 'deploy_ready', { reachesBacktest: true, reachesDeployPayload: false }),
      ],
      corpusResults: [],
    })

    expect(report.atomTotal).toBe(4)
    expect(report.atomDeployReady).toBe(2)
    expect(report.atomDeployReadyPct).toBe(50)
  })

  it('reports corpus pass coverage, attempt-1 pass rate, and blocker distribution', () => {
    const report = buildStage4CoverageReport({
      atoms: [],
      corpusResults: [
        { id: 'pass-1', passed: true, attemptCount: 1, status: 'corpus_pass', blocker: null },
        { id: 'retry-pass', passed: true, attemptCount: 2, status: 'corpus_pass', blocker: null },
        { id: 'drift', passed: false, attemptCount: 1, status: 'failed', blocker: 'semantic_drift' },
        { id: 'deploy-drift', passed: false, attemptCount: 1, status: 'failed', blocker: 'deploy_payload_drift' },
        { id: 'deploy-drift-2', passed: false, attemptCount: 1, status: 'failed', blocker: 'deploy_payload_drift' },
      ],
    })

    expect(report.corpusTotal).toBe(5)
    expect(report.corpusPass).toBe(2)
    expect(report.corpusPassPct).toBe(40)
    expect(report.attemptOnePassPct).toBe(20)
    expect(report.blockers).toEqual({
      deploy_payload_drift: 2,
      semantic_drift: 1,
    })
  })
})
