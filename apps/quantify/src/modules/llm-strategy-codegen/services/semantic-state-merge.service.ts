import { Injectable } from '@nestjs/common'

import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'
import type {
  SemanticActionState,
  SemanticAtomContract,
  SemanticContextSlotState,
  SemanticOrchestrationContract,
  SemanticOrchestrationNode,
  SemanticPositionConstraintState,
  SemanticPositionState,
  SemanticRiskState,
  SemanticState,
  SemanticTriggerState,
} from '../types/semantic-state'
import { normalizeRiskSemantics } from './semantic-state-normalization'
import {
  collectAtomLeaves,
  isRuleEffectsByRole,
  listRuleEffects,
  type AtomExpr,
  type RuleEffects,
  type RuleEffectsByRole,
  type SemanticRule,
} from '../types/atom-expr'

// #1383 Lane B：所有 atom bucket entry 必须实现的最小 identity shape，
// 供 dedupeByAtomIdentity 用 (key, phase, stableParamsHash, openSlots signature) 折叠重复条目。
interface AtomLikeEntry {
  key?: string
  phase?: string
  params?: Record<string, unknown>
  status: 'open' | 'locked' | 'superseded'
  source?: 'user_explicit' | 'inferred' | 'derived'
  value?: unknown
  // openSlots 用于 identity slot-key signature — 同 (key, phase, params) 但 openSlots
  // 不同的「合法 sibling atoms」（典型场景：用户先后分两轮设定两条同 key 的 MA 上穿条件，
  // 各自带独立 reference.period openSlot）不能被 dedup 折叠。
  openSlots?: readonly { slotKey: string }[]
}

@Injectable()
export class SemanticStateMergeService {
  merge(input: { persisted: SemanticState | null, derived: SemanticState }): SemanticState {
    if (!input.persisted) {
      return input.derived
    }

    // Issue #1395 Wave 4 + Issue #1403 子故障 D：rules[] 表达式树合并策略
    //   - derived 未给或空 → 保留 persisted.rules（避免 ...derived 把 rules 抹掉）
    //   - derived 显式给 rules → 按 identity（id 优先；否则 phase+sideScope+condition shape）
    //     与 persisted union 合并，同 identity 取 derived 覆盖
    //
    // 历史回归（#1403 子故障 D）：早期实现 derived 非空就整体覆盖 persisted，导致
    //   多轮 clarification 最后一轮（如 risk 槽位 LLM 只回 risk rule）把 entry/exit
    //   rules 抹光，UI 仅渲染最后一条 → 用户看到「只剩止损」的伪强终态。
    //   修复后：用户「确认 risk 阈值」单独一轮的 planner patch 仍能把之前的 entry/exit
    //   rules 留住，buildRulesSummary 一次性渲染齐全。
    const persistedRules = (input.persisted as { rules?: unknown }).rules
    const derivedRules = (input.derived as { rules?: unknown }).rules
    const persistedRulesArr = Array.isArray(persistedRules) ? persistedRules as SemanticState['rules'] : undefined
    const derivedRulesArr = Array.isArray(derivedRules) ? derivedRules as SemanticState['rules'] : undefined
    const mergedRules = this.mergeRulesByIdentity(persistedRulesArr, derivedRulesArr)

    return {
      ...input.derived,
      families: [...new Set([...input.persisted.families, ...input.derived.families])],
      trigger: this.mergeTriggers(input.persisted.trigger, input.derived.trigger),
      action: this.mergeActions(input.persisted.action, input.derived.action),
      risk: this.mergeRisk(input.persisted.risk, input.derived.risk),
      // #1383 Lane B：补齐 orchestration / positionConstraint 两个 bucket 的显式合并，
      // 否则 `...input.derived` 会用 derived 的空数组静默覆盖持久态。
      orchestration: this.mergeOrchestration(input.persisted.orchestration, input.derived.orchestration),
      positionConstraint: this.mergePositionConstraintBucket(
        input.persisted.positionConstraint,
        input.derived.positionConstraint,
      ),
      position: this.mergePosition(input.persisted.position, input.derived.position),
      contextSlots: this.mergeContextSlots(input.persisted.contextSlots, input.derived.contextSlots),
      normalizationNotes: [...new Set([...input.persisted.normalizationNotes, ...input.derived.normalizationNotes])],
      orchestrationContracts: this.mergeOrchestrationContracts(
        input.persisted.orchestrationContracts,
        input.derived.orchestrationContracts,
      ),
      updatedAt: new Date().toISOString(),
      ...(mergedRules !== undefined ? { rules: mergedRules as SemanticState['rules'] } : {}),
    }
  }

  private mergeTriggers(
    persisted: ReadonlyArray<SemanticTriggerState>,
    derived: ReadonlyArray<SemanticTriggerState>,
  ): SemanticTriggerState[] {
    if (derived.length === 0) {
      return persisted.map(trigger => ({
        ...trigger,
        params: { ...trigger.params },
        openSlots: trigger.openSlots.map(slot => ({ ...slot })),
      }))
    }

    const next = derived.map(trigger => ({
      ...trigger,
      params: { ...trigger.params },
      openSlots: trigger.openSlots.map(slot => ({ ...slot })),
    }))
    const originalDerivedCount = next.length
    const consumedDerivedIndexes = new Set<number>()

    for (const persistedTrigger of persisted) {
      const matchIndex = this.findBestTriggerMatchIndex(
        persistedTrigger,
        next,
        consumedDerivedIndexes,
        originalDerivedCount,
      )
      if (matchIndex < 0) {
        next.push({
          ...persistedTrigger,
          params: { ...persistedTrigger.params },
          openSlots: persistedTrigger.openSlots.map(slot => ({ ...slot })),
        })
        continue
      }

      const derivedTrigger = next[matchIndex]
      consumedDerivedIndexes.add(matchIndex)
      const preferPersisted = this.compareNodeStrength(persistedTrigger, derivedTrigger) > 0
      next[matchIndex] = {
        ...(preferPersisted ? derivedTrigger : persistedTrigger),
        ...(preferPersisted ? persistedTrigger : derivedTrigger),
        id: persistedTrigger.id,
        sideScope: persistedTrigger.sideScope ?? derivedTrigger.sideScope,
        params: preferPersisted
          ? { ...derivedTrigger.params, ...persistedTrigger.params }
          : { ...persistedTrigger.params, ...derivedTrigger.params },
        contracts: this.mergeContracts(persistedTrigger.contracts, derivedTrigger.contracts),
        openSlots: this.mergeOpenSlotsForMatchedNodes(
          persistedTrigger,
          derivedTrigger,
          persistedTrigger.openSlots,
          derivedTrigger.openSlots,
        ),
        status: derivedTrigger.status === 'locked' || persistedTrigger.status === 'superseded'
          ? derivedTrigger.status
          : persistedTrigger.status,
        evidence: preferPersisted
          ? persistedTrigger.evidence ?? derivedTrigger.evidence
          : derivedTrigger.evidence ?? persistedTrigger.evidence,
      }
    }

    return this.dedupeByAtomIdentity(this.coalesceEquivalentTriggers(next))
  }

