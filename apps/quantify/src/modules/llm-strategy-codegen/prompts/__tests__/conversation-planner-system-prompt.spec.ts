import { buildConversationPlannerSystemPrompt } from '../conversation-planner-system.prompt'

describe('conversationPlannerSystemPrompt', () => {
  it('requires planner output to stay advisory and return semanticPatch instead of checklist patch fields', () => {
    const prompt = buildConversationPlannerSystemPrompt()

    expect(prompt).toContain('服务端 semanticState / clarificationState / compilation gate 是唯一权威')
    expect(prompt).toContain('logicReady 只是建议性自评')
    expect(prompt).toContain('semanticPatch')
    expect(prompt).not.toContain('entryRules')
    expect(prompt).not.toContain('exitRules')
    expect(prompt).not.toContain('riskRules')
    expect(prompt).not.toContain('ChecklistPayload')
  })

  it('forbids planner prompt from rewriting locked semantics', () => {
    const prompt = buildConversationPlannerSystemPrompt()

    expect(prompt).toContain('你的职责是生成 semantic planning notes 与自然语言交互，并给出可采纳的 semanticPatch 草案，不是定义真实策略状态')
    expect(prompt).toContain('不得覆盖当前消息未涉及的已锁定语义')
    expect(prompt).toContain('不得泛化已锁定规则，不得把精确规则回退为模板化摘要')
    expect(prompt).toContain('只输出 JSON，不要 markdown')
  })
})
