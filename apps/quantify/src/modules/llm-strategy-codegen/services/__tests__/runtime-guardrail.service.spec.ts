import { RuntimeGuardrailService } from '../runtime-guardrail.service'

describe('runtimeGuardrailService', () => {
  const service = new RuntimeGuardrailService()

  it('fails when script throws', async () => {
    const result = await service.validate('throw new Error("boom")')
    expect(result.runtimePassed).toBe(false)
  })

  it('fails when output is empty object', async () => {
    const result = await service.validate('return {}')
    expect(result.runtimePassed).toBe(true)
    expect(result.outputPassed).toBe(false)
  })

  it('passes when output is non-empty object', async () => {
    const result = await service.validate('return { direction: "BUY" }')
    expect(result.runtimePassed).toBe(true)
    expect(result.outputPassed).toBe(true)
  })
})
