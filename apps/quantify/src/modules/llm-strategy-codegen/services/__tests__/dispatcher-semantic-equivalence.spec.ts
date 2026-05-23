/**
 * Issue #1279 PR2b — dispatcher 语义等价矩阵 spec
 *
 * 不变式（structural invariants，非 byte-equal）：
 *   - AC-7 真实用户 prompt（6 条）：dispatcher.dispatch 必须产出 ≥1 条可执行语义节点
 *     （actions + risk + atoms[positionConstraint/orchestration] 之和 ≥ 1）。
 *     注：DCA / Grid 等纯执行策略 trigger=0 是正确语义（执行计划本身不是条件触发器），
 *     约束改为 actions+risk ≥ 1 而非强求 trigger ≥ 1。
 *   - AC-12 webhook prompt（2 条）：dispatcher.dispatch 必须产出 ≥1 条
 *     external.signal trigger 节点。
 *
 * 设计取舍：
 *   - byte-equal 与 legacy SemanticSeedExtractorService 的对比已被证伪
 *     （见 dispatcher-self-baseline.spec.ts 头注解），故此 spec 改测语义等价 invariants。
 *   - 此 spec 与 dispatcher-self-baseline.spec.ts 的边界：
 *     baseline 守"任何 dispatcher 改动必须显式重录"；本 spec 守"每条 prompt 有可执行动作"。
 *     两者互不替代——前者捕获回归，后者捕获语义崩塌。
 *   - prompt 列表共享自 ./fixtures/ac-prompts.ts，与 dispatcher-self-baseline.spec.ts
 *     校准同一组语料，避免 silent drift。
 *
 * #1378 统一 5 桶原子语义：
 *   dispatcher 不再把 positionConstraint/orchestration 镜像到 legacy actions/risk；
 *   这两类执行语义保留在 atoms[]，由 seed builder 按 registry bucket 统一归桶。
 *
 * Refs: #1279
 */
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { collectAtomLeaves, listRuleEffects } from '../../types/atom-expr'
import { AC7_USER_PROMPTS, AC12_WEBHOOK_PROMPTS } from './fixtures/ac-prompts'

type RuleLeaf = ReturnType<typeof collectAtomLeaves>[number] & { phase?: string }

function collectRuleLeaves(patch: ReturnType<GenericSeedDispatcher['dispatch']>): RuleLeaf[] {
  return (patch.rules ?? []).flatMap(rule => [
    ...collectAtomLeaves(rule.condition).map(leaf => ({ ...leaf, phase: rule.phase })),
    ...listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect).map(leaf => ({ ...leaf, phase: rule.phase }))),
  ])
}

function collectRuleEffectLeaves(patch: ReturnType<GenericSeedDispatcher['dispatch']>): RuleLeaf[] {
  return (patch.rules ?? []).flatMap(rule =>
    listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect).map(leaf => ({ ...leaf, phase: rule.phase }))),
  )
}

