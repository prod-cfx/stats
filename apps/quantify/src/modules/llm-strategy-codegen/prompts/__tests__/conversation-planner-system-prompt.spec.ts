import { buildConversationPlannerSystemPrompt } from '../conversation-planner-system.prompt'

describe('conversationPlannerSystemPrompt', () => {
  it('enforces incremental extraction and preserves strong rule semantics', () => {
    const prompt = buildConversationPlannerSystemPrompt()

    expect(prompt).toContain('只能把用户当前消息或 currentLogic 中已经明确的规则写入 logic')
    expect(prompt).toContain('默认保留 currentLogic 中未被用户明确修改的字段')
    expect(prompt).toContain('entryRules / exitRules 中的每一条规则必须原子化表达')
    expect(prompt).toContain('禁止对规则进行抽象、总结或泛化')
    expect(prompt).toContain('对于包含数量/序列条件的规则（如“连续N根K线”），必须完整写入 logic')
    expect(prompt).toContain('如果某条规则无法清晰表达，应优先保持原始描述')
    expect(prompt).toContain('若缺少核心出场语义')
    expect(prompt).toContain('成对出现的多空规则必须完整保留')
    expect(prompt).toContain('“直接平仓”不能改写成“减仓”')
    expect(prompt).toContain('只允许你代为补齐交易所、周期、仓位等非核心元数据')
    expect(prompt).toContain('不得补写 entryRules/exitRules')
    expect(prompt).not.toContain('必须直接给出完整入场+出场规则草案')
  })
})
