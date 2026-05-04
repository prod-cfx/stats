import type { StrategyExecutionContextV1 } from '../../strategy-protocol'
import type { CompiledRuntimeValue } from './evaluate-expr-pool'
import type { CompiledGuardState } from './evaluate-guards'

interface OrderProgramNode {
  id: string
  sourceRef: string
  payload?: unknown
}

export interface CompiledOrderState {
  workingOrders: ReadonlyArray<{
    id: string
    sourceRef: string
    payload?: Record<string, unknown>
    levels?: readonly number[]
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
    workingOrders: Object.freeze(activePrograms.map(program => buildWorkingOrder(program, _exprValues))),
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
  const activeWhen = readStringProperty(program.payload, 'activeWhen')
  if (typeof activeWhen !== 'string' || activeWhen.length === 0 || activeWhen === 'always') {
    return true
  }
  return exprValues[activeWhen] === true
}

function buildWorkingOrder(
  program: OrderProgramNode,
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
): {
  id: string
  sourceRef: string
  payload?: Record<string, unknown>
  levels?: readonly number[]
} {
  const payload = readPayloadRecord(program.payload)
  const levels = readLevelSetLevels(payload?.levelSetRef, exprValues)

  return {
    id: program.id,
    sourceRef: program.sourceRef,
    ...(payload ? { payload } : {}),
    ...(levels ? { levels } : {}),
  }
}

function readLevelSetLevels(
  levelSetRef: unknown,
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
): readonly number[] | undefined {
  if (typeof levelSetRef !== 'string' || levelSetRef.length === 0) return undefined

  const value = exprValues[levelSetRef]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const levels = (value as { levels?: unknown }).levels
  if (!Array.isArray(levels)) return undefined

  return levels.filter((level): level is number => Number.isFinite(level))
}

function readPayloadRecord(payload: unknown): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined
  return { ...(payload as Record<string, unknown>) }
}

function readStringProperty(payload: unknown, key: string): string | undefined {
  const record = readPayloadRecord(payload)
  const value = record?.[key]
  return typeof value === 'string' ? value : undefined
}
