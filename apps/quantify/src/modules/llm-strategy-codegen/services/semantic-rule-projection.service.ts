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
 * Issue #1447 闸 3：
 *   - 每个 flat atom 必须携带 `_provenance: { ruleId, conditionPath }`，
 *     conditionPath 形如 `condition.atom` / `condition.and.children[2]` /
 *     `effects[0].atom` / `effects[1].sequence.steps[0]`；
 *   - merge / projection 链路末端 invariant：所有 atom 的 ruleId 必须能在输入
 *     `rules[]` 找到，否则 drop + 计数 `flat_atom_orphan_drop_total{bucket, source}`；
 *   - dispatcher noisy lift 已在 PlannerDispatcherMergeService.liftDispatcherAtomsIntoRules
 *     收敛为单叶子 rule，rule.id 形如 `dispatcher-lift-N-<key>`，本服务对其与
 *     planner 产出的 rule 一视同仁——「准入证」只看 ruleId 是否在当前 rules[] 内。
 */

import { Injectable, Logger } from '@nestjs/common'

import {
  ATOM_CONTRACT_REGISTRY,
} from '../atom-contracts/atom-contract-registry'
import type {
  AtomExpr,
  AtomExprAtom,
  SemanticRule,
} from '../types/atom-expr'
import type {
  SemanticActionState,
  SemanticFlatAtomProvenance,
  SemanticNodeStatus,
  SemanticOrchestrationNode,
  SemanticPositionConstraintKey,
  SemanticPositionConstraintState,
  SemanticRiskState,
  SemanticSlotState,
  SemanticSource,
  SemanticState,
  SemanticTriggerState,
} from '../types/semantic-state'
import type { ParamSlotSchema } from '../atom-contracts/atom-contract-surface.types'

import { buildTriggerCombinationContract } from './semantic-state-normalization'

type ProjectionOut = {
  trigger: SemanticTriggerState[]
  action: SemanticActionState[]
  risk: SemanticRiskState[]
  positionConstraint: SemanticPositionConstraintState[]
  orchestration: SemanticOrchestrationNode[]
}

/** Issue #1447 闸 3：用于 orphan drop 度量的 bucket label 集合（与 ProjectionOut 同步） */
type FlatBucket = keyof ProjectionOut

@Injectable()
export class SemanticRuleProjectionService {
  private readonly logger = new Logger(SemanticRuleProjectionService.name)
  /** Issue #1493：static 包装用 logger（避免实例化也可调用 invariant） */
  private static readonly staticLogger = new Logger(`${SemanticRuleProjectionService.name}.static`)

  /**
   * Issue #1493：把 `rules[]` 重新投影回 flat 五桶并返回新 SemanticState。
   *
   * 单一来源原则：`reducer` / `edit` / `readiness` 等下游路径**禁止** in-place
   * 修改 flat 五桶；任何 rules 树变更后必须经由本方法回写。
   *
   * 行为：
   *   - 不可变返回（structural sharing：非派生字段保持原引用）
   *   - rules 空 / undefined → 直接 return 原 state（不清空 flat，避免破坏老 fixture）
   *   - 末端跑 `enforceProvenanceInvariant`（projectToFlat 内部已跑，这里防御性 no-op）
   *
   * 不动字段：position / contextSlots / orchestrationContracts / pendingEdit /
   *   updatedAt / rules 本身 / diagnostics / 其它任何非派生字段。
   */
  reprojectFromRules(state: SemanticState): SemanticState {
    if (!state.rules || state.rules.length === 0) {
      // Issue #1493 C2：rules 空 + flat 非空 legacy 路径。
      //   生产规约：planner / dispatcher 路径 rules 永远非空（见 semantic-state.ts
      //   顶部 docstring 契约）；rules=undefined/[] 仅在老 fixture / pure-flat seed
      //   场景出现。这里输出结构化 warn 帮助下游线上排查为何某条记录走 legacy 路径。
      const flatNonEmptyCount
        = state.trigger.length
        + state.action.length
        + state.risk.length
        + (state.positionConstraint?.length ?? 0)
        + state.orchestration.length
      if (flatNonEmptyCount > 0) {
        this.logger.warn(
          `[#1493] reproject_skipped_rules_missing flatNonEmptyCount=${flatNonEmptyCount}`
          + ` metric=semantic_state_rules_missing_total+=1`,
        )
      }
      return state
    }
    const projected = this.projectToFlat(state.rules)
    // Issue #1493 M2：显式再跑一次 invariant—projectToFlat 内部已跑过一次，这里防御性
    //   no-op，但语义清晰地把 "reprojectFromRules 返回值满足 _provenance invariant"
    //   写在调用现场，未来若 projectToFlat 实现重抽不再内部跑 invariant，也不会让
    //   reprojectFromRules 静默退化。
    SemanticRuleProjectionService.enforceProvenanceInvariantInPlace(projected, state.rules)
    return {
      ...state,
      trigger: projected.trigger,
      action: projected.action,
      risk: projected.risk,
      positionConstraint: projected.positionConstraint,
      orchestration: projected.orchestration,
    }
  }

