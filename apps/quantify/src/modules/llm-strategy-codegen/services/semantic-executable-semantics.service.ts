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
  SemanticState,
  SemanticTriggerState,
} from '../types/semantic-state'
import type { RulesMainflowAtomFact } from './rules-mainflow-reader.service'
import { RulesMainflowReaderService } from './rules-mainflow-reader.service'

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
  constructor(
    private readonly rulesMainflowReader: RulesMainflowReaderService = new RulesMainflowReaderService(),
  ) {}

  /**
   * 入场语义判定 —— Issue #1383 Lane A：完全 registry-driven。
   * 历史等价：trigger.phase==='entry' locked || order_program contract || schedule。
   */
  hasExecutableEntrySemantics(state: SemanticState): boolean {
    if (this.hasLockedAtomFulfilling(state, 'entry')) return true
    // Issue #1395 (b)：positionConstraint 中的"持续入场源"atom 本身即视为入场语义。
    //   grid.range_rebalance / position.dca_schedule / position.pyramiding_limit
    //   是不依赖独立 entry trigger 的连续/调度类入场源；registry 是否已声明 phases
    //   不影响事实——直接在这里兜底，避免 readiness 误判入场语义缺失。
    if (this.hasContinuousEntryFromPositionConstraint(state)) return true
    // Issue #1395 (c)：state.rules 内任一 phase==='entry' 且 condition 含非空 atom 叶子。
    if (this.hasRulesEntrySemantics(state)) return true
    return false
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
    if (this.hasLegacyForcedExitRiskSemantics(state)) return true
    // Issue #1395 (b)：grid.range_rebalance 配置 breakoutAction ∈ {stop, pause, continue}
    //   本身即构成出场/风控语义（突破边界时的停止/暂停/继续策略），不需要独立 exit trigger。
    if (this.hasGridBreakoutExitSemantics(state)) return true
    // Issue #1395 (c)：state.rules 内存在 phase==='exit' 的 rule，或 effects 中含
    //   risk.* / action.close_* / breakoutAction 的 rule。
    if (this.hasRulesExitSemantics(state)) return true
    return false
  }

  /**
   * Trigger phase 锁定状态（保留原 API 用于其他调用方）。
   */
  hasLockedTriggerPhase(
    state: SemanticState,
    phase: Extract<SemanticTriggerState['phase'], 'entry' | 'exit'>,
  ): boolean {
    return this.rulesMainflowReader.readFactsByRole(state, 'condition').some(fact =>
      fact.phase === phase
      && this.isLockedWithoutOpenSlots(fact),
    )
  }

  /**
   * 是否存在 order_program 合约（grid / DCA 等 program 类 atom 锁定）。
   * registry-driven：constraint key 自声明同时满足 entry+exit 视为双向 program。
   */
  hasOrderProgramContractSemantics(state: SemanticState): boolean {
    return this.rulesMainflowReader.readFacts(state).some((fact) => {
      if (fact.status === 'superseded') return false
      const phases = this.lookupFulfillsPhase(fact.key)
      return phases.includes('entry') && phases.includes('exit')
    })
  }

  /**
   * 完整 order_program 语义 —— positionConstraint atom 实际锁定（locked + 无 open slot）。
   */
  hasCompleteOrderProgramSemantics(state: SemanticState): boolean {
    return this.collectLockedAtoms(state).some((atom) => {
      if (atom.bucket !== 'positionConstraint' && atom.bucket !== 'orchestration') return false
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

    for (const fact of this.rulesMainflowReader.readFacts(state)) {
      if (this.isLockedWithoutOpenSlots(fact)) {
        pushContracts(fact.contracts)
      }
    }
    if (state.position?.status === 'locked' && (state.position.openSlots ?? []).every(slot => slot.status !== 'open')) {
      pushContracts(state.position.contracts)
    }
    return capabilities
  }

  // =========================================================
  // 通用 registry-driven primitive
  // =========================================================

  /**
   * 通用 phase 满足检测 —— state 中**任一** atom（任何 bucket 或 rules 表达式树叶子，
   * 不要求 locked）自声明满足指定 strategy phase。
   *
   * 用途：
   *   - sizing 旁路：grid program / DCA schedule / pyramiding limit 等 atom 在 registry
   *     `ATOM_FULFILLS_STRATEGY_PHASE` 声明 `'sizing'`，表示"持续 sizing 源已存在"；
   *     clarification 据此跳过独立 single-trade position-size 追问。
   *   - 未来扩展新策略（DCA / TWAP / arbitrage 等）只需 atom 自声明对应 phase，
   *     所有消费者（conversation clarification / projection）零修改自动生效。
   *
   * 与 `hasLockedAtomFulfilling` 区别：本方法宽松——允许 unlocked atom + 覆盖 rules 树，
   * 用于策略层"信号一旦出现即视为旁路触发"的判定；后者严格——要求 locked + 满足
   * trigger.phase 字面相等，用于执行语义闭环判定。
   */
  anyAtomFulfillsPhase(state: SemanticState, phase: StrategyPhase): boolean {
    const fulfills = (fact: RulesMainflowAtomFact): boolean => {
      if (!this.lookupFulfillsPhase(fact.key).includes(phase)) return false
      if (phase !== 'sizing') return true
      return this.hasPositiveSizingEvidence(fact)
    }

    return this.rulesMainflowReader.readFacts(state).some(fact => fulfills(fact))
  }

  private hasPositiveSizingEvidence(fact: RulesMainflowAtomFact): boolean {
    const params = fact.params
    const contract = fact.key in ATOM_CONTRACT_REGISTRY
      ? ATOM_CONTRACT_REGISTRY[fact.key as AtomContractKey]
      : null
    const paramSource = contract?.sizingEvidence?.paramSource
    if (paramSource && this.readPositiveNumberParam(params, paramSource) !== null) return true

    return this.readPositiveNumberParam(params, 'perGridSizing') !== null
      || this.readPositiveNumberParam(params, 'perOrderSizing') !== null
      || this.readPositiveNumberParam(params, 'layerSizing') !== null
      || this.readPositiveNumberParam(params, 'valuePct') !== null
      || this.readNestedPositiveNumberParam(params, ['sizing', 'value']) !== null
      || this.readNestedPositiveNumberParam(params, ['params', 'sizing', 'value']) !== null
  }

  private readPositiveNumberParam(params: Record<string, unknown>, key: string): number | null {
    const value = params[key]
    return this.toPositiveNumber(value)
  }

  private readNestedPositiveNumberParam(params: Record<string, unknown>, path: readonly string[]): number | null {
    let current: unknown = params
    for (const key of path) {
      if (typeof current !== 'object' || current === null || Array.isArray(current)) return null
      current = (current as Record<string, unknown>)[key]
    }
    return this.toPositiveNumber(current)
  }

  private toPositiveNumber(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0 ? value : null
    }
    if (typeof value === 'string') {
      const numeric = Number(value.trim().match(/-?\d+(?:\.\d+)?/u)?.[0])
      return Number.isFinite(numeric) && numeric > 0 ? numeric : null
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return this.toPositiveNumber((value as Record<string, unknown>).value)
    }
    return null
  }

  /**
   * SemanticState 内是否存在 locked atom 自声明满足指定 strategy phase。
   *
   * 对 trigger bucket 额外约束：atom 实例 phase 必须与请求 phase 字面相等。
   *
   * Issue #1383 Round 1 C3：对百分比类 forced-exit 风险 atom（stop_loss_pct /
   * take_profit_pct / max_drawdown_pct / max_single_loss_pct）追加 valuePct > 0
   * 校验，与 legacy hasLegacyForcedExitRiskSemantics 行为对齐——valuePct 缺失
   * 或非正时不视为已锁定 exit 语义，避免上游 readiness 漏门导致出场语义被
   * 误判为已闭环。
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
    for (const fact of this.rulesMainflowReader.readFacts(state)) {
      if (!this.isLockedWithoutOpenSlots(fact)) continue
      if (!fact.key) continue
      atoms.push({
        key: fact.key,
        bucket: this.bucketForFact(fact),
        phase: fact.role === 'condition' ? fact.phase as SemanticTriggerState['phase'] : undefined,
        params: fact.params,
      })
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
  /**
   * Issue #1395 (b)：持续入场源 atom 在 positionConstraint 内即视为入场语义。
   * 不要求 registry 声明 phase；这些 atom key 在领域语义上本就是"连续/调度类入场"。
   */
  private hasContinuousEntryFromPositionConstraint(state: SemanticState): boolean {
    const CONTINUOUS_ENTRY_KEYS: ReadonlySet<string> = new Set([
      'grid.range_rebalance',
      'position.dca_schedule',
      'position.pyramiding_limit',
    ])
    return this.rulesMainflowReader.readFactsByRole(state, 'position').some((fact) => {
      if (fact.status === 'superseded') return false
      return CONTINUOUS_ENTRY_KEYS.has(fact.key)
    })
  }

  /**
   * Issue #1395 (b)：grid.range_rebalance + breakoutAction ∈ {stop,pause,continue}
   *   构成出场/风控语义。
   */
  private hasGridBreakoutExitSemantics(state: SemanticState): boolean {
    const VALID_BREAKOUT_ACTIONS: ReadonlySet<string> = new Set(['stop', 'pause', 'continue'])
    return this.rulesMainflowReader.readFacts(state).some((fact) => {
      if (fact.status === 'superseded') return false
      if (fact.key !== 'grid.range_rebalance') return false
      const action = (fact.params as { breakoutAction?: unknown }).breakoutAction
      return typeof action === 'string' && VALID_BREAKOUT_ACTIONS.has(action)
    })
  }

  /**
   * Issue #1395 (c)：state.rules 内任一 phase==='entry' 的 rule，且其 condition
   * 树至少含一个 atom 叶子 → 视为已具备入场语义。
   */
  private hasRulesEntrySemantics(state: SemanticState): boolean {
    if (!state.rules?.length) return false
    return this.rulesMainflowReader.readFactsByRole(state, 'condition').some(fact => fact.phase === 'entry')
  }

  /**
   * Issue #1395 (c)：rules 中显式 close action 或 grid breakout 才补充出场语义。
   * risk.* 仍走 registry / forced-exit 阈值校验，避免 partial take profit 或空阈值止损误判。
   */
  private hasRulesExitSemantics(state: SemanticState): boolean {
    if (!state.rules?.length) return false
    return this.rulesMainflowReader.readFacts(state).some((fact) => {
      if (fact.role === 'action' && fact.key.startsWith('action.close_')) return true
      if (fact.key === 'grid.range_rebalance') {
        const action = (fact.params as { breakoutAction?: unknown }).breakoutAction
        return typeof action === 'string' && action.length > 0
      }
      return false
    })
  }

  private hasLegacyForcedExitRiskSemantics(state: SemanticState): boolean {
    return this.rulesMainflowReader.readFactsByRole(state, 'risk').some((risk) => {
      if (!this.isLockedWithoutOpenSlots(risk)) {
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

  private isLockedWithoutOpenSlots(fact: RulesMainflowAtomFact): boolean {
    return fact.status === 'locked' && fact.openSlots.every(slot => slot.status !== 'open')
  }

  private bucketForFact(fact: RulesMainflowAtomFact): LockedAtom['bucket'] {
    const contract = (ATOM_CONTRACT_REGISTRY as Record<string, { bucket?: LockedAtom['bucket'] }>)[fact.key]
    if (contract?.bucket) return contract.bucket
    if (fact.role === 'action') return 'action'
    if (fact.role === 'risk') return 'risk'
    if (fact.role === 'position') return 'positionConstraint'
    if (fact.role === 'orchestration' || fact.role === 'program') return 'orchestration'
    return 'trigger'
  }
}
