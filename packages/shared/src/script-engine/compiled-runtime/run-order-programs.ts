import type { CompiledRuntimeValue } from './evaluate-expr-pool'
import type { CompiledGuardState } from './evaluate-guards'
import type { StrategyExecutionContextV1 } from '../../strategy-protocol'

interface OrderProgramNode {
  id: string
  sourceRef: string
}

export interface CompiledOrderState {
  workingOrders: ReadonlyArray<{
    id: string
    sourceRef: string
  }>
  activeProgramIds: readonly string[]
  cancelledProgramIds: readonly string[]
}

export function runOrderPrograms(
  _ctx: StrategyExecutionContextV1,
  programs: readonly OrderProgramNode[],
  _exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
  guardState: Readonly<CompiledGuardState>,
  orderProgramOrder: readonly string[],
  _executionModel?: Record<string, unknown>,
): Readonly<CompiledOrderState> {
  const programIndex = new Map(programs.map(program => [program.id, program]))

  const activePrograms = guardState.cancelOrderPrograms
    ? []
    : orderProgramOrder
      .map(id => programIndex.get(id))
      .filter((program): program is OrderProgramNode => program !== undefined)

  return Object.freeze({
    workingOrders: Object.freeze(activePrograms.map(program => ({
      id: program.id,
      sourceRef: program.sourceRef,
    }))),
    activeProgramIds: Object.freeze(activePrograms.map(program => program.id)),
    cancelledProgramIds: Object.freeze(
      guardState.cancelOrderPrograms ? [...orderProgramOrder] : [],
    ),
  })
}
