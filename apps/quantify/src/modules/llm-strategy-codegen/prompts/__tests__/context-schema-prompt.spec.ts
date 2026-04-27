import { buildContextSchemaPrompt } from '../context-schema.prompt'

describe('contextSchemaPrompt', () => {
  it('contains shared ctx-related type declarations', () => {
    const prompt = buildContextSchemaPrompt()

    expect(prompt).toContain('interface Bar')
    expect(prompt).toContain('interface StrategyParamsNormalized')
    expect(prompt).toContain('interface LegTimeframeData')
    expect(prompt).toContain('interface StrategyContext')
    expect(prompt).toContain('interface MultiLegStrategyContext')
  })

  it('contains strict runtime usage rules', () => {
    const prompt = buildContextSchemaPrompt()

    expect(prompt).toContain('ctx.paramsNormalized')
    expect(prompt).toContain('策略自定义字段可从 ctx.params 读取')
    expect(prompt).toContain('ctx.data / ctx.execution / ctx.legs / ctx.dataRequirements')
    expect(prompt).toContain('不要访问未声明字段')
    expect(prompt).toContain('不要从脚本文本反推策略语义')
    expect(prompt).toContain('只把 ctx 当作运行时输入协议')
  })
})
