import { collectAtomLeaves, isRuleEffectsByRole } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../../services/generic-seed-dispatcher.service'
import { STAGE4_ATOM_COVERAGE_MATRIX } from '../atom-coverage-matrix'
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
})
