/**
 * Issue #1338 invariant spec
 *
 * 守门以下不变量（避免 dispatcher 退化回 rule 爆炸 / fast==slow）：
 *   1. cross_over / cross_under paramSlots 双数字按位置分流：
 *      fastPeriod = 第 1 个数（index 0），slowPeriod = 第 2 个数（index 1）
 *   2. dispatcher.matchSurface 需 kw && verb 同时命中（旧逻辑 kw||verb 引发并行规则爆炸）
 *   3. 'EMA20 上穿 EMA50 时市价开多；EMA20 下穿 EMA50 时市价平多' 形态：
 *      - 不再命中 indicator.above / indicator.below
 *      - 不再命中 position.no_position（旧 verb '时' 单边匹配）
 *      - 触发恰 2 条：cross_over@entry@long + cross_under@exit@long
 *
 * Refs: #1338
 */
import { collectAtomLeaves } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'

describe('issue #1338 — dispatcher cross_over double-period + 多原子并行命中互斥', () => {
  const dispatcher = new GenericSeedDispatcher()
  const utterance = 'BTC 永续，1 小时级别。EMA20 上穿 EMA50 时市价开多；EMA20 下穿 EMA50 时市价平多。'
  type TypedLeaf = ReturnType<typeof collectRuleConditionLeaves>[number]

  function collectRuleConditionLeaves(patch: ReturnType<GenericSeedDispatcher['dispatch']>) {
    return (patch.rules ?? []).flatMap(rule =>
      collectAtomLeaves(rule.condition).map(leaf => ({ ...leaf, phase: rule.phase, sideScope: leaf.sideScope ?? rule.sideScope })),
    )
  }

  it('cross_over paramSlots：fastPeriod=20, slowPeriod=50（按位置而非同 pattern 重复）', () => {
    const patch = dispatcher.dispatch(utterance)
    const crossOverTrigger = collectRuleConditionLeaves(patch).find(
      (t): t is TypedLeaf => t.key === 'indicator.cross_over',
    )
    expect(crossOverTrigger).toBeDefined()
    expect(crossOverTrigger!.params).toMatchObject({
      indicator: 'ema',
      fastPeriod: 20,
      slowPeriod: 50,
    })
  })

  it('cross_over paramSlots：MA 6/48 斜杠写法保留 fastPeriod=6, slowPeriod=48', () => {
    const patch = dispatcher.dispatch('OKX 模拟盘 BTC-USDT-SWAP 合约 15m，MA 6/48 均线交叉趋势跟随，MA6 上穿 MA48 做多，仓位 35%。')
    const crossOverTrigger = collectRuleConditionLeaves(patch).find(
      (t): t is TypedLeaf => t.key === 'indicator.cross_over',
    )
    expect(crossOverTrigger).toBeDefined()
    expect(crossOverTrigger!.params).toMatchObject({
      indicator: 'ma',
      fastPeriod: 6,
      slowPeriod: 48,
    })
  })

  it('cross_under paramSlots：fastPeriod=20, slowPeriod=50（与 cross_over 对称）', () => {
    const patch = dispatcher.dispatch(utterance)
    const crossUnderTrigger = collectRuleConditionLeaves(patch).find(t => t.key === 'indicator.cross_under')
    expect(crossUnderTrigger).toBeDefined()
    expect(crossUnderTrigger!.params).toMatchObject({
      indicator: 'ema',
      fastPeriod: 20,
      slowPeriod: 50,
    })
  })

  it('spec 不再含 indicator.above / indicator.below（同从句 cross_over 命中时 above/below 被抑制）', () => {
    const patch = dispatcher.dispatch(utterance)
    const triggerKeys = collectRuleConditionLeaves(patch).map(t => t.key)
    expect(triggerKeys).not.toContain('indicator.above')
    expect(triggerKeys).not.toContain('indicator.below')
  })

  it('spec 不再含 position.no_position（旧 verb 时 单边匹配已修复）', () => {
    const patch = dispatcher.dispatch(utterance)
    const triggerKeys = collectRuleConditionLeaves(patch).map(t => t.key)
    expect(triggerKeys).not.toContain('position.no_position')
    expect(triggerKeys).not.toContain('position.has_position')
  })

  it('triggers 恰 2 条：cross_over@entry@long + cross_under@exit@long（issue #1338 AC sideScope=long 单边）', () => {
    const patch = dispatcher.dispatch(utterance)
    const triggers = collectRuleConditionLeaves(patch)
    expect(triggers.length).toBe(2)

    const co = triggers.find(t => t.key === 'indicator.cross_over')!
    const cu = triggers.find(t => t.key === 'indicator.cross_under')!
    // entry：cross_over direction → long（DIRECTION_TO_SIDE 直接派生）
    expect(co).toMatchObject({ phase: 'entry', sideScope: 'long' })
    // exit：'平多' close-verb 覆盖 cross_under → short 派生，回归 long（平的是多仓）。
    // 这是 Issue #1338 验收标准 3（sideScope = long 单边）的核心断言。
    expect(cu).toMatchObject({ phase: 'exit', sideScope: 'long' })
  })

  it('反例：仅 kw 命中（无 direction verb）不应触发 cross_over（守 kw && direction 双闸口）', () => {
    // 'EMA20 高于 EMA50'：EMA kw 在 cross_over.keywords 中，但 '上穿/金叉' verbs 全部不命中。
    // 旧逻辑 kw||direction 会误触；新逻辑 kw && direction 必须双命中。
    const patch = dispatcher.dispatch('EMA20 高于 EMA50 时开多')
    const triggerKeys = collectRuleConditionLeaves(patch).map(t => t.key)
    expect(triggerKeys).not.toContain('indicator.cross_over')
    expect(triggerKeys).not.toContain('indicator.cross_under')
  })

  it('反例：仅 verb 命中（无 kw 主语）不应触发 cross_over', () => {
    // '上穿' 是 cross_over verb，但 'EMA/MA/RSI' 等 kw 全部缺席（用 BTC 替代避免 kw 命中）。
    const patch = dispatcher.dispatch('上穿 时开多')
    const triggerKeys = collectRuleConditionLeaves(patch).map(t => t.key)
    expect(triggerKeys).not.toContain('indicator.cross_over')
  })

  it('单 EMA 上穿不应自动漂移成 priceCross，需保留缺慢线语义', () => {
    const patch = dispatcher.dispatch('BTCUSDT 15m。EMA20 上穿开多，但需要 OKX orderbook imbalance 大于 60% 确认。')
    const crossOverTrigger = collectRuleConditionLeaves(patch).find(t => t.key === 'indicator.cross_over')
    expect(crossOverTrigger).toBeDefined()
    expect(crossOverTrigger!.params).toMatchObject({ indicator: 'ema', fastPeriod: 20 })
    expect(crossOverTrigger!.params).not.toHaveProperty('priceCross')
  })

  it('明确价格主语时单 EMA 上穿才投影为 priceCross', () => {
    const patch = dispatcher.dispatch('BTCUSDT 15m，价格上穿 EMA20 时开多')
    const crossOverTrigger = collectRuleConditionLeaves(patch).find(t => t.key === 'indicator.cross_over')
    expect(crossOverTrigger).toBeDefined()
    expect(crossOverTrigger!.params).toMatchObject({ indicator: 'ema', fastPeriod: 20, period: 20, priceCross: true })
  })

  it('cross_over RSI 形态：period=14, value=70（与 fast/slow 位置语义对齐）', () => {
    const patch = dispatcher.dispatch('RSI14 上穿 70 时开多')
    const crossOverTrigger = collectRuleConditionLeaves(patch).find(t => t.key === 'indicator.cross_over')
    expect(crossOverTrigger).toBeDefined()
    expect(crossOverTrigger!.params).toMatchObject({
      indicator: 'rsi',
      period: 14,
      value: 70,
    })
  })

  it('range low buy clause with 买入 resolves entry predicate and 25% sizing', () => {
    const patch = dispatcher.dispatch('基于 OKX 模拟盘 BTC-USDT 现货 15m，创建区间低买高卖策略。入场规则：价格位于最近 36 根 K 线区间下 20% 时买入；出场规则：价格回到区间上 55% 或盈利达到 0.45% 时卖出平仓；风控：单次仓位 25%，不使用杠杆，止损 3%。')
    const entryRule = patch.rules?.find(rule => rule.phase === 'entry')
    const entryLeaves = entryRule ? collectAtomLeaves(entryRule.condition) : []
    const positionLeaves = entryRule
      ? Object.values(entryRule.effects)
          .flatMap(effects => effects)
          .flatMap(effect => collectAtomLeaves(effect))
          .filter(leaf => leaf.key === 'position.sizing')
      : []

    expect(entryLeaves).toEqual([expect.objectContaining({
      key: 'price.range_position_lte',
      params: expect.objectContaining({ lookbackBars: 36, thresholdPct: 20 }),
    })])
    expect(positionLeaves).toEqual([expect.objectContaining({
      params: expect.objectContaining({ sizing: { kind: 'ratio', value: 0.25, unit: 'ratio' } }),
    })])
  })
})