  /**
   * Issue #1493：把私有 `enforceProvenanceInvariant` 提升为 public static 入口。
   *
   * 调用方在「带外 mutation flat 桶」后可显式跑一次，与 `reprojectFromRules`
   * 配合形成"flat = pure function of rules"硬约束（见 SemanticFlatAtomProvenance
   * Major M-1 注释中的 follow-up）。
   *
   * 命名后缀 `InPlace` 显式声明语义：会原地修改 `out` 的五个数组（沿用原私有实现
   * 语义）；纯函数式调用方应先浅拷贝再传入。
   */
  static enforceProvenanceInvariantInPlace(
    out: ProjectionOut,
    rules: ReadonlyArray<SemanticRule>,
  ): void {
    const validRuleIds = new Set<string>()
    for (const r of rules) validRuleIds.add(r.id)

    const filterBucket = <T extends { _provenance?: SemanticFlatAtomProvenance, key?: string }>(
      bucket: FlatBucket,
      arr: T[],
    ): T[] => {
      const kept: T[] = []
      for (const node of arr) {
        const prov = node._provenance
        if (!prov || !validRuleIds.has(prov.ruleId)) {
          const sanitize = (s: string): string => s.replace(/[\r\n]+/g, ' ').slice(0, 200)
          const srcLabel = prov?.ruleId ? sanitize(prov.ruleId) : 'missing_provenance'
          const keyLabel = node.key ? sanitize(node.key) : '<unknown>'
          SemanticRuleProjectionService.staticLogger.warn(
            `[flat_atom_orphan_drop] bucket=${bucket} source=${srcLabel} key=${keyLabel}`
            + ` metric=flat_atom_orphan_drop_total{bucket="${bucket}",source="${srcLabel}"}+=1`,
          )
          continue
        }
        kept.push(node)
      }
      return kept
    }

    out.trigger = filterBucket('trigger', out.trigger)
    out.action = filterBucket('action', out.action)
    out.risk = filterBucket('risk', out.risk)
    out.positionConstraint = filterBucket('positionConstraint', out.positionConstraint)
    out.orchestration = filterBucket('orchestration', out.orchestration)
  }

  projectToFlat(rules: ReadonlyArray<SemanticRule>): ProjectionOut {
    const out: ProjectionOut = {
      trigger: [],
      action: [],
      risk: [],
      positionConstraint: [],
      orchestration: [],
    }

    for (const rule of rules) {
      this.projectCondition(rule, out.trigger)

      let effectIndex = 0
      for (const eff of rule.effects) {
        // effects[N] 顶层是 AtomExpr（可能是 atom 或 sequence/and/or/not），
        //   遍历叶子时拼接 `effects[N].<expr-path>` 作为 conditionPath。
        //
        // 审查 Critical C1（#1447 闸 3 第 1 轮）：effectIndex 在 walk 回调里被闭包捕获，
        //   若 eff 是复合节点（sequence / and / or 含多叶子），所有叶子共享同一 effectIndex
        //   会产出相同 baseId `${rule.id}-eff-${effectIndex}` → action/risk 桶 id 重复。
        //   修复：在回调外维护 leafIndexWithinEffect，每个叶子 id 形如
        //   `${rule.id}-eff-${effectIndex}-${leafIdx}`（单叶子时 leafIdx=0，与旧行为兼容）。
        const effBasePath = `effects[${effectIndex}]`
        let leafIdxWithinEffect = 0
        this.walkLeavesWithPath(eff, effBasePath, (leaf, leafPath) => {
          const contract = (ATOM_CONTRACT_REGISTRY as Record<string, { bucket?: string } | undefined>)[leaf.key]
          if (!contract || typeof contract.bucket !== 'string') {
            // unknown atom — skip silently（与 dispatchAtomsByContractBucket 兜底一致）
            return
          }
          const baseId = leafIdxWithinEffect === 0
            ? `${rule.id}-eff-${effectIndex}`
            : `${rule.id}-eff-${effectIndex}-${leafIdxWithinEffect}`
          leafIdxWithinEffect += 1
          this.dispatchEffectLeaf(contract.bucket, leaf, baseId, out, {
            ruleId: rule.id,
            conditionPath: leafPath,
          })
        })
        effectIndex += 1
      }
    }

    // Issue #1447 闸 3：merge / projection 链路末端 invariant 校验。
    //   理论上 projectToFlat 自己产生的 atom 永远有 _provenance.ruleId 且 in-set，
    //   但 invariant 作为 defense-in-depth 兜底任何下游误调用 / 未来重抽路径。
    SemanticRuleProjectionService.enforceProvenanceInvariantInPlace(out, rules)

    return out
  }