  private findBestTriggerMatchIndex(
    persistedTrigger: SemanticTriggerState,
    derivedTriggers: SemanticTriggerState[],
    consumedDerivedIndexes: Set<number>,
    searchLimit: number = derivedTriggers.length,
  ): number {
    let bestIndex = -1
    let bestScore = -1

    for (const [index, candidate] of derivedTriggers.entries()) {
      if (index >= searchLimit) {
        break
      }
      if (consumedDerivedIndexes.has(index) || !this.isSameTriggerIdentity(persistedTrigger, candidate)) {
        continue
      }

      const score = this.scoreTriggerMatch(persistedTrigger, candidate)
      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    }

    return bestIndex
  }

  private mergeActions(
    persisted: ReadonlyArray<SemanticActionState>,
    derived: ReadonlyArray<SemanticActionState>,
  ): SemanticActionState[] {
    const next = derived.map(action => ({
      ...action,
      params: action.params ? { ...action.params } : undefined,
      openSlots: (action.openSlots ?? []).map(slot => ({ ...slot })),
    }))
    const consumedDerivedIndexes = new Set<number>()

    for (const persistedAction of persisted) {
      const matchIndex = next.findIndex((candidate, index) =>
        !consumedDerivedIndexes.has(index) && this.isSameActionIdentity(persistedAction, candidate))
      if (matchIndex < 0) {
        // #1162 Task 7：identity miss 时检查是否完全相同（真重复）→ 丢弃；否则 push（保留合法多档）
        const isTrueDuplicate = next.some(candidate => this.isTrueDuplicateAction(persistedAction, candidate))
        if (!isTrueDuplicate) {
          next.push({
            ...persistedAction,
            params: persistedAction.params ? { ...persistedAction.params } : undefined,
            openSlots: (persistedAction.openSlots ?? []).map(slot => ({ ...slot })),
          })
        }
        continue
      }

      consumedDerivedIndexes.add(matchIndex)
      const derivedAction = next[matchIndex]
      const preferPersisted = this.compareNodeStrength(persistedAction, derivedAction) > 0
      next[matchIndex] = {
        ...(preferPersisted ? derivedAction : persistedAction),
        ...(preferPersisted ? persistedAction : derivedAction),
        id: persistedAction.id,
        params: preferPersisted
          ? { ...derivedAction.params, ...persistedAction.params }
          : { ...persistedAction.params, ...derivedAction.params },
        contracts: this.mergeContracts(persistedAction.contracts, derivedAction.contracts),
        openSlots: this.mergeOpenSlotsForMatchedNodes(
          persistedAction,
          derivedAction,
          persistedAction.openSlots ?? [],
          derivedAction.openSlots ?? [],
        ),
        evidence: preferPersisted
          ? persistedAction.evidence ?? derivedAction.evidence
          : derivedAction.evidence ?? persistedAction.evidence,
      }
    }

    return this.dedupeByAtomIdentity(next)
  }

  private mergeRisk(
    persisted: ReadonlyArray<SemanticRiskState>,
    derived: ReadonlyArray<SemanticRiskState>,
  ): SemanticRiskState[] {
    const next = derived.map(risk => ({
      ...risk,
      params: { ...risk.params },
      openSlots: risk.openSlots.map(slot => ({ ...slot })),
    }))
    const consumedDerivedIndexes = new Set<number>()

    for (const persistedRisk of persisted) {
      const matchIndex = next.findIndex((candidate, index) =>
        !consumedDerivedIndexes.has(index) && this.isSameRiskIdentity(persistedRisk, candidate))
      if (matchIndex < 0) {
        // #1162 Task 7：identity miss 时检查是否完全相同（真重复）→ 丢弃；否则 push
        const isTrueDuplicate = next.some(candidate => this.isTrueDuplicateRisk(persistedRisk, candidate))
        if (!isTrueDuplicate) {
          next.push({
            ...persistedRisk,
            params: { ...persistedRisk.params },
            openSlots: persistedRisk.openSlots.map(slot => ({ ...slot })),
          })
        }
        continue
      }

      consumedDerivedIndexes.add(matchIndex)
      const derivedRisk = next[matchIndex]
      const preferPersisted = this.compareNodeStrength(persistedRisk, derivedRisk) > 0
      next[matchIndex] = {
        ...(preferPersisted ? derivedRisk : persistedRisk),
        ...(preferPersisted ? persistedRisk : derivedRisk),
        id: persistedRisk.id,
        params: preferPersisted
          ? { ...derivedRisk.params, ...persistedRisk.params }
          : { ...persistedRisk.params, ...derivedRisk.params },
        contracts: this.mergeContracts(persistedRisk.contracts, derivedRisk.contracts),
        openSlots: this.mergeOpenSlotsForMatchedNodes(
          persistedRisk,
          derivedRisk,
          persistedRisk.openSlots,
          derivedRisk.openSlots,
        ),
        evidence: preferPersisted
          ? persistedRisk.evidence ?? derivedRisk.evidence
          : derivedRisk.evidence ?? persistedRisk.evidence,
      }
    }

    return this.dedupeByAtomIdentity(normalizeRiskSemantics(next))
  }

  // #1383 Lane B：orchestration bucket。identity = atom `key`（缺失则 fallback id）。
  private mergeOrchestration(
    persisted: ReadonlyArray<SemanticOrchestrationNode>,
    derived: ReadonlyArray<SemanticOrchestrationNode>,
  ): SemanticOrchestrationNode[] {
    const next = derived.map(node => this.cloneOrchestrationNode(node))
    const consumed = new Set<number>()

    for (const persistedNode of persisted) {
      const matchIndex = next.findIndex((candidate, index) =>
        !consumed.has(index) && this.isSameOrchestrationIdentity(persistedNode, candidate))
      if (matchIndex < 0) {
        next.push(this.cloneOrchestrationNode(persistedNode))
        continue
      }

      consumed.add(matchIndex)
      const derivedNode = next[matchIndex]!
      const preferPersisted = this.compareNodeStrength(persistedNode, derivedNode) > 0
      const stronger = preferPersisted ? persistedNode : derivedNode
      const weaker = preferPersisted ? derivedNode : persistedNode

      next[matchIndex] = {
        ...weaker,
        ...stronger,
        id: persistedNode.id,
        params: preferPersisted
          ? { ...derivedNode.params, ...persistedNode.params }
          : { ...persistedNode.params, ...derivedNode.params },
        openSlots: this.mergeOpenSlotsForMatchedNodes(
          persistedNode,
          derivedNode,
          [...persistedNode.openSlots],
          [...derivedNode.openSlots],
        ),
        contracts: this.mergeOrchestrationContracts(persistedNode.contracts, derivedNode.contracts),
        evidence: stronger.evidence ?? weaker.evidence,
      } as SemanticOrchestrationNode
    }

    return this.dedupeByAtomIdentity(next)
  }

