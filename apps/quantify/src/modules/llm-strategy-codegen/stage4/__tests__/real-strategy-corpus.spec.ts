import { collectAtomLeaves, isRuleEffectsByRole } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../../services/generic-seed-dispatcher.service'
import { STAGE4_ATOM_COVERAGE_MATRIX, isStage4DeployReadyAtom } from '../atom-coverage-matrix'
import { STAGE4_REAL_STRATEGY_CORPUS } from '../stage4-real-strategy-corpus'

const expectedCategories = [
  'simple_trend',
  'mean_reversion',
  'grid',
  'dca',
  'add_position',
  'portfolio_risk',
  'multi_timeframe',
  'multi_symbol',
  'data_source_binding',
  'action_lifecycle',
  'execution_program',
] as const

function collectRuleAtomKeys(patch: ReturnType<GenericSeedDispatcher['dispatch']>): string[] {
  return (patch.rules ?? []).flatMap((rule) => {
    const conditionKeys = collectAtomLeaves(rule.condition).map(leaf => leaf.key)
    const effectKeys = isRuleEffectsByRole(rule.effects)
      ? [
          ...rule.effects.actions,
          ...rule.effects.risks,
          ...rule.effects.positions,
          ...rule.effects.programs,
          ...rule.effects.orchestration,
        ].flatMap(effect => collectAtomLeaves(effect).map(leaf => leaf.key))
      : collectAtomLeaves(rule.effects).map(leaf => leaf.key)

    return [...conditionKeys, ...effectKeys]
  })
}

function collectRuleOrchestrationAtomKeys(patch: ReturnType<GenericSeedDispatcher['dispatch']>): string[] {
  return (patch.rules ?? []).flatMap((rule) => {
    if (!isRuleEffectsByRole(rule.effects)) {
      return []
    }

    return rule.effects.orchestration.flatMap(effect => collectAtomLeaves(effect).map(leaf => leaf.key))
  })
}

function coverageRowsForAtomKey(atomKey: string) {
  return STAGE4_ATOM_COVERAGE_MATRIX.filter(row => row.atomKey === atomKey || row.coveredAtomKeys.includes(atomKey))
}

