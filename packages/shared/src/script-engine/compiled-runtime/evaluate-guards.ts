import type { StrategyExecutionContextV1 } from '../../strategy-protocol'
import type { CompiledRuntimeValue } from './evaluate-expr-pool'

interface GuardProgramNode {
  id: string
  payload: {
    onBreach: 'BLOCK_NEW_ENTRY' | 'FORCE_EXIT' | 'HALT_STRATEGY' | 'CANCEL_ORDER_PROGRAMS'
  }
}

export interface CompiledGuardState {
  strategyHalt: boolean
  blockNewEntry: boolean
  forceExit: boolean
  cancelOrderPrograms: boolean
  triggered: readonly string[]
}

export function evaluateGuards(
  _ctx: StrategyExecutionContextV1,
  guards: readonly GuardProgramNode[],
  _exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
  guardOrder: readonly string[],
): Readonly<CompiledGuardState> {
  const guardIndex = new Map(guards.map(guard => [guard.id, guard]))
  const state: CompiledGuardState = {
    strategyHalt: false,
    blockNewEntry: false,
    forceExit: false,
    cancelOrderPrograms: false,
    triggered: [],
  }

  for (const guardId of guardOrder) {
    const guard = guardIndex.get(guardId)
    if (!guard) continue

    switch (guard.payload.onBreach) {
      case 'HALT_STRATEGY':
        state.strategyHalt = state.strategyHalt || false
        break
      case 'BLOCK_NEW_ENTRY':
        state.blockNewEntry = state.blockNewEntry || false
        break
      case 'FORCE_EXIT':
        state.forceExit = state.forceExit || false
        break
      case 'CANCEL_ORDER_PROGRAMS':
        state.cancelOrderPrograms = state.cancelOrderPrograms || false
        break
    }
  }

  return Object.freeze({
    ...state,
    triggered: Object.freeze([...state.triggered]),
  })
}
