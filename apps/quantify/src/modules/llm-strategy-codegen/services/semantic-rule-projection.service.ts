/**
 * Issue #1395 — rules[] → 扁平桶派生
 *
 * 把 SemanticRule[] 投影到 trigger / action / risk / positionConstraint / orchestration
 * 五个扁平桶（兼容下游 49 个 reader）。
 *
 * 设计要点：
 *   - 单叶子 rule.condition.kind === 'atom' → 1 个 trigger node（与旧 atoms[] 路径完全一致）
 *   - AND/OR 组合 → 多个 trigger node + 1 个 triggerCombinationContract(groupId, join)
 *   - NOT/SEQUENCE 在 contract 层暂不区分（IR 层处理）
 *   - effects[] 按 ATOM_CONTRACT_REGISTRY[key].bucket 投影到对应桶
 *
 * MVP 占位：
 *   - orchestration 投影仅记录 atom leaf 但未构造完整 orchestration node（结构复杂，
 *     与 effects 语义重合度低；先确保 trigger 路径不丢失，后续 PR 完善）。
 *   - 投影输出的 state 对象只填必要字段；下游 normalization / projection / readiness
 *     若需要额外字段，由各自服务按现有规则补齐。
 */

import { Injectable } from '@nestjs/common'

import {
  ATOM_CONTRACT_REGISTRY,
} from '../atom-contracts/atom-contract-registry'
import type {
  AtomExpr,
  AtomExprAtom,
  SemanticRule,
} from '../types/atom-expr'
import { collectAtomLeaves } from '../types/atom-expr'
import type {
  SemanticActionState,
  SemanticOrchestrationNode,
  SemanticPositionConstraintKey,
  SemanticPositionConstraintState,
  SemanticRiskState,
  SemanticTriggerState,
} from '../types/semantic-state'

import { buildTriggerCombinationContract } from './semantic-state-normalization'

@Injectable()
export class SemanticRuleProjectionService {
  projectToFlat(rules: ReadonlyArray<SemanticRule>): {
    trigger: SemanticTriggerState[]
    action: SemanticActionState[]
    risk: SemanticRiskState[]
    positionConstraint: SemanticPositionConstraintState[]
    orchestration: SemanticOrchestrationNode[]
  } {
    const out = {
      trigger: [] as SemanticTriggerState[],
      action: [] as SemanticActionState[],
      risk: [] as SemanticRiskState[],
      positionConstraint: [] as SemanticPositionConstraintState[],
      orchestration: [] as SemanticOrchestrationNode[],
    }

    for (const rule of rules) {
      this.projectCondition(rule, out.trigger)

      let effectIndex = 0
      for (const eff of rule.effects) {
        for (const leaf of collectAtomLeaves(eff)) {
          const contract = (ATOM_CONTRACT_REGISTRY as Record<string, { bucket?: string } | undefined>)[leaf.key]
          if (!contract || typeof contract.bucket !== 'string') {
            // unknown atom — skip silently（与 dispatchAtomsByContractBucket 兜底一致）
            continue
          }
          const baseId = `${rule.id}-eff-${effectIndex}`
          this.dispatchEffectLeaf(contract.bucket, leaf, baseId, out)
          effectIndex += 1
        }
      }
    }

    return out
  }

  private projectCondition(rule: SemanticRule, triggers: SemanticTriggerState[]): void {
    const expr = rule.condition
    if (expr.kind === 'atom') {
      triggers.push(this.atomToTrigger(expr, rule, 0))
      return
    }

    // 组合：收集所有叶子作为 trigger node
    const leaves = collectAtomLeaves(expr)
    const startIndex = triggers.length
    leaves.forEach((leaf, i) => {
      triggers.push(this.atomToTrigger(leaf, rule, i))
    })

    // AND/OR → combinationContract 挂到 **每个** group member（Issue #1413）。
    //   旧实现只挂第一个 member（"anchor + 隐式 tail" 约定），与 seed-builder
    //   `withMovingAverageStackCombinationContracts` 的"每个 member 挂同 groupId 合约"
    //   约定不一致；下游 SemanticTriggerCombinationContractService.resolveExecutableGroups
    //   按 `existing.members.push(trigger)` 累积成员，依赖每个 member 都带显式合约，
    //   anchor-only 路径会让非 anchor 退化为 implicit singleton。每个 member 都挂合约
    //   是与 IR / readiness 既有读取语义对齐的写法，也让 `rulesFromFlatBuckets` 反向
    //   投影能直接按 contract.groupId 归组，无需启发式扫描。
    const join = this.toJoinKind(expr)
    if (join && leaves.length >= 2) {
      const groupId = `rule-${rule.id}-grp`
      const contract = buildTriggerCombinationContract({
        groupId,
        join,
        phase: this.phaseToTriggerPhase(rule.phase),
        sideScope: rule.sideScope,
      })
      for (let i = 0; i < leaves.length; i++) {
        const member = triggers[startIndex + i]
        if (!member) continue
        triggers[startIndex + i] = {
          ...member,
          contracts: [...(member.contracts ?? []), contract],
        }
      }
    }
  }

  private toJoinKind(expr: AtomExpr): 'AND' | 'OR' | null {
    if (expr.kind === 'and') return 'AND'
    if (expr.kind === 'or') return 'OR'
    // NOT / sequence 由 IR 层 compileAtomExpr 处理
    return null
  }

  /** rule.phase 'entry' | 'exit' | 'gate' → trigger phase 'entry' | 'exit' | 'risk' | 'gate' */
  private phaseToTriggerPhase(phase: SemanticRule['phase']): SemanticTriggerState['phase'] {
    return phase
  }

  private atomToTrigger(
    atom: AtomExprAtom,
    rule: SemanticRule,
    index: number,
  ): SemanticTriggerState {
    return {
      id: `${rule.id}-cond-${index}`,
      key: atom.key,
      phase: this.phaseToTriggerPhase(rule.phase),
      sideScope: atom.sideScope ?? rule.sideScope,
      params: { ...atom.params },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }
  }

  private dispatchEffectLeaf(
    bucket: string,
    leaf: AtomExprAtom,
    baseId: string,
    out: {
      action: SemanticActionState[]
      risk: SemanticRiskState[]
      positionConstraint: SemanticPositionConstraintState[]
      orchestration: SemanticOrchestrationNode[]
    },
  ): void {
    switch (bucket) {
      case 'action':
        out.action.push({
          id: baseId,
          key: leaf.key,
          params: { ...leaf.params },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
        return
      case 'risk':
        out.risk.push({
          id: baseId,
          key: leaf.key,
          params: { ...leaf.params },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
        return
      case 'positionConstraint':
        out.positionConstraint.push({
          id: baseId,
          // 信任 registry bucket 已守门；leaf.key 与 SemanticPositionConstraintKey 联合类型对齐
          key: leaf.key as SemanticPositionConstraintKey,
          params: { ...leaf.params },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
        return
      case 'orchestration':
        // MVP 占位：orchestration node 结构复杂（kind / contracts / target / programKind ...），
        // 当前 PR 仅保 trigger 路径不丢失；orchestration effect 投影留待后续 PR。
        return
      default:
        return
    }
  }
}
