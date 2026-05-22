import { collectAtomLeaves, listRuleEffects } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { STAGE1_TYPED_RULES_CORPUS } from './fixtures/stage1-typed-rules-corpus'

function ruleEffectKeys(rule: NonNullable<ReturnType<GenericSeedDispatcher['dispatch']>['rules']>[number]): string[] {
  return listRuleEffects(rule.effects)
    .flatMap(effect => collectAtomLeaves(effect))
    .map(leaf => leaf.key)
}

function ruleConditionKeys(rule: NonNullable<ReturnType<GenericSeedDispatcher['dispatch']>['rules']>[number]): string[] {
  return collectAtomLeaves(rule.condition).map(leaf => leaf.key)
}

describe('stage1 typed rules corpus fixture', () => {
  it('contains exactly 31 required current-capability cases', () => {
    expect(STAGE1_TYPED_RULES_CORPUS).toHaveLength(31)
    expect(new Set(STAGE1_TYPED_RULES_CORPUS.map(item => item.id)).size).toBe(31)
    expect(STAGE1_TYPED_RULES_CORPUS.every(item => item.text.trim().length > 0)).toBe(true)
  })

  it.each(STAGE1_TYPED_RULES_CORPUS)(
    '$id dispatches production typed rules without legacy flat fields',
    ({ text, expectedPhases, expectedEffectRoles }) => {
      const patch = new GenericSeedDispatcher().dispatch(text)
      const legacyTopLevelFields = ['triggers', 'actions', 'risk', 'position', 'orchestration', 'atoms'] as const

      expect(patch.rules?.length ?? 0).toBeGreaterThan(0)
      for (const field of legacyTopLevelFields) {
        expect(patch).not.toHaveProperty(field)
      }
      for (const rule of patch.rules ?? []) {
        expect(Array.isArray(rule.effects)).toBe(false)
      }

      const phases = new Set((patch.rules ?? []).map(rule => rule.phase))
      for (const phase of expectedPhases) {
        expect(phases.has(phase)).toBe(true)
      }

      for (const role of expectedEffectRoles) {
        expect((patch.rules ?? []).some(rule => !Array.isArray(rule.effects) && rule.effects[role].length > 0)).toBe(true)
      }
    },
  )

  it('scopes entry open action away from exit rules', () => {
    const patch = new GenericSeedDispatcher().dispatch('15min 布林带下轨买入 上轨卖出')
    const exitRule = patch.rules?.find(rule => rule.phase === 'exit')

    expect(exitRule).toBeDefined()
    expect(ruleEffectKeys(exitRule!)).not.toContain('action.open_long')
  })

  it('uses grid.range_rebalance as program condition without blind entry open action', () => {
    const patch = new GenericSeedDispatcher().dispatch('在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金')
    const programRule = patch.rules?.find(rule => rule.phase === 'program')

    expect(programRule).toBeDefined()
    expect(ruleConditionKeys(programRule!)).toContain('grid.range_rebalance')
    expect(ruleEffectKeys(programRule!)).not.toContain('action.open_long')
  })
})
