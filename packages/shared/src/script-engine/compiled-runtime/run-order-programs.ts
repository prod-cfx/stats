import type { StrategyExecutionContextV1 } from '../../strategy-protocol'
import type { CompiledRuntimeValue } from './evaluate-expr-pool'
import type { CompiledGuardState } from './evaluate-guards'

interface OrderProgramNode {
  id: string
  sourceRef: string
  payload?: {
    activeWhen?: string
  }
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

  const orderedPrograms = orderProgramOrder
    .map(id => programIndex.get(id))
    .filter((program): program is OrderProgramNode => program !== undefined)
  const activePrograms = guardState.cancelOrderPrograms
    ? []
    : orderedPrograms.filter(program => isOrderProgramActive(program, _exprValues))
  const inactiveProgramIds = guardState.cancelOrderPrograms
    ? []
    : orderedPrograms
      .filter(program => !isOrderProgramActive(program, _exprValues))
      .map(program => program.id)

  return Object.freeze({
    workingOrders: Object.freeze(activePrograms.map(program => ({
      id: program.id,
      sourceRef: program.sourceRef,
    }))),
    activeProgramIds: Object.freeze(activePrograms.map(program => program.id)),
    cancelledProgramIds: Object.freeze(
      guardState.cancelOrderPrograms ? [...orderProgramOrder] : inactiveProgramIds,
    ),
  })
}

function isOrderProgramActive(
  program: OrderProgramNode,
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
): boolean {
  const activeWhen = program.payload?.activeWhen
  if (typeof activeWhen !== 'string' || activeWhen.length === 0 || activeWhen === 'always') {
    return true
  }
  return exprValues[activeWhen] === true
}
