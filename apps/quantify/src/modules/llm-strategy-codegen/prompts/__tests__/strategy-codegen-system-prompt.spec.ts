import { buildStrategyCodegenSystemPrompt } from '../strategy-codegen-system.prompt'

describe('strategyCodegenSystemPrompt', () => {
  it('contains protocol contract and ctx documentation', () => {
    const prompt = buildStrategyCodegenSystemPrompt('- helpers.ta.sma(prices: number[], period: number): number | null')

    expect(prompt).toContain("protocolVersion: 'v1'")
    expect(prompt).toContain('const strategy: StrategyAdapterV1')
    expect(prompt).toContain('ctx.data')
    expect(prompt).toContain('ctx.paramsNormalized')
    expect(prompt).toContain('策略自定义字段可从 ctx.params 读取')
    expect(prompt).toContain('size.mode 必须是 "QTY"')
    expect(prompt).toContain('helpers.ta.sma')
  })

  it('requires rule-by-rule coverage from checklist to code', () => {
    const prompt = buildStrategyCodegenSystemPrompt('- helpers.ta.sma(prices: number[], period: number): number | null')

    expect(prompt).toContain('需求和约束中的每一条 entryRules / exitRules，以及会影响运行时决策的 riskRules，都必须在代码中有明确对应实现')
    expect(prompt).toContain('每一条 entryRules / exitRules / riskRules，都必须对应代码中的一个独立条件判断或执行分支')
    expect(prompt).toContain('禁止将多个 exit 或 risk 规则合并为单一 if 条件')
    expect(prompt).toContain('对于“连续 N 根 K 线”类规则，必须显式实现逐 bar 计数或序列判断逻辑')
    expect(prompt).toContain('若某条规则实现复杂，必须优先用最直接方式实现')
    expect(prompt).toContain('禁止遗漏任何已经明确的策略规则')
    expect(prompt).toContain('禁止把强语义规则弱化')
    expect(prompt).toContain('“直接平仓”不能实现成“减仓”')
    expect(prompt).toContain('不要为了“覆盖”而伪造无意义的运行时代码分支')
    expect(prompt).toContain('生成前先逐条检查需求和约束里的规则是否都已覆盖')
  })
})