  private cloneOrchestrationNode(node: SemanticOrchestrationNode): SemanticOrchestrationNode {
    return {
      ...node,
      params: { ...node.params },
      evidence: node.evidence ? { ...node.evidence } : undefined,
      openSlots: node.openSlots.map(slot => ({ ...slot })),
      contracts: node.contracts.map(contract => this.cloneOrchestrationContract(contract)),
      activeWhen: node.activeWhen ? { ...node.activeWhen } : undefined,
      gridParams: node.gridParams ? { ...node.gridParams } : undefined,
      sizing: node.sizing ? { ...node.sizing } : undefined,
      dynamicGridStep: node.dynamicGridStep ? { ...node.dynamicGridStep } : undefined,
      idempotencyKey: node.idempotencyKey ? { ...node.idempotencyKey } : undefined,
      symbols: node.symbols ? [...node.symbols] : undefined,
      requiredTimeframes: node.requiredTimeframes ? [...node.requiredTimeframes] : undefined,
      legSizing: node.legSizing ? { ...node.legSizing } : undefined,
    }
  }

  private isSameOrchestrationIdentity(
    left: SemanticOrchestrationNode,
    right: SemanticOrchestrationNode,
  ): boolean {
    if (left.kind !== right.kind) return false
    // Issue #1383 Round 1 M7：identity 同时比 (key, stableParamsHash)，
    //   避免两个同名 program（如 program.dynamic_grid 各持不同 lower/upper）
    //   仅因 key 相同被误折叠 + 后续 params 浅合并丢嵌套。
    if (left.key !== undefined && right.key !== undefined) {
      if (left.key !== right.key) return false
      return this.stableParamsHash(left.params) === this.stableParamsHash(right.params)
    }
    return left.id === right.id
  }

  // #1383 Lane B：positionConstraint bucket 顶层入口。
  // 复用既有 mergePositionConstraints（基于 byKey + identity = constraint.key），
  // 再额外跑一遍 dedupeByAtomIdentity 以折叠真重复。
  private mergePositionConstraintBucket(
    persisted: ReadonlyArray<SemanticPositionConstraintState>,
    derived: ReadonlyArray<SemanticPositionConstraintState>,
  ): SemanticPositionConstraintState[] {
    const merged = this.mergePositionConstraints(persisted, derived) ?? []
    return this.dedupeByAtomIdentity([...merged])
  }

  private mergePosition(
    persisted: SemanticPositionState | null,
    derived: SemanticPositionState | null,
  ): SemanticPositionState | null {
    if (!persisted) {
      return derived
    }

    if (!derived) {
      return persisted
    }

    const preferPersisted = this.compareNodeStrength(persisted, derived) > 0
    const stronger = preferPersisted ? persisted : derived
    const weaker = preferPersisted ? derived : persisted

    return {
      ...weaker,
      ...stronger,
      value: stronger.value ?? weaker.value,
      // H1 修复：同函数顶层 `{...weaker, ...stronger}` 对 sizing 也有同样的整段覆盖
      // 问题。如果 derived 是更强源但显式回 sizing: null/undefined（典型场景：planner
      // LLM 不输出 sizing 字段，或 reducer 清空），会把 persisted 的 locked sizing 抹掉。
      // 与 value/evidence 一致用 nullish fallback：stronger 真正给出新 sizing 才用，
      // 否则保留 weaker 的非空 sizing。
      sizing: stronger.sizing ?? weaker.sizing,
      contracts: this.mergeContracts(persisted.contracts, derived.contracts),
      // #DCA-bug-fix：spread 后 stronger.constraints 会以整体形式覆盖 weaker.constraints；
      // 如果 derived 是更强源但 constraints 缺/为空（典型场景：conversation planner LLM
      // 只回 position.sizing 不回 position.dca_schedule constraint），就会把 seed 抽出的
      // locked dca_schedule / pyramiding_limit 抹掉。按 key union 合并，每个 key 内部按
      // strength 取强，保证 locked 持久态不被 derived 弱化。
      // DEPRECATED Task 6: position.constraints moved to top-level positionConstraint[]
      evidence: stronger.evidence ?? weaker.evidence,
    }
  }

  private cloneOrchestrationContract(
    contract: SemanticOrchestrationContract,
  ): SemanticOrchestrationContract {
    return {
      ...contract,
      capabilities: contract.capabilities.map(capability => ({
        ...capability,
        shape: capability.shape ? { ...capability.shape } : undefined,
      })),
      requires: contract.requires.map(requirement => ({ ...requirement })),
      params: { ...contract.params },
      runtimeRequirements: contract.runtimeRequirements.map(requirement => ({ ...requirement })),
      stateRequirements: contract.stateRequirements.map(requirement => ({ ...requirement })),
      orderRequirements: contract.orderRequirements.map(requirement => ({ ...requirement })),
      openSlots: contract.openSlots.map(slot => ({ ...slot })),
      effects: contract.effects?.map(effect => ({
        ...effect,
        shape: effect.shape ? { ...effect.shape } : undefined,
      })),
      target: contract.target ? { ...contract.target } : undefined,
    }
  }

  private mergeOrchestrationContracts(
    persisted: readonly SemanticOrchestrationContract[],
    derived: readonly SemanticOrchestrationContract[],
  ): SemanticOrchestrationContract[] {
    const next = derived.map(contract => this.cloneOrchestrationContract(contract))

    for (const persistedContract of persisted) {
      const matchIndex = next.findIndex(candidate => this.isSameOrchestrationContractIdentity(persistedContract, candidate))
      if (matchIndex < 0) {
        next.push(this.cloneOrchestrationContract(persistedContract))
        continue
      }

      const derivedContract = next[matchIndex]!
      next[matchIndex] = {
        ...this.cloneOrchestrationContract(persistedContract),
        ...this.cloneOrchestrationContract(derivedContract),
        id: persistedContract.id,
        params: { ...persistedContract.params, ...derivedContract.params },
        capabilities: [...persistedContract.capabilities, ...derivedContract.capabilities].map(capability => ({
          ...capability,
          shape: capability.shape ? { ...capability.shape } : undefined,
        })),
        requires: [...persistedContract.requires, ...derivedContract.requires].map(requirement => ({ ...requirement })),
        runtimeRequirements: [...persistedContract.runtimeRequirements, ...derivedContract.runtimeRequirements].map(requirement => ({ ...requirement })),
        stateRequirements: [...persistedContract.stateRequirements, ...derivedContract.stateRequirements].map(requirement => ({ ...requirement })),
        orderRequirements: [...persistedContract.orderRequirements, ...derivedContract.orderRequirements].map(requirement => ({ ...requirement })),
        openSlots: this.mergeOpenSlots([...persistedContract.openSlots], [...derivedContract.openSlots]),
      }
    }

    return next
  }

  private isSameOrchestrationContractIdentity(
    left: SemanticOrchestrationContract,
    right: SemanticOrchestrationContract,
  ): boolean {
    if (left.id === right.id) {
      return true
    }
    if (left.kind !== right.kind) {
      return false
    }

    const leftKeys = this.collectOrchestrationContractSemanticKeys(left)
    const rightKeys = this.collectOrchestrationContractSemanticKeys(right)
    return [...leftKeys].some(key => rightKeys.has(key))
  }

