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
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'

describe('issue #1338 — dispatcher cross_over double-period + 多原子并行命中互斥', () => {
  const dispatcher = new GenericSeedDispatcher()
  const utterance = 'BTC 永续，1 小时级别。EMA20 上穿 EMA50 时市价开多；EMA20 下穿 EMA50 时市价平多。'

  it('cross_over paramSlots：fastPeriod=20, slowPeriod=50（按位置而非同 pattern 重复）', () => {
    const patch = dispatcher.dispatch(utterance)
    const crossOverTrigger = (patch.triggers ?? []).find(
      (t): t is typeof t & { key: string } => (t as { key?: string }).key === 'indicator.cross_over',
    ) as { params?: Record<string, unknown> } | undefined
    expect(crossOverTrigger).toBeDefined()
    expect(crossOverTrigger!.params).toMatchObject({
      indicator: 'ema',
      fastPeriod: 20,
      slowPeriod: 50,
    })
  })

  it('cross_under paramSlots：fastPeriod=20, slowPeriod=50（与 cross_over 对称）', () => {
    const patch = dispatcher.dispatch(utterance)
    const crossUnderTrigger = (patch.triggers ?? []).find(
      t => (t as { key?: string }).key === 'indicator.cross_under',
    ) as { params?: Record<string, unknown> } | undefined
    expect(crossUnderTrigger).toBeDefined()
    expect(crossUnderTrigger!.params).toMatchObject({
      indicator: 'ema',
      fastPeriod: 20,
      slowPeriod: 50,
    })
  })

  it('spec 不再含 indicator.above / indicator.below（同从句 cross_over 命中时 above/below 被抑制）', () => {
    const patch = dispatcher.dispatch(utterance)
    const triggerKeys = (patch.triggers ?? []).map(t => (t as { key?: string }).key)
    expect(triggerKeys).not.toContain('indicator.above')
    expect(triggerKeys).not.toContain('indicator.below')
  })

  it('spec 不再含 position.no_position（旧 verb 时 单边匹配已修复）', () => {
    const patch = dispatcher.dispatch(utterance)
    const triggerKeys = (patch.triggers ?? []).map(t => (t as { key?: string }).key)
    expect(triggerKeys).not.toContain('position.no_position')
    expect(triggerKeys).not.toContain('position.has_position')
  })

  it('triggers 恰 2 条：cross_over@entry@long + cross_under@exit@long', () => {
    const patch = dispatcher.dispatch(utterance)
    const triggers = (patch.triggers ?? []) as Array<{ key: string, phase: string, sideScope: string }>
    expect(triggers.length).toBe(2)

    const co = triggers.find(t => t.key === 'indicator.cross_over')!
    const cu = triggers.find(t => t.key === 'indicator.cross_under')!
    expect(co).toMatchObject({ phase: 'entry', sideScope: 'long' })
    expect(cu).toMatchObject({ phase: 'exit', sideScope: 'short' })
  })

  it('cross_over RSI 形态：period=14, value=70（与 fast/slow 位置语义对齐）', () => {
    const patch = dispatcher.dispatch('RSI14 上穿 70 时开多')
    const crossOverTrigger = (patch.triggers ?? []).find(
      t => (t as { key?: string }).key === 'indicator.cross_over',
    ) as { params?: Record<string, unknown> } | undefined
    expect(crossOverTrigger).toBeDefined()
    expect(crossOverTrigger!.params).toMatchObject({
      indicator: 'rsi',
      period: 14,
      value: 70,
    })
  })
})
