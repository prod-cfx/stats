import type { CompiledRuntimeValue } from './evaluate-expr-pool'
import {
  type CompiledOrchestrationGate,
  evaluateOrchestrationGates,
} from './evaluate-orchestration-gates'

function gate(
  partial: Partial<CompiledOrchestrationGate> & {
    exprId: string
    sideScope?: 'long' | 'short' | 'both'
  },
): CompiledOrchestrationGate {
  return {
    id: partial.id ?? `g-${partial.exprId}`,
    exprId: partial.exprId,
    target: { phase: 'entry', sideScope: partial.sideScope },
    effectWhenFalse: 'block_new_entries',
  }
}

describe('evaluateOrchestrationGates', () => {
  it('empty gates → no blocking', () => {
    expect(evaluateOrchestrationGates([], {})).toEqual({
      blockEntryLong: false,
      blockEntryShort: false,
    })
  })

  it('long gate exprValue=true → no blocking', () => {
    const gates = [gate({ exprId: 'e1', sideScope: 'long' })]
    expect(evaluateOrchestrationGates(gates, { e1: true })).toEqual({
      blockEntryLong: false,
      blockEntryShort: false,
    })
  })

  it('long gate exprValue=false → blocks long only', () => {
    const gates = [gate({ exprId: 'e1', sideScope: 'long' })]
    expect(evaluateOrchestrationGates(gates, { e1: false })).toEqual({
      blockEntryLong: true,
      blockEntryShort: false,
    })
  })

  it('short gate exprValue=false → blocks short only', () => {
    const gates = [gate({ exprId: 'e1', sideScope: 'short' })]
    expect(evaluateOrchestrationGates(gates, { e1: false })).toEqual({
      blockEntryLong: false,
      blockEntryShort: true,
    })
  })

  it('long gate missing exprValue → fail-closed (block long)', () => {
    const gates = [gate({ exprId: 'missing', sideScope: 'long' })]
    expect(evaluateOrchestrationGates(gates, {})).toEqual({
      blockEntryLong: true,
      blockEntryShort: false,
    })
  })

  it('long gate exprValue=number 1 → fail-closed (not bare true)', () => {
    const gates = [gate({ exprId: 'e1', sideScope: 'long' })]
    const values: Record<string, CompiledRuntimeValue> = { e1: 1 }
    expect(evaluateOrchestrationGates(gates, values)).toEqual({
      blockEntryLong: true,
      blockEntryShort: false,
    })
  })

  it('long gate exprValue=null → fail-closed', () => {
    const gates = [gate({ exprId: 'e1', sideScope: 'long' })]
    const values: Record<string, CompiledRuntimeValue> = { e1: null }
    expect(evaluateOrchestrationGates(gates, values)).toEqual({
      blockEntryLong: true,
      blockEntryShort: false,
    })
  })

  it("long gate exprValue='true' string → fail-closed", () => {
    const gates = [gate({ exprId: 'e1', sideScope: 'long' })]
    const values: Record<string, CompiledRuntimeValue> = { e1: 'true' }
    expect(evaluateOrchestrationGates(gates, values)).toEqual({
      blockEntryLong: true,
      blockEntryShort: false,
    })
  })

  it('long gate exprValue={levels:[]} → fail-closed', () => {
    const gates = [gate({ exprId: 'e1', sideScope: 'long' })]
    const values: Record<string, CompiledRuntimeValue> = { e1: { levels: [] } }
    expect(evaluateOrchestrationGates(gates, values)).toEqual({
      blockEntryLong: true,
      blockEntryShort: false,
    })
  })

  it("sideScope='both' with exprValue=false → blocks both", () => {
    const gates = [gate({ exprId: 'e1', sideScope: 'both' })]
    expect(evaluateOrchestrationGates(gates, { e1: false })).toEqual({
      blockEntryLong: true,
      blockEntryShort: true,
    })
  })

  it("target.phase='exit' (synthetic, forward-compat) → ignored", () => {
    const synthetic = {
      id: 'g-exit',
      exprId: 'e1',
      target: { phase: 'exit', sideScope: 'long' },
      effectWhenFalse: 'block_new_entries',
    } as unknown as CompiledOrchestrationGate
    expect(evaluateOrchestrationGates([synthetic], { e1: false })).toEqual({
      blockEntryLong: false,
      blockEntryShort: false,
    })
  })

  it('two long gates, one true one false → any false blocks', () => {
    const gates = [
      gate({ id: 'a', exprId: 'eA', sideScope: 'long' }),
      gate({ id: 'b', exprId: 'eB', sideScope: 'long' }),
    ]
    expect(
      evaluateOrchestrationGates(gates, { eA: true, eB: false }),
    ).toEqual({
      blockEntryLong: true,
      blockEntryShort: false,
    })
  })
})
