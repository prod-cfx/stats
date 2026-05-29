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
})