  private collectOrchestrationContractSemanticKeys(contract: SemanticOrchestrationContract): Set<string> {
    return new Set([
      ...contract.capabilities.map(capability => this.semanticTupleKey(capability)),
      ...contract.requires.map(requirement => this.semanticTupleKey(requirement)),
      ...(contract.effects ?? []).map(effect => this.semanticTupleKey(effect)),
    ])
  }

  private mergePositionConstraints(
    persisted: readonly SemanticPositionConstraintState[] | undefined,
    derived: readonly SemanticPositionConstraintState[] | undefined,
  ): readonly SemanticPositionConstraintState[] | undefined {
    if (!persisted && !derived) return undefined
    const byKey = new Map<string, SemanticPositionConstraintState>()

    // 持久态先全量克隆入桶 —— 避免后续路径直接持有 caller 引用，对齐
    // mergeTriggers / mergeActions / mergeRisks 的克隆约定（参数与 openSlots 浅克隆）。
    for (const constraint of persisted ?? []) {
      byKey.set(constraint.key, this.clonePositionConstraint(constraint))
    }

    for (const incoming of derived ?? []) {
      const existing = byKey.get(incoming.key)
      if (!existing) {
        byKey.set(incoming.key, this.clonePositionConstraint(incoming))
        continue
      }

      // tie-break 统一到 `> 0`（等强偏 derived），与 mergeTriggers / mergeActions /
      // mergeRisk / mergePosition 顶层 / mergeSlotState 全文件其它 6 处保持一致；
      // 等强偏 persisted 的语义已经由本函数顶层"persisted 先入桶 + derived 仅在更强时
      // 覆盖"的顺序保证：strict greater 让真正更强的 derived（如 planner 后续 patch
      // 把 dca_schedule 从 open 推到 locked）能压过持久态。
      const preferPersisted = this.compareNodeStrength(existing, incoming) > 0
      const stronger = preferPersisted ? existing : incoming
      const weaker = preferPersisted ? incoming : existing

      byKey.set(existing.key, {
        ...weaker,
        ...stronger,
        id: existing.id,
        // params 一层 spread 仍会把 stronger.perOrderSizing 这类 sub-object 整段覆盖
        // weaker 同名 sub-object（典型现象：stronger 只回 `{ value: 50 }` 会把
        // `{ kind:'quote', value:100, asset:'USDT' }` 压扁成 `{ value:50 }`），破坏
        // SemanticPositionSizingContract discriminated-union 形态。
        // 改走 mergePositionConstraintParams 做一层深合并：plain object 字段（如
        // perOrderSizing/capitalCap/exitRule）走子对象 spread，其余字段沿用顶层 spread。
        params: this.mergePositionConstraintParams(
          weaker.params,
          stronger.params,
        ),
        contracts: this.mergeContracts(existing.contracts, incoming.contracts),
        openSlots: this.mergeOpenSlotsForMatchedNodes(
          existing,
          incoming,
          existing.openSlots,
          incoming.openSlots,
        ),
        evidence: preferPersisted
          ? existing.evidence ?? incoming.evidence
          : incoming.evidence ?? existing.evidence,
      })
    }

    // m1 修复：原先 length===0 返回 undefined 与原 spread 行为不完全等价
    // （旧逻辑会保留 stronger 的 [] 引用）。返回 `[]` 让 'constraints' in pos 等
    // 存在性判断与 .length 判空仍保持一致。
    return [...byKey.values()]
  }

  private clonePositionConstraint(
    constraint: SemanticPositionConstraintState,
  ): SemanticPositionConstraintState {
    return {
      ...constraint,
      params: { ...(constraint.params ?? {}) },
      openSlots: (constraint.openSlots ?? []).map(slot => ({ ...slot })),
      contracts: constraint.contracts
        ? constraint.contracts.map(item => ({ ...item }))
        : undefined,
    }
  }

  private mergePositionConstraintParams(
    weaker: Record<string, unknown> | undefined,
    stronger: Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    const base: Record<string, unknown> = { ...(weaker ?? {}) }
    for (const [key, strongerValue] of Object.entries(stronger ?? {})) {
      // R2-M1 修复：null/undefined 一律视为"stronger 未说"，保留 weaker——与 H1 顶层
      //   `sizing: stronger.sizing ?? weaker.sizing` 语义对齐。否则同一份 patch 里
      //   顶层 sizing 与内层 perOrderSizing/capitalCap 出现两种 null 语义，调用方
      //   （planner / reducer）容易踩坑。如需"显式清空子合约"语义请走专用 reducer 路径。
      if (strongerValue === null || strongerValue === undefined) {
        continue
      }
      const weakerValue = base[key]
      if (
        this.isPlainObject(strongerValue)
        && this.isPlainObject(weakerValue)
      ) {
        // R2-m2 限制说明：仅做一层 spread。当前 contract shape 是两层
        //   （params.perOrderSizing.{kind,value,asset}）；若未来出现三层嵌套
        //   （如 perOrderSizing.range.{lo,hi}）需要递归扩展，spec 应同步加 case。
        base[key] = { ...weakerValue, ...strongerValue }
        continue
      }
      base[key] = strongerValue
    }
    return base
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
  }

  private mergeContracts(
    persisted: SemanticAtomContract[] | undefined,
    derived: SemanticAtomContract[] | undefined,
  ): SemanticAtomContract[] | undefined {
    const next: SemanticAtomContract[] = []
    for (const contract of [...(persisted ?? []), ...(derived ?? [])]) {
      const matchIndex = next.findIndex(candidate => this.isSameContractIdentity(candidate, contract))
      if (matchIndex < 0) {
        next.push(this.cloneContract(contract))
        continue
      }

      next[matchIndex] = this.mergeContract(next[matchIndex]!, contract)
    }

    return next.length > 0 ? next : undefined
  }

  private isSameContractIdentity(
    left: SemanticAtomContract,
    right: SemanticAtomContract,
  ): boolean {
    if (left.id === right.id) {
      return true
    }
    if (left.kind !== right.kind) {
      return false
    }

    const leftSemanticKeys = this.collectContractSemanticKeys(left)
    const rightSemanticKeys = this.collectContractSemanticKeys(right)
    return [...leftSemanticKeys].some(key => rightSemanticKeys.has(key))
  }

  private mergeContract(
    left: SemanticAtomContract,
    right: SemanticAtomContract,
  ): SemanticAtomContract {
    return {
      ...left,
      ...right,
      capabilities: this.mergeContractCapabilities(left.capabilities, right.capabilities),
      requires: this.mergeContractRequirements(left.requires, right.requires),
      effects: this.mergeContractEffects(left.effects, right.effects),
      params: {
        ...left.params,
        ...right.params,
      },
    }
  }

  private collectContractSemanticKeys(contract: SemanticAtomContract): Set<string> {
    return new Set([
      ...contract.capabilities.map(capability => this.semanticTupleKey(capability)),
      ...contract.requires.map(requirement => this.semanticTupleKey(requirement)),
      ...(contract.effects ?? []).map(effect => this.semanticTupleKey(effect)),
    ])
  }

