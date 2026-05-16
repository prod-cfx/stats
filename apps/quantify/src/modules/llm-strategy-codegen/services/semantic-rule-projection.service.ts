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

    // AND/OR → combinationContract 挂到第一个 member
    const join = this.toJoinKind(expr)
    if (join && leaves.length >= 2) {
      const groupId = `rule-${rule.id}-grp`
      const contract = buildTriggerCombinationContract({
        groupId,
        join,
        phase: this.phaseToTriggerPhase(rule.phase),
        sideScope: rule.sideScope,
      })
      const first = triggers[startIndex]
      if (first) {
        triggers[startIndex] = {
          ...first,
          contracts: [...(first.contracts ?? []), contract],
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
        // Issue #1432：补齐 orchestration projection（之前 MVP 占位 return）。
        //   实施策略与 trigger/action/risk/positionConstraint case 对称：
        //     - kind 推断自 leaf.key prefix（program. / gate. / scope. / portfolioRisk.）
        //     - 字段从 leaf.params 透传（与 dispatcher 写入 patch.orchestration.nodes 的
        //       shape 兼容；具体专属字段 like programKind/sizing/gridParams 仍走 params）
        //     - metadata 硬编码 status:'locked' / source:'user_explicit' / openSlots:[]
        //       —— 与 trigger 等其它 case 一致；Issue #1433 (R-A) 统一改 metadata 反推
        //     - 未知 kind prefix 静默 skip（fail-open，与 unknown atom 兜底一致）
        //
        //   注：当前 projectToFlat 无产线调用方（仅 spec + 文档引用），本改动零产线回归
        //   风险；后续 reader 漏斗化路径将通过本方法消费 rules → flat 视图。
        {
          const kind = this.inferOrchestrationKind(leaf.key)
          if (!kind) return
          // 审查 Minor #1：params 浅拷贝（与其它 case 对称）。14 变体的专属字段
          //   如 gridParams / sizing / dynamicGridStep 等含嵌套对象，下游若就地
          //   mutate 会污染原 leaf。#1433 R-A 阶段如要补 fail-closed 校验需注意
          //   把嵌套字段也克隆，或在 helper 中走 deep clone。
          out.orchestration.push({
            id: baseId,
            kind,
            key: leaf.key,
            params: { ...leaf.params },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
            contracts: [],
          })
        }
        return
      default:
        return
    }
  }

  /**
   * Issue #1432：从 orchestration bucket atom key prefix 推断 `kind`。
   * 与 `SemanticOrchestrationNode.kind` 联合类型对齐。
   */
  private inferOrchestrationKind(key: string): SemanticOrchestrationNode['kind'] | null {
    if (key.startsWith('program.')) return 'program'
    if (key.startsWith('gate.')) return 'gate'
    if (key.startsWith('scope.')) return 'scope'
    if (key.startsWith('portfolioRisk.')) return 'portfolioRisk'
    return null
  }
}
