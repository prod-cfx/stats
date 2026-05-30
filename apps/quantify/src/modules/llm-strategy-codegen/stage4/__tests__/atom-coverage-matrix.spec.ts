import {
  STAGE4_ATOM_COVERAGE_MATRIX,
  STAGE4_ATOM_FAMILIES,
  STAGE4_DEPLOY_READY_STATUSES,
  isStage4DeployReadyAtom,
} from '../atom-coverage-matrix'
import { buildStage4CoverageReport } from '../stage4-coverage-reporter'
import { ATOM_CONTRACT_REGISTRY } from '../../atom-contracts/atom-contract-registry'

const pr2UmbrellaKeys = [
  'indicator.cross',
  'indicator.threshold',
  'indicator.slope',
  'pattern.breakout',
  'pattern.pullback',
  'pattern.range',
  'volume.spike',
  'volume.confirmation',
  'time.session',
  'time.cooldownWindow',
  'event.externalSignal',
  'orderbook.imbalance',
  'fundingRate.condition',
  'openInterest.condition',
  'liquidation.condition',
] as const

const pr2NewGranularAtomKeys = [
  'indicator.slope',
  'pattern.pullback',
  'pattern.range',
  'volume.confirmation',
  'time.cooldown_window',
  'orderbook.imbalance',
  'fundingRate.condition',
  'openInterest.condition',
  'liquidation.condition',
] as const

const pr3RiskAtomKeys = [
  'risk.stop_loss_pct',
  'risk.trailing_stop_pct',
  'risk.partial_take_profit',
  'risk.max_drawdown_pct',
  'risk.cooldown',
  'risk.max_loss_per_trade',
] as const

const pr3PositionAtomKeys = [
  'position.sizing',
  'position.pyramiding_limit',
  'position.dca_schedule',
  'position.budget_cap',
  'position.leverage',
  'position.max_exposure_pct',
] as const

const pr4ActionAtomKeys = [
  'action.open_long',
  'action.open_short',
  'action.close_long',
  'action.close_short',
  'action.add_position',
  'action.reduce_position',
  'action.reverse_position',
  'action.conditional_order',
  'action.limit_order',
] as const

const pr4ProgramAtomKeys = [
  'program.fixed_grid_gated',
  'program.twap',
  'program.dca',
  'program.martingale',
  'program.rebalance',
  'program.iceberg',
] as const