describe('Stage 4 real strategy corpus', () => {
  const dispatcher = new GenericSeedDispatcher()
  const knownStage4AtomKeys = new Set(STAGE4_ATOM_COVERAGE_MATRIX.flatMap(row => [row.atomKey, ...row.coveredAtomKeys]))

  it('covers every Stage 4 strategy category with at least one real user strategy', () => {
    const categories = new Set(STAGE4_REAL_STRATEGY_CORPUS.map(item => item.category))

    expect([...categories].sort()).toEqual([...expectedCategories].sort())
  })

  it('uses only Stage 4 atom keys declared in the coverage matrix', () => {
    const unknownKeys = STAGE4_REAL_STRATEGY_CORPUS
      .flatMap(item => item.expectedAtomKeys)
      .filter(key => !knownStage4AtomKeys.has(key))

    expect(unknownKeys).toEqual([])
  })

  it('routes each corpus strategy to its expected typed rules atoms on attempt-1', () => {
    const missingByCase = STAGE4_REAL_STRATEGY_CORPUS.flatMap((item) => {
      const patch = dispatcher.dispatch(item.initialUserMessage)
      const actualKeys = new Set(collectRuleAtomKeys(patch))

      return item.expectedAtomKeys
        .filter(key => !actualKeys.has(key))
        .map(key => ({ id: item.id, key }))
    })

    expect(missingByCase).toEqual([])
  })

  it('routes multi-timeframe and multi-symbol corpus cases to PR5 orchestration effects on attempt-1', () => {
    const expectedOrchestrationKeysByCase = new Map([
      ['stage4-multi-timeframe-trend-confirmation', 'scope.timeframe'],
      ['stage4-multi-symbol-shared-risk', 'scope.symbol'],
    ])

    const missingByCase = [...expectedOrchestrationKeysByCase].flatMap(([caseId, expectedKey]) => {
      const item = STAGE4_REAL_STRATEGY_CORPUS.find(entry => entry.id === caseId)
      expect(item).toBeDefined()

      const patch = dispatcher.dispatch(item!.initialUserMessage)
      const orchestrationKeys = new Set(collectRuleOrchestrationAtomKeys(patch))

      return orchestrationKeys.has(expectedKey) ? [] : [{ id: caseId, key: expectedKey }]
    })

    expect(missingByCase).toEqual([])
  })

  it('keeps corpus expected failures aligned with deploy-ready coverage rows', () => {
    const invalidCases = STAGE4_REAL_STRATEGY_CORPUS.flatMap((item) => {
      const rowsByExpectedAtom = item.expectedAtomKeys.map(atomKey => ({ atomKey, rows: coverageRowsForAtomKey(atomKey) }))

      if (item.expectedFailure === null) {
        return rowsByExpectedAtom
          .filter(({ rows }) => !rows.some(isStage4DeployReadyAtom))
          .map(({ atomKey }) => ({ id: item.id, atomKey, issue: 'missing_deploy_ready_row' }))
      }

      const hasExpectedBlocker = rowsByExpectedAtom.some(({ rows }) =>
        rows.some(row => !isStage4DeployReadyAtom(row) && row.unsupportedReason === item.expectedFailure),
      )

      return hasExpectedBlocker ? [] : [{ id: item.id, issue: 'missing_expected_blocker_row' }]
    })

    expect(invalidCases).toEqual([])
  })

  it('covers every deploy-ready Stage 4 atom with at least one pass strategy', () => {
    const passAtomKeys = new Set(
      STAGE4_REAL_STRATEGY_CORPUS
        .filter(item => item.expectedFailure === null)
        .flatMap(item => item.expectedAtomKeys),
    )

    const missingDeployReadyAtoms = STAGE4_ATOM_COVERAGE_MATRIX
      .filter(isStage4DeployReadyAtom)
      .filter(row => !row.coveredAtomKeys.some(atomKey => passAtomKeys.has(atomKey)))
      .map(row => row.atomKey)

    expect(missingDeployReadyAtoms).toEqual([])
  })

  it('marks PR5 multi-timeframe and multi-symbol corpus cases as pass only when their atoms are deploy-ready', () => {
    const invalidCases = STAGE4_REAL_STRATEGY_CORPUS
      .filter(item => item.id === 'stage4-multi-timeframe-trend-confirmation' || item.id === 'stage4-multi-symbol-shared-risk')
      .flatMap((item) => {
        if (item.expectedFailure !== null) return [{ id: item.id, issue: 'expected_failure_present' }]
        const nonReadyAtom = item.expectedAtomKeys.find(atomKey => !coverageRowsForAtomKey(atomKey).some(isStage4DeployReadyAtom))
        return nonReadyAtom ? [{ id: item.id, atomKey: nonReadyAtom, issue: 'atom_not_deploy_ready' }] : []
      })

    expect(invalidCases).toEqual([])
  })

  it('does not create duplicate entry or exit rules for corpus strategies', () => {
    const duplicateCases = STAGE4_REAL_STRATEGY_CORPUS.flatMap((item) => {
      const patch = dispatcher.dispatch(item.initialUserMessage)
      const phases = (patch.rules ?? []).map(rule => rule.phase)

      return [
        phases.filter(phase => phase === 'entry').length > 1 ? `${item.id}:entry` : null,
        phases.filter(phase => phase === 'exit').length > 1 ? `${item.id}:exit` : null,
      ].filter((value): value is string => value !== null)
    })

    expect(duplicateCases).toEqual([])
  })

  it('does not over-emit kill switch for max-drawdown portfolio risk cases', () => {
    const targetCases = STAGE4_REAL_STRATEGY_CORPUS.filter(item => item.id.includes('portfolio-risk'))
    const invalidCases = targetCases.flatMap((item) => {
      const patch = dispatcher.dispatch(item.initialUserMessage)
      const actualKeys = new Set(collectRuleAtomKeys(patch))
      return actualKeys.has('risk.kill_switch') ? [item.id] : []
    })

    expect(invalidCases).toEqual([])
  })
})
