/**
 * SemanticExecutableSemanticsService —— Issue #1383 Lane A Foundation
 *
 * 单一职责：基于 `ATOM_CONTRACT_REGISTRY[key].fulfillsStrategyPhase` 自声明，
 * 判断 SemanticState 是否已具备入场 / 出场 / 风险 / sizing / context 五大执行语义。
 *
 * 设计要点：
 *   - 完全 registry-driven，不再读 capability.domain === 'order_program'、
 *     capability.verb === 'maintain' / 'schedule' / 'place' / 'rebalance' 等硬编码串
 *   - 扩展新策略只需在 atom-contract-registry 的 `ATOM_FULFILLS_STRATEGY_PHASE`
 *     表里给新 atom 声明对应 phase；本服务零修改
 *
 * 历史代码迁移自 codegen-conversation.service.ts:3167-3264 的 7 个 private 方法。
 */
import { Injectable } from '@nestjs/common'

import {
  ATOM_CONTRACT_REGISTRY,
  getAtomFulfillsStrategyPhase,
} from '../atom-contracts/atom-contract-registry'
import type { AtomContractKey } from '../atom-contracts/atom-contract-types'
import type {
  SemanticCapability,
  SemanticPositionConstraintState,
  SemanticState,
  SemanticTriggerState,
} from '../types/semantic-state'

const FIELD_KEY_RISK_STOP_LOSS_PCT = 'risk.stop_loss_pct'
const FIELD_KEY_RISK_TAKE_PROFIT_PCT = 'risk.take_profit_pct'
const FIELD_KEY_RISK_MAX_DRAWDOWN_PCT = 'risk.max_drawdown_pct'
const FIELD_KEY_RISK_MAX_SINGLE_LOSS_PCT = 'risk.max_single_loss_pct'
const ATOM_PARTIAL_TAKE_PROFIT_KEY: AtomContractKey = 'risk.partial_take_profit'

/**
 * 百分比类 forced-exit 风险 atom 集合。
 * 这些 atom 在 registry 自声明 `['risk','exit']` 时仍需校验 `params.valuePct > 0`，
 * 与 legacy hasLegacyForcedExitRiskSemantics 保持等价。
 */
const PCT_FORCED_EXIT_RISK_KEYS: ReadonlySet<string> = new Set([
  FIELD_KEY_RISK_STOP_LOSS_PCT,
  FIELD_KEY_RISK_TAKE_PROFIT_PCT,
  FIELD_KEY_RISK_MAX_DRAWDOWN_PCT,
  FIELD_KEY_RISK_MAX_SINGLE_LOSS_PCT,
])

type StrategyPhase = 'entry' | 'exit' | 'risk' | 'sizing' | 'context'

interface LockedAtom {
  readonly key: string
  readonly bucket: 'trigger' | 'action' | 'risk' | 'positionConstraint' | 'orchestration' | 'position'
  readonly phase?: SemanticTriggerState['phase']
  readonly params: Record<string, unknown>
}

@Injectable()
export class SemanticExecutableSemanticsService {
  /**
   * 入场语义判定 —— Issue #1383 Lane A：完全 registry-driven。
   * 历史等价：trigger.phase==='entry' locked || order_program contract || schedule。
   */
  hasExecutableEntrySemantics(state: SemanticState): boolean {
    return this.hasLockedAtomFulfilling(state, 'entry')
  }

  /**
   * 出场语义判定 —— Issue #1383 Lane A：完全 registry-driven。
   * 历史等价：trigger.phase==='exit' locked || forced-exit 风险 atom ||
   *           order_program contract || schedule。
   *
   * Issue #1383 Round 1 M5：调度类原子（execution.on_start / position.dca_schedule /
   *   program.event_listener）的"自身已满足 exit 语义"语义直接在 registry 的
   *   fulfillsStrategyPhase 里声明 'exit'，不在 service 内做 bypass——保持 registry
   *   是唯一真相源。
   */
  hasExecutableExitSemantics(state: SemanticState): boolean {
    if (this.hasLockedAtomFulfilling(state, 'exit')) return true
    // 兼容：legacy risk atom（不在 ATOM_CONTRACT_REGISTRY 内）通过 params 校验判定 forced-exit。
    return this.hasLegacyForcedExitRiskSemantics(state)
  }

  /**
   * Trigger phase 锁定状态（保留原 API 用于其他调用方）。
   */
  hasLockedTriggerPhase(
    state: SemanticState,
    phase: Extract<SemanticTriggerState['phase'], 'entry' | 'exit'>,
  ): boolean {
    return state.trigger.some(trigger =>
      trigger.phase === phase
      && trigger.status === 'locked'
      && trigger.openSlots.every(slot => slot.status !== 'open'),
    )
  }

