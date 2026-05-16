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
  SemanticNodeStatus,
  SemanticOrchestrationNode,
  SemanticPositionConstraintKey,
  SemanticPositionConstraintState,
  SemanticRiskState,
  SemanticSlotState,
  SemanticSource,
  SemanticTriggerState,
} from '../types/semantic-state'
import type { ParamSlotSchema } from '../atom-contracts/atom-contract-surface.types'

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
    // Issue #1433 R-A：metadata 从 contract.paramSlots 反推（不再硬编码）
    const meta = this.deriveOwnerMetadata(atom.key, atom.params, `${rule.id}-cond-${index}`)
    return {
      id: `${rule.id}-cond-${index}`,
      key: atom.key,
      phase: this.phaseToTriggerPhase(rule.phase),
      sideScope: atom.sideScope ?? rule.sideScope,
      params: { ...atom.params },
      status: meta.status,
      source: meta.source,
      openSlots: meta.openSlots,
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
    // Issue #1433 R-A：所有 case 共用 metadata 反推（不再硬编码 locked / [] / user_explicit）
    const meta = this.deriveOwnerMetadata(leaf.key, leaf.params, baseId)
    switch (bucket) {
      case 'action':
        out.action.push({
          id: baseId,
          key: leaf.key,
          params: { ...leaf.params },
          status: meta.status,
          source: meta.source,
          openSlots: meta.openSlots,
        })
        return
      case 'risk':
        out.risk.push({
          id: baseId,
          key: leaf.key,
          params: { ...leaf.params },
          status: meta.status,
          source: meta.source,
          openSlots: meta.openSlots,
        })
        return
      case 'positionConstraint':
        out.positionConstraint.push({
          id: baseId,
          // 信任 registry bucket 已守门；leaf.key 与 SemanticPositionConstraintKey 联合类型对齐
          key: leaf.key as SemanticPositionConstraintKey,
          params: { ...leaf.params },
          status: meta.status,
          source: meta.source,
          openSlots: meta.openSlots,
        })
        return
      case 'orchestration':
        // Issue #1432：orchestration projection（kind 推断 + 字段透传）。
        // Issue #1433 R-A：metadata 走 deriveOwnerMetadata（与其它 case 对称）。
        {
          const kind = this.inferOrchestrationKind(leaf.key)
          if (!kind) return
          // 审查 Minor #1：params 浅拷贝（与其它 case 对称）。14 变体的专属字段
          //   如 gridParams / sizing / dynamicGridStep 等含嵌套对象，下游若就地
          //   mutate 会污染原 leaf；如需 fail-closed 校验请补 deep clone。
          out.orchestration.push({
            id: baseId,
            kind,
            key: leaf.key,
            params: { ...leaf.params },
            status: meta.status,
            source: meta.source,
            openSlots: meta.openSlots,
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

  /**
   * Issue #1433 R-A：从 atom contract `surface.paramSlots` 反推 owner-level
   * metadata（status / source / openSlots），消除 projection 各 case 的硬编码。
   *
   * 设计要点（Option A 最小子集，#1423 决策 Option C 框架下分层落地）：
   *   - 读 ATOM_CONTRACT_REGISTRY[atomKey].surface.paramSlots
   *   - 遍历 `required: true` 的 slot：若 atom.params 缺该 key（或值为 null/undefined/''），
   *     合成一条 SemanticSlotState 推入 openSlots
   *   - status：openSlots.length === 0 → 'locked'；否则 'open'
   *   - source：保持 'user_explicit'（rules 来自 planner LLM 输出，按"planner 是
   *     用户意图明确表达"语义；如未来 dispatcher derivation 接入再细分 'derived'）
   *
   * 守门：
   *   - atom 未在 registry 注册 / 无 surface / 无 paramSlots → 视为无 required slot，
   *     返回 status='locked' + openSlots=[]（fail-open，与既有 isAtomParamsStrictlyValid 一致）
   *   - 现行 projectToFlat 无产线调用方，零回归；reader 漏斗化时本 helper 接入
   *     clarification 链路（见 #1433 issue comment 标注的顺序约束）
   */
  private deriveOwnerMetadata(
    atomKey: string,
    params: Readonly<Record<string, unknown>>,
    ownerId: string,
  ): { status: SemanticNodeStatus, source: SemanticSource, openSlots: SemanticSlotState[] } {
    const entry = (ATOM_CONTRACT_REGISTRY as Record<string, { surface?: { paramSlots?: Record<string, ParamSlotSchema> } } | undefined>)[atomKey]
    const paramSlots = entry?.surface?.paramSlots
    if (!paramSlots) {
      return { status: 'locked', source: 'user_explicit', openSlots: [] }
    }

    // R-A 审查 Major #3：优先调 atom contract 顶层的 clarificationQuestion 文案（i18n 一致），
    //   fail-safe fallback 到通用模板。contract 通常有此函数（atom-coverage 不变量约束）。
    const clarificationFn = (entry as { clarificationQuestion?: (slotKey: string, params: Record<string, unknown>, locale: 'zh' | 'en') => string } | undefined)?.clarificationQuestion

    const openSlots: SemanticSlotState[] = []
    for (const [slotKey, schema] of Object.entries(paramSlots)) {
      if (!schema.required) continue
      const v = (params as Record<string, unknown>)[slotKey]
      // R-A 审查 Major #2：missing 判定不能误伤合法 0 / false——percent kind 的 valuePct=0
      //   是"价格不变"语义合法值；enum 的 boolean default 也合法。
      //   只把 undefined / null / 空字符串视为 missing，number / boolean / 0 / false 不算。
      const missing
        = v === undefined
        || v === null
        || (typeof v === 'string' && v.trim() === '')
      if (!missing) continue
      let questionHint = `请补充 ${atomKey} 的 ${slotKey} 参数。`
      if (typeof clarificationFn === 'function') {
        try {
          const fromContract = clarificationFn(slotKey, params as Record<string, unknown>, 'zh')
          if (typeof fromContract === 'string' && fromContract.trim() !== '') {
            questionHint = fromContract
          }
        }
        catch {
          // contract 抛错 fail-safe 走 fallback 模板
        }
      }
      openSlots.push({
        slotKey: `${atomKey}.${slotKey}`,
        fieldPath: `${ownerId}.params.${slotKey}`,
        status: 'open',
        priority: 'core',
        questionHint,
        affectsExecution: true,
        atomKey,
        paramSlotKey: slotKey,
      })
    }

    return {
      status: openSlots.length === 0 ? 'locked' : 'open',
      source: 'user_explicit',
      openSlots,
    }
  }
}