describe('issue #1279 PR2b — dispatcher semantic equivalence', () => {
  const dispatcher = new GenericSeedDispatcher()

  describe('ac-7：真实用户 prompt 必须产出可执行动作节点', () => {
    it.each(AC7_USER_PROMPTS)(
      '$id：dispatch 必须产出 ≥1 条可执行语义节点（5 桶原子语义）',
      ({ utterance }) => {
        const patch = dispatcher.dispatch(utterance)
        const executableCount = collectRuleEffectLeaves(patch).length

        // 5 桶闭环：DCA/Grid 等纯执行策略在 atoms[positionConstraint] 中合法。
        expect(executableCount).toBeGreaterThanOrEqual(1)
      },
    )
  })

  describe('ac-12：webhook prompt 必须命中 external.signal trigger', () => {
    it.each(AC12_WEBHOOK_PROMPTS)(
      '$id：dispatch 必须包含 ≥1 条 external.signal trigger',
      ({ utterance }) => {
        const patch = dispatcher.dispatch(utterance)
        const externalSignalHits = collectRuleLeaves(patch).filter(t => t.key === 'external.signal')
        expect(externalSignalHits.length).toBeGreaterThanOrEqual(1)
      },
    )
  })

  describe('user-reported semantic surface regressions', () => {
    it('parses Chinese percent price-change clauses without asking for entry/exit again', () => {
      const patch = dispatcher.dispatch('在okx交易所 我想买btc 3分钟之内跌百分1买入，15分钟之内涨百分2卖出，单笔用百分10资金，止损5% 止盈10%')
      const percentChangeTriggers = collectRuleLeaves(patch).filter(trigger => trigger.key === 'price.percent_change')

      expect(percentChangeTriggers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          phase: 'entry',
          params: expect.objectContaining({ direction: 'down', valuePct: -1 }),
        }),
        expect.objectContaining({
          phase: 'exit',
          params: expect.objectContaining({ direction: 'up', valuePct: 2 }),
        }),
      ]))
    })

    it('splits unpunctuated event clauses before risk percent clauses can pollute price-change params', () => {
      const patch = dispatcher.dispatch('在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金 止损5% 止盈10%')
      const percentChangeTriggers = collectRuleLeaves(patch).filter(trigger => trigger.key === 'price.percent_change')

      expect(percentChangeTriggers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          phase: 'entry',
          sideScope: 'long',
          params: expect.objectContaining({ direction: 'down', valuePct: -1 }),
        }),
        expect.objectContaining({
          phase: 'exit',
          sideScope: 'long',
          params: expect.objectContaining({ direction: 'up', valuePct: 2 }),
        }),
      ]))
      expect(percentChangeTriggers.map(trigger => trigger.params.valuePct)).not.toContain(-5)
      expect(percentChangeTriggers.map(trigger => trigger.params.valuePct)).not.toContain(5)
    })

    it('parses RSI parenthesized period and symbolic lte comparator as one complete entry atom', () => {
      const patch = dispatcher.dispatch('ETH 永续，15 分钟。RSI(14) ≤ 30 时开多，仓位的 2% ATR 作为止损。')
      const rsiTriggers = collectRuleLeaves(patch).filter(trigger => trigger.key === 'oscillator.rsi_lte')

      expect(rsiTriggers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          phase: 'entry',
          params: expect.objectContaining({
            period: 14,
            value: 30,
          }),
          sideScope: 'long',
        }),
      ]))
    })

    it('uses explicit entry action verbs for trigger sideScope before direction inheritance', () => {
      const patch = dispatcher.dispatch('RSI(14) ≤ 30 时开多')
      const rsiTrigger = collectRuleLeaves(patch).find(trigger => trigger.key === 'oscillator.rsi_lte')

      expect(rsiTrigger).toEqual(expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({ period: 14, value: 30 }),
      }))
    })

    it('expands multiple EMA static-compare references without using timeframe as period', () => {
      const patch = dispatcher.dispatch('15分钟 价格在ema20 ema60 ema144上方，出场 价格低于ema20')
      const abovePeriods = collectRuleLeaves(patch)
        .filter(trigger => trigger.key === 'indicator.above')
        .map(trigger => trigger.params['reference.period'])
        .sort((a, b) => Number(a) - Number(b))
      const belowTrigger = collectRuleLeaves(patch).find(trigger => trigger.key === 'indicator.below')

      expect(abovePeriods).toEqual([20, 60, 144])
      expect(abovePeriods).not.toContain(15)
      expect(belowTrigger).toEqual(expect.objectContaining({
        phase: 'exit',
        params: expect.objectContaining({ 'reference.period': 20 }),
      }))
    })

    it('extracts grid range roles and per-grid sizing from their own surfaces', () => {
      const patch = dispatcher.dispatch('网格 价格区间 60000-80000 每格间距 0.5% 单笔使用 10%')
      const gridAtom = collectRuleLeaves(patch).find(atom => atom.key === 'grid.range_rebalance')

      expect(gridAtom).toEqual(expect.objectContaining({
        params: expect.objectContaining({
          rangeLower: 60000,
          rangeUpper: 80000,
          perGridSizing: 0.1,
          perOrderSizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        }),
      }))
      expect(gridAtom?.params?.rangeUpper).not.toBe(60000)
      expect(gridAtom?.params?.perGridSizing).not.toBe(60000)
      expect(gridAtom?.params?.perGridSizing).not.toBe(0.5)
    })
  })
})
