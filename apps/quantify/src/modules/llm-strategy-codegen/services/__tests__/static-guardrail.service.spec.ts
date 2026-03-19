import { StaticGuardrailService } from '../static-guardrail.service'

describe('staticGuardrailService', () => {
  const service = new StaticGuardrailService()

  it('rejects forbidden token', () => {
    const result = service.validate('const x = eval("1+1")')
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('禁用能力')
  })

  it('rejects unauthorized helper namespace', () => {
    const result = service.validate('const x = helpers.custom.alpha()')
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('未授权 helper')
  })

  it('rejects dynamic helper bracket access', () => {
    const result = service.validate('const ns = \"ta\"; const x = helpers[ns].rsi([1,2,3], 2)')
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('动态 helper')
  })

  it('passes allowed helper namespace', () => {
    const result = service.validate('const x = helpers.ta.rsi([1,2,3], 2); return { direction: "BUY" }')
    expect(result.passed).toBe(true)
  })
})