  /**
   * Issue #1447 闸 3：遍历 AtomExpr 叶子，同时累积 JSON-Pointer 式路径。
   *
   * 路径段约定（与 atom-expr.ts joinPath 风格一致）：
   *   - atom 叶：`<base>.atom`
   *   - and/or：`<base>.and.children[i]` / `<base>.or.children[i]`
   *   - not   ：`<base>.not.child`
   *   - sequence：`<base>.sequence.steps[i]`
   *
   * 单叶子 rule.condition 形如 `condition.atom`；
   * AND 第三个 child 形如 `condition.and.children[2].atom`。
   */
  private walkLeavesWithPath(
    expr: AtomExpr,
    basePath: string,
    visit: (leaf: AtomExprAtom, path: string) => void,
  ): void {
    switch (expr.kind) {
      case 'atom':
        visit(expr, `${basePath}.atom`)
        return
      case 'and':
        expr.children.forEach((child, i) => {
          this.walkLeavesWithPath(child, `${basePath}.and.children[${i}]`, visit)
        })
        return
      case 'or':
        expr.children.forEach((child, i) => {
          this.walkLeavesWithPath(child, `${basePath}.or.children[${i}]`, visit)
        })
        return
      case 'not':
        this.walkLeavesWithPath(expr.child, `${basePath}.not.child`, visit)
        return
      case 'sequence':
        expr.steps.forEach((step, i) => {
          this.walkLeavesWithPath(step, `${basePath}.sequence.steps[${i}]`, visit)
        })
        return
      default: {
        // 审查 Critical C2（#1447 闸 3 第 1 轮）：exhaustiveness guard。
        //   若未来新增 AtomExpr kind 而本 switch 漏改，TS 编译期会在 _exhaustive 赋值处报错；
        //   运行时 fallback warn 一行而不静默 drop。
        const _exhaustive: never = expr
        this.logger.warn(`walkLeavesWithPath: unsupported AtomExpr kind ${(_exhaustive as { kind: string }).kind}`)
      }
    }
  }

  private projectCondition(rule: SemanticRule, triggers: SemanticTriggerState[]): void {
    const expr = rule.condition
    const startIndex = triggers.length
    let leafCount = 0
    // 审查 Minor m-1（#1447 闸 3 第 1 轮）：删除冗余 collectedLeaves，leafCount 已等价。
    this.walkLeavesWithPath(expr, 'condition', (leaf, leafPath) => {
      triggers.push(this.atomToTrigger(leaf, rule, leafCount, {
        ruleId: rule.id,
        conditionPath: leafPath,
      }))
      leafCount += 1
    })

    if (leafCount === 0) return

    // AND/OR → combinationContract 挂到第一个 member
    const join = this.toJoinKind(expr)
    if (join && leafCount >= 2) {
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
    provenance: SemanticFlatAtomProvenance,
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
      _provenance: provenance,
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
    provenance: SemanticFlatAtomProvenance,
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
          _provenance: provenance,
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
          _provenance: provenance,
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
          _provenance: provenance,
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
            _provenance: provenance,
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
   * Issue #1447 闸 3：merge / projection 链路末端 invariant —— flat 桶任一 atom 必须
   * 能反查到 `_provenance.ruleId` 对应的 rule；找不到 → drop + 结构化 warn 度量
   * `flat_atom_orphan_drop_total{bucket, source}`。
   *
   * dispatcher noisy lift 漏网场景：dispatcher 在 planner 之前做关键词启发式抽取，
   * 若某条改造路径未经 PlannerDispatcherMergeService.liftDispatcherAtomsIntoRules
   * 而直接把孤立 atom 塞进 flat 桶（或下游服务手工 push），该 atom 的
   * `_provenance.ruleId` 不会出现在 `rules[]` 中 → 在此被 drop。
   *
   * 缺 `_provenance` 字段（外部直接 push 进扁平桶）→ 也视为 orphan，与 dispatcher
   * noisy lift 同源治理；下游若需带外注入，应先包装成 single-leaf rule（与
   * dispatcher lift 一致）。
   *
   * TODO(#1447 follow-up)：把 structured logger.warn metric stub 替换为正式
   *   Prometheus / OpenTelemetry counter（沿用 #1445 / #1446 同一 metric pipeline 升级窗口）。
   *
   * Issue #1493 M2：删除实例包装方法，调用方统一走
   *   `SemanticRuleProjectionService.enforceProvenanceInvariantInPlace` static 入口。
   */

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
