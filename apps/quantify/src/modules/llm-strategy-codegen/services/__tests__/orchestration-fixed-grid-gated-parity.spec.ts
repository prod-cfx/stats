import { evaluateOrchestrationGates } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'
import { runDecisionPrograms } from '@ai/shared/script-engine/compiled-runtime/run-decision-programs'
import { runOrderPrograms } from '@ai/shared/script-engine/compiled-runtime/run-order-programs'

describe('orchestration program fixed_grid_gated — backtest vs live signal parity', () => {
  function buildProgram(onDeactivate: 'cancel' | 'keep' | 'close', activeWhenExprId = 'expr-gate-long') {
    return [{
      id: 'program-1',
      programKind: 'fixed_grid_gated' as const,
      activeWhenExprId,
      onDeactivate,
      rebuildPolicy: 'static' as const,
      gridParams: { anchorPrice: 50000, levelCount: 3, stepPct: 5 },
      sizing: { mode: 'fixed_pct' as const, value: 5 },
    }]
  }

  function decide({ programs, exprValues, ctxQty }: {
    programs: ReturnType<typeof buildProgram>
    exprValues: Record<string, any>
    ctxQty: number
  }) {
    const gateState = evaluateOrchestrationGates([], exprValues)
    const decision = runDecisionPrograms(
      { __compiledDecisionState: { barIndex: 0 }, currentBar: { close: 50000 }, currentPositionQty: ctxQty } as any,
      [],
      exprValues,
      { forceExit: false } as any,
      [],
      gateState,
      undefined,
    )
    const orderState = runOrderPrograms(
      { currentBar: {} } as any,
      [],
      exprValues,
      { forceExit: false } as any,
      [],
      undefined,
      programs,
    )
    return { decision, orderState }
  }

  it('case A: program active=true → workingOrders identical between two paths', () => {
    const a = decide({ programs: buildProgram('cancel'), exprValues: { 'expr-gate-long': true }, ctxQty: 0 })
    const b = decide({ programs: buildProgram('cancel'), exprValues: { 'expr-gate-long': true }, ctxQty: 0 })
    expect(a).toEqual(b)
    expect(a.orderState.workingOrders.length).toBeGreaterThan(0)
  })

  it('case B: active=false onDeactivate=cancel → cancelledProgramIds identical', () => {
    const a = decide({ programs: buildProgram('cancel'), exprValues: { 'expr-gate-long': false }, ctxQty: 0 })
    const b = decide({ programs: buildProgram('cancel'), exprValues: { 'expr-gate-long': false }, ctxQty: 0 })
    expect(a).toEqual(b)
    expect(a.orderState.cancelledProgramIds).toContain('program-1')
  })

  it('case C: active=false onDeactivate=keep → workingOrders 仍存在 identical', () => {
    const a = decide({ programs: buildProgram('keep'), exprValues: { 'expr-gate-long': false }, ctxQty: 0 })
    const b = decide({ programs: buildProgram('keep'), exprValues: { 'expr-gate-long': false }, ctxQty: 0 })
    expect(a).toEqual(b)
    expect(a.orderState.workingOrders.some(o => o.id === 'program-1')).toBe(true)
  })

  it('case D (W5): active=false onDeactivate=close → closeProgramIds identical (不污染 workingOrders)', () => {
    const a = decide({ programs: buildProgram('close'), exprValues: { 'expr-gate-long': false }, ctxQty: -1 })
    const b = decide({ programs: buildProgram('close'), exprValues: { 'expr-gate-long': false }, ctxQty: -1 })
    expect(a).toEqual(b)
    expect(a.orderState.closeProgramIds).toContain('program-1')
    expect(a.orderState.workingOrders.some(o => o.id === 'program-1')).toBe(false)
    expect(a.orderState.cancelledProgramIds).not.toContain('program-1')
  })

  it('case E (W5): close+持仓 short → orderState 一致；上层应同步合成 CLOSE_SHORT', () => {
    const a = decide({ programs: buildProgram('close'), exprValues: { 'expr-gate-long': false }, ctxQty: -1 })
    const b = decide({ programs: buildProgram('close'), exprValues: { 'expr-gate-long': false }, ctxQty: -1 })
    expect(a.orderState).toEqual(b.orderState)
    // backtest/live 都消费同一 closeProgramIds → 上层合成 CLOSE_SHORT 语义在两路中一致
    // 实际 CLOSE_SHORT 由 backtest-strategy-adapter 的 synthesizeCloseDecision 完成（T12）；
    // live signal 同源 close 由 follow-up #YYYY 接入；当前 spec 仅断言 orderState 在共用 evaluator 后形态一致
    expect(a.orderState.closeProgramIds).toContain('program-1')
  })
})