describe('Stage 4 atom coverage matrix', () => {
  const pr3Rows = STAGE4_ATOM_COVERAGE_MATRIX.filter(row => row.prBatch === 'pr3-risk-position')
  const pr4Rows = STAGE4_ATOM_COVERAGE_MATRIX.filter(row => row.prBatch === 'pr4-action-program')

  it('covers all Stage 4 atom families', () => {
    const families = new Set(STAGE4_ATOM_COVERAGE_MATRIX.map(row => row.family))

    expect([...families].sort()).toEqual([...STAGE4_ATOM_FAMILIES].sort())
  })

  it('uses unique atom keys', () => {
    const keys = STAGE4_ATOM_COVERAGE_MATRIX.map(row => row.atomKey)

    expect(new Set(keys).size).toBe(keys.length)
  })

  it('requires acceptance fields on every row', () => {
    const invalidRows = STAGE4_ATOM_COVERAGE_MATRIX.filter(row =>
      !row.family
      || !row.rulePath
      || !row.status
      || row.requiredDataSources.length === 0
      || row.deployPayloadImpact.length === 0
      || !row.prBatch,
    )

    expect(invalidRows).toEqual([])
  })

  it('keeps deploy-ready numerator statuses explicit', () => {
    expect(STAGE4_DEPLOY_READY_STATUSES).toEqual(['deploy_ready', 'corpus_pass'])
  })

  it('contains PR2 predicate umbrella rows mapped to typed condition atoms', () => {
    const rowsByKey = new Map(STAGE4_ATOM_COVERAGE_MATRIX.map(row => [row.atomKey, row]))

    for (const key of pr2UmbrellaKeys) {
      const row = rowsByKey.get(key)
      expect(row).toBeDefined()
      expect(row?.family).toBe('predicate')
      expect(row?.rulePath).toBe('rules[].condition')
      expect(row?.prBatch).toBe('pr2-predicate')
      expect(row?.coveredAtomKeys.length).toBeGreaterThan(0)
    }
  })

  it('requires PR2 deploy-ready rows to include at least three dialogue utterances', () => {
    const invalidRows = STAGE4_ATOM_COVERAGE_MATRIX.filter(row =>
      row.prBatch === 'pr2-predicate'
      && STAGE4_DEPLOY_READY_STATUSES.includes(row.status)
      && row.utteranceExamples.length < 3,
    )

    expect(invalidRows).toEqual([])
  })

  it('does not classify planned PR2 granular atoms as executable', () => {
    const plannedPr2AtomKeys = STAGE4_ATOM_COVERAGE_MATRIX
      .filter(row => row.prBatch === 'pr2-predicate' && !STAGE4_DEPLOY_READY_STATUSES.includes(row.status))
      .flatMap(row => row.coveredAtomKeys)
      .filter((key): key is typeof pr2NewGranularAtomKeys[number] => pr2NewGranularAtomKeys.includes(key as typeof pr2NewGranularAtomKeys[number]))

    const executablePlannedAtoms = plannedPr2AtomKeys.filter(key =>
      ATOM_CONTRACT_REGISTRY[key].classifier.supportStatus === 'supported_executable',
    )

    expect(executablePlannedAtoms).toEqual([])
  })

  it('contains direct PR3 risk atom rows under typed risk effects', () => {
    const rowsByKey = new Map(STAGE4_ATOM_COVERAGE_MATRIX.map(row => [row.atomKey, row]))

    for (const key of pr3RiskAtomKeys) {
      const row = rowsByKey.get(key)
      expect(row).toBeDefined()
      expect(row?.family).toBe('risk')
      expect(row?.rulePath).toBe('rules[].effects.risks')
      expect(row?.coveredAtomKeys).toEqual([key])
      expect(row?.prBatch).toBe('pr3-risk-position')
    }
  })

  it('contains direct PR3 position atom rows under typed position effects', () => {
    const rowsByKey = new Map(STAGE4_ATOM_COVERAGE_MATRIX.map(row => [row.atomKey, row]))

    for (const key of pr3PositionAtomKeys) {
      const row = rowsByKey.get(key)
      expect(row).toBeDefined()
      expect(row?.family).toBe('position')
      expect(row?.rulePath).toBe('rules[].effects.positions')
      expect(row?.coveredAtomKeys).toEqual([key])
      expect(row?.prBatch).toBe('pr3-risk-position')
    }
  })

  it('requires deploy-ready PR3 rows to declare full dataflow coverage', () => {
    const invalidRows = pr3Rows.filter(row =>
      isStage4DeployReadyAtom(row)
      && (
        row.utteranceExamples.length < 3
        || !row.displayShape.includes('source path')
        || row.canonicalShape === 'unsupported'
        || row.irShape === 'unsupported'
        || !row.reachesBacktest
        || !row.reachesDeployPayload
        || row.unsupportedReason !== null
      ),
    )

    expect(invalidRows).toEqual([])
  })

  it('does not let PR3 risk and position rows remain empty planned coverage', () => {
    expect(pr3Rows.every(row => row.status === 'planned')).toBe(false)
    expect(pr3Rows.filter(isStage4DeployReadyAtom).length).toBeGreaterThan(0)
  })

  it('requires non deploy-ready PR3 rows to carry concrete blockers', () => {
    const invalidRows = pr3Rows.filter(row =>
      !isStage4DeployReadyAtom(row)
      && (
        row.unsupportedReason === null
        || (row.reachesBacktest && row.reachesDeployPayload)
      ),
    )

    expect(invalidRows).toEqual([])
  })

  it('counts PR3 deploy-ready atoms in the coverage reporter numerator', () => {
    const report = buildStage4CoverageReport({ atoms: pr3Rows, corpusResults: [] })

    expect(report.atomDeployReady).toBeGreaterThan(0)
  })

  it('contains direct PR4 action atom rows under typed action effects', () => {
    const rowsByKey = new Map(STAGE4_ATOM_COVERAGE_MATRIX.map(row => [row.atomKey, row]))

    for (const key of pr4ActionAtomKeys) {
      const row = rowsByKey.get(key)
      expect(row).toBeDefined()
      expect(row?.family).toBe('action')
      expect(row?.rulePath).toBe('rules[].effects.actions')
      expect(row?.coveredAtomKeys).toEqual([key])
      expect(row?.prBatch).toBe('pr4-action-program')
    }
  })

  it('contains direct PR4 program atom rows under typed program effects', () => {
    const rowsByKey = new Map(STAGE4_ATOM_COVERAGE_MATRIX.map(row => [row.atomKey, row]))

    for (const key of pr4ProgramAtomKeys) {
      const row = rowsByKey.get(key)
      expect(row).toBeDefined()
      expect(row?.family).toBe('program')
      expect(row?.rulePath).toBe('rules[].effects.programs')
      expect(row?.coveredAtomKeys).toEqual([key])
      expect(row?.prBatch).toBe('pr4-action-program')
    }
  })

  it('requires deploy-ready PR4 rows to declare full rules acceptance coverage', () => {
    const invalidRows = pr4Rows.filter(row =>
      isStage4DeployReadyAtom(row)
      && (
        row.utteranceExamples.length < 3
        || !row.displayShape.includes('source path')
        || !row.canonicalShape.includes('source path')
        || !row.irShape.includes('source path')
        || !row.runtimeRequirement.includes('runtime evaluator')
        || !row.deployPayloadImpact.some(item => item.includes('sourcePath'))
        || !row.reachesBacktest
        || !row.reachesDeployPayload
        || row.unsupportedReason !== null
      ),
    )

    expect(invalidRows).toEqual([])
  })

  it('does not let PR4 action and program rows remain empty planned coverage', () => {
    expect(pr4Rows.every(row => row.status === 'planned')).toBe(false)
    expect(pr4Rows.filter(isStage4DeployReadyAtom).length).toBeGreaterThan(0)
  })

  it('requires non deploy-ready PR4 rows to carry concrete blockers', () => {
    const invalidRows = pr4Rows.filter(row =>
      !isStage4DeployReadyAtom(row)
      && (
        row.unsupportedReason === null
        || (row.reachesBacktest && row.reachesDeployPayload)
      ),
    )

    expect(invalidRows).toEqual([])
  })

  it('keeps DCA program distinct from existing position DCA support', () => {
    const dcaProgram = STAGE4_ATOM_COVERAGE_MATRIX.find(row => row.atomKey === 'program.dca')
    const dcaPosition = STAGE4_ATOM_COVERAGE_MATRIX.find(row => row.atomKey === 'position.dca_schedule')

    expect(dcaProgram?.family).toBe('program')
    expect(dcaProgram?.rulePath).toBe('rules[].effects.programs')
    expect(dcaProgram?.unsupportedReason).toBe('program_dca_lifecycle_deploy_binding_missing')
    expect(isStage4DeployReadyAtom(dcaProgram!)).toBe(false)
    expect(dcaPosition?.family).toBe('position')
    expect(dcaPosition?.rulePath).toBe('rules[].effects.positions')
  })
})
