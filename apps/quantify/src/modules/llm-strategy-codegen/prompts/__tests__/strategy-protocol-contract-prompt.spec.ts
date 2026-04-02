import { buildStrategyProtocolTypeContractPrompt } from '../strategy-protocol-contract.prompt'

describe('strategyProtocolContractPrompt', () => {
  it('contains shared protocol declarations and type bindings', () => {
    const prompt = buildStrategyProtocolTypeContractPrompt()

    expect(prompt).toContain("type StrategyAction =")
    expect(prompt).toContain('interface StrategyDecisionV1')
    expect(prompt).toContain('interface StrategyAdapterV1')
    expect(prompt).toContain("type StrategyAdapterV1 = import('@ai/shared').StrategyAdapterV1")
    expect(prompt).toContain('const strategy: StrategyAdapterV1 = {')
    expect(prompt).toContain("protocolVersion: 'v1'")
  })

  it('returns stable content across repeated calls', () => {
    const first = buildStrategyProtocolTypeContractPrompt()
    const second = buildStrategyProtocolTypeContractPrompt()

    expect(second).toBe(first)
  })
})