  private semanticTupleKey(tuple: { domain: string, verb: string, object: string }): string {
    return `${tuple.domain}:${tuple.verb}:${tuple.object}`
  }

  private mergeContractCapabilities(
    left: SemanticAtomContract['capabilities'],
    right: SemanticAtomContract['capabilities'],
  ): SemanticAtomContract['capabilities'] {
    const next: Array<SemanticAtomContract['capabilities'][number]> = []
    for (const capability of [...left, ...right]) {
      const matchIndex = next.findIndex(candidate =>
        candidate.domain === capability.domain
        && candidate.verb === capability.verb
        && candidate.object === capability.object,
      )
      if (matchIndex < 0) {
        next.push({
          ...capability,
          shape: { ...capability.shape },
        })
        continue
      }

      next[matchIndex] = {
        ...next[matchIndex]!,
        ...capability,
        shape: {
          ...next[matchIndex]!.shape,
          ...capability.shape,
        },
      }
    }
    return next
  }

  private mergeContractRequirements(
    left: SemanticAtomContract['requires'],
    right: SemanticAtomContract['requires'],
  ): SemanticAtomContract['requires'] {
    const next: Array<SemanticAtomContract['requires'][number]> = []
    for (const requirement of [...left, ...right]) {
      if (next.some(candidate =>
        candidate.domain === requirement.domain
        && candidate.verb === requirement.verb
        && candidate.object === requirement.object,
      )) {
        continue
      }
      next.push({ ...requirement })
    }
    return next
  }

  private mergeContractEffects(
    left: SemanticAtomContract['effects'],
    right: SemanticAtomContract['effects'],
  ): SemanticAtomContract['effects'] {
    const next: Array<NonNullable<SemanticAtomContract['effects']>[number]> = []
    for (const effect of [...(left ?? []), ...(right ?? [])]) {
      const matchIndex = next.findIndex(candidate =>
        candidate.domain === effect.domain
        && candidate.verb === effect.verb
        && candidate.object === effect.object,
      )
      if (matchIndex < 0) {
        next.push({
          ...effect,
          shape: effect.shape ? { ...effect.shape } : undefined,
        })
        continue
      }

      next[matchIndex] = {
        ...next[matchIndex]!,
        ...effect,
        shape: {
          ...next[matchIndex]!.shape,
          ...effect.shape,
        },
      }
    }
    return next.length > 0 ? next : undefined
  }

  private cloneContract(contract: SemanticAtomContract): SemanticAtomContract {
    return {
      ...contract,
      capabilities: contract.capabilities.map(capability => ({
        ...capability,
        shape: capability.shape ? { ...capability.shape } : undefined,
      })),
      requires: contract.requires.map(requirement => ({ ...requirement })),
      effects: contract.effects?.map(effect => ({
        ...effect,
        shape: effect.shape ? { ...effect.shape } : undefined,
      })),
      params: { ...contract.params },
    }
  }

  private mergeOpenSlotsForMatchedNodes(
    persistedNode: { status: 'open' | 'locked' | 'superseded', source?: 'user_explicit' | 'inferred' | 'derived', value?: unknown },
    derivedNode: { status: 'open' | 'locked' | 'superseded', source?: 'user_explicit' | 'inferred' | 'derived', value?: unknown },
    persistedSlots: SemanticTriggerState['openSlots'],
    derivedSlots: SemanticTriggerState['openSlots'],
  ): SemanticTriggerState['openSlots'] {
    if (
      persistedNode.status === 'locked'
      && derivedNode.status === 'open'
      && this.compareNodeStrength(persistedNode, derivedNode) > 0
    ) {
      return persistedSlots.map(slot => ({ ...slot }))
    }

    return this.mergeOpenSlots(persistedSlots, derivedSlots)
  }

  private mergeContextSlots(
    persisted: SemanticContextSlotState,
    derived: SemanticContextSlotState,
  ): SemanticContextSlotState {
    return {
      exchange: this.mergeSlotState(persisted.exchange, derived.exchange),
      symbol: this.mergeSlotState(persisted.symbol, derived.symbol),
      marketType: this.mergeSlotState(persisted.marketType, derived.marketType),
      timeframe: this.mergeSlotState(persisted.timeframe, derived.timeframe),
    }
  }

  private isSameTriggerIdentity(left: SemanticTriggerState, right: SemanticTriggerState): boolean {
    if (left.phase !== right.phase || left.key !== right.key) {
      return false
    }

    if (left.sideScope && right.sideScope && left.sideScope !== right.sideScope) {
      return false
    }

    const stableIdentityKeys = [
      'indicator',
      'referenceRole',
      'basis',
    ] as const

    return this.haveCompatibleParamValues(left.params, right.params, stableIdentityKeys)
  }

  private coalesceEquivalentTriggers(
    triggers: SemanticTriggerState[],
  ): SemanticTriggerState[] {
    const next: SemanticTriggerState[] = []

    for (const trigger of triggers) {
      const matchIndex = next.findIndex(candidate => this.isEquivalentTriggerForCoalescing(candidate, trigger))
      if (matchIndex < 0) {
        next.push(trigger)
        continue
      }

      next[matchIndex] = this.mergeEquivalentTrigger(next[matchIndex]!, trigger)
    }

    return next
  }

  private isEquivalentTriggerForCoalescing(
    left: SemanticTriggerState,
    right: SemanticTriggerState,
  ): boolean {
    if (this.isEquivalentBollingerBoundaryTrigger(left, right)) {
      return true
    }

    if (
      left.id !== right.id
      && left.source === 'user_explicit'
      && right.source === 'user_explicit'
    ) {
      return false
    }

    if (left.phase !== right.phase || left.key !== right.key) {
      return false
    }

    if (left.sideScope && right.sideScope && left.sideScope !== right.sideScope) {
      return false
    }

    return this.haveCompatibleParamValues(
      this.omitTriggerConfirmationParam(left.params),
      this.omitTriggerConfirmationParam(right.params),
    )
  }

  private mergeEquivalentTrigger(
    existing: SemanticTriggerState,
    incoming: SemanticTriggerState,
  ): SemanticTriggerState {
    const preferIncoming = this.compareNodeStrength(incoming, existing) > 0
    const stronger = preferIncoming ? incoming : existing
    const weaker = preferIncoming ? existing : incoming
    const confirmationMode = this.resolvePreferredConfirmationMode(
      stronger.params.confirmationMode,
      weaker.params.confirmationMode,
    )

    return {
      ...weaker,
      ...stronger,
      id: stronger.id,
      sideScope: stronger.sideScope ?? weaker.sideScope,
      params: {
        ...weaker.params,
        ...stronger.params,
        ...(confirmationMode ? { confirmationMode } : {}),
      },
      contracts: this.mergeContracts(existing.contracts, incoming.contracts),
      openSlots: this.mergeOpenSlots(existing.openSlots, incoming.openSlots),
      evidence: stronger.evidence ?? weaker.evidence,
    }
  }

