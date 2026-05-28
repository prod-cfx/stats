/**
 * Issue #1707 Gap C — dispatcher 在"识别到 sizing 意图但 extractor 没产出 sizing 形状"
 * 时不应硬塞一个 params={phase:'entry'} 的空 `position.sizing` atom。
 *
 * 旧行为：
 *   原 generic-seed-dispatcher.collectTypedRuleGlobalEffects 的 else-if 分支在
 *   `hasSizingIntent(userMessage)` 命中但 `flatPatch.position?.sizing` 缺失时硬 push
 *   `{ key:'position.sizing', params:{ phase:'entry' } }` 进 rules tree。结果：
 *     - PerTradeSizingResolver (d) `tryReadSizingShape(params.sizing)` → null
 *     - PerTradeSizingResolver (c) 在 Gap B 修复前也拿不到 capability evidence
 *     - clarification 仍要追问 sizing，但 rules tree 已落入"看似有 position role
 *       leaf、实际零 anchor"的灰色态，干扰下游 readiness / 渲染。
 *
 * 期望：dispatcher 在 sizing 形状缺失时不 emit；clarification + readiness 各自负责报缺。
 */

import { collectAtomLeaves } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'

describe('Issue #1707 Gap C — dispatcher empty position.sizing fallback removed', () => {
  const service = new GenericSeedDispatcher()

  function positionLeavesFromRules(patch: ReturnType<GenericSeedDispatcher['dispatch']>) {
    return (patch.rules ?? []).flatMap((rule) => {
      const positions = (rule.effects as { positions?: ReadonlyArray<unknown> }).positions ?? []
      return positions.flatMap((effect) => collectAtomLeaves(effect as Parameters<typeof collectAtomLeaves>[0]))
    })
  }

  it('utterance with sizing keyword but no numeric shape → no position.sizing atom emitted', () => {
    // 用户表述含"仓位"关键词但完全没给数值（既不是百分比、也不是定额），
    // dispatcher 不应该凭空 emit 一个空形状的 position.sizing。
    const patch = service.dispatch('BTC 突破前高时开多，控制好仓位风险')
    const positionSizing = positionLeavesFromRules(patch).filter(l => l.key === 'position.sizing')
    expect(positionSizing).toEqual([])
  })

  it('utterance with sizing keyword but no shape → spine 不含 sizing leaf（防御性，证明上游不会因 Gap C 删 fallback 而漏 emit 真 sizing）', () => {
    // 与 #30 case 等价方向：确认删 fallback 后 dispatcher.dispatch 整体输出不再
    // 产生"有 position.sizing key 但 params.sizing 缺失"的污染 leaf。
    // 下游 readiness 由 PerTradeSizingResolver 拿不到 anchor 自然报 missing，
    // 不依赖 dispatcher 在此处占位 emit。
    const patch = service.dispatch('帮我做个量化策略，控制仓位')
    const sizingLeaves = positionLeavesFromRules(patch).filter(l => l.key === 'position.sizing')
    expect(sizingLeaves).toEqual([])
    // 不存在「key=position.sizing 但 params.sizing 为空」的污染 leaf
    expect(sizingLeaves.every(l => l.params && 'sizing' in (l.params as Record<string, unknown>))).toBe(true)
  })

  it('utterance with explicit "10%" sizing → position.sizing emitted with concrete shape', () => {
    // 控制 case：当 extractor 抓到 sizing 形状（"仓位 10%"），dispatcher 必须 emit
    // 带有 params.sizing 的真 atom（resolver 仍能 anchor）。
    const patch = service.dispatch('BTC 突破前高时开多 10% 仓位')
    const positionSizing = positionLeavesFromRules(patch).filter(l => l.key === 'position.sizing')
    expect(positionSizing.length).toBeGreaterThanOrEqual(1)
    expect(positionSizing[0].params).toEqual(expect.objectContaining({
      sizing: expect.objectContaining({ kind: 'ratio' }),
    }))
  })
})
