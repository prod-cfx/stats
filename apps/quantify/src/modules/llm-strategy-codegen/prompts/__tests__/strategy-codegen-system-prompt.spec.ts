import { buildStrategyCodegenSystemPrompt } from '../strategy-codegen-system.prompt'

describe('strategyCodegenSystemPrompt', () => {
  it('contains protocol contract and ctx documentation', () => {
    const prompt = buildStrategyCodegenSystemPrompt('- helpers.ta.sma(prices: number[], period: number): number | null')

    expect(prompt).toContain('你是量化策略脚本生成器（仅用于调试与对照，不是正式发布真源）。')
    expect(prompt).toContain('正式发布链路以 canonical -> IR -> AST -> compiled script 为准。')
    expect(prompt).toContain('不得假设自己输出的脚本会直接进入 published snapshot。')
    expect(prompt).toContain("protocolVersion: 'v1'")
    expect(prompt).toContain('const strategy: StrategyAdapterV1')
    expect(prompt).toContain('ctx.data')
    expect(prompt).toContain('ctx.paramsNormalized')
    expect(prompt).toContain('策略自定义字段可从 ctx.params 读取')
    expect(prompt).toContain('size.mode 必须是 "QTY"')
    expect(prompt).toContain('helpers.ta.sma')
  })

  it('describes codegen coverage in terms of semantic state or canonical semantics instead of checklist rules', () => {
    const prompt = buildStrategyCodegenSystemPrompt('- helpers.ta.sma(prices: number[], period: number): number | null')

    expect(prompt).toContain('semanticState')
    expect(prompt).toContain('canonical 语义')
    expect(prompt).toContain('禁止依赖旧 checklist 文本分类推断策略真实语义')
    expect(prompt).not.toContain('entryRules / exitRules / riskRules')
  })
})
