/**
 * Issue #1279 PR2b — dispatcher 语义等价矩阵 spec
 *
 * 不变式（structural invariants，非 byte-equal）：
 *   - AC-7 真实用户 prompt（6 条）：dispatcher.dispatch 必须产出 ≥1 条可执行动作节点
 *     （actions + risk 之和 ≥ 1）。
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
 * PR2c5 恢复双段约束（refs #1279）：
 *   BUCKET_TO_PATCH_SLOT 接入 positionConstraint→actions + orchestration→risk 后，
 *   ac-7-user-4/5/6 的 grid/dca/pyramiding atom 正确流到 patch.actions 段，
 *   所有 6 条 prompt 满足 actions+risk ≥ 1 约束——已撤销 hotfix #1294 回退，恢复双段约束。
 *
 * Refs: #1279
 */
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { AC7_USER_PROMPTS, AC12_WEBHOOK_PROMPTS } from './fixtures/ac-prompts'

describe('issue #1279 PR2b — dispatcher semantic equivalence', () => {
  const dispatcher = new GenericSeedDispatcher()

  describe('ac-7：真实用户 prompt 必须产出可执行动作节点', () => {
    it.each(AC7_USER_PROMPTS)(
      '$id：dispatch 必须产出 ≥1 条 actions 或 risk 节点（双段约束已恢复 — refs PR2c5）',
      ({ utterance }) => {
        const patch = dispatcher.dispatch(utterance)
        const actionCount = patch.actions?.length ?? 0
        const riskCount = patch.risk?.length ?? 0
        const executableCount = actionCount + riskCount

        // PR2c5 恢复双段约束：actions+risk ≥ 1（DCA/Grid 等纯执行策略 trigger=0 合法）。
        // 原 hotfix #1294 回退的 "total ≥ 1" 已废弃，见文件头注解。
        expect(executableCount).toBeGreaterThanOrEqual(1)
      },
    )
  })

  describe('ac-12：webhook prompt 必须命中 external.signal trigger', () => {
    it.each(AC12_WEBHOOK_PROMPTS)(
      '$id：dispatch 必须包含 ≥1 条 external.signal trigger',
      ({ utterance }) => {
        const patch = dispatcher.dispatch(utterance)
        const triggers = patch.triggers ?? []
        const externalSignalHits = triggers.filter(t => t.key === 'external.signal')
        expect(externalSignalHits.length).toBeGreaterThanOrEqual(1)
      },
    )
  })

  describe('user-reported semantic surface regressions', () => {
    it('parses Chinese percent price-change clauses without asking for entry/exit again', () => {
      const patch = dispatcher.dispatch('在okx交易所 我想买btc 3分钟之内跌百分1买入，15分钟之内涨百分2卖出，单笔用百分10资金，止损5% 止盈10%')
      const percentChangeTriggers = patch.triggers?.filter(trigger => trigger.key === 'price.percent_change') ?? []

      expect(percentChangeTriggers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          phase: 'entry',
          params: expect.objectContaining({ direction: 'down', valuePct: -0.01 }),
        }),
        expect.objectContaining({
          phase: 'exit',
          params: expect.objectContaining({ direction: 'up', valuePct: 0.02 }),
        }),
      ]))
    })

    it('splits unpunctuated event clauses before risk percent clauses can pollute price-change params', () => {
      const patch = dispatcher.dispatch('在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金 止损5% 止盈10%')
      const percentChangeTriggers = patch.triggers?.filter(trigger => trigger.key === 'price.percent_change') ?? []

      expect(percentChangeTriggers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          phase: 'entry',
          sideScope: 'long',
          params: expect.objectContaining({ direction: 'down', valuePct: -0.01 }),
        }),
        expect.objectContaining({
          phase: 'exit',
          sideScope: 'long',
          params: expect.objectContaining({ direction: 'up', valuePct: 0.02 }),
        }),
      ]))
      expect(percentChangeTriggers.map(trigger => trigger.params.valuePct)).not.toContain(-0.05)
      expect(percentChangeTriggers.map(trigger => trigger.params.valuePct)).not.toContain(0.05)
    })

    it('parses RSI parenthesized period and symbolic lte comparator as one complete entry atom', () => {
      const patch = dispatcher.dispatch('ETH 永续，15 分钟。RSI(14) ≤ 30 时开多，仓位的 2% ATR 作为止损。')
      const rsiTriggers = patch.triggers?.filter(trigger => trigger.key === 'oscillator.rsi_lte') ?? []

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
      const rsiTrigger = patch.triggers?.find(trigger => trigger.key === 'oscillator.rsi_lte')

      expect(rsiTrigger).toEqual(expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({ period: 14, value: 30 }),
      }))
    })

    it('expands multiple EMA static-compare references without using timeframe as period', () => {
      const patch = dispatcher.dispatch('15分钟 价格在ema20 ema60 ema144上方，出场 价格低于ema20')
      const abovePeriods = (patch.triggers ?? [])
        .filter(trigger => trigger.key === 'indicator.above')
        .map(trigger => trigger.params['reference.period'])
        .sort((a, b) => Number(a) - Number(b))
      const belowTrigger = (patch.triggers ?? []).find(trigger => trigger.key === 'indicator.below')

      expect(abovePeriods).toEqual([20, 60, 144])
      expect(abovePeriods).not.toContain(15)
      expect(belowTrigger).toEqual(expect.objectContaining({
        phase: 'exit',
        params: expect.objectContaining({ 'reference.period': 20 }),
      }))
    })

    it('extracts grid range roles and per-grid sizing from their own surfaces', () => {
      const patch = dispatcher.dispatch('网格 价格区间 60000-80000 每格间距 0.5% 单笔使用 10%')
      const gridAction = patch.actions?.find(action => action.key === 'grid.range_rebalance')

      expect(gridAction).toEqual(expect.objectContaining({
        params: expect.objectContaining({
          rangeLower: 60000,
          rangeUpper: 80000,
          perGridSizing: 0.1,
          perOrderSizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        }),
      }))
      expect(gridAction?.params.rangeUpper).not.toBe(60000)
      expect(gridAction?.params.perGridSizing).not.toBe(60000)
      expect(gridAction?.params.perGridSizing).not.toBe(0.5)
    })
  })
})
