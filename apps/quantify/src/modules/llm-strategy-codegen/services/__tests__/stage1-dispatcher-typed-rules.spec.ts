import { collectAtomLeaves, listRuleEffects } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { STAGE1_TYPED_RULES_CORPUS } from './fixtures/stage1-typed-rules-corpus'

function ruleEffectKeys(rule: NonNullable<ReturnType<GenericSeedDispatcher['dispatch']>['rules']>[number]): string[] {
  return listRuleEffects(rule.effects)
    .flatMap(effect => collectAtomLeaves(effect))
    .map(leaf => leaf.key)
}

function ruleEffectLeaves(rule: NonNullable<ReturnType<GenericSeedDispatcher['dispatch']>['rules']>[number]) {
  return listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect))
}

function ruleConditionKeys(rule: NonNullable<ReturnType<GenericSeedDispatcher['dispatch']>['rules']>[number]): string[] {
  return collectAtomLeaves(rule.condition).map(leaf => leaf.key)
}

function allEffectLeaves(patch: ReturnType<GenericSeedDispatcher['dispatch']>) {
  return (patch.rules ?? []).flatMap(rule => ruleEffectLeaves(rule).map(leaf => ({ ...leaf, rulePhase: rule.phase })))
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

  it('scopes entry position sizing away from exit and program rules', () => {
    const patch = new GenericSeedDispatcher().dispatch('BTC 1小时突破 MA20 买入，单笔使用 10% 资金，跌破 MA20 卖出，启用最大回撤 15% 熔断')
    const exitRule = patch.rules?.find(rule => rule.phase === 'exit')
    const programRule = patch.rules?.find(rule => rule.phase === 'program')

    expect(exitRule).toBeDefined()
    expect(programRule).toBeDefined()
    expect(ruleEffectKeys(exitRule!)).not.toContain('position.sizing')
    expect(ruleEffectKeys(programRule!)).not.toContain('position.sizing')
  })

  it('does not fabricate default effects without explicit text evidence', () => {
    const patch = new GenericSeedDispatcher().dispatch('BTC 1小时 RSI 低于 30')
    const effects = allEffectLeaves(patch)

    expect(effects.map(effect => effect.key)).not.toContain('action.open_long')
    expect(effects.map(effect => effect.key)).not.toContain('position.sizing')
    expect(effects.map(effect => effect.key)).not.toContain('risk.stop_loss_pct')
    expect(effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'scope.timeframe',
          evidence: expect.objectContaining({ text: expect.stringContaining('1小时') }),
        }),
      ]),
    )
  })

  it('attaches evidence text to inferred fallback effects', () => {
    const patch = new GenericSeedDispatcher().dispatch('BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点。')
    const effects = allEffectLeaves(patch)

    expect(effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'action.open_long',
          evidence: expect.objectContaining({ text: expect.stringContaining('买') }),
        }),
        expect.objectContaining({
          key: 'position.sizing',
          evidence: expect.objectContaining({ text: expect.stringContaining('一点') }),
        }),
      ]),
    )
  })

  it('does not infer sizing from generic use wording in stage1 candle case', () => {
    const text = STAGE1_TYPED_RULES_CORPUS.find(item => item.id === 'stage1-008-candle-open-close')!.text
    const patch = new GenericSeedDispatcher().dispatch(text)
    const effects = allEffectLeaves(patch)

    expect(effects.map(effect => effect.key)).not.toContain('position.sizing')
  })

  it('infers webhook sizing only from explicit amount evidence', () => {
    const text = STAGE1_TYPED_RULES_CORPUS.find(item => item.id === 'stage1-025-webhook-event')!.text
    const patch = new GenericSeedDispatcher().dispatch(text)
    const positions = allEffectLeaves(patch).filter(effect => effect.key === 'position.sizing')

    expect(positions.length).toBeGreaterThan(0)
    expect(positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence: expect.objectContaining({ text: expect.stringContaining('100') }),
        }),
      ]),
    )
    expect(positions.map(position => position.evidence?.text?.toLowerCase())).not.toContain('u')
    expect(positions.map(position => position.evidence?.text)).not.toContain('用')
  })

  it('maps legacy risk phase effects into exit risk role', () => {
    const patch = new GenericSeedDispatcher().dispatch('BTC 1h 跌破 MA20 止损 5%')
    const riskLeaves = allEffectLeaves(patch).filter(effect => effect.key === 'risk.stop_loss_pct')

    expect(riskLeaves.length).toBeGreaterThan(0)
    expect(riskLeaves.some(effect => effect.rulePhase === 'exit')).toBe(true)
  })
})
