/**
 * Orchestration gate evaluator (Phase 5 S1, issue #984).
 *
 * Fail-closed semantics:
 *   - exprValues 缺失（undefined）/ 非裸 boolean true（包括 number 1 / 'true' / null /
 *     { levels: [] }）一律视为 false → 该 gate 转为"阻止新开仓"
 *   - target.phase !== 'entry' 静默忽略（forward-compat：S2/S3/S4 引入 strategy /
 *     subStrategy / orderProgram phase 时由各自 evaluator 处理）
 *   - sideScope 缺省视为 'both'，即同时阻 long 与 short 入场
 *
 * 仅作用于 OPEN_* 决策（在 runDecisionPrograms 末端 emit 处套）；CLOSE_* /
 * REDUCE_* / forceExit 不受影响（issue #984 bullet #6 安全保证："能进就能出"）。
 */
import type { CompiledRuntimeValue } from './evaluate-expr-pool'

export interface CompiledOrchestrationGate {
  id: string
  exprId: string
  target: { phase: 'entry'; sideScope?: 'long' | 'short' | 'both' }
  effectWhenFalse: 'block_new_entries'
}

export interface OrchestrationGateState {
  blockEntryLong: boolean
  blockEntryShort: boolean
}

export function evaluateOrchestrationGates(
  gates: readonly CompiledOrchestrationGate[],
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
): OrchestrationGateState {
  let blockLong = false
  let blockShort = false
  for (const gate of gates) {
    if (gate.target.phase !== 'entry') continue
    const raw = exprValues[gate.exprId]
    const isTrue = raw === true
    if (isTrue) continue
    const sideScope = gate.target.sideScope ?? 'both'
    if (sideScope === 'long' || sideScope === 'both') blockLong = true
    if (sideScope === 'short' || sideScope === 'both') blockShort = true
  }
  return { blockEntryLong: blockLong, blockEntryShort: blockShort }
}