  private isEquivalentBollingerBoundaryTrigger(
    left: SemanticTriggerState,
    right: SemanticTriggerState,
  ): boolean {
    if (left.phase !== right.phase) {
      return false
    }
    if (left.sideScope && right.sideScope && left.sideScope !== right.sideScope) {
      return false
    }

    const leftBoundary = this.readBollingerBoundaryIdentity(left)
    const rightBoundary = this.readBollingerBoundaryIdentity(right)
    if (!leftBoundary || !rightBoundary) {
      return false
    }

    return leftBoundary.role === rightBoundary.role
      && this.sameOptionalNumber(leftBoundary.period, rightBoundary.period)
      && this.sameOptionalNumber(leftBoundary.stdDev, rightBoundary.stdDev)
  }

  private readBollingerBoundaryIdentity(
    trigger: SemanticTriggerState,
  ): { role: string, period: number | null, stdDev: number | null } | null {
    if (
      trigger.key === ATOM_CONTRACT_REGISTRY['bollinger.touch_upper'].key
      || trigger.key === ATOM_CONTRACT_REGISTRY['bollinger.touch_lower'].key
      || trigger.key === ATOM_CONTRACT_REGISTRY['bollinger.touch_middle'].key
    ) {
      return {
        role: trigger.key === ATOM_CONTRACT_REGISTRY['bollinger.touch_upper'].key
          ? 'upper'
          : trigger.key === ATOM_CONTRACT_REGISTRY['bollinger.touch_lower'].key
            ? 'lower'
            : 'middle',
        period: this.readFiniteNumber(trigger.params.period),
        stdDev: this.readFiniteNumber(trigger.params.stdDev),
      }
    }

    if (trigger.key !== ATOM_CONTRACT_REGISTRY['price.detect.indicator_boundary'].key) {
      return null
    }

    const indicator = trigger.params.indicator
    if (!indicator || typeof indicator !== 'object' || Array.isArray(indicator)) {
      return null
    }
    const indicatorRecord = indicator as Record<string, unknown>
    if (indicatorRecord.name !== 'bollinger') {
      return null
    }

    const role = typeof trigger.params.boundaryRole === 'string' ? trigger.params.boundaryRole : null
    if (role !== 'upper' && role !== 'lower' && role !== 'middle') {
      return null
    }

    return {
      role,
      period: this.readFiniteNumber(indicatorRecord.period),
      stdDev: this.readFiniteNumber(indicatorRecord.stdDev),
    }
  }

  private sameOptionalNumber(left: number | null, right: number | null): boolean {
    return left === null || right === null || left === right
  }

  private readFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private omitTriggerConfirmationParam(params: Record<string, unknown>): Record<string, unknown> {
    const { confirmationMode: _confirmationMode, ...rest } = params
    return rest
  }

  private resolvePreferredConfirmationMode(
    left: unknown,
    right: unknown,
  ): string | null {
    const rank = (value: unknown): number => {
      if (value === 'close_confirm') return 3
      if (value === 'touch') return 2
      if (value === 'ambiguous_touch_or_close_confirm') return 1
      return 0
    }

    if (rank(left) >= rank(right)) {
      return typeof left === 'string' && left ? left : null
    }
    return typeof right === 'string' && right ? right : null
  }

  private scoreTriggerMatch(left: SemanticTriggerState, right: SemanticTriggerState): number {
    let score = 0

    if (left.sideScope && right.sideScope && left.sideScope === right.sideScope) {
      score += 5
    }

    const candidateKeys = new Set([
      ...Object.keys(left.params),
      ...Object.keys(right.params),
    ])
    for (const key of candidateKeys) {
      if (left.params[key] !== undefined && left.params[key] === right.params[key]) {
        score += 1
      }
    }

    const leftSlotKeys = new Set(left.openSlots.map(slot => slot.slotKey))
    for (const slot of right.openSlots) {
      if (leftSlotKeys.has(slot.slotKey)) {
        score += 3
      }
    }

    return score
  }

  private isSameActionIdentity(left: SemanticActionState, right: SemanticActionState): boolean {
    if (left.key !== right.key) {
      return false
    }

    return this.haveCompatibleParamValues(left.params ?? {}, right.params ?? {})
  }

  private isSameRiskIdentity(left: SemanticRiskState, right: SemanticRiskState): boolean {
    if (left.key !== right.key) {
      return false
    }

    return this.haveCompatibleParamValues(left.params, right.params)
  }

  private haveCompatibleParamValues(
    left: Record<string, unknown>,
    right: Record<string, unknown>,
    keys?: readonly string[],
  ): boolean {
    const identityKeys = keys ?? [...new Set([...Object.keys(left), ...Object.keys(right)])]

    return identityKeys.every((key) => {
      const leftValue = left[key]
      const rightValue = right[key]
      if (leftValue === undefined || rightValue === undefined) {
        return true
      }
      return leftValue === rightValue
    })
  }

  private mergeOpenSlots(
    persisted: SemanticTriggerState['openSlots'],
    derived: SemanticTriggerState['openSlots'],
  ): SemanticTriggerState['openSlots'] {
    const next = derived.map(slot => ({ ...slot }))

    for (const persistedSlot of persisted) {
      const matchIndex = next.findIndex(slot =>
        slot.slotKey === persistedSlot.slotKey && slot.fieldPath === persistedSlot.fieldPath)
      if (matchIndex < 0) {
        next.push({ ...persistedSlot })
        continue
      }

      next[matchIndex] = this.mergeSlotState(persistedSlot, next[matchIndex])!
    }

    return next
  }

  private mergeSlotState<T extends SemanticContextSlotState[keyof SemanticContextSlotState]>(
    persisted: T,
    derived: T,
  ): T {
    if (!persisted) {
      return derived
    }

    if (!derived) {
      return persisted
    }

    const preferPersisted = this.compareNodeStrength(persisted, derived) > 0
    const stronger = preferPersisted ? persisted : derived
    const weaker = preferPersisted ? derived : persisted

    return {
      ...weaker,
      ...stronger,
      value: 'value' in stronger && stronger.value !== undefined
        ? stronger.value
        : 'value' in weaker
          ? weaker.value
          : undefined,
      evidence: stronger.evidence ?? weaker.evidence,
    } as T
  }

  private compareNodeStrength(
    left: { status: 'open' | 'locked' | 'superseded', source?: 'user_explicit' | 'inferred' | 'derived', value?: unknown },
    right: { status: 'open' | 'locked' | 'superseded', source?: 'user_explicit' | 'inferred' | 'derived', value?: unknown },
  ): number {
    const statusDiff = this.getStatusRank(left.status) - this.getStatusRank(right.status)
    if (statusDiff !== 0) {
      return statusDiff
    }

    const sourceDiff = this.getSourceRank(left.source) - this.getSourceRank(right.source)
    if (sourceDiff !== 0) {
      return sourceDiff
    }

    return Number(left.value !== undefined) - Number(right.value !== undefined)
  }

  private getStatusRank(status: 'open' | 'locked' | 'superseded'): number {
    switch (status) {
      case 'locked':
        return 2
      case 'open':
        return 1
      case 'superseded':
      default:
        return 0
    }
  }

