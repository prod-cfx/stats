import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'
import { SemanticPresentationRegistryService } from '../semantic-presentation-registry.service'

/**
 * #1217 follow-up：clarification 路径下"我当前理解的策略是：${summary}"长期只渲染
 * trigger + risk，遗漏 position 段（含 sizing 与 dca_schedule / pyramiding_limit
 * 等 constraint 显示），用户在 dev/prod 看到的现象就是输入完整 DCA 配置后 UI 仍
 * 回显成纯 sizing"仓位：100 USDT"，看似"DCA 没识别"。
 *
 * 修复：buildClarificationView 与 buildConversationView 对齐，summary 并入
 * positionSummary（即调用 buildPositionSummary 渲染 constraint）。
 */

describe('semantic-state-projection — buildClarificationView 包含 position 段', () => {
  const extractor = new SemanticSeedExtractorService()
  const builder = new SemanticSeedStateBuilderService()
  const registry = new SemanticAtomRegistryService()
  const presentation = new SemanticPresentationRegistryService(registry)
  const projection = new SemanticStateProjectionService(presentation)

  const dcaUtterance
    = 'OKX 现货 BTCUSDT 1h，RSI14 低于 30 开始 DCA，价格每跌 5% 补仓一次，每次 100 USDT，最多 4 次，总投入不超过 500 USDT，RSI14 高于 70 卖出。'

  it('DCA utterance — clarificationView.summary 应同时含 trigger / risk / position(sizing + dca_schedule) 段', () => {
    const state = builder.build(extractor.extract(dcaUtterance))!
    const summary = projection.buildClarificationView(state).summary

    expect(summary).toMatch(/RSI14/)
    expect(summary).toMatch(/仓位/)
    expect(summary).toMatch(/DCA/)
  })

  it('DCA utterance — clarificationView.summary 与 conversationView.summary 在 position 段保持一致', () => {
    const state = builder.build(extractor.extract(dcaUtterance))!
    const clarification = projection.buildClarificationView(state).summary
    const conversation = projection.buildConversationView(state).summary

    // conversation 比 clarification 多 actionSummary / orchestrationSummary，
    // 但 position 段（含 DCA 渲染）应一致；通过子串包含校验
    expect(conversation).toContain('DCA 补仓计划')
    expect(clarification).toContain('DCA 补仓计划')
  })

  it('纯 trigger + risk（无 position 段）utterance — clarificationView 退化到 trigger + risk 即可，不报错', () => {
    const state = builder.build(extractor.extract('OKX 合约 BTCUSDT 15m，价格突破 80000 开多，亏损 2% 止损。'))!
    const summary = projection.buildClarificationView(state).summary

    expect(typeof summary).toBe('string')
    expect(summary.length).toBeGreaterThan(0)
    // 不抛错也不破坏既有 trigger / risk 渲染
  })
})
