import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'
import { SemanticPresentationRegistryService } from '../semantic-presentation-registry.service'
import type { SemanticState } from '../../types/semantic-state'

/**
 * #1238 follow-up：clarification 路径下"我当前理解的策略是：${summary}"长期只渲染
 * trigger + risk，遗漏 position 段（含 sizing 与 dca_schedule / pyramiding_limit
 * 等 constraint 显示），用户在 dev/prod 看到的现象就是输入完整 DCA 配置后 UI 仍
 * 回显成纯 sizing"仓位：100 USDT"，看似"DCA 没识别"。
 *
 * 修复：buildClarificationView 与 buildConversationView 对齐，summary 并入
 * positionSummary（即调用 buildPositionSummary 渲染 constraint）。
 *
 * Registry / projection 共享生命周期说明：SemanticAtomRegistryService 与
 * SemanticPresentationRegistryService 当前均为构造期一次性注册，跨 it 共享安全；
 * 若未来引入 lazy 注册需要改 beforeEach。
 */

describe('semantic-state-projection — buildClarificationView 包含 position 段', () => {
  const extractor = new SemanticSeedExtractorService()
  const builder = new SemanticSeedStateBuilderService()
  const registry = new SemanticAtomRegistryService()
  const presentation = new SemanticPresentationRegistryService(registry)
  const projection = new SemanticStateProjectionService(presentation)

  function buildStateOrFail(utterance: string): SemanticState {
    const patch = extractor.extract(utterance)
    const state = builder.build(patch)
    expect(state).toBeTruthy()
    return state!
  }

  const dcaUtterance
    = 'OKX 现货 BTCUSDT 1h，RSI14 低于 30 开始 DCA，价格每跌 5% 补仓一次，每次 100 USDT，最多 4 次，总投入不超过 500 USDT，RSI14 高于 70 卖出。'

  it('DCA utterance — clarificationView.summary 必须含精确 position 段："仓位：100 USDT" + "DCA 补仓计划"', () => {
    const state = buildStateOrFail(dcaUtterance)
    const summary = projection.buildClarificationView(state).summary

    // 精确锚定 position 段被并入 —— 把 PR 改动回滚后这两条会同时挂
    expect(summary).toContain('仓位：100 USDT')
    expect(summary).toContain('DCA 补仓计划')
    // DCA 关键参数 maxCount=4 一并锁住，防 buildPositionSummary 退化只渲染 sizing
    expect(summary).toContain('最多 4 次')
  })

  it('DCA utterance — clarificationView 与 conversationView 在 position 段保持一致', () => {
    const state = buildStateOrFail(dcaUtterance)
    const clarification = projection.buildClarificationView(state).summary
    const conversation = projection.buildConversationView(state).summary

    // 同一份 state 下两条路径都必须含完整 position 段；conversation 还会多渲染
    // actionSummary / orchestrationSummary 等，故只比对 position 段子串
    for (const fragment of ['仓位：100 USDT', 'DCA 补仓计划', '最多 4 次']) {
      expect(conversation).toContain(fragment)
      expect(clarification).toContain(fragment)
    }
  })

  it('pyramiding_limit utterance（含 sizing）— clarificationView.summary 含"最多 N 次加仓"段', () => {
    // 用 utterance 触发 position.pyramiding_limit 路径，验证 position 段在非 dca_schedule
    // constraint 下也能被 buildPositionSummary 渲染并并入 clarification summary。
    // buildPositionSummary 在 sizing 非空时优先走 pyramiding_limit 简化输出
    // （service.ts:2330），必须显式给 sizing 才能命中渲染分支。
    const state = buildStateOrFail('OKX 合约 BTCUSDT 15m，使用 10% 仓位，MA20 上穿 MA50 开多，盈利后加仓，最多 3 次。')
    const summary = projection.buildClarificationView(state).summary
    // 至少能看见 position 段（仓位 + 加仓次数任一）；具体文案以 buildPositionSummary 输出为准
    const hasPositionFragment = /仓位/.test(summary) || /加仓/.test(summary) || /最多\s*3\s*次/.test(summary)
    expect(hasPositionFragment).toBe(true)
  })

  it('纯 trigger + risk utterance（无 position 段）— clarificationView 退化到 trigger + risk，不抛错也不留悬挂分隔符', () => {
    const state = buildStateOrFail('OKX 合约 BTCUSDT 15m，价格突破 80000 开多，亏损 2% 止损。')
    const summary = projection.buildClarificationView(state).summary

    expect(typeof summary).toBe('string')
    expect(summary.length).toBeGreaterThan(0)
    // 不能出现 "仓位：" / "DCA" 段
    expect(summary).not.toContain('仓位：')
    expect(summary).not.toContain('DCA')
    // 防 join('；') 留下悬挂分隔符（"...；" 结尾或 "；；" 中间）
    expect(summary.endsWith('；')).toBe(false)
    expect(summary).not.toMatch(/；；/)
  })

  it('state.position = null — clarificationView 不抛错，summary 不含 position 段', () => {
    const state = buildStateOrFail(dcaUtterance)
    // 显式清掉 position 模拟 builder 边界场景（实际 builder 不会回 null，但
    // SemanticState.position 类型允许 null，buildPositionSummary 早退分支必须覆盖）
    state.position = null
    const view = projection.buildClarificationView(state)
    expect(typeof view.summary).toBe('string')
    expect(view.summary.length).toBeGreaterThan(0)
    expect(view.summary).not.toContain('仓位：')
    expect(view.summary).not.toContain('DCA 补仓计划')
  })
})
