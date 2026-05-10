import type { CompiledRuntimeValue } from './evaluate-expr-pool'
import type {CompiledOrchestrationGate} from './evaluate-orchestration-gates';
import {
  
  evaluateOrchestrationGates
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

describe('phase 5 S10 — subStrategy gates', () => {
  function pauseGate(
    partial: { id?: string; exprId: string; subStrategyScopeRef: string },
  ): CompiledOrchestrationGate {
    return {
      id: partial.id ?? `g-${partial.exprId}`,
      exprId: partial.exprId,
      target: { phase: 'subStrategy', subStrategyScopeRef: partial.subStrategyScopeRef },
      effectWhenFalse: 'pause_substrategy',
    }
  }

  function switchGate(
    partial: { id?: string; exprId: string; from: string; to: string },
  ): CompiledOrchestrationGate {
    return {
      id: partial.id ?? `g-${partial.exprId}`,
      exprId: partial.exprId,
      target: {
        phase: 'subStrategy',
        subStrategyScopeRef: partial.from,
        toSubStrategyScopeRef: partial.to,
      },
      effectWhenFalse: 'switch_substrategy',
    }
  }

  it('pause_substrategy gate=false → pausedSubStrategyScopeIds.has(ref) (R1 fail-closed pause)', () => {
    const gates = [pauseGate({ exprId: 'e1', subStrategyScopeRef: 'ss-A' })]
    const state = evaluateOrchestrationGates(gates, { e1: false })
    expect(state.pausedSubStrategyScopeIds).toBeDefined()
    expect(state.pausedSubStrategyScopeIds!.has('ss-A')).toBe(true)
  })

  it('pause_substrategy gate=true → 不 pause（pausedSubStrategyScopeIds undefined）', () => {
    const gates = [pauseGate({ exprId: 'e1', subStrategyScopeRef: 'ss-A' })]
    const state = evaluateOrchestrationGates(gates, { e1: true })
    expect(state.pausedSubStrategyScopeIds).toBeUndefined()
  })

  it('pause_substrategy 缺值 → fail-closed 视同 false → pause（兑现 R1 fail-closed 语义）', () => {
    const gates = [pauseGate({ exprId: 'missing', subStrategyScopeRef: 'ss-A' })]
    const state = evaluateOrchestrationGates(gates, {})
    expect(state.pausedSubStrategyScopeIds!.has('ss-A')).toBe(true)
  })

  it("pause_substrategy 非 boolean true（'true' 字符串）→ fail-closed → pause", () => {
    const gates = [pauseGate({ exprId: 'e1', subStrategyScopeRef: 'ss-A' })]
    const values: Record<string, CompiledRuntimeValue> = { e1: 'true' }
    const state = evaluateOrchestrationGates(gates, values)
    expect(state.pausedSubStrategyScopeIds!.has('ss-A')).toBe(true)
  })

  it('pause_substrategy 多个 ref，gate=false → pausedSet 包含所有触发的 ref', () => {
    const gates = [
      pauseGate({ id: 'g1', exprId: 'eA', subStrategyScopeRef: 'ss-A' }),
      pauseGate({ id: 'g2', exprId: 'eB', subStrategyScopeRef: 'ss-B' }),
    ]
    const state = evaluateOrchestrationGates(gates, { eA: false, eB: false })
    expect(state.pausedSubStrategyScopeIds!.size).toBe(2)
    expect(state.pausedSubStrategyScopeIds!.has('ss-A')).toBe(true)
    expect(state.pausedSubStrategyScopeIds!.has('ss-B')).toBe(true)
  })

  it('switch_substrategy gate=true 单候选 → switchToSubStrategyScopeId === toRef', () => {
    const gates = [switchGate({ exprId: 'e1', from: 'ss-A', to: 'ss-B' })]
    const state = evaluateOrchestrationGates(gates, { e1: true })
    expect(state.switchToSubStrategyScopeId).toBe('ss-B')
  })

  it('switch_substrategy 0 候选（gate=false）→ switchToSubStrategyScopeId === undefined', () => {
    const gates = [switchGate({ exprId: 'e1', from: 'ss-A', to: 'ss-B' })]
    const state = evaluateOrchestrationGates(gates, { e1: false })
    expect(state.switchToSubStrategyScopeId).toBeUndefined()
  })

  it('switch_substrategy ≥2 候选都 gate=true → switchToSubStrategyScopeId === undefined（M1 验收 #9 fail-closed）', () => {
    const gates = [
      switchGate({ id: 'g1', exprId: 'eA', from: 'ss-A', to: 'ss-B' }),
      switchGate({ id: 'g2', exprId: 'eB', from: 'ss-A', to: 'ss-C' }),
    ]
    const state = evaluateOrchestrationGates(gates, { eA: true, eB: true })
    // 条件不明确 → fail-closed，不写值
    expect(state.switchToSubStrategyScopeId).toBeUndefined()
  })

  it('regime gate (phase=entry) + pause_substrategy gate (phase=subStrategy) 同 evaluator 同 bar 共存 → 互不污染（M-issue2）', () => {
    const regimeGate: CompiledOrchestrationGate = {
      id: 'g-regime',
      exprId: 'e_regime',
      target: { phase: 'entry', sideScope: 'long' },
      effectWhenFalse: 'block_new_entries',
    }
    const subGate = pauseGate({ id: 'g-sub', exprId: 'e_sub', subStrategyScopeRef: 'ss-A' })
    const state = evaluateOrchestrationGates([regimeGate, subGate], { e_regime: false, e_sub: false })
    // entry phase 输出
    expect(state.blockEntryLong).toBe(true)
    expect(state.blockEntryShort).toBe(false)
    // subStrategy phase 输出
    expect(state.pausedSubStrategyScopeIds!.has('ss-A')).toBe(true)
    // 互不污染
    expect(state.switchToSubStrategyScopeId).toBeUndefined()
  })

  it("phase='strategy' gate silent skip（不污染输出）", () => {
    const strategyGate = {
      id: 'g-strategy',
      exprId: 'e1',
      target: { phase: 'strategy' },
      effectWhenFalse: 'block_new_entries',
    } as unknown as CompiledOrchestrationGate
    const state = evaluateOrchestrationGates([strategyGate], { e1: false })
    expect(state).toEqual({ blockEntryLong: false, blockEntryShort: false })
  })
})