  private getSourceRank(source?: 'user_explicit' | 'inferred' | 'derived'): number {
    switch (source) {
      case 'user_explicit':
        return 2
      case 'inferred':
        return 1
      case 'derived':
      default:
        return 0
    }
  }

  /**
   * #1162 Task 7 — 真重复检测：key + sideScope + 参数字典深度稳定序列化
   * 用于 mergeActions / mergeRisk fallback push 路径：仅当完全相同才丢弃新副本；
   * params 不同（合法多档 add_position 等）则仍 push。
   */
  private stableParamsHash(params: Record<string, unknown> | undefined): string {
    if (!params) return 'null'
    // critic Major #1：递归稳定序列化，避免嵌套对象（如 tiers 数组、sizing 子对象）
    //   因 key 顺序差异被误判为"不同"，导致真重复漏判
    return JSON.stringify(this.stableValue(params))
  }

  private stableValue(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map(v => this.stableValue(v))
    const obj = value as Record<string, unknown>
    return Object.keys(obj).sort().reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = this.stableValue(obj[k])
      return acc
    }, {})
  }

  // #1167：SemanticActionState / SemanticRiskState 顶层无 sideScope 字段（在 params 内 / trigger 才有）
  //   去掉 sideScope 比较；真重复判定用 key + stableParamsHash（params 内 sideScope 已含在 hash 内）
  private isTrueDuplicateAction(left: SemanticActionState, right: SemanticActionState): boolean {
    return left.key === right.key
      && this.stableParamsHash(left.params) === this.stableParamsHash(right.params)
  }

  private isTrueDuplicateRisk(left: SemanticRiskState, right: SemanticRiskState): boolean {
    return left.key === right.key
      && this.stableParamsHash(left.params) === this.stableParamsHash(right.params)
  }

  /**
   * #1383 Lane B：所有 bucket merge 收尾统一过此 helper。
   * identity = (key, phase, stableParamsHash, openSlots slotKey signature)；
   * 同 identity 多条折叠为一条，保留 compareNodeStrength 最强的（locked > superseded > open；
   * user_explicit > inferred > derived）。修复"止损/止盈渲染两次"等回归 — persisted/derived
   * 各自走过 identity match 后仍残留同 atom 多份的边界场景。
   *
   * openSlots slotKey 列入 identity 是为了保留合法 sibling atom：同 (key, phase, params) 但
   * 持有不同 open slot 的两条 atom（例如两条 indicator.above 各自带 reference.period.entry.a/b）
   * 不能被折叠为一条。
   */
  private dedupeByAtomIdentity<T extends AtomLikeEntry>(entries: T[]): T[] {
    const keptByIdentity = new Map<string, T>()
    const result: T[] = []
    const placeholderByIdentity = new Map<string, number>()

    for (const entry of entries) {
      const identity = this.computeAtomIdentityKey(entry)
      const existingIndex = placeholderByIdentity.get(identity)
      if (existingIndex === undefined) {
        placeholderByIdentity.set(identity, result.length)
        keptByIdentity.set(identity, entry)
        result.push(entry)
        continue
      }

      const incumbent = keptByIdentity.get(identity)!
      // strict greater：等强保留先到（与现有 tie-break 一致：等强偏 derived，
      // 但 dedupe 是 post-pass，"先到"已是 mergeXxx 决出的赢家）。
      if (this.compareNodeStrength(entry, incumbent) > 0) {
        result[existingIndex] = entry
        keptByIdentity.set(identity, entry)
      }
    }

    return result
  }

  // Issue #1403 子故障 D + Issue #1443 升级：rules[] 按 content shape 合并而非 rule.id。
  //
  //   旧实现优先用 rule.id 作 identity——LLM 每轮新 rule 用不同 id（如
  //   `rule-entry-1` vs `rule-r1-entry` vs `dispatcher-lift-N-xxx`），即便 condition/
  //   effects shape 完全相同也不去重，导致**多轮对话 rules 累加**：
  //     - 用户首轮 "3 分钟跌 1% 买入" → planner 产 entry rule#1
  //     - 用户答 "合约" → planner 重新产 entry rule#2 含相同语义但新 id
  //     - state.rules 累加 2 条相同 entry → UI 重复显示
  //
  //   通用修复：identity 完全基于 content shape（phase + sideScope + conditionHash +
  //   effectsHash），忽略 rule.id（id 是构造时序号，不该作去重依据）。
  //
  //   同 identity 走 "derived 覆盖 persisted"（最新轮次 LLM 描述权重更高）；
  //   持久态独有的 rule（如更早轮次定下的 entry/exit）保留，避免被风控轮次抹平。
  private mergeRulesByIdentity(
    persisted: readonly SemanticRule[] | undefined,
    derived: readonly SemanticRule[] | undefined,
  ): readonly SemanticRule[] | undefined {
    if (!persisted && !derived) return undefined
    const persistedArr = persisted ?? []
    const derivedArr = derived ?? []
    if (persistedArr.length === 0) return derivedArr.length > 0 ? derivedArr : undefined
    if (derivedArr.length === 0) return persistedArr

    // Issue #1443：双重 dedup 兼顾旧 id 契约 + 新 shape 累加防护
    //   Pass 1：按 rule.id 折叠（保旧契约——同 id 表"LLM 修正同一条"，derived 覆盖）
    //   Pass 2：按 content shape 折叠（解决新问题——不同 id 但同 shape 多轮累加）
    const shapeOf = (rule: SemanticRule): string => {
      const condHash = this.stableParamsHash(rule.condition as unknown as Record<string, unknown>)
      const effectsHash = this.stableParamsHash(
        (rule.effects ?? []) as unknown as Record<string, unknown>,
      )
      return `shape:${rule.phase}|${rule.sideScope}|${condHash}|effects:${effectsHash}`
    }

    // ── Pass 1：按 id 折叠 ──
    const byId = new Map<string, SemanticRule>()
    const idOrder: string[] = []
    const noIdRules: SemanticRule[] = []
    const ingest = (rule: SemanticRule): void => {
      if (rule.id && rule.id.length > 0) {
        if (!byId.has(rule.id)) idOrder.push(rule.id)
        // 审查 M2 + Task 6：同 id 折叠时 effects 若 derived 缺省/空数组 → 保留 persisted；
        // typed RuleEffects 逐 role 合并，避免 risks patch 清空 programs。
        const existing = byId.get(rule.id)
        const mergedEffects = this.mergeRuleEffects(existing?.effects, rule.effects)
        byId.set(rule.id, { ...rule, effects: mergedEffects })
      }
      else {
        noIdRules.push(rule)
      }
    }
    persistedArr.forEach(ingest)
    derivedArr.forEach(ingest)
    const afterIdPass: SemanticRule[] = [...idOrder.map(k => byId.get(k)!), ...noIdRules]

    // ── Pass 2：按 content shape 折叠（不同 id 同 shape → 留后入者，去重累加） ──
    const byShape = new Map<string, SemanticRule>()
    const shapeOrder: string[] = []
    for (const rule of afterIdPass) {
      const sig = shapeOf(rule)
      if (!byShape.has(sig)) shapeOrder.push(sig)
      // 后入者（derived）覆盖前入者（persisted）
      byShape.set(sig, rule)
    }
    const afterShapePass = shapeOrder.map(s => byShape.get(s)!)

    // ── Pass 3：风控类 rule 归一化折叠（Issue #1443 多轮 SL/TP 翻倍真因） ──
    //   用户复测：turn 1（现货）planner 产 risk rule { sideScope:'long', effects:[close_long] }；
    //   turn 2（选「合约 perp」）planner 重产同语义 risk rule 但 { sideScope:'both',
    //   effects:[close_long, close_short] } —— Pass 2 的 shape 含 sideScope 与 effects，
    //   两者签名不同 → 两条都留 → UI「止损×2 / 止盈×2」。
    //
    //   通用判定：风控类 rule = condition 所有 leaf 的 contract.bucket === 'risk'
    //   （`risk.stop_loss_pct` / `risk.take_profit_pct` / `risk.trailing_stop` 等）。
    //   这类 rule 的"用户意图身份"完全由 condition（阈值 + basis）决定，与 sideScope
    //   或具体 close action 无关——SL/TP 触发后的平仓动作是市场类型派生的，不该让
    //   语义上同一条 SL 因为派生侧 close action 多寡而分裂成两条。
    //
    //   归一化 sig = `risk:${phase}|${condHash}`，同 sig 留后入者（derived 覆盖 persisted），
    //   与 Pass 2 derived-prevails 语义一致。
    //
    //   守门：
    //   - condition 含任何非 risk-bucket leaf（如 AND(price.above, risk.stop_loss)）→ 不归一化
    //     （混合 condition 语义复杂，保守保留 Pass 2 行为）
    //   - condition leaf bucket 在 registry 缺失 → fail-open 不归一化（避免新 atom 未注册时
    //     被错合并）
    const conditionAllRiskBucket = (rule: SemanticRule): boolean => {
      const leaves = collectAtomLeaves(rule.condition)
      if (leaves.length === 0) return false
      for (const leaf of leaves) {
        const contract = (ATOM_CONTRACT_REGISTRY as Record<string, { bucket?: string } | undefined>)[leaf.key]
        if (!contract || contract.bucket !== 'risk') return false
      }
      return true
    }
    const byRiskSig = new Map<string, SemanticRule>()
    const riskOrder: string[] = []
    const nonRiskRules: SemanticRule[] = []
    for (const rule of afterShapePass) {
      if (!conditionAllRiskBucket(rule)) {
        nonRiskRules.push(rule)
        continue
      }
      const condHash = this.stableParamsHash(rule.condition as unknown as Record<string, unknown>)
      const sig = `risk:${rule.phase}|${condHash}`
      if (!byRiskSig.has(sig)) riskOrder.push(sig)
      byRiskSig.set(sig, rule)
    }
    // 保持原顺序：风控 rule 在出现位置插入归一化后的代表（按 riskOrder 一致取首次出现位置）。
    // 实际渲染顺序对 UI 影响有限（projection 层会按 phase 重排），这里简化为「先非风控，
    // 后归一化风控」——既往 Pass 2 输出顺序也不保证严格稳定。
    if (riskOrder.length === 0) return afterShapePass
    return [...nonRiskRules, ...riskOrder.map(s => byRiskSig.get(s)!)]
  }

  private mergeRuleEffects(
    persisted: RuleEffects | undefined,
    derived: RuleEffects,
  ): RuleEffects {
    if (!persisted) return this.cloneRuleEffects(derived)
    if (listRuleEffects(derived).length === 0) return this.cloneRuleEffects(persisted)
    if (listRuleEffects(persisted).length === 0) return this.cloneRuleEffects(derived)

    if (isRuleEffectsByRole(persisted) && isRuleEffectsByRole(derived)) {
      return {
        actions: this.mergeRuleEffectRole(persisted.actions, derived.actions),
        risks: this.mergeRuleEffectRole(persisted.risks, derived.risks),
        positions: this.mergeRuleEffectRole(persisted.positions, derived.positions),
        orchestration: this.mergeRuleEffectRole(persisted.orchestration, derived.orchestration),
        programs: this.mergeRuleEffectRole(persisted.programs, derived.programs),
      } satisfies RuleEffectsByRole
    }

    return this.cloneRuleEffects(derived)
  }

  private mergeRuleEffectRole(
    persisted: ReadonlyArray<AtomExpr>,
    derived: ReadonlyArray<AtomExpr>,
  ): AtomExpr[] {
    if (derived.length === 0) return persisted.map(effect => this.cloneAtomExpr(effect))
    if (persisted.length === 0) return derived.map(effect => this.cloneAtomExpr(effect))

    const byShape = new Map<string, AtomExpr>()
    const order: string[] = []
    for (const effect of [...persisted, ...derived]) {
      const shape = this.stableParamsHash(effect as unknown as Record<string, unknown>)
      if (!byShape.has(shape)) order.push(shape)
      byShape.set(shape, effect)
    }
    return order.map(shape => this.cloneAtomExpr(byShape.get(shape)!))
  }

  private cloneRuleEffects(effects: RuleEffects): RuleEffects {
    if (Array.isArray(effects)) {
      return effects.map(effect => this.cloneAtomExpr(effect))
    }
    const typedEffects = effects as RuleEffectsByRole
    return {
      actions: typedEffects.actions.map(effect => this.cloneAtomExpr(effect)),
      risks: typedEffects.risks.map(effect => this.cloneAtomExpr(effect)),
      positions: typedEffects.positions.map(effect => this.cloneAtomExpr(effect)),
      orchestration: typedEffects.orchestration.map(effect => this.cloneAtomExpr(effect)),
      programs: typedEffects.programs.map(effect => this.cloneAtomExpr(effect)),
    } satisfies RuleEffectsByRole
  }

  private cloneAtomExpr(effect: AtomExpr): AtomExpr {
    return structuredClone(effect) as AtomExpr
  }

  private computeAtomIdentityKey(entry: AtomLikeEntry): string {
    const key = entry.key ?? '__nokey__'
    const phase = entry.phase ?? '__nophase__'
    const paramsHash = this.stableParamsHash(entry.params)
    // openSlots signature 把"同 atom 不同 open slot"sibling 区分出去；
    // Issue #1383 Round 1 M6：含 slotKey + fieldPath，避免两条 sibling atom
    //   (例如 EMA20 / EMA60 各自 reference.period.entry.a / .b) 因 slotKey 同名
    //   被错合并。排序保证顺序无关。
    const slotSignatures = (entry.openSlots ?? [])
      .map((slot) => {
        const slotKey = slot.slotKey ?? ''
        const fieldPath = (slot as { fieldPath?: string }).fieldPath ?? ''
        return `${slotKey}@${fieldPath}`
      })
      .sort()
      .join(',')
    return `${key}|${phase}|${paramsHash}|${slotSignatures}`
  }
}
