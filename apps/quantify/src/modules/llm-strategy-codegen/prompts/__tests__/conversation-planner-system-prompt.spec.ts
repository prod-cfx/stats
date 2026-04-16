import { buildConversationPlannerSystemPrompt } from '../conversation-planner-system.prompt'

describe('conversationPlannerSystemPrompt', () => {
  it('requires semantic update candidates instead of checklist patch output', () => {
    const prompt = buildConversationPlannerSystemPrompt()

    expect(prompt).toContain('程序化决策层决定 DIRECT_COMPILE / CONFIRM_INFERRED / ASK_CLARIFY')
    expect(prompt).toContain('"semanticUpdates"')
    expect(prompt).not.toContain('"entryRules"?: string[]')
    expect(prompt).not.toContain('"exitRules"?: string[]')
  })

  it('forbids planner prompt from rewriting locked semantics', () => {
    const prompt = buildConversationPlannerSystemPrompt()

    expect(prompt).toContain('你的职责是生成 semantic update candidates 与自然语言交互，不是定义真实策略状态')
    expect(prompt).toContain('不得覆盖当前消息未涉及的已锁定语义')
    expect(prompt).toContain('不得泛化已锁定规则，不得把精确规则回退为模板化摘要')
    expect(prompt).toContain('只输出 JSON，不要 markdown')
  })
})