  /**
   * 是否存在 order_program 合约（grid / DCA 等 program 类 atom 锁定）。
   * registry-driven：constraint key 自声明同时满足 entry+exit 视为双向 program。
   */
  hasOrderProgramContractSemantics(state: SemanticState): boolean {
    const topLevelConstraintIds = new Set(state.positionConstraint.map(c => c.id))
    const constraints: SemanticPositionConstraintState[] = [
      ...(state.positionConstraint ?? []),
      ...((state.position?.constraints ?? []).filter(c => !topLevelConstraintIds.has(c.id))),
    ]
    return constraints.some((constraint) => {
      if (constraint.status === 'superseded') return false
      const phases = this.lookupFulfillsPhase(constraint.key)
      return phases.includes('entry') && phases.includes('exit')
    })
  }

  /**
   * 完整 order_program 语义 —— positionConstraint atom 实际锁定（locked + 无 open slot）。
   */
  hasCompleteOrderProgramSemantics(state: SemanticState): boolean {
    return this.collectLockedAtoms(state).some((atom) => {
      if (atom.bucket !== 'positionConstraint') return false
      const phases = this.lookupFulfillsPhase(atom.key)
      return phases.includes('entry') && phases.includes('exit')
    })
  }

  /**
   * scheduled 入场语义 —— 例如 execution.on_start / scheduled program / DCA schedule。
   */
  hasLockedScheduleSemantics(state: SemanticState): boolean {
    return this.collectLockedAtoms(state).some((atom) => {
      const phases = this.lookupFulfillsPhase(atom.key)
      if (!phases.includes('entry')) return false
      return atom.key === 'execution.on_start'
        || atom.key.startsWith('program.')
        || atom.key === 'position.dca_schedule'
    })
  }

  /**
   * 收集所有已锁定 atom 的 capabilities（保留 API 用于 sizing / readiness 等下游）。
   */
  collectLockedCapabilities(state: SemanticState): SemanticCapability[] {
    const capabilities: SemanticCapability[] = []
    const pushContracts = (contracts: readonly { capabilities: readonly SemanticCapability[] }[] | undefined): void => {
      for (const contract of contracts ?? []) capabilities.push(...contract.capabilities)
    }

    for (const trigger of state.trigger) {
      if (trigger.status === 'locked' && trigger.openSlots.every(slot => slot.status !== 'open')) {
        pushContracts(trigger.contracts)
      }
    }
    for (const action of state.action) {
      if (action.status === 'locked' && (action.openSlots ?? []).every(slot => slot.status !== 'open')) {
        pushContracts(action.contracts)
      }
    }
    for (const risk of state.risk) {
      if (risk.status === 'locked' && risk.openSlots.every(slot => slot.status !== 'open')) {
        pushContracts(risk.contracts)
      }
    }
    const topLevelConstraintIds = new Set(state.positionConstraint.map(c => c.id))
    if (state.position?.status === 'locked' && (state.position.openSlots ?? []).every(slot => slot.status !== 'open')) {
      pushContracts(state.position.contracts)
      for (const constraint of state.position.constraints ?? []) {
        if (topLevelConstraintIds.has(constraint.id)) continue
        if (constraint.status === 'locked' && constraint.openSlots.every(slot => slot.status !== 'open')) {
          pushContracts(constraint.contracts)
        }
      }
    }
    for (const constraint of state.positionConstraint) {
      if (constraint.status === 'locked' && constraint.openSlots.every(slot => slot.status !== 'open')) {
        pushContracts(constraint.contracts)
      }
    }
    return capabilities
  }

  // =========================================================
  // 通用 registry-driven primitive
  // =========================================================

  /**
   * SemanticState 内是否存在 locked atom 自声明满足指定 strategy phase。
   *
   * 对 trigger bucket 额外约束：atom 实例 phase 必须与请求 phase 字面相等。
   *
   * Issue #1383 Round 1 C3：对百分比类 forced-exit 风险 atom（stop_loss_pct /
   * take_profit_pct / max_drawdown_pct / max_single_loss_pct）追加 valuePct > 0
   * 校验，与 legacy hasLegacyForcedExitRiskSemantics 行为对齐——valuePct 缺失
   * 或非正时不视为已锁定 exit 语义，避免上游 readiness 漏门导致 placeholder
   * reconciler 错误回收 missing_exit_atom。
   */
  hasLockedAtomFulfilling(state: SemanticState, phase: StrategyPhase): boolean {
    return this.collectLockedAtoms(state).some((atom) => {
      const phases = this.lookupFulfillsPhase(atom.key)
      if (!phases.includes(phase)) return false
      if (atom.bucket === 'trigger') {
        if (phase === 'entry' || phase === 'exit') {
          return atom.phase === phase
        }
      }
      if (atom.bucket === 'risk' && phase === 'exit' && PCT_FORCED_EXIT_RISK_KEYS.has(atom.key)) {
        const valuePct = (atom.params as { valuePct?: unknown }).valuePct
        return typeof valuePct === 'number' && Number.isFinite(valuePct) && valuePct > 0
      }
      return true
    })
  }

