import { RuntimeGuardrailService } from '../runtime-guardrail.service'

describe('runtimeGuardrailService', () => {
  const service = new RuntimeGuardrailService()
  const validPayload = '{ direction: "BUY", signalType: "ENTRY", confidence: 80, entryPrice: 101, stopLoss: 99, takeProfit: 106, reasoning: "breakout confirmed", positionSizeRatio: 0.2 }'

  it('fails when script throws', async () => {
    const result = await service.validate('throw new Error("boom")')
    expect(result.runtimePassed).toBe(false)
  })

  it('fails when output is empty object', async () => {
    const result = await service.validate('return {}')
    expect(result.runtimePassed).toBe(true)
    expect(result.outputPassed).toBe(false)
  })

  it('fails when required fields are missing', async () => {
    const result = await service.validate('return { direction: "BUY" }')
    expect(result.runtimePassed).toBe(true)
    expect(result.outputPassed).toBe(false)
    expect(result.reason).toContain('signalType')
  })

  it('fails when confidence is out of range', async () => {
    const result = await service.validate(
      'return { direction: "BUY", signalType: "ENTRY", confidence: 120, entryPrice: 101, stopLoss: 99, takeProfit: 106, reasoning: "x" }',
    )
    expect(result.runtimePassed).toBe(true)
    expect(result.outputPassed).toBe(false)
    expect(result.reason).toContain('confidence')
  })

  it('fails when both position size fields are present', async () => {
    const result = await service.validate(
      'return { direction: "BUY", signalType: "ENTRY", confidence: 80, entryPrice: 101, stopLoss: 99, takeProfit: 106, reasoning: "x", positionSizeQuote: 100, positionSizeRatio: 0.3 }',
    )
    expect(result.runtimePassed).toBe(true)
    expect(result.outputPassed).toBe(false)
    expect(result.reason).toContain('二选一')
  })

  it('fails when positionSizeRatio is not a number', async () => {
    const result = await service.validate(
      'return { direction: "BUY", signalType: "ENTRY", confidence: 80, entryPrice: 101, stopLoss: 99, takeProfit: 106, reasoning: "x", positionSizeRatio: "0.2" }',
    )
    expect(result.runtimePassed).toBe(true)
    expect(result.outputPassed).toBe(false)
    expect(result.reason).toContain('positionSizeRatio')
  })

  it('passes when output is a valid signal payload object', async () => {
    const result = await service.validate(`return ${validPayload}`)
    expect(result.runtimePassed).toBe(true)
    expect(result.outputPassed).toBe(true)
  })

  it('passes when output is a valid JSON string payload', async () => {
    const result = await service.validate(`return JSON.stringify(${validPayload})`)
    expect(result.runtimePassed).toBe(true)
    expect(result.outputPassed).toBe(true)
  })

  it('passes when output is protocol v1 adapter with onBar decision', async () => {
    const result = await service.validate(
      'return { protocolVersion: "v1", onBar: () => ({ action: "OPEN_LONG", size: { mode: "RATIO", value: 0.2 }, confidence: 88, reason: "trend" }) }',
    )
    expect(result.runtimePassed).toBe(true)
    expect(result.outputPassed).toBe(true)
  })

  it('fails when protocol v1 adapter returns invalid decision', async () => {
    const result = await service.validate(
      'return { protocolVersion: "v1", onBar: () => ({ action: "OPEN_LONG" }) }',
    )
    expect(result.runtimePassed).toBe(true)
    expect(result.outputPassed).toBe(false)
    expect(result.reason).toContain('size')
  })

  it('fails when ADJUST_POSITION does not use QTY size mode', async () => {
    const result = await service.validate(
      'return { protocolVersion: "v1", onBar: () => ({ action: "ADJUST_POSITION", size: { mode: "RATIO", value: 0.2 }, confidence: 80, reason: "x" }) }',
    )
    expect(result.runtimePassed).toBe(true)
    expect(result.outputPassed).toBe(false)
    expect(result.reason).toContain('ADJUST_POSITION')
  })
})
