import { compileStrategyScriptForVm } from '../strategy-script-compiler.util'

describe('strategyScriptCompilerUtil', () => {
  it('keeps legacy js script unchanged', () => {
    const source = 'return { direction: "BUY" }'
    const compiled = compileStrategyScriptForVm(source)

    expect(compiled.ok).toBe(true)
    expect(compiled.isTypeScript).toBe(false)
    expect(compiled.executableCode).toBe(source)
  })

  it('type-checks and transpiles strategy adapter ts', () => {
    const source = `
const strategy: StrategyAdapterV1 = {
  protocolVersion: "v1",
  onBar(ctx: Record<string, unknown>): StrategyDecisionV1 {
    return {
      action: "NOOP",
      confidence: 80,
      reason: "hold"
    }
  }
}
strategy
`
    const compiled = compileStrategyScriptForVm(source)
    expect(compiled.ok).toBe(true)
    expect(compiled.isTypeScript).toBe(true)
    expect(compiled.executableCode).toContain('const strategy')
  })

  it('fails when adapter protocolVersion is invalid', () => {
    const source = `
const strategy: StrategyAdapterV1 = {
  protocolVersion: "v2",
  onBar(ctx: Record<string, unknown>): StrategyDecisionV1 {
    return { action: "NOOP" }
  }
}
strategy
`
    const compiled = compileStrategyScriptForVm(source)
    expect(compiled.ok).toBe(false)
    expect(compiled.error).toContain('"v2"')
    expect(compiled.error).toContain('"v1"')
  })
})