  /**
   * 收集所有 locked atom 实例的 key + bucket + phase + params。
   */
  collectLockedAtoms(state: SemanticState): LockedAtom[] {
    const atoms: LockedAtom[] = []
    for (const trigger of state.trigger) {
      if (trigger.status === 'locked' && trigger.openSlots.every(slot => slot.status !== 'open')) {
        atoms.push({ key: trigger.key, bucket: 'trigger', phase: trigger.phase, params: trigger.params })
      }
    }
    for (const action of state.action) {
      if (action.status === 'locked' && (action.openSlots ?? []).every(slot => slot.status !== 'open')) {
        atoms.push({ key: action.key, bucket: 'action', params: action.params ?? {} })
      }
    }
    for (const risk of state.risk) {
      if (risk.status === 'locked' && risk.openSlots.every(slot => slot.status !== 'open')) {
        atoms.push({ key: risk.key, bucket: 'risk', params: risk.params })
      }
    }
    for (const constraint of state.positionConstraint) {
      if (constraint.status === 'locked' && constraint.openSlots.every(slot => slot.status !== 'open')) {
        atoms.push({ key: constraint.key, bucket: 'positionConstraint', params: constraint.params })
      }
    }
    if (state.position) {
      for (const constraint of state.position.constraints ?? []) {
        if (constraint.status === 'locked' && constraint.openSlots.every(slot => slot.status !== 'open')) {
          atoms.push({ key: constraint.key, bucket: 'positionConstraint', params: constraint.params })
        }
      }
    }
    for (const node of state.orchestration ?? []) {
      if (node.status !== 'locked' || node.openSlots.some(slot => slot.status === 'open')) continue
      // Issue #1383 Round 1 M8：缺 key 的 orchestration node 跳过收集而不是推 key=''。
      //   推 ''/未注册 key 会被 lookupFulfillsPhase 返回 []，等同永远不满足任何 phase，
      //   且静默掩盖了上游种子生成器忘填 node.key 的 bug。skip + 跑 invariant
      //   ("orchestration node 必须有 registry key") 才能 fail-loud 暴露漏注册。
      if (!node.key) continue
      atoms.push({ key: node.key, bucket: 'orchestration', params: node.params })
    }
    return atoms
  }

  /**
   * 查表 fulfillsStrategyPhase；未注册 atom（如 legacy FIELD_KEY 风险 atom）返回 []。
   */
  private lookupFulfillsPhase(key: string): ReadonlyArray<StrategyPhase> {
    if (!(key in ATOM_CONTRACT_REGISTRY)) return []
    return getAtomFulfillsStrategyPhase(key as AtomContractKey)
  }

  /**
   * Legacy forced-exit 风险 atom 判定（不在 ATOM_CONTRACT_REGISTRY 内的 risk.max_drawdown_pct /
   * risk.max_single_loss_pct 等仍走 params valuePct 校验路径）。
   *
   * 与历史 hasLockedExitRiskSemantics 严格对齐：valuePct > 0 视为已锁定 forced-exit 语义。
   */
  private hasLegacyForcedExitRiskSemantics(state: SemanticState): boolean {
    return state.risk.some((risk) => {
      if (risk.status !== 'locked' || risk.openSlots.some(slot => slot.status === 'open')) {
        return false
      }
      // Issue #1383 Lane A：risk.partial_take_profit 已在 ATOM_FULFILLS_STRATEGY_PHASE
      //   声明为 ['risk']（partial-only，不构成完整出场语义）；不再走 legacy forced-exit
      //   路径短路成 exit。registry-driven 判定胜出。
      if (risk.key === ATOM_PARTIAL_TAKE_PROFIT_KEY) {
        return false
      }
      const threshold = risk.params.valuePct
      if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold <= 0) {
        return false
      }
      return risk.key === FIELD_KEY_RISK_STOP_LOSS_PCT
        || risk.key === FIELD_KEY_RISK_TAKE_PROFIT_PCT
        || risk.key === FIELD_KEY_RISK_MAX_DRAWDOWN_PCT
        || risk.key === FIELD_KEY_RISK_MAX_SINGLE_LOSS_PCT
    })
  }
}
