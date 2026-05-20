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
  SemanticExpression,
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

const ADD_POSITION_ATOM_KEY = ATOM_CONTRACT_REGISTRY['action.add_position'].key
const POSITION_NO_POSITION_ATOM_KEY = ATOM_CONTRACT_REGISTRY['position.no_position'].key
const POSITION_PYRAMIDING_LIMIT_ATOM_KEY = ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].key

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
    const normalizedRules = this.prunePyramidingRulesWithoutAddAction(state.rules)
    const projected = this.projectToFlat(normalizedRules)
    // Issue #1493 M2：显式再跑一次 invariant—projectToFlat 内部已跑过一次，这里防御性
    //   no-op，但语义清晰地把 "reprojectFromRules 返回值满足 _provenance invariant"
    //   写在调用现场，未来若 projectToFlat 实现重抽不再内部跑 invariant，也不会让
    //   reprojectFromRules 静默退化。
    SemanticRuleProjectionService.enforceProvenanceInvariantInPlace(projected, normalizedRules)
    return {
      ...state,
      rules: normalizedRules,
      trigger: projected.trigger,
      action: projected.action,
      risk: projected.risk,
      positionConstraint: projected.positionConstraint,
      orchestration: projected.orchestration,
    }
  }

  private prunePyramidingRulesWithoutAddAction(rules: ReadonlyArray<SemanticRule>): ReadonlyArray<SemanticRule> {
    if (this.rulesContainAtomKey(rules, ADD_POSITION_ATOM_KEY)) {
      return rules
    }

    let changed = false
    const next: SemanticRule[] = []
    for (const rule of rules) {
      if (this.exprContainsAtomKey(rule.condition, POSITION_PYRAMIDING_LIMIT_ATOM_KEY)) {
        changed = true
        continue
      }

      const effects: AtomExpr[] = []
      for (const effect of rule.effects) {
        const pruned = this.pruneAtomKeyFromExpr(effect, POSITION_PYRAMIDING_LIMIT_ATOM_KEY)
        if (!pruned) {
          changed = true
          continue
        }
        if (pruned !== effect) changed = true
        effects.push(pruned)
      }

      if (
        effects.length === 0
        && rule.condition.kind === 'atom'
        && rule.condition.key === POSITION_NO_POSITION_ATOM_KEY
      ) {
        changed = true
        continue
      }

      next.push(effects.length === rule.effects.length && effects.every((effect, index) => effect === rule.effects[index])
        ? rule
        : { ...rule, effects })
    }

    return changed ? next : rules
  }

  private rulesContainAtomKey(rules: ReadonlyArray<SemanticRule>, atomKey: string): boolean {
    return rules.some(rule =>
      this.exprContainsAtomKey(rule.condition, atomKey)
      || rule.effects.some(effect => this.exprContainsAtomKey(effect, atomKey)),
    )
  }

  private exprContainsAtomKey(expr: AtomExpr, atomKey: string): boolean {
    if (expr.kind === 'atom') return expr.key === atomKey
    if (expr.kind === 'and' || expr.kind === 'or') {
      return expr.children.some(child => this.exprContainsAtomKey(child, atomKey))
    }
    if (expr.kind === 'not') return this.exprContainsAtomKey(expr.child, atomKey)
    return expr.steps.some(step => this.exprContainsAtomKey(step, atomKey))
  }

  private pruneAtomKeyFromExpr(expr: AtomExpr, atomKey: string): AtomExpr | null {
    if (expr.kind === 'atom') {
      return expr.key === atomKey ? null : expr
    }

    if (expr.kind === 'and' || expr.kind === 'or') {
      const children = expr.children
        .map(child => this.pruneAtomKeyFromExpr(child, atomKey))
        .filter((child): child is AtomExpr => child !== null)
      if (children.length === 0) return null
      if (children.length === 1) return children[0]!
      return children.length === expr.children.length && children.every((child, index) => child === expr.children[index])
        ? expr
        : { ...expr, children }
    }

    if (expr.kind === 'not') {
      const child = this.pruneAtomKeyFromExpr(expr.child, atomKey)
      if (!child) return null
      return child === expr.child ? expr : { ...expr, child }
    }

    const steps = expr.steps
      .map(step => this.pruneAtomKeyFromExpr(step, atomKey))
      .filter((step): step is AtomExpr => step !== null)
    if (steps.length === 0) return null
    if (steps.length === 1) return steps[0]!
    return steps.length === expr.steps.length && steps.every((step, index) => step === expr.steps[index])
      ? expr
      : { ...expr, steps }
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
      this.projectCondition(rule, out)

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

  private projectCondition(rule: SemanticRule, out: ProjectionOut): void {
    const triggers = out.trigger
    const expr = rule.condition
    const startIndex = triggers.length
    let leafCount = 0
    let triggerLeafCount = 0
    // 审查 Minor m-1（#1447 闸 3 第 1 轮）：删除冗余 collectedLeaves，leafCount 已等价。
    this.walkLeavesWithPath(expr, 'condition', (leaf, leafPath) => {
      const contract = (ATOM_CONTRACT_REGISTRY as Record<string, { bucket?: string } | undefined>)[leaf.key]
      const provenance = {
        ruleId: rule.id,
        conditionPath: leafPath,
      }
      const baseId = `${rule.id}-cond-${leafCount}`
      if (!contract || typeof contract.bucket !== 'string' || contract.bucket === 'trigger') {
        triggers.push(this.atomToTrigger(leaf, rule, leafCount, provenance))
        triggerLeafCount += 1
      }
      else {
        this.dispatchEffectLeaf(contract.bucket, leaf, baseId, out, provenance)
      }
      leafCount += 1
    })

    if (triggerLeafCount === 0) return

    // AND/OR → 同一个 combinationContract 挂到每个 trigger member。
    // 只挂第一个会让后续 trigger 走 implicit singleton group，canonical 只能看到
    // 第一片条件，导致规则树里的 AND/OR 参数在 flat -> canonical 断裂。
    const join = this.toJoinKind(expr)
    if (join && triggerLeafCount >= 2) {
      const groupId = `rule-${rule.id}-grp`
      const contract = buildTriggerCombinationContract({
        groupId,
        join,
        phase: this.phaseToTriggerPhase(rule.phase),
        sideScope: rule.sideScope,
      })
      for (let index = startIndex; index < triggers.length; index += 1) {
        const trigger = triggers[index]
        if (!trigger || trigger._provenance?.ruleId !== rule.id) continue
        triggers[index] = {
          ...trigger,
          contracts: [...(trigger.contracts ?? []), contract],
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
          out.orchestration.push(...this.atomToOrchestrationNodes(leaf, baseId, kind, meta, provenance))
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

  private atomToOrchestrationNodes(
    leaf: AtomExprAtom,
    baseId: string,
    kind: SemanticOrchestrationNode['kind'],
    meta: { status: SemanticNodeStatus, source: SemanticSource, openSlots: SemanticSlotState[] },
    provenance: SemanticFlatAtomProvenance,
  ): SemanticOrchestrationNode[] {
    const base: SemanticOrchestrationNode = {
      id: baseId,
      kind,
      key: leaf.key,
      params: { ...leaf.params },
      status: meta.status,
      source: meta.source,
      openSlots: meta.openSlots,
      contracts: [],
      _provenance: provenance,
    }

    if (leaf.key === 'portfolioRisk.drawdown_block') {
      return [{
        ...base,
        scope: this.readEnum(leaf.params.scope, ['portfolio', 'symbol', 'subStrategy'] as const) ?? 'portfolio',
        mode: this.readEnum(leaf.params.mode, ['observe', 'enforce'] as const) ?? 'enforce',
        thresholdPct: this.readNumber(leaf.params.thresholdPct) ?? this.readNumber(leaf.params.pct),
      }]
    }

    if (leaf.key === 'scope.symbol') {
      const symbols = Array.isArray(leaf.params.symbols)
        ? leaf.params.symbols.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map(item => item.trim())
        : []
      if (symbols.length === 0) return []
      return [{
        ...base,
        symbolScopeKind: 'symbol',
        symbols,
        primarySymbol: this.readString(leaf.params.primarySymbol) ?? symbols[0],
      }]
    }

    if (leaf.key === 'scope.timeframe') {
      const primaryTimeframe = this.readString(leaf.params.primaryTimeframe)
      const requiredTimeframes = Array.isArray(leaf.params.requiredTimeframes)
        ? leaf.params.requiredTimeframes.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map(item => item.trim())
        : []
      if (!primaryTimeframe || requiredTimeframes.length === 0) return []
      return [{
        ...base,
        timeframeScopeKind: 'timeframe',
        primaryTimeframe: primaryTimeframe as SemanticOrchestrationNode['primaryTimeframe'],
        requiredTimeframes: requiredTimeframes as SemanticOrchestrationNode['requiredTimeframes'],
        alignmentPolicy: this.readEnum(leaf.params.alignmentPolicy, ['strict', 'tolerant'] as const) ?? 'strict',
      }]
    }

    if (leaf.key === 'program.fixed_grid_gated') {
      const gateId = this.readString(leaf.params.activeWhenRef) ?? `${baseId}-implicit-gate`
      return [
        ...(leaf.params.activeWhenRef ? [] : [this.buildImplicitAlwaysOnGate(gateId, baseId, provenance)]),
        {
          ...base,
          programKind: 'fixed_grid_gated',
          activeWhenRef: gateId,
          onDeactivate: this.readEnum(leaf.params.onDeactivate, ['cancel', 'keep', 'close'] as const) ?? 'cancel',
          rebuildPolicy: 'static',
          gridParams: this.normalizeFixedGridParams(leaf.params),
          sizing: this.normalizeProgramSizing(leaf.params.sizing) ?? this.normalizeProgramSizing(leaf.params) ?? { mode: 'fixed_pct', value: 10 },
        },
      ]
    }

    if (leaf.key === 'program.adaptive_volatility_grid') {
      const gateId = this.readString(leaf.params.activeWhenRef) ?? `${baseId}-implicit-gate`
      return [
        ...(leaf.params.activeWhenRef ? [] : [this.buildImplicitAlwaysOnGate(gateId, baseId, provenance)]),
        {
          ...base,
          programKind: 'adaptive_volatility_grid',
          activeWhenRef: gateId,
          onDeactivate: this.readEnum(leaf.params.onDeactivate, ['cancel', 'keep', 'close'] as const) ?? 'cancel',
          rebuildPolicy: 'atr_window',
          atrPeriod: this.readNumber(leaf.params.atrPeriod) ?? 14,
          atrMultiplier: this.readNumber(leaf.params.atrMultiplier) ?? 1.5,
          rangeMultiplier: this.readNumber(leaf.params.rangeMultiplier) ?? 3,
          atrDriftPct: this.readNumber(leaf.params.atrDriftPct) ?? 20,
          rebuildCooldownSec: this.readNumber(leaf.params.rebuildCooldownSec) ?? 300,
          minStepPct: this.readNumber(leaf.params.minStepPct) ?? 0.2,
          maxStepPct: this.readNumber(leaf.params.maxStepPct) ?? 2,
          levelCount: this.readNumber(leaf.params.levelCount) ?? 6,
          sizing: this.normalizeProgramSizing(leaf.params.sizing) ?? this.normalizeProgramSizing(leaf.params) ?? { mode: 'fixed_pct', value: 10 },
        },
      ]
    }

    if (leaf.key === 'gate.regime') {
      // Rules-tree gate effects are predicate-level filters. The rule condition itself
      // remains the executable source; projecting this bare effect into orchestration
      // creates a phase0 runtime node without target/activeWhen and blocks codegen.
      if (!leaf.params.activeWhen && !leaf.params.target && !leaf.params.effectWhenFalse) {
        return []
      }
    }

    return [base]
  }

  private buildImplicitAlwaysOnGate(
    id: string,
    sourceId: string,
    provenance: SemanticFlatAtomProvenance,
  ): SemanticOrchestrationNode {
    const activeWhen: SemanticExpression = {
      kind: 'predicate',
      op: 'GT',
      left: { kind: 'series', source: 'bar', field: 'close' },
      right: { kind: 'indicator', name: 'ema', params: { period: 1 } },
    }
    return {
      id,
      kind: 'gate',
      key: 'gate.regime',
      params: { sourceProgramId: sourceId, implicit: true },
      status: 'locked',
      source: 'derived',
      openSlots: [],
      contracts: [],
      target: { phase: 'entry', sideScope: 'both' },
      activeWhen,
      effectWhenFalse: 'block_new_entries',
      _provenance: provenance,
    }
  }

  private normalizeFixedGridParams(params: Readonly<Record<string, unknown>>): SemanticOrchestrationNode['gridParams'] {
    const lowerBound = this.readNumber(params.lowerBound) ?? this.readNumber(params.lower)
    const upperBound = this.readNumber(params.upperBound) ?? this.readNumber(params.upper)
    const anchorPrice = this.readNumber(params.anchorPrice)
      ?? (lowerBound !== undefined && upperBound !== undefined ? (lowerBound + upperBound) / 2 : 1)
    const levelCount = this.readNumber(params.levelCount) ?? this.readNumber(params.levels) ?? 10
    const stepPct = this.readNumber(params.stepPct) ?? 1
    return {
      anchorPrice,
      levelCount,
      stepPct,
      ...(lowerBound !== undefined ? { lowerBound } : {}),
      ...(upperBound !== undefined ? { upperBound } : {}),
    }
  }

  private normalizeProgramSizing(value: unknown): SemanticOrchestrationNode['sizing'] | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    const record = value as Record<string, unknown>
    const mode = this.readEnum(record.mode, ['fixed_quote', 'fixed_base', 'fixed_pct'] as const)
    const amount = this.readNumber(record.value) ?? this.readNumber(record.quote) ?? this.readNumber(record.pct)
    if (!mode || amount === undefined || amount <= 0) return undefined
    return { mode, value: amount }
  }

  private readNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value !== 'string') return undefined
    const parsed = Number(value.trim().match(/^-?\d+(?:\.\d+)?/u)?.[0])
    return Number.isFinite(parsed) ? parsed : undefined
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
  }

  private readEnum<const T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
    if (typeof value !== 'string') return undefined
    return allowed.includes(value) ? value as T[number] : undefined
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
      // Issue #1495: 禁止把 internal key（atomKey / slotKey）拼进 user-facing 文案。
      //   优先级：contract.clarificationQuestion → display.publicName.zh/en → 通用兜底
      //   fail-closed 时只用「该条件 / 该参数」，不暴露任何 internal identifier。
      const displayEntry = (entry as { display?: { publicName?: { zh?: string, en?: string } } } | undefined)?.display
      // Issue #1495 M1: 用 trim() || 兜底链，防 publicName.zh = '' 时 ?? 短路失效（空串是 non-null，会被 ?? 当合法值）
      const atomPublicName
        = (displayEntry?.publicName?.zh?.trim() || displayEntry?.publicName?.en?.trim() || '该条件')
      let questionHint = `请补充${atomPublicName}的参数。`
      if (typeof clarificationFn === 'function') {
        try {
          const fromContract = clarificationFn(slotKey, params as Record<string, unknown>, 'zh')
          if (typeof fromContract === 'string' && fromContract.trim() !== '') {
            questionHint = fromContract
          }
        }
        catch (err) {
          // Issue #1495-m2: contract 抛错 fail-safe 走 fallback 模板，但不再静默吞错；
          //   structured warn 让 metric/告警可观测
          this.logger.warn(
            `[#1495] clarificationQuestion threw: atomKey=${atomKey} slotKey=${slotKey} err=${err instanceof Error ? err.message : String(err)}`,
          )
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
