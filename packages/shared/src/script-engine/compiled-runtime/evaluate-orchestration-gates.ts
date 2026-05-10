/**
 * Orchestration gate evaluator (Phase 5 S1, issue #984; extended Phase 5 S10 #1111).
 *
 * Fail-closed semantics:
 *   - exprValues 缺失（undefined）/ 非裸 boolean true（包括 number 1 / 'true' / null /
 *     { levels: [] }）一律视为 false
 *   - phase='entry'：gate=false → blockEntryLong/Short（按 sideScope long/short/both）
 *   - phase='strategy'：本 PR substrate 不支持，silent skip（留 #984 #5 strategy 子级 PR）
 *   - phase='subStrategy'：
 *     * effectWhenFalse='pause_substrategy'：gate=false 时 pausedSubStrategyScopeIds.add(target.subStrategyScopeRef)
 *     * effectWhenFalse='switch_substrategy'：gate=true 时收集 target.toSubStrategyScopeRef 进 switchCandidates
 *       - 0 候选 → switchToSubStrategyScopeId 不写值
 *       - 1 候选 → switchToSubStrategyScopeId = candidate
 *       - ≥2 候选 → fail-closed（不写值；caller 视同未切换 → NOOP，对应验收 #9 "条件不明确 fail-closed"）
 *
 * 仅作用于 OPEN_* 决策（在 runDecisionPrograms 末端 emit 处套）；CLOSE_* /
 * REDUCE_* / forceExit 不受影响（issue #984 bullet #6 安全保证："能进就能出"）。
 */
import type { CompiledRuntimeValue } from './evaluate-expr-pool'

// Phase 5 S10 (#1111): target 升级为 discriminated union（与 Canonical/IR 同步）
export type CompiledOrchestrationGateTarget =
  | { phase: 'entry'; sideScope?: 'long' | 'short' | 'both' }
  | { phase: 'strategy' }
  | { phase: 'subStrategy'; subStrategyScopeRef: string; toSubStrategyScopeRef?: string }

export interface CompiledOrchestrationGate {
  id: string
  exprId: string
  // Phase 5 S10 (#1111): union（entry / strategy / subStrategy）
  target: CompiledOrchestrationGateTarget
  // Phase 5 S10 (#1111): effect 扩 'pause_substrategy' | 'switch_substrategy'
  effectWhenFalse: 'block_new_entries' | 'pause_substrategy' | 'switch_substrategy'
}

export interface OrchestrationGateState {
  blockEntryLong: boolean
  blockEntryShort: boolean
  // Phase 5 S10 (#1111): 全 optional，旧 caller / mock 字面量构造零 type error
  pausedSubStrategyScopeIds?: ReadonlySet<string>
  switchToSubStrategyScopeId?: string
}

export function evaluateOrchestrationGates(
  gates: readonly CompiledOrchestrationGate[],
  exprValues: Readonly<Record<string, CompiledRuntimeValue>>,
): OrchestrationGateState {
  let blockLong = false
  let blockShort = false
  // Phase 5 S10 (#1111): 惰性构造 — 所有 pause gate 都未触发时不创建 Set
  let pausedSet: Set<string> | null = null
  // Phase 5 S10 (#1111): switch 候选列表（gate=true 时累加 toSubStrategyScopeRef）
  const switchCandidates: string[] = []

  for (const gate of gates) {
    const target = gate.target
    const raw = exprValues[gate.exprId]
    const isTrue = raw === true

    switch (target.phase) {
      case 'entry': {
        if (isTrue) continue
        const sideScope = target.sideScope ?? 'both'
        if (sideScope === 'long' || sideScope === 'both') blockLong = true
        if (sideScope === 'short' || sideScope === 'both') blockShort = true
        break
      }
      case 'strategy': {
        // 本 PR substrate 不支持 — silent skip（留 #984 #5 strategy 子级 PR）
        // Defense in depth：readiness 已 unsupported，万一透传到 runtime 仍跳过不污染输出
        break
      }
      case 'subStrategy': {
        if (gate.effectWhenFalse === 'pause_substrategy') {
          if (isTrue) break // gate=true → active；不修改输出
          // gate=false → pause active subStrategy
          if (!pausedSet) pausedSet = new Set<string>()
          pausedSet.add(target.subStrategyScopeRef)
          break
        }
        if (gate.effectWhenFalse === 'switch_substrategy') {
          if (!isTrue) break // gate=false → 不触发切换
          // gate=true 收集切换目标
          if (typeof target.toSubStrategyScopeRef === 'string' && target.toSubStrategyScopeRef !== '') {
            switchCandidates.push(target.toSubStrategyScopeRef)
          }
          break
        }
        // 其它 effect（如误配 'block_new_entries' to subStrategy）— silent skip（readiness 已 fail-closed）
        break
      }
    }
  }

  // Phase 5 S10 (#1111): switch 决策表 — 0/1/≥2 三路 fail-closed
  let switchToSubStrategyScopeId: string | undefined
  if (switchCandidates.length === 1) {
    switchToSubStrategyScopeId = switchCandidates[0]
  }
  // 0 或 ≥2 → 不写值（≥2 fail-closed 兑现验收 #9 "条件不明确 fail-closed"）

  const state: OrchestrationGateState = {
    blockEntryLong: blockLong,
    blockEntryShort: blockShort,
  }
  if (pausedSet) {
    state.pausedSubStrategyScopeIds = pausedSet
  }
  if (switchToSubStrategyScopeId !== undefined) {
    state.switchToSubStrategyScopeId = switchToSubStrategyScopeId
  }
  return state
}
