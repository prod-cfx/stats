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
    const gateRule = patch.rules?.find(rule => rule.phase === 'gate')

    expect(exitRule).toBeDefined()
    expect(gateRule).toBeDefined()
    expect(ruleEffectKeys(exitRule!)).not.toContain('position.sizing')
    expect(ruleEffectKeys(gateRule!)).not.toContain('position.sizing')
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
    expect(effects.map(effect => effect.key)).not.toContain('action.open_short')
  })

  it('does not infer sizing from generic use wording in stage1 candle case', () => {
    const text = STAGE1_TYPED_RULES_CORPUS.find(item => item.id === 'stage1-008-candle-open-close')!.text
    const patch = new GenericSeedDispatcher().dispatch(text)
    const effects = allEffectLeaves(patch)

    expect(effects.map(effect => effect.key)).not.toContain('position.sizing')
  })

  it('does not infer sizing from funding rate percentage', () => {
    const patch = new GenericSeedDispatcher().dispatch('BTC 1h 资金费率大于 0.1% 时做多')
    const effects = allEffectLeaves(patch)

    expect(effects.map(effect => effect.key)).not.toContain('position.sizing')
  })

  it('treats single EMA cross wording as price crossing that EMA when combined with funding rate', () => {
    const patch = new GenericSeedDispatcher().dispatch('BTCUSDT 15m。资金费率为正并且 EMA20 上穿时开多。跌破 EMA20 时平多。')
    const entryRule = patch.rules?.find(rule => rule.phase === 'entry')
    const leaves = entryRule ? collectAtomLeaves(entryRule.condition) : []
    const cross = leaves.find(leaf => leaf.key === 'indicator.cross_over')

    expect(entryRule).toBeDefined()
    expect(leaves.map(leaf => leaf.key)).toContain('fundingRate.condition')
    expect(cross).toEqual(expect.objectContaining({
      key: 'indicator.cross_over',
      params: expect.objectContaining({
        indicator: 'ema',
        period: 20,
        fastPeriod: 20,
        priceCross: true,
      }),
    }))
    expect(cross?.params).not.toEqual(expect.objectContaining({ slowPeriod: 14 }))
    expect(cross?.params).not.toEqual(expect.objectContaining({ period: 0 }))
    expect(ruleEffectKeys(entryRule!)).toContain('action.open_long')
  })

  it('keeps explicit fixed-ratio sizing for on-start spot strategy 6', () => {
    const text = STAGE1_TYPED_RULES_CORPUS.find(item => item.id === 'stage1-006-ordi-spot-on-start')!.text
    const patch = new GenericSeedDispatcher().dispatch(text)
    const effects = allEffectLeaves(patch)
    const sizing = effects.find(effect => effect.key === 'position.sizing')
    const entryRule = patch.rules?.find(rule => rule.phase === 'entry')

    expect(entryRule).toBeDefined()
    expect(ruleConditionKeys(entryRule!)).toContain('execution.on_start')
    expect(ruleEffectKeys(entryRule!)).toContain('action.open_long')
    expect(sizing).toEqual(expect.objectContaining({
      key: 'position.sizing',
      params: expect.objectContaining({
        sizing: expect.objectContaining({ kind: 'ratio', value: 0.1, unit: 'ratio' }),
      }),
    }))
  })

  it('parses plain percent take-profit without ATR drift for boll scalp strategy 7', () => {
    const text = STAGE1_TYPED_RULES_CORPUS.find(item => item.id === 'stage1-007-boll-scalp')!.text
    const patch = new GenericSeedDispatcher().dispatch(text)
    const effects = allEffectLeaves(patch)
    const keys = effects.map(effect => effect.key)
    const takeProfit = effects.find(effect => effect.key === 'risk.take_profit_pct')
    const sizing = effects.find(effect => effect.key === 'position.sizing')

    expect(keys).not.toContain('risk.atr_take_profit')
    expect(takeProfit).toEqual(expect.objectContaining({
      key: 'risk.take_profit_pct',
      params: expect.objectContaining({ valuePct: 1.5, basis: 'entry_avg_price' }),
    }))
    expect(sizing).toEqual(expect.objectContaining({
      params: expect.objectContaining({
        sizing: expect.objectContaining({ kind: 'ratio', value: 0.1, unit: 'ratio' }),
      }),
    }))
  })

  it('parses colloquial half and remaining partial take-profit tiers without treating trigger pct as close pct', () => {
    const patch = new GenericSeedDispatcher().dispatch('OKX 永续 BTCUSDT 15m。RSI14 低于 30 做多，盈利 5% 平一半，盈利 10% 平剩余。')
    const effects = allEffectLeaves(patch)
    const partialTakeProfit = effects.find(effect => effect.key === 'risk.partial_take_profit')

    expect(effects.map(effect => effect.key)).not.toContain('risk.take_profit_pct')
    expect(partialTakeProfit).toEqual(expect.objectContaining({
      key: 'risk.partial_take_profit',
      params: expect.objectContaining({
        tiers: [
          { trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 },
          { trigger: { kind: 'pnl_pct', threshold: 10 }, reduceRatio: 1 },
        ],
      }),
    }))
  })

  it('does not treat half-position entry wording as partial take-profit context', () => {
    const patch = new GenericSeedDispatcher().dispatch('BTC 15m 半仓买入，止盈 10%。')
    const effects = allEffectLeaves(patch)

    expect(effects.map(effect => effect.key)).toContain('risk.take_profit_pct')
    expect(effects.map(effect => effect.key)).not.toContain('risk.partial_take_profit')
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

  // Issue #1691 staging30 s28: 用户描述「下穿平仓」类纯出场动作时，
  // dispatcher 必须为 exit phase 注入 action.close_long / action.close_short fallback。
  // 否则 readiness.hasExit=false，前端持续追问 rulesTree.exit，触发 assistant_prompt_loop。
  it('infers exit close_long action when text expresses close intent without explicit verb', () => {
    const patch = new GenericSeedDispatcher().dispatch('SOL 1d，EMA20 上穿 EMA60 开多，下穿平仓，最大回撤 15% 熔断。')
    const exitRule = patch.rules?.find(rule => rule.phase === 'exit')

    expect(exitRule).toBeDefined()
    expect(ruleEffectKeys(exitRule!)).toContain('action.close_long')
  })

  it('infers exit close_short action for short-side close intent', () => {
    const patch = new GenericSeedDispatcher().dispatch('BTC 1h MA20 下穿 MA60 开空，上穿平空。')
    const exitRule = patch.rules?.find(rule => rule.phase === 'exit')

    expect(exitRule).toBeDefined()
    expect(ruleEffectKeys(exitRule!)).toContain('action.close_short')
  })

  it('does not treat exit price-change percentage as position sizing', () => {
    const patch = new GenericSeedDispatcher().dispatch('价格相对入场均价下跌 5% 时平仓。')
    const sizingLeaves = allEffectLeaves(patch).filter(effect => effect.key === 'position.sizing')

    expect(sizingLeaves).toEqual([])
  })

  it('does not promote DCA drawdown percentage to top-level position sizing', () => {
    const patch = new GenericSeedDispatcher().dispatch('ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT。')
    const positionSizingLeaves = allEffectLeaves(patch).filter(effect => effect.key === 'position.sizing')
    const addPositionLeaves = allEffectLeaves(patch).filter(effect => effect.key === 'action.add_position')

    expect(positionSizingLeaves).toEqual([])
    expect(addPositionLeaves).toEqual(expect.arrayContaining([
      expect.objectContaining({
        params: expect.objectContaining({
          sizing: expect.objectContaining({ kind: 'quote', value: 200, asset: 'USDT' }),
        }),
      }),
    ]))
  })
})
