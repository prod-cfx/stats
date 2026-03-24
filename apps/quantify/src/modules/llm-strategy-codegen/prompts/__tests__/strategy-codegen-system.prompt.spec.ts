import { buildStrategyCodegenSystemPrompt } from '../strategy-codegen-system.prompt'

describe('strategyCodegenSystemPrompt', () => {
  it('contains protocol contract and ctx documentation', () => {
    const prompt = buildStrategyCodegenSystemPrompt('- helpers.ta.sma(prices: number[], period: number): number | null')

    expect(prompt).toContain("protocolVersion: 'v1'")
    expect(prompt).toContain('const strategy: StrategyAdapterV1')
    expect(prompt).toContain('ctx.data')
    expect(prompt).toContain('ctx.paramsNormalized')
    expect(prompt).toContain('size.mode 必须是 "QTY"')
    expect(prompt).toContain('helpers.ta.sma')
  })
})
