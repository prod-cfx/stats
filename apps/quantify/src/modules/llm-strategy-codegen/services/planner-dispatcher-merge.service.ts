import { Injectable, Logger } from '@nestjs/common'

import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import {
  collectAtomLeaves,
  isRuleEffectsByRole,
  listRuleEffects,
  mapRuleEffectsByRole,
  semanticRuleSchema,
  type AtomExpr,
  type AtomExprAtom,
  type RuleEffects,
  type RuleEffectsByRole,
  type SemanticRule,
} from '../types/atom-expr'
import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'

/**
 * Issue #1445：planner 输出 schema 硬校验结果。
 *
 * - `ok: true`：semanticPatch 符合 rules-first 表达式树契约
 * - `ok: false`：列出全部阻断项；`reminder` 是要拼回 user message 末尾的提示串，
 *    供 conversation 层做单轮重试
 * - `warnings`：只进入诊断，不阻断脚本生成
 */
export type PlannerPatchValidation =
  | { ok: true, warnings?: PlannerSchemaRejectReason[] }
  | { ok: false, reasons: PlannerSchemaRejectReason[], reminder: string, warnings?: PlannerSchemaRejectReason[] }

/**
 * Issue #1445：planner schema reject 原因 label，按违反类型聚合，便于 metric 维度收敛。
 * 与 `planner_schema_reject_total{reason}` 对接（当前为 logger.warn 结构化 stub）。
 */
export type PlannerSchemaRejectReason =
  | 'rules_missing_or_empty'        // 无 rules[] 或为空数组
  | 'legacy_flat_field'             // 出现旧 atoms/triggers/actions/risks/risk/position/positionConstraints/orchestration 顶层字段
  | 'rule_shape_invalid'            // rule 缺 id/phase/sideScope/condition/effects 或 zod 不通过
  | 'evidence_text_missing'         // rule 或叶子 atom 缺 evidence.text
  | 'evidence_text_not_substring'   // evidence.text 不是 user message 子串（warning-only）
  | 'condition_leaf_bucket_invalid' // condition 内叶子来自非法 bucket
  | 'effects_leaf_bucket_invalid'   // effects 内叶子来自非法 bucket

/**
 * Issue #1445：metric stage 区分初次校验 / 重试后校验。
 * 用结构化 logger.warn 作 metric stub（参 #1446 PR #1449 的实现风格）。
 */
export type PlannerSchemaRejectStage = 'initial' | 'retry'

const LEGACY_FLAT_FIELDS: ReadonlyArray<string> = [
  'atoms',
  'triggers',
  'actions',
  'risks',
  'risk',
  'position',
  'positionConstraints',
  'positionConstraint',
  'orchestration',
] as const

const CONDITION_ALLOWED_BUCKETS: ReadonlySet<string> = new Set([
  'trigger',
  'risk',           // risk 作 condition / predicate 谓词
  'orchestration',  // orchestration-gate
])

const CONDITION_ALLOWED_POSITION_CONSTRAINT_ATOMS: ReadonlySet<string> = new Set([
  'grid.range_rebalance',
])

const EFFECTS_ALLOWED_BUCKETS: ReadonlySet<string> = new Set([
  'action',
  'risk',              // risk 作 effect / 副作用
  'positionConstraint',
  'orchestration',     // orchestration-effect
])

const RULE_EFFECT_ROLE_ALLOWED_BUCKETS = {
  actions: 'action',
  risks: 'risk',
  positions: 'positionConstraint',
  orchestration: 'orchestration',
} as const

type TypedRuleEffectRole = keyof typeof RULE_EFFECT_ROLE_ALLOWED_BUCKETS | 'programs'

/**
 * Issue #1443：always-on runtime gate atom 集合（与 semantic-state-projection.service.ts
 *   同一份真相源；两处独立维护风险低，atom 数量稳定）。这类 atom 在 rule.condition
 *   位置表达「策略启动后始终激活」语义；若 effects 是 action（开/平仓动作），通常是
 *   planner / dispatcher 误产的技术兜底 rule（用户没明确说"启动即开平仓"），是 UI 噪音。
 */
const MERGE_ALWAYS_ON_ATOM_KEYS: ReadonlySet<string> = new Set([
  'execution.on_start',
])

const DCA_SCHEDULE_ATOM_KEY = ATOM_CONTRACT_REGISTRY['position.dca_schedule'].key
const ADD_POSITION_ATOM_KEY = ATOM_CONTRACT_REGISTRY['action.add_position'].key
const EXECUTION_ON_START_ATOM_KEY = ATOM_CONTRACT_REGISTRY['execution.on_start'].key

type PlannerPatchAtomNode = Record<string, unknown> & {
  key: string
  phase?: SemanticRule['phase'] | 'risk'
  sideScope?: 'long' | 'short' | 'both'
  params?: Record<string, unknown>
  evidence?: unknown
}

type PlannerPositionPatch = Record<string, unknown> & {
  mode?: string
  value?: number
  positionMode?: string
  status?: string
  source?: string
  openSlots?: unknown[]
  sizing?: unknown
  constraints?: PlannerPatchAtomNode[]
  evidence?: unknown
}

type InternalPlannerPatch = CodegenSemanticPatch & {
  atoms?: PlannerPatchAtomNode[]
  triggers?: PlannerPatchAtomNode[]
  actions?: PlannerPatchAtomNode[]
  risk?: PlannerPatchAtomNode[]
  position?: PlannerPositionPatch
  orchestration?: { nodes?: PlannerPatchAtomNode[] }
  __zodQuarantine?: unknown
}

type ContextSlotsPatch = NonNullable<CodegenSemanticPatch['contextSlots']>

type FallbackPredicateAtom = {
  key: string
  phase?: 'entry' | 'exit' | 'risk' | 'gate' | 'program'
  sideScope?: 'long' | 'short' | 'both'
  params?: Record<string, unknown>
  evidence?: { text?: unknown }
  sourceActionKey?: string
}

/**
 * Issue #1383：planner 输出常常只包含 trigger/action/risk 桶；positionConstraint /
 * orchestration 桶 atom（如 grid.range_rebalance、position.dca_schedule、
 * program.event_listener）需要 regex/keyword 的 GenericSeedDispatcher 补齐。
 *
 * 本服务把 planner JSON patch 与 dispatcher patch 做 union-merge：
 * - atoms / triggers / actions / risk：identity = (key, phase, stableParamsHash)，
 *   同 identity 时 planner 条目优先（携带 LLM evidence/source）。
 * - contextSlots：浅合并，planner 字段优先。
 * - position：dispatcher 优先（regex 抽取数值更稳），constraints union+dedup。
 * - orchestration.nodes：union dedup（优先 id；无 id 时 (key, stableParamsHash)）。
 *
 * 规则按 bucket 通用化，禁止针对具体 atom 写特例。
 */
@Injectable()
export class PlannerDispatcherMergeService {
  private readonly logger = new Logger(PlannerDispatcherMergeService.name)

  buildRulesTreeFallbackFromDispatcher(
    dispatcherPatch: InternalPlannerPatch | null | undefined,
    userMessage: string,
  ): InternalPlannerPatch | null {
    if (!this.isNonEmpty(dispatcherPatch)) return null
    const patch: InternalPlannerPatch = { ...(dispatcherPatch as InternalPlannerPatch) }
    if (!patch.rules?.length) return null
    this.hydrateExplicitPercentRisksFromText(patch, userMessage)
    this.pruneInvalidDeterministicNoiseRules(patch, { rules: patch.rules }, userMessage)
    return patch
  }

  private cloneRulesNativePatch(patch: InternalPlannerPatch): InternalPlannerPatch {
    const zodQuarantine = (patch as { __zodQuarantine?: unknown }).__zodQuarantine
    return {
      ...(patch.contextSlots ? { contextSlots: patch.contextSlots } : {}),
      ...(patch.rules?.length ? { rules: patch.rules } : {}),
      ...(Array.isArray(zodQuarantine) && zodQuarantine.length > 0 ? { __zodQuarantine: zodQuarantine } : {}),
    } as InternalPlannerPatch
  }

  private mergeRulesNativePatches(
    plannerPatch: InternalPlannerPatch | null | undefined,
    dispatcherPatch: InternalPlannerPatch | null | undefined,
  ): InternalPlannerPatch | null {
    const plannerHas = this.isNonEmpty(plannerPatch)
    const dispatcherHas = this.isNonEmpty(dispatcherPatch)
    if (!plannerHas && !dispatcherHas) return null
    if (plannerHas && !dispatcherHas) {
      const cloned = this.cloneRulesNativePatch(plannerPatch as InternalPlannerPatch)
      if (cloned.rules?.length) cloned.rules = this.dedupeRulesBySignature(cloned.rules)
      return cloned
    }
    if (!plannerHas && dispatcherHas) {
      const cloned = this.cloneRulesNativePatch(dispatcherPatch as InternalPlannerPatch)
      if (cloned.rules?.length) cloned.rules = this.dedupeRulesBySignature(cloned.rules)
      return cloned
    }

    const planner = plannerPatch as InternalPlannerPatch
    const dispatcher = dispatcherPatch as InternalPlannerPatch
    const contextSlots = this.mergeContextSlots(planner.contextSlots, dispatcher.contextSlots)
    const patch: InternalPlannerPatch = {
      ...(contextSlots
        ? { contextSlots }
        : {}),
      rules: this.mergeRulesById(planner.rules, dispatcher.rules),
    }
    const plannerQuarantine = (planner as { __zodQuarantine?: unknown }).__zodQuarantine
    if (Array.isArray(plannerQuarantine) && plannerQuarantine.length > 0) {
      (patch as { __zodQuarantine?: unknown }).__zodQuarantine = plannerQuarantine
    }
    this.overrideRulesLeafParamsFromDispatcher(patch, dispatcher)
    this.liftDispatcherPositionSizingIntoPlannerRules(patch, dispatcher)
    return patch.rules?.length || patch.contextSlots ? patch : null
  }

  private mergeContextSlots(
    plannerSlots: ContextSlotsPatch | undefined,
    dispatcherSlots: ContextSlotsPatch | undefined,
  ): ContextSlotsPatch | undefined {
    if (!plannerSlots && !dispatcherSlots) return undefined

    const merged: ContextSlotsPatch = { ...(dispatcherSlots ?? {}) }
    for (const [field, plannerValue] of Object.entries(plannerSlots ?? {})) {
      const dispatcherValue = dispatcherSlots?.[field]
      if (this.isUsableContextSlotValue(plannerValue) || !this.isUsableContextSlotValue(dispatcherValue)) {
        merged[field] = plannerValue
      }
    }

    return Object.keys(merged).length > 0 ? merged : undefined
  }

  private isUsableContextSlotValue(value: unknown): boolean {
    if (value === null || value === undefined) return false
    if (typeof value === 'string') return value.trim().length > 0
    if (typeof value !== 'object' || Array.isArray(value)) return false

    const record = value as Record<string, unknown>
    if ('value' in record) return this.isUsableContextSlotValue(record.value)
    return false
  }

  /**
   * Issue #1707 iter4：dispatcher emit 的 `position.sizing` leaf 提升到 planner spine。
   *
   * 真因：`mergeRulesById` 契约——dispatcher rule 与 planner rule 语义不匹配（condition 不等）
   *   → 整条 dispatcher rule 被丢。dispatcher 自创一条 rule 承载 `position.sizing` 时，
   *   condition 通常是 dispatcher predicate[0]（如 trigger leaf 或 execution.on_start），
   *   而 planner entry rule 的 condition 是 indicator 组合 → 永远不匹配 → sizing leaf 100%
   *   被丢，readiness 死循环追问。
   *
   * 修复：planner spine 任何 rule 都没有 `position.sizing` 叶子时，
   *   把 dispatcher 全集中的 `position.sizing` leaves 注入到 planner 首选 entry rule。
   *   首选规则：long entry → 首条 entry。spine 完全无 entry rule 时直接 return + warn，
   *   不再退化到 exit/risk rule（避免把 sizing 元数据 leaf 错绑到非 entry 宿主）。
   *
   * 边界守卫（iter4 review 反馈修复）：
   *   - 跨边过滤：只收 source rule.sideScope ∈ {'both', target.sideScope} 的 sizing leaf；
   *     leaf.sideScope 在 append 前 rewrite 为 target.sideScope，避免 short sizing 落到 long entry
   *   - 跨阶段过滤：只收 source rule.phase ∈ {'entry','gate'} 的 sizing leaf；
   *     program-phase（DCA / grid 程序）sizing 语义不同，不能跨阶段提升
   *   - 去重签名：与 `mergeAppendMissingEffectListParams` 统一为 `key|sideScope|stable(params)`，
   *     避免 params key 顺序敏感导致重复 append
   *   - legacy 数组分支：先 normalize 成 RuleEffectsByRole 再注入，避免与 iter3 typed 分支行为漂移
   *
   * 不动 dispatcher 已被 enrich-only / append-when-missing 合入的场景（spine 已有 leaf）；
   *   动作只在 spine 完全缺 sizing leaf 时发生。
   */
  private liftDispatcherPositionSizingIntoPlannerRules(
    merged: InternalPlannerPatch,
    dispatcher: InternalPlannerPatch,
  ): void {
    const rules = merged.rules
    if (!rules || rules.length === 0) return
    const SIZING_KEY = 'position.sizing'

    const spineHasSizing = rules.some(rule =>
      listRuleEffects(rule.effects)
        .flatMap(effect => collectAtomLeaves(effect))
        .some(leaf => leaf.key === SIZING_KEY),
    )
    if (spineHasSizing) return

    // target 选择：long entry → 首条 entry。完全无 entry 时直接 return + warn，
    //   不退化到 exit/risk/program rule（避免 sizing 元数据落到非 entry 宿主造成 anchor 跨界）。
    const targetIndex = (() => {
      const longEntry = rules.findIndex(r => r.phase === 'entry' && r.sideScope === 'long')
      if (longEntry >= 0) return longEntry
      return rules.findIndex(r => r.phase === 'entry')
    })()
    if (targetIndex < 0) {
      this.logger.warn('[liftDispatcherPositionSizingIntoPlannerRules] spine has no entry rule; sizing lift skipped — clarification will report missing per_order_budget')
      return
    }
    const target = rules[targetIndex]

    const stableParamsSig = (params: Readonly<Record<string, unknown>> | undefined): string => {
      const entries = Object.entries(params ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      return JSON.stringify(entries)
    }

    const sizingLeaves: AtomExprAtom[] = []
    const seen = new Set<string>()
    for (const rule of dispatcher.rules ?? []) {
      // 跨阶段过滤：只接受 entry/gate phase（gate 与 entry 同生命周期段，sizing 语义一致）
      if (rule.phase !== 'entry' && rule.phase !== 'gate') continue
      // 跨边过滤：source rule.sideScope 必须 'both' 或与 target.sideScope 一致
      if (rule.sideScope !== 'both' && rule.sideScope !== target.sideScope) continue
      for (const effect of listRuleEffects(rule.effects)) {
        for (const leaf of collectAtomLeaves(effect)) {
          if (leaf.key !== SIZING_KEY) continue
          // append 前 rewrite leaf.sideScope 为 target.sideScope，强一致
          const normalized: AtomExprAtom = {
            ...leaf,
            sideScope: target.sideScope,
          }
          // 与 mergeAppendMissingEffectListParams 统一去重签名：key|sideScope|stable(params)
          const sig = `${normalized.key}|${normalized.sideScope ?? ''}|${stableParamsSig(normalized.params)}`
          if (seen.has(sig)) continue
          seen.add(sig)
          sizingLeaves.push(normalized)
        }
      }
    }
    if (sizingLeaves.length === 0) return

    // legacy 数组 effects 分支先 normalize 成 RuleEffectsByRole 再注入，
    //   避免与 iter3 typed 分支行为漂移（iter3 typed 分支 passthrough，legacy 分支 registry 路由）。
    const targetEffectsByRole: RuleEffectsByRole = isRuleEffectsByRole(target.effects)
      ? target.effects
      : this.toRuleEffectsByRole(target.effects)
    const nextEffects: RuleEffects = {
      ...targetEffectsByRole,
      positions: [...(targetEffectsByRole.positions ?? []), ...sizingLeaves],
    }
    merged.rules = rules.map((rule, idx) => (idx === targetIndex ? { ...rule, effects: nextEffects } : rule))
  }

  private mergeRulesById(
    plannerRules: readonly SemanticRule[] | undefined,
    dispatcherRules: readonly SemanticRule[] | undefined,
  ): SemanticRule[] | undefined {
    const planner = [...(plannerRules ?? [])]
    const dispatcher = [...(dispatcherRules ?? [])]
    if (!planner.length && !dispatcher.length) return undefined
    // No planner spine → dispatcher rules become the fallback spine.
    if (!planner.length) return this.dedupeRulesBySignature(dispatcher)

    // Contract (codegen-conversation.service.ts: "rules tree 是唯一策略语义真源；
    // deterministic dispatcher 只校准执行槽位，禁止 union 补 rule"):
    // planner rules are the only semantic spine. Dispatcher rules may ONLY enrich a
    // semantically-matching planner rule (fill missing leaf params); they are never
    // appended. A dispatcher rule that matches no planner rule is dropped.
    const spine = this.dedupeRulesBySignature(planner)
    for (const incoming of dispatcher) {
      const targetIndex = spine.findIndex(rule => this.rulesRepresentSameExecution(rule, incoming))
      if (targetIndex >= 0) spine[targetIndex] = this.mergeEquivalentRule(spine[targetIndex], incoming)
    }
    return spine
  }

  private dedupeRulesBySignature(rules: readonly SemanticRule[]): SemanticRule[] {
    const byId = new Map<string, SemanticRule>()
    const semanticIndex = new Map<string, string>()
    const order: string[] = []
    for (const rule of rules) {
      const signature = this.ruleSemanticSignature(rule)
      const existingSemanticId = semanticIndex.get(signature)
      if (existingSemanticId && byId.has(existingSemanticId)) {
        const existing = byId.get(existingSemanticId) as SemanticRule
        byId.set(existingSemanticId, this.mergeEquivalentRule(existing, rule))
        continue
      }
      const id = rule.id
      if (!byId.has(id)) order.push(id)
      byId.set(id, byId.get(id) ?? rule)
      semanticIndex.set(signature, id)
    }
    const deduped = order.map(id => byId.get(id) as SemanticRule)
    return this.foldProgramOrchestrationSubsetRules(deduped)
  }

  /**
   * Issue #1633 staging s13：phase=program / orchestration rules whose condition
   * 完全相同（atomExprSignature 一致）、effect-leaf 集合存在 strict subset 关系时，
   * 把 subset 折叠进 superset。subset 折叠通过 `mergeEquivalentRule` 让 sub 的
   * params 补齐 super 缺失的 leaf。effect leaf 签名使用 alias-aware 形式
   * （feedId↔dataSourceFeedId / role↔dataSourceRole / schemaRef↔dataSourceSchemaRef
   * 等会被归一为 canonical key），与 semantic-state-merge.service ALIAS_PARAM_KEYS
   * 行为对齐。
   *
   * 仅作用于 phase==='program' 的 rule（rule.phase 枚举无 orchestration；orchestration
   * 语义当前通过 program-phase + effects.orchestration role 表达）。lifecycle（entry/exit/gate）
   * 不动，避开误折叠风险。
   */
  private foldProgramOrchestrationSubsetRules(rules: readonly SemanticRule[]): SemanticRule[] {
    if (rules.length < 2) return [...rules]
    const groups = new Map<string, number[]>()
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i]
      if (rule.phase !== 'program') continue
      const key = `${rule.phase}|${this.normalizeRuleSideForSignature(rule)}|${this.atomExprSignature(rule.condition)}`
      const list = groups.get(key) ?? []
      list.push(i)
      groups.set(key, list)
    }
    const dropped = new Set<number>()
    const mutated = new Map<number, SemanticRule>()
    for (const indices of groups.values()) {
      if (indices.length < 2) continue
      const sigs = indices.map(i => this.effectCanonicalSignatureSet(rules[i].effects))
      for (let a = 0; a < indices.length; a++) {
        if (dropped.has(indices[a])) continue
        for (let b = 0; b < indices.length; b++) {
          if (a === b) continue
          if (dropped.has(indices[b])) continue
          const superSet = sigs[a]
          const subSet = sigs[b]
          if (superSet.size <= subSet.size) continue
          let isSubset = true
          for (const sig of subSet) {
            if (!superSet.has(sig)) { isSubset = false; break }
          }
          if (!isSubset) continue
          const superIdx = indices[a]
          const subIdx = indices[b]
          const superRule = mutated.get(superIdx) ?? rules[superIdx]
          const merged = this.mergeEquivalentRule(superRule, rules[subIdx])
          mutated.set(superIdx, merged)
          dropped.add(subIdx)
        }
      }
    }
    if (dropped.size === 0) return [...rules]
    return rules
      .map((rule, i) => mutated.get(i) ?? rule)
      .filter((_, i) => !dropped.has(i))
  }

  private effectCanonicalSignatureSet(effects: RuleEffects): Set<string> {
    const out = new Set<string>()
    for (const effect of listRuleEffects(effects)) {
      for (const leaf of collectAtomLeaves(effect)) {
        out.add(this.atomLeafCanonicalSignature(leaf))
      }
    }
    return out
  }

  /**
   * Issue #1633 staging s13：alias-aware leaf signature 用于 program/orchestration
   * subset-fold。镜像 semantic-state-merge.service.ts 的 ALIAS_PARAM_KEYS 行为：
   *   feedId → dataSourceFeedId
   *   role → dataSourceRole
   *   schemaRef → dataSourceSchemaRef
   * 若同 atom 同时含 canonical + alias，保留 canonical。
   */
  private atomLeafCanonicalSignature(atom: AtomExprAtom): string {
    const aliasMap: Readonly<Record<string, string>> = {
      feedId: 'dataSourceFeedId',
      role: 'dataSourceRole',
      schemaRef: 'dataSourceSchemaRef',
    }
    const raw = this.omitParams(atom.params ?? {}, ['phase', 'source', 'basisSource', 'evidence'])
    const canonical: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(raw)) {
      if (key === 'bufferPct' && value === 0) continue
      const target = aliasMap[key] ?? key
      if (target !== key && target in canonical) continue
      canonical[target] = value
    }
    return `${atom.key}|${this.stableParamsHash(canonical)}|${atom.sideScope ?? ''}`
  }

  private rulesRepresentSameExecution(planner: SemanticRule, dispatcher: SemanticRule): boolean {
    if (planner.phase !== dispatcher.phase) return false
    if (!this.sideScopesCompatible(planner.sideScope, dispatcher.sideScope)) return false
    if (collectAtomLeaves(planner.condition).length === 0) return false
    if (collectAtomLeaves(dispatcher.condition).length === 0) return false
    if (!this.conditionsRepresentSameLifecycle(planner, dispatcher)) return false
    const plannerActions = this.lifecycleActionKeys(planner)
    const dispatcherActions = this.lifecycleActionKeys(dispatcher)
    if (plannerActions.size === 0 || dispatcherActions.size === 0) return false
    for (const key of dispatcherActions) if (plannerActions.has(key)) return true
    return false
  }

  private lifecycleActionKeys(rule: SemanticRule): Set<string> {
    const lifecycle = new Set<string>([
      ATOM_CONTRACT_REGISTRY['action.open_long'].key,
      ATOM_CONTRACT_REGISTRY['action.open_short'].key,
      ATOM_CONTRACT_REGISTRY['action.close_long'].key,
      ATOM_CONTRACT_REGISTRY['action.close_short'].key,
    ])
    return new Set(listRuleEffects(rule.effects)
      .flatMap(effect => collectAtomLeaves(effect))
      .map(leaf => leaf.key)
      .filter(key => lifecycle.has(key)))
  }

  private mergeEquivalentRule(existing: SemanticRule, candidate: SemanticRule): SemanticRule {
    return {
      ...existing,
      condition: this.mergeMissingAtomParams(existing.condition, candidate.condition),
      effects: this.mergeMissingRuleEffectParams(existing.effects, candidate.effects),
    }
  }

  private mergeMissingRuleEffectParams(existing: RuleEffects, candidate: RuleEffects): RuleEffects {
    if (isRuleEffectsByRole(existing) || isRuleEffectsByRole(candidate)) {
      const existingByRole = this.toRuleEffectsByRole(existing)
      const candidateByRole = this.toRuleEffectsByRole(candidate)
      return {
        actions: this.mergeMissingEffectListParams(existingByRole.actions, candidateByRole.actions),
        risks: this.mergeMissingEffectListParams(existingByRole.risks, candidateByRole.risks),
        // Issue #1707 iter2：positions 桶接收 dispatcher 缺失补齐（append-when-missing）。
        //   原 enrich-only 行为对 lifecycle 副作用（action/risk）安全，但 position.sizing
        //   是单一仓位 sizing 元数据 leaf，planner LLM 通常不产出（"仓位 10usdt" 这种 sizing
        //   元信息 prompt 没强制 emit），dispatcher extractor 可信度更高。enrich-only 丢
        //   dispatcher leaf 直接导致仓位 anchor 缺失 → clarification 持续追问。
        positions: this.mergeAppendMissingEffectListParams(existingByRole.positions, candidateByRole.positions),
        orchestration: this.mergeMissingEffectListParams(existingByRole.orchestration, candidateByRole.orchestration),
        programs: this.mergeMissingEffectListParams(existingByRole.programs, candidateByRole.programs),
      }
    }
    return this.mergeMissingEffectListParams(existing, candidate)
  }

  private toRuleEffectsByRole(effects: RuleEffects): RuleEffectsByRole {
    const out: {
      actions: AtomExpr[]
      risks: AtomExpr[]
      positions: AtomExpr[]
      orchestration: AtomExpr[]
      programs: AtomExpr[]
    } = {
      actions: [],
      risks: [],
      positions: [],
      orchestration: [],
      programs: [],
    }
    if (isRuleEffectsByRole(effects)) {
      // Issue #1707 iter3：rules-only — typed RuleEffectsByRole 输入下 role 即真理，
      //   passthrough 不做任何 registry 重派。
      //   先前 iter2 fallback 仍对已登记 atom 重路由，导致 dispatcher 合法 emit 的
      //   position.sizing 等 leaf 被静默搬桶/丢弃，让 readiness 持续追问 position.sizing。
      //   grid.range_rebalance 等 bucket 一致性校验由 collectEffectRoleViolations
      //   (planner schema 硬校验) 兜底，不在此 normalize 路径上做。
      for (const role of ['actions', 'risks', 'positions', 'orchestration', 'programs'] as const) {
        for (const effect of (effects[role] ?? [])) {
          out[role].push(effect)
        }
      }
      return out
    }
    // legacy 数组输入：无 role 信息，按 registry bucket 路由。
    for (const effect of effects) {
      if (effect.kind !== 'atom') continue
      if (this.isProgramEffectAtom(effect.key)) {
        out.programs.push(effect)
        continue
      }
      const bucket = this.readAtomBucket(effect.key)
      if (bucket === 'action') out.actions.push(effect)
      else if (bucket === 'risk') out.risks.push(effect)
      else if (bucket === 'positionConstraint') out.positions.push(effect)
      else if (bucket === 'orchestration') out.orchestration.push(effect)
    }
    return out
  }

  private mergeMissingEffectListParams(
    existing: readonly AtomExpr[],
    candidate: readonly AtomExpr[],
  ): AtomExprAtom[] {
    const candidateAtoms = candidate.filter((effect): effect is AtomExprAtom => effect.kind === 'atom')
    return existing
      .filter((effect): effect is AtomExprAtom => effect.kind === 'atom')
      .map((effect) => {
        const matched = candidateAtoms.find(candidateEffect => this.effectLeafMatches(effect, candidateEffect))
        return matched ? this.mergeMissingAtomParams(effect, matched) as AtomExprAtom : effect
      })
  }

  /**
   * Issue #1707 iter2：append-when-missing 变体，专给 positions 桶用。
   * 行为：
   *   1) existing 中的 leaf 优先（沿用原 enrich-only 行为：在 candidate 中找同 key+sideScope，
   *      用 candidate.params 填 existing 缺失字段）
   *   2) candidate 中 existing 没有的 leaf 直接 append（key 维度去重）
   *
   * 为什么单独给 positions：planner LLM prompt 对 sizing 元信息（"仓位 10usdt"）
   *   不强制 emit position.sizing leaf；dispatcher extractor 可靠度更高；丢 leaf
   *   直接 readiness fail-closed → clarification 死循环。actions/risks 是 lifecycle
   *   副作用，必须由 planner 谱系，沿用 enrich-only 避免 dispatcher 凭空塞 action。
   */
  private mergeAppendMissingEffectListParams(
    existing: readonly AtomExpr[],
    candidate: readonly AtomExpr[],
  ): AtomExprAtom[] {
    const candidateAtoms = candidate.filter((effect): effect is AtomExprAtom => effect.kind === 'atom')
    const existingAtoms = existing.filter((effect): effect is AtomExprAtom => effect.kind === 'atom')
    const enriched: AtomExprAtom[] = existingAtoms.map((effect) => {
      const matched = candidateAtoms.find(candidateEffect => this.effectLeafMatches(effect, candidateEffect))
      return matched ? this.mergeMissingAtomParams(effect, matched) as AtomExprAtom : effect
    })
    const existingKeys = new Set(existingAtoms.map(e => `${e.key}|${e.sideScope ?? ''}`))
    for (const candidateAtom of candidateAtoms) {
      const sig = `${candidateAtom.key}|${candidateAtom.sideScope ?? ''}`
      if (existingKeys.has(sig)) continue
      existingKeys.add(sig)
      enriched.push(candidateAtom)
    }
    return enriched
  }

  private mergeMissingAtomParams(existing: AtomExpr, candidate: AtomExpr): AtomExpr {
    if (existing.kind === 'atom' && candidate.kind === 'atom') {
      return {
        ...existing,
        params: this.fillMissingParams(existing.params, [candidate.params ?? {}]) ?? existing.params,
      }
    }
    if ((existing.kind === 'and' || existing.kind === 'or') && existing.kind === candidate.kind) {
      return {
        ...existing,
        children: existing.children.map(child => {
          const matched = candidate.children.find(candidateChild => this.atomExprSignature(child) === this.atomExprSignature(candidateChild))
          return matched ? this.mergeMissingAtomParams(child, matched) : child
        }),
      }
    }
    if (existing.kind === 'not' && candidate.kind === 'not') {
      return { ...existing, child: this.mergeMissingAtomParams(existing.child, candidate.child) }
    }
    if (existing.kind === 'sequence' && candidate.kind === 'sequence') {
      return {
        ...existing,
        steps: existing.steps.map(step => {
          const matched = candidate.steps.find(candidateStep => this.atomExprSignature(step) === this.atomExprSignature(candidateStep))
          return matched ? this.mergeMissingAtomParams(step, matched) : step
        }),
      }
    }
    return existing
  }

  private ruleSemanticSignature(rule: SemanticRule): string {
    return [
      rule.phase,
      this.normalizeRuleSideForSignature(rule),
      this.atomExprSignature(rule.condition),
      JSON.stringify(this.effectSignatureSet(rule.effects)),
    ].join('|')
  }

  private normalizeRuleSideForSignature(rule: SemanticRule): string {
    const actionSides = listRuleEffects(rule.effects)
      .flatMap(effect => collectAtomLeaves(effect))
      .filter(leaf => this.readAtomBucket(leaf.key) === 'action')
      .map(leaf => this.normalizedEffectSideSignature(leaf))
      .filter(side => side !== 'both')
      .sort()
    return actionSides.length > 0 ? actionSides.join(',') : rule.sideScope
  }

  private effectSignatureSet(effects: RuleEffects): string[] {
    return listRuleEffects(effects)
      .flatMap(effect => collectAtomLeaves(effect))
      .map(leaf => this.atomLeafSemanticSignature(leaf, 'effect'))
      .sort()
  }

  private atomExprSignature(expr: AtomExpr): string {
    if (expr.kind === 'atom') return this.atomLeafSemanticSignature(expr, 'condition')
    if (expr.kind === 'and' || expr.kind === 'or') {
      return `${expr.kind}(${expr.children.map(child => this.atomExprSignature(child)).sort().join('&')})`
    }
    if (expr.kind === 'not') return `not(${this.atomExprSignature(expr.child)})`
    if (expr.kind === 'sequence') return `sequence(${expr.steps.map(step => this.atomExprSignature(step)).join('>')})`
    return JSON.stringify(expr)
  }

  private atomLeafSemanticSignature(atom: AtomExprAtom, role: 'condition' | 'effect'): string {
    const bucket = this.readAtomBucket(atom.key)
    const params = this.omitParams(atom.params ?? {}, [
      'phase',
      'source',
      'basisSource',
      'evidence',
    ])
    if (bucket === 'action' && role === 'effect') {
      return `${atom.key}|${this.normalizedEffectSideSignature(atom)}`
    }
    return `${atom.key}|${this.stableParamsHash(params)}|${atom.sideScope ?? ''}`
  }

  /**
   * Issue #1445：planner LLM raw `semanticPatch` 输出硬校验。
   *
   * 校验内容（按 Issue 验收标准）：
   *   1. `semanticPatch.rules` 必填且为非空数组
   *   2. 禁旧字段：`atoms / triggers / actions / risks / risk / position / positionConstraints / orchestration`
   *      出现在 `semanticPatch` 顶层一律 reject
   *   3. 每条 rule 必有 `id / phase / sideScope / condition / effects`
   *      （走 zod `semanticRuleSchema`，包含 AtomExpr 子树结构校验）
   *   4. 每条 rule 必有 `evidence.text`；不是 user message 子串时降级为 warning，
   *      由 conversation 层归一化为用户原文，不阻断脚本生成
   *   5. condition 内叶子 atom 来自 trigger / risk / orchestration-gate 桶（grid.range_rebalance 例外）
   *      effects 内叶子来自 action / risk / positionConstraint / orchestration 桶
   *      （按 `ATOM_CONTRACT_REGISTRY[*].bucket` 派生；未注册 atom fail-open）
   *
   * 返回 `{ ok: false, reasons, reminder }` 时 reminder 拼回 user message 末尾供 planner 重试。
   *
   * @param plannerPatch planner LLM 原始 `semanticPatch` 字段（未经 normalize）；
   *   接受 unknown 以容忍 LLM 偏离 schema
   * @param userMessage 触发本次 planner 调用的 user message，用于校准 evidence.text 诊断
   */
  validatePlannerSemanticPatch(
    plannerPatch: unknown,
    userMessage: string,
  ): PlannerPatchValidation {
    const reasons = new Set<PlannerSchemaRejectReason>()
    const warnings = new Set<PlannerSchemaRejectReason>()
    const detailNotes: string[] = []

    if (!plannerPatch || typeof plannerPatch !== 'object' || Array.isArray(plannerPatch)) {
      reasons.add('rules_missing_or_empty')
      detailNotes.push('semanticPatch 必须是对象，且包含非空 rules[]')
      return this.buildRejectResult(reasons, detailNotes)
    }
    const patch = plannerPatch as Record<string, unknown>

    // 1) legacy flat field check
    for (const legacy of LEGACY_FLAT_FIELDS) {
      if (legacy in patch) {
        reasons.add('legacy_flat_field')
        detailNotes.push(`禁止使用旧扁平字段 semanticPatch.${legacy}`)
      }
    }

    // 2) rules[] 必填且非空
    const rules = patch.rules
    if (!Array.isArray(rules) || rules.length === 0) {
      reasons.add('rules_missing_or_empty')
      detailNotes.push('semanticPatch.rules 必须是非空数组（rules-first 表达式树形态）')
      return this.buildRejectResult(reasons, detailNotes)
    }

    // 3) 每条 rule shape + evidence + bucket 校验
    const message = typeof userMessage === 'string' ? userMessage : ''
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i] as Record<string, unknown> | undefined
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
        reasons.add('rule_shape_invalid')
        detailNotes.push(`rules[${i}] 不是对象`)
        continue
      }

      const parsed = semanticRuleSchema.safeParse(rule)
      if (!parsed.success) {
        reasons.add('rule_shape_invalid')
        const issuePath = parsed.error.issues[0]?.path?.join('.') ?? '<root>'
        const code = parsed.error.issues[0]?.code ?? 'invalid'
        detailNotes.push(`rules[${i}] 结构非法（${issuePath}: ${code}）；rule 必须含 id / phase / sideScope / condition / effects`)
        continue
      }
      const semRule = parsed.data as SemanticRule

      // rule.evidence.text
      const ruleEvidence = (rule as { evidence?: { text?: unknown } }).evidence
      const ruleEvidenceText = ruleEvidence?.text
      if (typeof ruleEvidenceText !== 'string' || ruleEvidenceText.trim().length === 0) {
        reasons.add('evidence_text_missing')
        detailNotes.push(`rules[${i}].evidence.text 必填`)
      }
      else if (message && !message.includes(ruleEvidenceText.trim())) {
        warnings.add('evidence_text_not_substring')
      }

      // condition / effects 叶子 atom 校验：bucket + evidence.text
      this.collectLeafAtomViolations({
        ruleIndex: i,
        ruleRaw: rule,
        semRule,
        message,
        reasons,
        warnings,
        detailNotes,
      })
    }

    if (reasons.size === 0) {
      const warningList = Array.from(warnings)
      return warningList.length > 0 ? { ok: true, warnings: warningList } : { ok: true }
    }
    return this.buildRejectResult(reasons, detailNotes, warnings)
  }

  /**
   * Issue #1445：metric stub。当前模块无 prom-client 注入，按 #1446 PR #1449 风格
   * 用结构化 logger.warn 写入，scraper 可抓取。
   * 后续接入正式 Counter 时替换为 `Counter.labels({ stage }).inc(value)`。
   *
   * TODO(#1445 follow-up): 替换为 prom-client Counter，与 codegen 模块整体 metric 接入合并。
   */
  emitPlannerSchemaRejectMetric(stage: PlannerSchemaRejectStage, value = 1): void {
    this.logger.warn(`metric=planner_schema_reject_total stage=${stage} value=${value}`)
  }

  private buildRejectResult(
    reasons: Set<PlannerSchemaRejectReason>,
    detailNotes: ReadonlyArray<string>,
    warnings: Set<PlannerSchemaRejectReason> = new Set(),
  ): PlannerPatchValidation {
    const reasonList = Array.from(reasons)
    const warningList = Array.from(warnings)
    const reminder = [
      '上一轮 planner 输出未通过 schema 硬校验，必须按 rules-first 表达式树形态重出：',
      '- semanticPatch.rules[] 必填且非空',
      '- 禁止使用旧扁平字段（atoms/triggers/actions/risks/risk/position/positionConstraints/orchestration）',
      '- 每条 rule 必须含 id / phase / sideScope / condition (旧 triggers) / effects (typed RuleEffects)',
      '- effects 必须是对象：{ actions, risks, positions, orchestration, programs }',
      '- program.* 执行程序 atom（如 program.dynamic_grid / program.event_listener）必须用 phase=program 且只能进入 effects.programs；position.dca_schedule 按 catalog/role 放入 effects.positions，使用其 catalog phase。',
      '- 每条 rule 必须有 evidence.text；叶子 atom 若带 evidence.text，也必须非空',
      '- condition 内叶子 atom 来自 trigger / risk(谓词) / orchestration-gate 桶；grid.range_rebalance 可作 program condition；effects 内叶子来自 action / risk(副作用) / positionConstraint / orchestration-effect 桶',
      '本次具体违反：',
      ...detailNotes.slice(0, 12).map(s => `  · ${s}`),
      '请重出合规 semanticPatch.rules[] 形态。',
    ].join('\n')
    return {
      ok: false,
      reasons: reasonList,
      reminder,
      ...(warningList.length > 0 ? { warnings: warningList } : {}),
    }
  }

  private collectLeafAtomViolations(args: {
    ruleIndex: number
    ruleRaw: Record<string, unknown>
    semRule: SemanticRule
    message: string
    reasons: Set<PlannerSchemaRejectReason>
    warnings: Set<PlannerSchemaRejectReason>
    detailNotes: string[]
  }): void {
    const { ruleIndex, ruleRaw, semRule, message, reasons, warnings, detailNotes } = args

    type ContractShape = { bucket?: string }
    const getBucket = (key: string): string | undefined =>
      (ATOM_CONTRACT_REGISTRY as Record<string, ContractShape | undefined>)[key]?.bucket

    // condition leaves
    const conditionLeaves = collectAtomLeaves(semRule.condition)
    for (const leaf of conditionLeaves) {
      const bucket = getBucket(leaf.key)
      const conditionAllowed = bucket !== undefined
        && (
          CONDITION_ALLOWED_BUCKETS.has(bucket)
          || (bucket === 'positionConstraint' && CONDITION_ALLOWED_POSITION_CONSTRAINT_ATOMS.has(leaf.key))
        )
      if (bucket !== undefined && !conditionAllowed) {
        reasons.add('condition_leaf_bucket_invalid')
        detailNotes.push(`rules[${ruleIndex}].condition 含非法叶子 atom key=${leaf.key} bucket=${bucket}（应来自 trigger/risk/orchestration-gate 桶）`)
      }
    }

    this.collectEffectRoleViolations(ruleIndex, semRule, getBucket, reasons, detailNotes)

    // leaf evidence.text：planner 在 leaf atom 上若声明 evidence，则 text 必须非空；
    // 非 user message 子串只作为 warning，随后由 conversation 层归一化。
    const rawCondition = (ruleRaw as { condition?: unknown }).condition
    this.checkLeafEvidenceSubstring(rawCondition, message, `rules[${ruleIndex}].condition`, reasons, warnings, detailNotes)
    const rawEffects = (ruleRaw as { effects?: unknown }).effects
    if (Array.isArray(rawEffects)) {
      for (let ei = 0; ei < rawEffects.length; ei++) {
        this.checkLeafEvidenceSubstring(rawEffects[ei], message, `rules[${ruleIndex}].effects[${ei}]`, reasons, warnings, detailNotes)
      }
    }
    else if (rawEffects && typeof rawEffects === 'object') {
      for (const role of ['actions', 'risks', 'positions', 'orchestration', 'programs'] as const) {
        const roleEffects = (rawEffects as Partial<Record<typeof role, unknown>>)[role]
        if (!Array.isArray(roleEffects)) continue
        for (let ei = 0; ei < roleEffects.length; ei++) {
          this.checkLeafEvidenceSubstring(roleEffects[ei], message, `rules[${ruleIndex}].effects.${role}[${ei}]`, reasons, warnings, detailNotes)
        }
      }
    }
  }

  private collectEffectRoleViolations(
    ruleIndex: number,
    semRule: SemanticRule,
    getBucket: (key: string) => string | undefined,
    reasons: Set<PlannerSchemaRejectReason>,
    detailNotes: string[],
  ): void {
    if (Array.isArray(semRule.effects)) {
      for (let ei = 0; ei < semRule.effects.length; ei++) {
        this.collectLegacyEffectBucketViolations(ruleIndex, ei, semRule.effects[ei], getBucket, reasons, detailNotes)
      }
      return
    }

    for (const role of ['actions', 'risks', 'positions', 'orchestration', 'programs'] as const satisfies ReadonlyArray<TypedRuleEffectRole>) {
      const effects = semRule.effects[role]
      for (let ei = 0; ei < effects.length; ei++) {
        const leaves = collectAtomLeaves(effects[ei])
        for (const leaf of leaves) {
          const bucket = getBucket(leaf.key)
          if (bucket === undefined) continue
          const roleAllowed = role === 'programs'
            ? this.isProgramEffectAtom(leaf.key)
              || (bucket === 'positionConstraint' && CONDITION_ALLOWED_POSITION_CONSTRAINT_ATOMS.has(leaf.key))
            : !this.isProgramEffectAtom(leaf.key) && bucket === RULE_EFFECT_ROLE_ALLOWED_BUCKETS[role]
          if (roleAllowed) continue
          reasons.add('effects_leaf_bucket_invalid')
          detailNotes.push(`rules[${ruleIndex}].effects.${role}[${ei}] 含非法叶子 atom key=${leaf.key} bucket=${bucket}（必须匹配 ${role} role）`)
        }
      }
    }
  }

  private collectLegacyEffectBucketViolations(
    ruleIndex: number,
    effectIndex: number,
    effect: AtomExpr,
    getBucket: (key: string) => string | undefined,
    reasons: Set<PlannerSchemaRejectReason>,
    detailNotes: string[],
  ): void {
    const effLeaves = collectAtomLeaves(effect)
    for (const leaf of effLeaves) {
      const bucket = getBucket(leaf.key)
      if (bucket !== undefined && !EFFECTS_ALLOWED_BUCKETS.has(bucket)) {
        reasons.add('effects_leaf_bucket_invalid')
        detailNotes.push(`rules[${ruleIndex}].effects[${effectIndex}] 含非法叶子 atom key=${leaf.key} bucket=${bucket}（应来自 action/risk/positionConstraint/orchestration 桶）`)
      }
    }
  }

  private isProgramEffectAtom(key: string): boolean {
    // Registry currently models executable programs as orchestration bucket atoms
    // named program.*; this keeps programs role validation contract-driven by
    // registered atom identity instead of strategy-specific keywords.
    return key.startsWith('program.')
  }

  private expandRulesForInternalFlat(dispatcher: InternalPlannerPatch): InternalPlannerPatch {
    return this.cloneRulesNativePatch(dispatcher)
  }

  /**
   * 递归检查 raw AtomExpr 树叶子 atom 的 evidence.text 子串约束。
   * leaf.evidence 可选；提供时其 text 必须非空，非 user message 子串只记 warning。
   */
  private checkLeafEvidenceSubstring(
    node: unknown,
    message: string,
    pathPrefix: string,
    reasons: Set<PlannerSchemaRejectReason>,
    warnings: Set<PlannerSchemaRejectReason>,
    detailNotes: string[],
  ): void {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return
    const kind = (node as { kind?: unknown }).kind
    if (kind === 'atom') {
      const evidence = (node as { evidence?: { text?: unknown } }).evidence
      if (evidence !== undefined && evidence !== null) {
        const text = (evidence as { text?: unknown }).text
        if (typeof text !== 'string' || text.trim().length === 0) {
          reasons.add('evidence_text_missing')
          detailNotes.push(`${pathPrefix} 叶子 atom 含 evidence 但 text 缺失/为空`)
        }
        else if (message && !message.includes(text.trim())) {
          warnings.add('evidence_text_not_substring')
        }
      }
      return
    }
    if (kind === 'and' || kind === 'or') {
      const children = (node as { children?: unknown[] }).children
      if (Array.isArray(children)) {
        for (let i = 0; i < children.length; i++) {
          this.checkLeafEvidenceSubstring(children[i], message, `${pathPrefix}.children[${i}]`, reasons, warnings, detailNotes)
        }
      }
      return
    }
    if (kind === 'not') {
      this.checkLeafEvidenceSubstring((node as { child?: unknown }).child, message, `${pathPrefix}.child`, reasons, warnings, detailNotes)
      return
    }
    if (kind === 'sequence') {
      const steps = (node as { steps?: unknown[] }).steps
      if (Array.isArray(steps)) {
        for (let i = 0; i < steps.length; i++) {
          this.checkLeafEvidenceSubstring(steps[i], message, `${pathPrefix}.steps[${i}]`, reasons, warnings, detailNotes)
        }
      }
    }
  }

  private buildFallbackRules(dispatcher: InternalPlannerPatch, userMessage: string): SemanticRule[] {
    const predicateAtoms = this.collectFallbackPredicateAtoms(dispatcher)
    if (predicateAtoms.length === 0) return []
    const effectAtoms = this.collectFallbackEffectAtoms(dispatcher)
    const rules: SemanticRule[] = this.buildCompositeFallbackRules(predicateAtoms, effectAtoms, userMessage)
    const compositeCoveredPredicates = this.collectCompositeCoveredPredicates(predicateAtoms, userMessage)
    const multiTimeframeCoveredPredicates = this.appendMultiTimeframeEntryRules(
      rules,
      predicateAtoms,
      effectAtoms,
      dispatcher,
      userMessage,
    )
    const seen = new Set<string>()

    for (const predicate of predicateAtoms) {
      if (compositeCoveredPredicates.has(predicate)) continue
      if (multiTimeframeCoveredPredicates.has(predicate)) continue
      const phase = this.normalizeFallbackRulePhase(predicate.phase)
      const sideScope = this.normalizeFallbackRuleSideScope(predicate, phase, dispatcher, userMessage)
      const effects = this.resolveFallbackEffects({
        phase,
        sideScope,
        effectAtoms,
        predicate,
      })
      if (effects.length === 0) continue
      const condition: AtomExprAtom = {
        kind: 'atom',
        key: predicate.key,
        params: predicate.params ?? {},
        ...(sideScope ? { sideScope } : {}),
        ...this.resolveFallbackEvidence(predicate, userMessage),
      }
      const signature = `${phase}|${sideScope}|${JSON.stringify(this.normalizeAtomExprForSignature(condition))}|${JSON.stringify(effects.map(effect => this.normalizeAtomExprForSignature(effect)))}`
      if (seen.has(signature)) continue
      seen.add(signature)
      rules.push({
        id: `deterministic-rule-${rules.length + 1}`,
        phase,
        sideScope,
        condition,
        effects: this.toTypedRuleEffects(effects),
        ...this.resolveFallbackEvidence(predicate, userMessage),
      })
    }

    return rules
  }

  private appendMultiTimeframeEntryRules(
    rules: SemanticRule[],
    predicateAtoms: ReadonlyArray<FallbackPredicateAtom>,
    effectAtoms: ReadonlyArray<AtomExprAtom>,
    dispatcher: InternalPlannerPatch,
    userMessage: string,
  ): ReadonlySet<FallbackPredicateAtom> {
    const covered = new Set<FallbackPredicateAtom>()
    const groups = new Map<string, FallbackPredicateAtom[]>()
    for (const predicate of predicateAtoms) {
      if (predicate.phase === 'exit' || predicate.phase === 'gate' || predicate.phase === 'risk' || predicate.phase === 'program') continue
      const timeframe = this.readStringParam(predicate.params, 'timeframe')
      if (!timeframe) continue
      const phase = 'entry'
      const sideScope = this.normalizeFallbackRuleSideScope(predicate, phase, dispatcher, userMessage)
      const effects = this.resolveFallbackEffects({ phase, sideScope, effectAtoms, predicate })
      if (effects.length === 0) continue
      const key = [
        phase,
        sideScope,
        predicate.key,
        this.readEvidenceText(predicate) ?? '',
        JSON.stringify(this.omitParams(predicate.params ?? {}, ['timeframe'])),
        effects.map(effect => `${effect.key}:${this.normalizedEffectSideSignature(effect)}`).join(','),
      ].join('|')
      const list = groups.get(key) ?? []
      list.push(predicate)
      groups.set(key, list)
    }

    let index = 0
    for (const group of groups.values()) {
      const uniqueTimeframes = new Set(group.map(predicate => this.readStringParam(predicate.params, 'timeframe')).filter(Boolean))
      if (group.length < 2 || uniqueTimeframes.size < 2) continue
      const first = group[0]
      if (!first) continue
      const phase = 'entry'
      const sideScope = this.normalizeFallbackRuleSideScope(first, phase, dispatcher, userMessage)
      const effects = this.resolveFallbackEffects({ phase, sideScope, effectAtoms, predicate: first })
      if (effects.length === 0) continue
      const evidence = this.resolveFallbackEvidence(first, userMessage)
      rules.push({
        id: `deterministic-entry-mtf-${++index}`,
        phase,
        sideScope,
        condition: {
          kind: 'and',
          children: group.map(predicate => ({
            kind: 'atom' as const,
            key: predicate.key,
            params: predicate.params ?? {},
            ...(predicate.sideScope ? { sideScope: predicate.sideScope } : {}),
            ...this.resolveFallbackEvidence(predicate, userMessage),
          })),
        },
        effects: this.toTypedRuleEffects(effects),
        ...evidence,
      })
      group.forEach(predicate => covered.add(predicate))
    }
    return covered
  }

  private collectCompositeCoveredPredicates(
    predicateAtoms: ReadonlyArray<FallbackPredicateAtom>,
    userMessage: string,
  ): ReadonlySet<FallbackPredicateAtom> {
    const covered = new Set<FallbackPredicateAtom>()
    const pullback = this.findPullbackReclaimPredicate(predicateAtoms)
    if (pullback) {
      const trend = predicateAtoms.find(predicate =>
        predicate !== pullback
        && predicate.phase !== 'exit'
        && predicate.key === pullback.key
        && this.readNumericParam(predicate.params, 'reference.period') !== this.readNumericParam(pullback.params, 'reference.period'),
      )
      if (trend) covered.add(trend)
      covered.add(pullback)

      const pullbackEvidence = this.readEvidenceText(pullback)
      const previousExtremaRetestKey = ATOM_CONTRACT_REGISTRY['price.previous_extrema_retest'].key
      for (const predicate of predicateAtoms) {
        if (predicate.key !== previousExtremaRetestKey) continue
        if (this.readEvidenceText(predicate) === pullbackEvidence) covered.add(predicate)
      }
    }
    const rsiReclaim = this.findRsiReclaimPredicate(predicateAtoms)
    if (rsiReclaim) {
      const trend = this.findTrendPredicateForRsiReclaim(predicateAtoms, rsiReclaim)
      if (trend) {
        const originalTrend = this.findOriginalTrendPredicateForSynthetic(predicateAtoms, trend) ?? trend
        covered.add(originalTrend)
      }
      covered.add(rsiReclaim)
    }
    const volumeRebound = this.findVolumeReboundSequencePredicate(predicateAtoms, userMessage)
    if (volumeRebound) {
      const original = this.findOriginalTrendPredicateForSynthetic(predicateAtoms, volumeRebound) ?? volumeRebound
      covered.add(original)
    }
    return covered
  }

  private buildCompositeFallbackRules(
    predicateAtoms: ReadonlyArray<FallbackPredicateAtom>,
    effectAtoms: ReadonlyArray<AtomExprAtom>,
    userMessage: string,
  ): SemanticRule[] {
    const rules: SemanticRule[] = []
    const volumeRebound = this.findVolumeReboundSequencePredicate(predicateAtoms, userMessage)
    if (volumeRebound) {
      const phase = 'entry'
      const sideScope = volumeRebound.sideScope ?? 'long'
      const effects = this.resolveFallbackEffects({
        phase,
        sideScope,
        effectAtoms,
        predicate: volumeRebound,
      })
      if (effects.length > 0) {
        rules.push({
          id: 'deterministic-composite-volume-rebound',
          phase,
          sideScope,
          condition: {
            kind: 'atom',
            key: ATOM_CONTRACT_REGISTRY['condition.sequence'].key,
            params: volumeRebound.params ?? {},
            ...(volumeRebound.sideScope ? { sideScope: volumeRebound.sideScope } : {}),
            ...this.resolveFallbackEvidence(volumeRebound, userMessage),
          },
          effects: this.toTypedRuleEffects(effects),
          ...this.resolveFallbackEvidence(volumeRebound, userMessage),
        })
      }
    }
    const rsiReclaim = this.findRsiReclaimPredicate(predicateAtoms)
    if (rsiReclaim) {
      const rsiTrend = this.findTrendPredicateForRsiReclaim(predicateAtoms, rsiReclaim)
      const sideScope = rsiReclaim.sideScope ?? rsiTrend?.sideScope ?? 'long'
      const effects = this.resolveFallbackEffects({
        phase: 'entry',
        sideScope,
        effectAtoms,
        predicate: rsiReclaim,
      })
      if (effects.length > 0) {
        const threshold = this.readNumericParam(rsiReclaim.params, 'value') ?? this.readNumericParam(rsiReclaim.params, 'threshold')
        const rawPeriod = this.readNumericParam(rsiReclaim.params, 'period')
        const period = rawPeriod !== null && threshold !== null && Math.abs(rawPeriod - threshold) <= 1e-9
          ? 14
          : rawPeriod ?? 14
        const evidence = this.resolveFallbackEvidence(rsiReclaim, userMessage)
        const sequenceCondition: AtomExprAtom = {
          kind: 'atom',
          key: ATOM_CONTRACT_REGISTRY['condition.sequence'].key,
          params: {
            sequenceKind: 'rsi_reclaim',
            indicator: 'rsi',
            period,
            ...(threshold !== null ? { threshold, value: threshold } : {}),
          },
          ...(rsiReclaim.sideScope ? { sideScope: rsiReclaim.sideScope } : {}),
          ...evidence,
        }
        rules.push({
          id: 'deterministic-composite-rsi-reclaim',
          phase: 'entry',
          sideScope,
          condition: rsiTrend
            ? {
              kind: 'and',
              children: [
                {
                  kind: 'atom',
                  key: rsiTrend.key,
                  params: rsiTrend.params ?? {},
                  ...(rsiTrend.sideScope ? { sideScope: rsiTrend.sideScope } : {}),
                  ...this.resolveFallbackEvidence(rsiTrend, userMessage),
                },
                sequenceCondition,
              ],
            }
            : sequenceCondition,
          effects: this.toTypedRuleEffects(effects),
          ...evidence,
        })
      }
    }
    const pullback = this.findPullbackReclaimPredicate(predicateAtoms)
    if (!pullback) return rules

    const trend = predicateAtoms.find(predicate =>
      predicate !== pullback
      && predicate.phase !== 'exit'
      && predicate.key === pullback.key
      && this.readNumericParam(predicate.params, 'reference.period') !== this.readNumericParam(pullback.params, 'reference.period'),
    )
    if (!trend) return rules

    const sideScope = pullback.sideScope ?? trend.sideScope ?? 'long'
    const effects = this.resolveFallbackEffects({
      phase: 'entry',
      sideScope,
      effectAtoms,
      predicate: pullback,
    })
    if (effects.length === 0) return rules

    const pullbackPeriod = this.readNumericParam(pullback.params, 'reference.period')
    const pullbackIndicator = typeof pullback.params?.indicator === 'string' ? pullback.params.indicator : 'ma'
    const evidence = this.resolveFallbackEvidence(pullback, userMessage)
    rules.push({
      id: 'deterministic-composite-1',
      phase: 'entry',
      sideScope,
      condition: {
        kind: 'and',
        children: [
          {
            kind: 'atom',
            key: trend.key,
            params: trend.params ?? {},
            ...(trend.sideScope ? { sideScope: trend.sideScope } : {}),
            ...this.resolveFallbackEvidence(trend, userMessage),
          },
          {
            kind: 'atom',
            key: ATOM_CONTRACT_REGISTRY['condition.sequence'].key,
            params: {
              sequenceKind: 'pullback_reclaim',
              reference: {
                indicator: pullbackIndicator,
                ...(pullbackPeriod !== null ? { period: pullbackPeriod } : {}),
              },
              'reference.indicator': pullbackIndicator,
              ...(pullbackPeriod !== null ? { 'reference.period': pullbackPeriod } : {}),
            },
            ...(pullback.sideScope ? { sideScope: pullback.sideScope } : {}),
            ...evidence,
          },
        ],
      },
      effects: this.toTypedRuleEffects(effects),
      ...evidence,
    })
    return rules
  }

  private findPullbackReclaimPredicate(
    predicateAtoms: ReadonlyArray<FallbackPredicateAtom>,
  ): FallbackPredicateAtom | null {
    return predicateAtoms.find((predicate) => {
      if (predicate.phase === 'exit') return false
      const evidence = this.readEvidenceText(predicate)
      if (!evidence) return false
      return /回踩|回测|pullback|retest/iu.test(evidence) && /重新\s*站上|重回|站回|reclaim/iu.test(evidence)
    }) ?? null
  }

  private findRsiReclaimPredicate(
    predicateAtoms: ReadonlyArray<FallbackPredicateAtom>,
  ): FallbackPredicateAtom | null {
    return predicateAtoms.find((predicate) => {
      if (predicate.phase === 'exit') return false
      if (predicate.key !== ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key) return false
      const indicator = this.readStringParam(predicate.params, 'indicator')
      if (indicator !== 'rsi') return false
      const evidence = this.readEvidenceText(predicate)
      return Boolean(evidence && /RSI/iu.test(evidence) && /跌破|低于|下方/iu.test(evidence) && /重新上穿|上穿|回到|重新站上/iu.test(evidence))
    }) ?? null
  }

  private findTrendPredicateForRsiReclaim(
    predicateAtoms: ReadonlyArray<FallbackPredicateAtom>,
    rsiReclaim: FallbackPredicateAtom,
  ): FallbackPredicateAtom | null {
    const maPair = predicateAtoms
      .filter(predicate =>
        predicate !== rsiReclaim
        && predicate.phase !== 'exit'
        && predicate.key === ATOM_CONTRACT_REGISTRY['indicator.above'].key,
      )
      .map(predicate => ({ predicate, pair: this.extractMovingAveragePair(this.readEvidenceText(predicate) ?? '') }))
      .find(item => item.pair !== null)
    if (maPair?.pair) {
      const indicator = maPair.pair.indicator
      return {
        ...maPair.predicate,
        params: {
          ...(maPair.predicate.params ?? {}),
          indicator,
          period: maPair.pair.leftPeriod,
          'reference.period': maPair.pair.rightPeriod,
        },
      }
    }

    return predicateAtoms.find(predicate =>
      predicate !== rsiReclaim
      && predicate.phase !== 'exit'
      && predicate.key === ATOM_CONTRACT_REGISTRY['indicator.above'].key,
    ) ?? null
  }

  private findVolumeReboundSequencePredicate(
    predicateAtoms: ReadonlyArray<FallbackPredicateAtom>,
    userMessage: string,
  ): FallbackPredicateAtom | null {
    const candle = predicateAtoms.find((predicate) => {
      if (predicate.phase === 'exit') return false
      if (predicate.key !== ATOM_CONTRACT_REGISTRY['price.candle_pattern'].key) return false
      const pattern = this.readStringParam(predicate.params, 'pattern')
      if (pattern !== 'consecutive_body') return false
      const evidence = `${this.readEvidenceText(predicate) ?? ''} ${userMessage}`
      return /放量|成交量放大|量能放大|volume\s*spike/iu.test(evidence)
        && /反弹|回升|rebound|bounce/iu.test(evidence)
    })
    if (!candle) return null

    const evidence = `${this.readEvidenceText(candle) ?? ''} ${userMessage}`
    const rawDirection = this.readStringParam(candle.params, 'direction')
    const direction = rawDirection === 'bearish' || rawDirection === 'down' || /连续\s*(?:跌|阴)|连跌|收跌|bear/iu.test(evidence)
      ? 'down'
      : 'up'
    const count = this.readNumericParam(candle.params, 'minBars')
      ?? this.readNumericParam(candle.params, 'count')
      ?? this.extractConsecutiveBars(evidence)
      ?? 3
    const timeframe = this.readStringParam(candle.params, 'timeframe') ?? this.extractTimeframeTokens(evidence)[0]
    const params: Record<string, unknown> = {
      sequenceKind: 'pattern_then_volume_spike',
      direction,
      count,
      reboundDirection: direction === 'down' ? 'up' : 'down',
      lookbackBars: 20,
      ...(timeframe ? { timeframe } : {}),
      ...(/下一根|next\s*bar/iu.test(evidence) ? { nextBarOnly: 'true' } : {}),
    }
    return {
      ...candle,
      key: ATOM_CONTRACT_REGISTRY['condition.sequence'].key,
      params,
      sideScope: candle.sideScope === 'short' ? 'short' : 'long',
      evidence: candle.evidence ?? { text: userMessage },
    }
  }

  private findOriginalTrendPredicateForSynthetic(
    predicateAtoms: ReadonlyArray<FallbackPredicateAtom>,
    synthetic: FallbackPredicateAtom,
  ): FallbackPredicateAtom | null {
    const evidence = this.readEvidenceText(synthetic)
    return predicateAtoms.find(predicate =>
      predicate === synthetic
      || (
        evidence !== null
        && this.readEvidenceText(predicate) === evidence
        && (
          predicate.key === synthetic.key
          || predicate.key === ATOM_CONTRACT_REGISTRY['indicator.above'].key
          || predicate.key === ATOM_CONTRACT_REGISTRY['price.candle_pattern'].key
        )
      ),
    ) ?? null
  }

  private extractMovingAveragePair(text: string): { indicator: string, leftPeriod: number, rightPeriod: number } | null {
    const match = /(EMA|MA|SMA)\s*(\d{1,4})\s*(?:在|高于|大于|>)\s*(EMA|MA|SMA)\s*(\d{1,4})\s*(?:上方|之上)?/iu.exec(text)
    if (!match?.[1] || !match[2] || !match[3] || !match[4]) return null
    const leftPeriod = Number(match[2])
    const rightPeriod = Number(match[4])
    if (!Number.isFinite(leftPeriod) || !Number.isFinite(rightPeriod)) return null
    const leftIndicator = match[1].toLowerCase()
    const rightIndicator = match[3].toLowerCase()
    const indicator = leftIndicator === 'ema' || rightIndicator === 'ema' ? 'ema' : 'ma'
    return { indicator, leftPeriod, rightPeriod }
  }

  private normalizeFallbackRuleSideScope(
    predicate: FallbackPredicateAtom,
    phase: SemanticRule['phase'],
    dispatcher: InternalPlannerPatch,
    userMessage: string,
  ): 'long' | 'short' | 'both' {
    const current = predicate.sideScope ?? 'both'
    if (phase !== 'exit') return current
    if (current === 'both' && !this.hasShortEntryIntent(dispatcher, userMessage)) return 'long'
    if (current !== 'short') return current
    const evidence = this.readEvidenceText(predicate) ?? userMessage
    const explicitShortExit = /平空|空单|空仓|close\s+short/iu.test(evidence)
    if (explicitShortExit) return current
    const hasShortIntent = this.hasShortEntryIntent(dispatcher, userMessage)
    return hasShortIntent ? current : 'long'
  }

  private hasShortEntryIntent(dispatcher: InternalPlannerPatch, userMessage: string): boolean {
    const actionOpenShortKey = ATOM_CONTRACT_REGISTRY['action.open_short'].key
    if ((dispatcher.rules ?? []).some(rule =>
      collectAtomLeaves(rule.condition).some(atom => atom.key === actionOpenShortKey)
      || listRuleEffects(rule.effects).some(effect => collectAtomLeaves(effect).some(atom => atom.key === actionOpenShortKey)),
    )) return true
    return /开空|做空|空单|卖空|short/iu.test(userMessage)
  }

  private readEvidenceText(item: { evidence?: { text?: unknown } }): string | null {
    const text = item.evidence?.text
    return typeof text === 'string' && text.trim().length > 0 ? text.trim() : null
  }

  private readNumericParam(params: Record<string, unknown> | undefined, key: string): number | null {
    const direct = params?.[key]
    if (typeof direct === 'number' && Number.isFinite(direct)) return direct
    const value = key.split('.').reduce<unknown>((current, part) => {
      if (!current || typeof current !== 'object') return undefined
      return (current as Record<string, unknown>)[part]
    }, params)
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private omitParams(
    params: Record<string, unknown>,
    keys: ReadonlyArray<string>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    const omitted = new Set(keys)
    for (const [key, value] of Object.entries(params)) {
      if (omitted.has(key)) continue
      out[key] = value
    }
    return out
  }

  private buildFallbackPositionFromDispatcherConstraints(
    dispatcher: InternalPlannerPatch,
  ): null {
    void dispatcher
    return null
  }

  private collectFallbackPredicateAtoms(dispatcher: InternalPlannerPatch): FallbackPredicateAtom[] {
    const out: FallbackPredicateAtom[] = []
    const push = (item: typeof out[number]): void => {
      if (typeof item.key !== 'string' || item.key.length === 0) return
      out.push(item)
    }
    for (const rule of dispatcher.rules ?? []) {
      for (const atom of collectAtomLeaves(rule.condition)) {
        push({
          key: atom.key,
          phase: rule.phase,
          sideScope: atom.sideScope ?? rule.sideScope,
          params: atom.params,
          evidence: atom.evidence ?? rule.evidence,
        })
      }
    }
    return this.dedupeFallbackAtoms(out)
  }

  private dropRangePositionPredicatesCoveredByAddPosition(
    predicates: FallbackPredicateAtom[],
    dispatcher: InternalPlannerPatch,
  ): FallbackPredicateAtom[] {
    const addPositionEvidence = new Set(
      (dispatcher.rules ?? [])
        .flatMap(rule => listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect)))
        .filter(atom => atom.key === ADD_POSITION_ATOM_KEY)
        .map(atom => this.readEvidenceText(atom))
        .filter((text): text is string => Boolean(text)),
    )
    if (addPositionEvidence.size === 0) return predicates
    return predicates.filter((predicate) => {
      const evidence = this.readEvidenceText(predicate)
      if (
        predicate.key === ATOM_CONTRACT_REGISTRY['price.percent_change'].key
        && predicate.sourceActionKey !== ADD_POSITION_ATOM_KEY
      ) {
        return Boolean(evidence && !addPositionEvidence.has(evidence))
      }
      if (predicate.key !== ATOM_CONTRACT_REGISTRY['price.range_position_gte'].key) return true
      if (!evidence) return false
      return !addPositionEvidence.has(evidence) && !/加仓|加投|补仓/iu.test(evidence)
    })
  }

  private collectFallbackEffectAtoms(dispatcher: InternalPlannerPatch): AtomExprAtom[] {
    return this.dedupeFallbackEffects(
      (dispatcher.rules ?? [])
        .flatMap(rule => listRuleEffects(rule.effects))
        .flatMap(effect => collectAtomLeaves(effect)),
    )
  }

  private findDispatcherDcaScheduleAtom(
    dispatcher: InternalPlannerPatch,
  ): { params?: Record<string, unknown>, evidence?: { text?: unknown } } | null {
    return this.collectFallbackEffectAtoms(dispatcher).find(atom => atom.key === DCA_SCHEDULE_ATOM_KEY) ?? null
  }

  private resolveFallbackEffects(args: {
    phase: SemanticRule['phase']
    sideScope: 'long' | 'short' | 'both'
    effectAtoms: ReadonlyArray<AtomExprAtom>
    predicate: { phase?: 'entry' | 'exit' | 'risk' | 'gate' | 'program', sideScope?: 'long' | 'short' | 'both', sourceActionKey?: string }
  }): AtomExprAtom[] {
    const phaseMatched = args.effectAtoms
      .filter(atom => this.effectMatchesRule(atom, args.phase, args.sideScope))
      .filter(atom => args.predicate.sourceActionKey === ADD_POSITION_ATOM_KEY || atom.key !== ADD_POSITION_ATOM_KEY)
    if (args.predicate.sourceActionKey === ADD_POSITION_ATOM_KEY && phaseMatched.length > 0) {
      return this.dedupeFallbackEffects(phaseMatched.filter(atom => atom.key === ADD_POSITION_ATOM_KEY))
    }
    if (args.predicate.sourceActionKey === DCA_SCHEDULE_ATOM_KEY) {
      const dcaEffects = args.effectAtoms.filter(atom => atom.key === DCA_SCHEDULE_ATOM_KEY)
      const defaults = this.defaultActionEffects(args.phase, args.sideScope)
      return this.dedupeFallbackEffects([...dcaEffects, ...phaseMatched, ...defaults])
    }
    const defaults = this.defaultActionEffects(args.phase, args.sideScope)
    return this.dedupeFallbackEffects([...phaseMatched, ...defaults])
  }

  private normalizeFallbackRulePhase(phase: FallbackPredicateAtom['phase']): SemanticRule['phase'] {
    if (phase === 'entry' || phase === 'exit' || phase === 'gate' || phase === 'program') return phase
    if (phase === 'risk') return 'exit'
    return 'entry'
  }

  private effectMatchesRule(
    atom: AtomExprAtom,
    phase: SemanticRule['phase'],
    sideScope: 'long' | 'short' | 'both',
  ): boolean {
    const key = atom.key
    if (phase === 'entry') {
      if (key === ADD_POSITION_ATOM_KEY) {
        return sideScope === 'both' || atom.sideScope === undefined || atom.sideScope === sideScope || atom.sideScope === 'both'
      }
      if (sideScope === 'long') return key === ATOM_CONTRACT_REGISTRY['action.open_long'].key
      if (sideScope === 'short') return key === ATOM_CONTRACT_REGISTRY['action.open_short'].key
      return key === ATOM_CONTRACT_REGISTRY['action.open_long'].key || key === ATOM_CONTRACT_REGISTRY['action.open_short'].key
    }
    if (phase === 'exit') {
      if (sideScope === 'long') return key === ATOM_CONTRACT_REGISTRY['action.close_long'].key
      if (sideScope === 'short') return key === ATOM_CONTRACT_REGISTRY['action.close_short'].key
      return key === ATOM_CONTRACT_REGISTRY['action.close_long'].key || key === ATOM_CONTRACT_REGISTRY['action.close_short'].key
    }
    return this.readAtomBucket(key) !== 'action'
  }

  private buildAddPositionTriggerPredicate(atom: {
    key: string
    phase?: 'entry' | 'exit' | 'risk' | 'gate' | 'program'
    sideScope?: 'long' | 'short' | 'both'
    params?: Record<string, unknown>
    evidence?: { text?: unknown }
  }): {
      key: string
      phase: 'entry'
      sideScope: 'long' | 'short' | 'both'
      params: Record<string, unknown>
      evidence?: { text?: unknown }
      sourceActionKey: string
    } | null {
    if (atom.key !== ADD_POSITION_ATOM_KEY) return null
    const params = atom.params ?? {}
    const addMode = typeof params.addMode === 'string' ? params.addMode : null
    const paramSideScope = params.sideScope
    const sideScope = paramSideScope === 'long' || paramSideScope === 'short' || paramSideScope === 'both'
      ? paramSideScope
      : atom.sideScope ?? 'long'
    if (addMode === 'profit_pct' && typeof params.profitThreshold === 'number') {
      return {
        key: 'price.percent_change',
        phase: 'entry',
        sideScope,
        params: {
          basis: 'entry_avg_price',
          direction: 'up',
          valuePct: Math.abs(params.profitThreshold),
        },
        ...(atom.evidence ? { evidence: atom.evidence } : {}),
        sourceActionKey: ADD_POSITION_ATOM_KEY,
      }
    }
    if (addMode === 'drawdown_pct' && typeof params.drawdownThreshold === 'number') {
      return {
        key: 'price.percent_change',
        phase: 'entry',
        sideScope,
        params: {
          basis: 'entry_avg_price',
          direction: 'down',
          valuePct: Math.abs(params.drawdownThreshold),
        },
        ...(atom.evidence ? { evidence: atom.evidence } : {}),
        sourceActionKey: ADD_POSITION_ATOM_KEY,
      }
    }
    return null
  }

  private defaultActionEffects(phase: SemanticRule['phase'], sideScope: 'long' | 'short' | 'both'): AtomExprAtom[] {
    if (phase === 'gate' || phase === 'program') return []
    const keys = phase === 'entry'
      ? (sideScope === 'long'
          ? [ATOM_CONTRACT_REGISTRY['action.open_long'].key]
          : sideScope === 'short'
            ? [ATOM_CONTRACT_REGISTRY['action.open_short'].key]
            : [ATOM_CONTRACT_REGISTRY['action.open_long'].key, ATOM_CONTRACT_REGISTRY['action.open_short'].key])
      : (sideScope === 'long'
          ? [ATOM_CONTRACT_REGISTRY['action.close_long'].key]
          : sideScope === 'short'
            ? [ATOM_CONTRACT_REGISTRY['action.close_short'].key]
            : [ATOM_CONTRACT_REGISTRY['action.close_long'].key, ATOM_CONTRACT_REGISTRY['action.close_short'].key])
    return keys.map(key => ({ kind: 'atom' as const, key, params: {} }))
  }

  private resolveFallbackEvidence(
    atom: { evidence?: { text?: unknown } },
    userMessage: string,
  ): { evidence?: { text: string } } {
    const text = typeof atom.evidence?.text === 'string' && atom.evidence.text.trim().length > 0
      ? atom.evidence.text.trim()
      : userMessage.trim()
    return text ? { evidence: { text } } : {}
  }

  private readAtomBucket(key: string): string | undefined {
    return (ATOM_CONTRACT_REGISTRY as Record<string, { bucket?: string } | undefined>)[key]?.bucket
  }

  private atomHasRole(key: string, role: 'predicate' | 'effect'): boolean {
    return (ATOM_CONTRACT_REGISTRY as Record<string, { roles?: readonly string[] } | undefined>)[key]?.roles?.includes(role) ?? false
  }

  private dedupeFallbackAtoms<T extends { key: string, phase?: unknown, sideScope?: unknown, params?: unknown, sourceActionKey?: unknown }>(items: T[]): T[] {
    const seen = new Map<string, number>()
    const out: T[] = []
    for (const item of items) {
      const params = item.params && typeof item.params === 'object'
        ? this.omitParams(item.params as Record<string, unknown>, ['phase'])
        : {}
      const signature = `${item.key}|${String(item.phase ?? '')}|${String(item.sideScope ?? '')}|${JSON.stringify(params)}`
      const seenIndex = seen.get(signature)
      if (seenIndex !== undefined) {
        if (out[seenIndex]?.sourceActionKey === undefined && item.sourceActionKey !== undefined) {
          out[seenIndex] = item
        }
        continue
      }
      seen.set(signature, out.length)
      out.push(item)
    }
    return out
  }

  private dedupeFallbackEffects(items: AtomExprAtom[]): AtomExprAtom[] {
    const seen = new Set<string>()
    const out: AtomExprAtom[] = []
    for (const item of items) {
      const signature = `${item.key}|${this.normalizedEffectSideSignature(item)}|${JSON.stringify(this.omitParams(item.params ?? {}, ['phase']))}`
      if (seen.has(signature)) continue
      seen.add(signature)
      out.push(item)
    }
    return out
  }

  private normalizedEffectSideSignature(item: AtomExprAtom): string {
    if (this.readAtomBucket(item.key) === 'risk') return 'risk'
    if (item.key.endsWith('_long')) return 'long'
    if (item.key.endsWith('_short')) return 'short'
    const paramSideScope = item.params.sideScope
    if (paramSideScope === 'long' || paramSideScope === 'short') return paramSideScope
    return item.sideScope === 'long' || item.sideScope === 'short' ? item.sideScope : 'both'
  }

  mergePlannerAndDispatcherPatches(
    plannerPatch: InternalPlannerPatch | null | undefined,
    dispatcherPatch: InternalPlannerPatch | null | undefined,
  ): InternalPlannerPatch | null {
    const merged = this.mergeRulesNativePatches(plannerPatch, dispatcherPatch)
    if (!merged) return null
    try {
      this.filterAlwaysOnActionNoiseRules(merged)
    }
    catch (err) {
      this.logger.warn(`filterAlwaysOnActionNoiseRules 抛出异常，已 fail-open 保留 merged 原状：${err instanceof Error ? err.message : String(err)}`)
    }
    try {
      this.foldSubsetConditionRules(merged)
    }
    catch (err) {
      this.logger.warn(`foldSubsetConditionRules 抛出异常，已 fail-open 保留 merged 原状：${err instanceof Error ? err.message : String(err)}`)
    }
    if (Array.isArray(merged.rules) && merged.rules.length > 0) {
      merged.rules = this.dedupeRulesBySignature(merged.rules as readonly SemanticRule[])
    }
    return merged
  }

  mergeDeterministicExecutionSlots(
    plannerPatch: InternalPlannerPatch | null | undefined,
    dispatcherPatch: InternalPlannerPatch | null | undefined,
    userMessage = '',
  ): InternalPlannerPatch | null {
    if (!this.isNonEmpty(plannerPatch)) {
      return this.buildRulesTreeFallbackFromDispatcher(dispatcherPatch, userMessage) ?? plannerPatch ?? null
    }
    const dispatcher = dispatcherPatch as InternalPlannerPatch | null | undefined
    const merged = this.mergeRulesNativePatches(plannerPatch, dispatcher) ?? this.cloneRulesNativePatch(plannerPatch as InternalPlannerPatch)
    if (dispatcher) {
      this.appendDispatcherRulesForMissingLifecyclePhases(merged, dispatcher)
      this.preserveExplicitDispatcherSemanticsInPlannerSpine(merged, dispatcher)
      this.pruneRulesConflictingWithExplicitDispatcherLifecycle(merged, dispatcher)
    }
    if (userMessage.trim().length > 0) {
      try {
        this.hydratePlannerMultiTimeframeRules(merged, userMessage)
      }
      catch (err) {
        this.logger.warn(`hydratePlannerMultiTimeframeRules 抛出异常，已 fail-open 保留 planner rules：${err instanceof Error ? err.message : String(err)}`)
      }
      try {
        this.hydrateExplicitMacdTupleFromText(merged, userMessage)
      }
      catch (err) {
        this.logger.warn(`hydrateExplicitMacdTupleFromText 抛出异常，已 fail-open 保留 planner rules：${err instanceof Error ? err.message : String(err)}`)
      }
      try {
        this.hydrateExplicitPercentRisksFromText(merged, userMessage)
      }
      catch (err) {
        this.logger.warn(`hydrateExplicitPercentRisksFromText 抛出异常，已 fail-open 保留 planner rules：${err instanceof Error ? err.message : String(err)}`)
      }
      try {
        this.hydrateLifecycleAddPositionFromText(merged, userMessage)
      }
      catch (err) {
        this.logger.warn(`hydrateLifecycleAddPositionFromText 抛出异常，已 fail-open 保留 planner rules：${err instanceof Error ? err.message : String(err)}`)
      }
      try {
        this.pruneInvalidDeterministicNoiseRules(merged, dispatcher ?? {}, userMessage)
      }
      catch (err) {
        this.logger.warn(`pruneInvalidDeterministicNoiseRules 抛出异常，已 fail-open 保留 planner rules：${err instanceof Error ? err.message : String(err)}`)
      }
      try {
        this.dropEntriesDuplicatingSameSideExitConditions(merged)
      }
      catch (err) {
        this.logger.warn(`dropEntriesDuplicatingSameSideExitConditions 抛出异常，已 fail-open 保留 planner rules：${err instanceof Error ? err.message : String(err)}`)
      }
    }
    try {
      this.foldSubsetConditionRules(merged)
    }
    catch (err) {
      this.logger.warn(`foldSubsetConditionRules 抛出异常，已 fail-open 保留 planner rules：${err instanceof Error ? err.message : String(err)}`)
    }
    if (Array.isArray(merged.rules) && merged.rules.length > 0) {
      merged.rules = this.dedupeRulesBySignature(merged.rules as readonly SemanticRule[])
    }
    return merged
  }

  private repairPlannerRiskDriftFromDispatcherRules(
    merged: InternalPlannerPatch,
    dispatcher: InternalPlannerPatch,
    userMessage: string,
  ): void {
    const rules = merged.rules
    const dispatcherRules = dispatcher.rules
    if (!rules?.length || !dispatcherRules?.length) return
    if (/(?:^|[^a-z])ATR(?:[^a-z]|$)|平均真实波幅/iu.test(userMessage)) return
    let mutated = false
    const nextRules = rules.map((rule) => {
      const existingEffects = listRuleEffects(rule.effects)
      const hasAtrTakeProfit = existingEffects.some(effect =>
        collectAtomLeaves(effect).some(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['risk.atr_take_profit'].key),
      )
      if (!hasAtrTakeProfit) return rule

      const dispatcherTakeProfit = this.findDispatcherTakeProfitReplacement(rule, dispatcherRules)
        ?? this.findDispatcherTakeProfitEffect(dispatcher)
        ?? this.derivePercentTakeProfitFromRuleCondition(rule)
      if (!dispatcherTakeProfit) return rule

      const keptEffects = existingEffects.filter(effect =>
        !collectAtomLeaves(effect).some(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['risk.atr_take_profit'].key),
      )
      const alreadyHasPercentTakeProfit = keptEffects.some(effect =>
        collectAtomLeaves(effect).some(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['risk.take_profit_pct'].key),
      )
      mutated = true
      return {
        ...rule,
        effects: this.appendTypedRuleEffects(
          keptEffects,
          alreadyHasPercentTakeProfit ? [] : [dispatcherTakeProfit],
        ),
      }
    })
    if (mutated) merged.rules = nextRules
  }

  private hydratePlannerMultiTimeframeRules(
    merged: InternalPlannerPatch,
    userMessage: string,
  ): void {
    const rules = merged.rules
    if (!rules?.length) return
    const timeframes = this.extractTimeframeTokens(userMessage)
    if (timeframes.length < 2) return
    let mutated = false
    const nextRules = rules.map((rule) => {
      if (rule.condition.kind !== 'and') return rule
      const children = rule.condition.children
      if (children.length !== timeframes.length) return rule
      const atomChildren = children.filter((child): child is AtomExprAtom => child.kind === 'atom')
      if (atomChildren.length !== children.length) return rule
      if (atomChildren.some(child => this.readStringParam(child.params, 'timeframe'))) return rule
      const keys = new Set(atomChildren.map(child => child.key))
      if (keys.size !== 1) return rule
      const nextChildren = atomChildren.map((child, index) => ({
        ...child,
        params: {
          ...(child.params ?? {}),
          timeframe: timeframes[index],
        },
      }))
      mutated = true
      return {
        ...rule,
        condition: {
          ...rule.condition,
          children: nextChildren,
        },
      }
    })
    if (mutated) merged.rules = nextRules
  }

  private extractTimeframeTokens(text: string): string[] {
    const out: string[] = []
    const seen = new Set<string>()
    const re = /(?<![A-Za-z0-9])(?:(1m|3m|5m|15m|30m|1h|2h|4h|6h|8h|12h|1d|3d|1w)|(\d{1,3})\s*(分钟|小时|天|周(?!期)|min(?:ute)?s?|hours?|days?|weeks?|m|h|d|w)|(日线|日K|daily))(?![A-Za-z0-9])/giu
    for (const match of text.matchAll(re)) {
      const value = match[1]
        ? match[1].toLowerCase()
        : match[4]
          ? '1d'
          : this.normalizeTimeframeToken(match[2], match[3])
      if (!value || seen.has(value)) continue
      seen.add(value)
      out.push(value)
    }
    return out
  }

  private normalizeTimeframeToken(value: string | undefined, unit: string | undefined): string | null {
    if (!value || !unit) return null
    const normalizedUnit = unit.toLowerCase()
    const suffix = normalizedUnit === '分钟' || normalizedUnit.startsWith('min') || normalizedUnit === 'm'
      ? 'm'
      : normalizedUnit === '小时' || normalizedUnit.startsWith('hour') || normalizedUnit === 'h'
        ? 'h'
        : normalizedUnit === '天' || normalizedUnit.startsWith('day') || normalizedUnit === 'd'
          ? 'd'
          : normalizedUnit.startsWith('周') || normalizedUnit.startsWith('week') || normalizedUnit === 'w'
            ? 'w'
            : null
    return suffix ? `${Number(value)}${suffix}` : null
  }

  private pruneInvalidDeterministicNoiseRules(
    merged: InternalPlannerPatch,
    dispatcher: InternalPlannerPatch,
    userMessage: string,
  ): void {
    const rules = merged.rules
    if (!rules?.length) return
    const dispatcherLeaves = (dispatcher.rules ?? []).flatMap(rule => [
      ...collectAtomLeaves(rule.condition),
      ...listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect)),
    ])
    const hasDrawdownBlock = dispatcherLeaves.some(atom => atom.key === ATOM_CONTRACT_REGISTRY['portfolioRisk.drawdown_block'].key)
      || rules.some(rule => JSON.stringify(rule).includes(ATOM_CONTRACT_REGISTRY['portfolioRisk.drawdown_block'].key))
    const hasExplicitStopLoss = /止损|stop\s*loss/iu.test(userMessage)
    const hasAtrIntent = /(?:^|[^a-z])ATR(?:[^a-z]|$)|平均真实波幅/iu.test(userMessage)
    const allowShort = this.hasShortEntryIntent(dispatcher, userMessage)
    const hasRsiComposite = rules.some(rule =>
      rule.phase === 'entry'
      && collectAtomLeaves(rule.condition).some(leaf =>
        leaf.key === ATOM_CONTRACT_REGISTRY['condition.sequence'].key
        && leaf.params?.sequenceKind === 'rsi_reclaim',
      ),
    )
    const seen = new Set<string>()
    const next: SemanticRule[] = []

    for (const rule of rules) {
      const normalizedConditionInitial = this.repairMissingRsiReclaimSequence(
        this.normalizeRuleConditionNoise(rule.condition, userMessage),
        userMessage,
        rule,
      )
      const normalizedEffectInput = this.normalizeRuleEffectsNoise(
        rule.effects,
        normalizedConditionInitial,
      )
      let normalizedCondition = this.repairConditionFromEffects(
        normalizedConditionInitial,
        normalizedEffectInput,
      )
      const dedupedEffects = this.dedupeRuleEffects(normalizedEffectInput)
      const withoutUnsupportedNoise = this.removeUnsupportedEffectNoise(
        dedupedEffects,
        collectAtomLeaves(normalizedCondition),
        hasAtrIntent,
      )
      const sideScopedEffects = this.removeContradictorySideActionEffects(
        withoutUnsupportedNoise,
        rule.phase,
        rule.sideScope,
      )
      const effectLeaves = listRuleEffects(sideScopedEffects).flatMap(effect => collectAtomLeaves(effect))
      normalizedCondition = this.repairLifecycleConditionNoise(normalizedCondition, effectLeaves)
      const conditionLeaves = collectAtomLeaves(normalizedCondition)
      if ((rule.phase === 'entry' || rule.phase === 'exit') && effectLeaves.length === 0) continue
      const hasInvalidConditionBucket = conditionLeaves.some((leaf) => {
        const bucket = this.readAtomBucket(leaf.key)
        return bucket !== undefined
          && !CONDITION_ALLOWED_BUCKETS.has(bucket)
          && !(bucket === 'positionConstraint' && CONDITION_ALLOWED_POSITION_CONSTRAINT_ATOMS.has(leaf.key))
      })
      if (hasInvalidConditionBucket && effectLeaves.length === 0) continue
      if (this.isEmptyPositionPresenceGateRule(rule, conditionLeaves, effectLeaves)) continue
      if (
        hasRsiComposite
        && rule.phase === 'entry'
        && !conditionLeaves.some(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['condition.sequence'].key)
        && conditionLeaves.some(leaf =>
          leaf.key === ATOM_CONTRACT_REGISTRY['oscillator.rsi_lte'].key
          || leaf.key === ATOM_CONTRACT_REGISTRY['oscillator.rsi_gte'].key
          || leaf.key === ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key
          || (
            leaf.key === ATOM_CONTRACT_REGISTRY['indicator.above'].key
            && !conditionLeaves.some(other => other.key === ATOM_CONTRACT_REGISTRY['condition.sequence'].key)
          ),
        )
      ) {
        continue
      }
      const hasEventListener = effectLeaves.some(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['program.event_listener'].key)
      if (hasEventListener && !/webhook|外部事件|事件监听/iu.test(userMessage)) continue

      const hasStopLossCondition = conditionLeaves.some(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['risk.stop_loss_pct'].key)
      const hasStopLossEffect = effectLeaves.some(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['risk.stop_loss_pct'].key)
      const hasStopLossValue = [...conditionLeaves, ...effectLeaves]
        .filter(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['risk.stop_loss_pct'].key)
        .some(leaf => this.readNumericParam(leaf.params, 'valuePct') !== null || this.readNumericParam(leaf.params, 'pct') !== null)
      if (hasStopLossCondition && rule.phase !== 'exit') continue
      if (hasDrawdownBlock && !hasExplicitStopLoss && (hasStopLossCondition || hasStopLossEffect)) continue
      if ((hasStopLossCondition || hasStopLossEffect) && !hasStopLossValue) continue

      const normalizedEffects = allowShort
        ? sideScopedEffects
        : mapRuleEffectsByRole(sideScopedEffects, effect => this.removeShortActionEffect(effect))
      const signature = `${rule.phase}|${rule.sideScope}|${JSON.stringify(this.normalizeAtomExprForSignature(normalizedCondition))}|${JSON.stringify(listRuleEffects(normalizedEffects).map(effect => this.normalizeAtomExprForSignature(effect)))}`
      if (seen.has(signature)) continue
      seen.add(signature)
      next.push(
        normalizedEffects === rule.effects && normalizedCondition === rule.condition
          ? rule
          : {
              ...rule,
              sideScope: !allowShort && rule.sideScope === 'both' ? 'long' : rule.sideScope,
              condition: normalizedCondition,
              effects: normalizedEffects,
            },
      )
    }
    merged.rules = this.repairRelativeEntryPercentExitSideDrift(
      this.dropDuplicateLifecycleRules(
        this.dropDuplicateGridProgramRules(
          this.dropDuplicateExternalSignalLifecycleRules(
            this.dropRulesCoveredByStrongerComposite(next),
          ),
        ),
      ),
      userMessage,
    )
    this.clearLifecycleOnlyTopLevelPositionSizing(merged)
  }

  private repairRelativeEntryPercentExitSideDrift(
    rules: readonly SemanticRule[],
    userMessage: string,
  ): SemanticRule[] {
    const entrySide = this.inferSingleEntrySideFromRules(rules)
    if (!entrySide) return [...rules]

    const priceChangeKey = ATOM_CONTRACT_REGISTRY['price.percent_change'].key
    const stopLossKey = ATOM_CONTRACT_REGISTRY['risk.stop_loss_pct'].key
    const closeActionKey = entrySide === 'short'
      ? ATOM_CONTRACT_REGISTRY['action.close_short'].key
      : ATOM_CONTRACT_REGISTRY['action.close_long'].key

    const candidates = rules
      .map((rule, index) => ({ rule, index, evidence: this.readLifecycleEvidenceText(rule) }))
      .filter(({ rule, evidence }) => {
        if (rule.phase !== 'exit') return false
        if (!this.isRelativeEntryPercentCloseText(evidence ?? userMessage)) return false
        return collectAtomLeaves(rule.condition).some(leaf => leaf.key === priceChangeKey || leaf.key === stopLossKey)
      })
    if (candidates.length === 0) return [...rules]

    const groups = new Map<string, typeof candidates>()
    for (const candidate of candidates) {
      const key = candidate.evidence ?? '__user_message__'
      groups.set(key, [...(groups.get(key) ?? []), candidate])
    }

    let mutated = false
    const removeIndexes = new Set<number>()
    const replacements = new Map<number, SemanticRule>()

    for (const group of groups.values()) {
      const percentSource = group.find(({ rule }) => collectAtomLeaves(rule.condition).some(leaf => leaf.key === priceChangeKey))
      const riskSource = group.find(({ rule }) => collectAtomLeaves(rule.condition).some(leaf => leaf.key === stopLossKey))
      const source = percentSource ?? riskSource
      if (!source) continue
      const percent = this.readRelativeEntryPercentExitValue(source.rule)
      if (percent === null) continue

      const direction = this.readRelativeEntryPercentExitDirection(source.rule, source.evidence ?? userMessage, entrySide)
      const valuePct = direction === 'down' ? -Math.abs(percent) : Math.abs(percent)
      const repairedCondition: AtomExprAtom = {
        kind: 'atom',
        key: priceChangeKey,
        params: {
          ...(collectAtomLeaves(source.rule.condition).find(leaf => leaf.key === priceChangeKey)?.params ?? {}),
          basis: 'entry_avg_price',
          direction,
          valuePct,
        },
        ...(source.evidence ? { evidence: { text: source.evidence } } : {}),
      }
      const repairedRule: SemanticRule = {
        ...source.rule,
        sideScope: entrySide,
        condition: repairedCondition,
        effects: this.appendTypedRuleEffects(
          this.emptyRuleEffects(),
          [{ kind: 'atom', key: closeActionKey, params: {} }],
        ),
      }

      replacements.set(source.index, repairedRule)
      for (const candidate of group) {
        if (candidate.index !== source.index) removeIndexes.add(candidate.index)
      }
      mutated = true
    }

    if (!mutated) return [...rules]
    return rules
      .map((rule, index) => replacements.get(index) ?? rule)
      .filter((_rule, index) => !removeIndexes.has(index))
  }

  private inferSingleEntrySideFromRules(rules: readonly SemanticRule[]): 'long' | 'short' | null {
    let hasOpenLong = false
    let hasOpenShort = false
    for (const rule of rules) {
      if (rule.phase !== 'entry') continue
      const effectKeys = listRuleEffects(rule.effects)
        .flatMap(effect => collectAtomLeaves(effect))
        .map(leaf => leaf.key)
      hasOpenLong ||= effectKeys.includes(ATOM_CONTRACT_REGISTRY['action.open_long'].key)
      hasOpenShort ||= effectKeys.includes(ATOM_CONTRACT_REGISTRY['action.open_short'].key)
    }
    if (hasOpenShort && !hasOpenLong) return 'short'
    if (hasOpenLong && !hasOpenShort) return 'long'
    return null
  }

  private readLifecycleEvidenceText(rule: SemanticRule): string | null {
    return this.readEvidenceText(rule)
      ?? collectAtomLeaves(rule.condition).map(leaf => this.readEvidenceText(leaf)).find((text): text is string => text !== null)
      ?? listRuleEffects(rule.effects)
        .flatMap(effect => collectAtomLeaves(effect))
        .map(leaf => this.readEvidenceText(leaf))
        .find((text): text is string => text !== null)
      ?? null
  }

  private isRelativeEntryPercentCloseText(text: string): boolean {
    return /(?:相对|基于|按|从)?(?:入场价|入场均价|开仓价|entry(?:\s+avg)?\s+price)/iu.test(text)
      && /(?:下跌|上涨|跌|涨|回撤|盈利|亏损|%)\D{0,12}(?:平仓|平多|平空|止盈|退出|close)/iu.test(text)
  }

  private readRelativeEntryPercentExitValue(rule: SemanticRule): number | null {
    const leaf = collectAtomLeaves(rule.condition).find(atom =>
      atom.key === ATOM_CONTRACT_REGISTRY['price.percent_change'].key
      || atom.key === ATOM_CONTRACT_REGISTRY['risk.stop_loss_pct'].key,
    )
    if (!leaf) return null
    const value = this.readNumericParam(leaf.params, 'valuePct')
      ?? this.readNumericParam(leaf.params, 'pct')
      ?? this.readNumericParam(leaf.params, 'thresholdPct')
    return value === null ? null : Math.abs(value)
  }

  private readRelativeEntryPercentExitDirection(
    rule: SemanticRule,
    text: string,
    entrySide: 'long' | 'short',
  ): 'up' | 'down' {
    const priceLeaf = collectAtomLeaves(rule.condition).find(atom => atom.key === ATOM_CONTRACT_REGISTRY['price.percent_change'].key)
    const direction = this.readStringParam(priceLeaf?.params, 'direction')
    if (direction === 'down' || direction === 'decrease' || direction === 'loss') return 'down'
    if (direction === 'up' || direction === 'increase' || direction === 'profit') return 'up'
    if (/下跌|跌破|跌|回撤|亏损|loss/iu.test(text)) return 'down'
    if (/上涨|涨破|涨|盈利|止盈|profit/iu.test(text)) return 'up'
    return entrySide === 'short' ? 'down' : 'up'
  }

  private clearLifecycleOnlyTopLevelPositionSizing(merged: InternalPlannerPatch): void {
    void merged
  }

  private pruneIntrinsicRuleNoise(merged: InternalPlannerPatch): void {
    const rules = merged.rules
    if (!rules?.length) return
    const next = rules.map((rule) => {
      const conditionInitial = this.normalizeRuleConditionNoise(rule.condition, '')
      const effectsInitial = this.normalizeRuleEffectsNoise(rule.effects, conditionInitial)
      const condition = this.repairConditionFromEffects(conditionInitial, effectsInitial)
      return {
        ...rule,
        condition,
        effects: this.removeContradictorySideActionEffects(
          this.dedupeRuleEffects(effectsInitial),
          rule.phase,
          rule.sideScope,
        ),
      }
    })
    merged.rules = this.dropDuplicateLifecycleRules(
      this.dropDuplicateGridProgramRules(
        this.dropDuplicateExternalSignalLifecycleRules(
          this.dropRulesCoveredByStrongerComposite(next),
        ),
      ),
    )
  }

  private dropDuplicateExternalSignalLifecycleRules(rules: readonly SemanticRule[]): SemanticRule[] {
    const bySignature = new Map<string, { index: number, rule: SemanticRule, score: number }>()
    const kept: Array<SemanticRule | null> = []

    for (const rule of rules) {
      const signature = this.externalSignalLifecycleSignature(rule)
      if (!signature) {
        kept.push(rule)
        continue
      }
      const score = this.externalSignalRuleStrength(rule)
      const existing = bySignature.get(signature)
      if (!existing) {
        bySignature.set(signature, { index: kept.length, rule, score })
        kept.push(rule)
        continue
      }
      if (score > existing.score) {
        kept[existing.index] = rule
        bySignature.set(signature, { index: existing.index, rule, score })
      }
    }

    return kept.filter((rule): rule is SemanticRule => rule !== null)
  }

  private externalSignalLifecycleSignature(rule: SemanticRule): string | null {
    const conditionLeaves = collectAtomLeaves(rule.condition)
    if (!conditionLeaves.some(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['external.signal'].key)) return null
    const actionKeys = this.lifecycleActionKeys(rule)
    if (actionKeys.size === 0) return null
    return [rule.phase, rule.sideScope, [...actionKeys].sort().join(',')].join('|')
  }

  private externalSignalRuleStrength(rule: SemanticRule): number {
    const signal = collectAtomLeaves(rule.condition).find(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['external.signal'].key)
    const signalId = this.readStringParam(signal?.params, 'signalId')
    if (!signalId) return 0
    if (/^(?:TBD|REQUIRED_SIGNAL_ID|openSlots)$/iu.test(signalId)) return 1
    return 2
  }

  private repairMissingRsiReclaimSequence(
    condition: AtomExpr,
    userMessage: string,
    rule: SemanticRule,
  ): AtomExpr {
    if (rule.phase !== 'entry') return condition
    const leaves = collectAtomLeaves(condition)
    const existingRsiReclaim = leaves.find(leaf =>
      leaf.key === ATOM_CONTRACT_REGISTRY['condition.sequence'].key
      && leaf.params?.sequenceKind === 'rsi_reclaim',
    )
    if (existingRsiReclaim) {
      return this.isRsiReclaimWithOnlyRsiThresholdNoise(leaves, existingRsiReclaim)
        ? existingRsiReclaim
        : condition
    }
    // 无 sequence atom，但 planner 直出 `and(rsi cross_over(T), rsi_lte(T))`：
    // cross_over 已含「上一根在阈值另一侧、当前上穿」语义，同 bar 再 AND rsi_lte(T)
    // 恒为矛盾（当前需同时 ≤T 且 >T）→ 永不触发。塌缩为单独 cross_over（可执行 reclaim）。
    // 仅同阈值才判矛盾：cross_over(38) AND rsi_lte(50) 是合法过滤，不可误删。
    const rsiCrossOver = leaves.find(leaf =>
      leaf.key === ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key
      && this.readStringParam(leaf.params, 'indicator') === 'rsi',
    )
    if (rsiCrossOver) {
      const crossThreshold = this.readRsiThreshold(rsiCrossOver)
      const others = leaves.filter(leaf => leaf !== rsiCrossOver)
      const allContradictoryNoise = others.length > 0 && others.every(leaf =>
        this.isRsiThresholdComparatorLeaf(leaf)
        && crossThreshold !== null
        && this.readRsiThreshold(leaf) === crossThreshold,
      )
      if (allContradictoryNoise) return rsiCrossOver
    }
    if (!/RSI/iu.test(userMessage)) return condition
    if (!/跌破|低于|下方/iu.test(userMessage)) return condition
    if (!/重新上穿|上穿|回到|重新站上/iu.test(userMessage)) return condition
    const threshold = this.extractRsiReclaimThreshold(userMessage)
    if (threshold === null) return condition
    const period = this.extractRsiPeriod(userMessage) ?? 14
    const sequence: AtomExprAtom = {
      kind: 'atom',
      key: ATOM_CONTRACT_REGISTRY['condition.sequence'].key,
      params: {
        sequenceKind: 'rsi_reclaim',
        indicator: 'rsi',
        period,
        threshold,
        value: threshold,
      },
      sideScope: rule.sideScope,
      evidence: { text: userMessage },
    }
    if (this.isStandaloneRsiReclaimNoiseCondition(condition)) return sequence
    return {
      kind: 'and',
      children: [condition, sequence],
    }
  }

  private isRsiReclaimWithOnlyRsiThresholdNoise(
    leaves: ReadonlyArray<AtomExprAtom>,
    sequence: AtomExprAtom,
  ): boolean {
    const otherLeaves = leaves.filter(leaf => leaf !== sequence)
    if (otherLeaves.length === 0) return false
    return otherLeaves.every(leaf => this.isRsiReclaimThresholdNoiseLeaf(leaf))
  }

  // 纯 RSI 阈值比较叶子——与 rsi cross_over 同 bar AND 时是矛盾噪音。
  // 兼容两类 atom key：oscillator.rsi_lte/gte 与 indicator.threshold_lte/gte(indicator=rsi)，
  // 与 isRsiReclaimThresholdNoiseLeaf 的识别口径一致。
  private isRsiThresholdComparatorLeaf(leaf: AtomExprAtom): boolean {
    if (
      leaf.key === ATOM_CONTRACT_REGISTRY['oscillator.rsi_lte'].key
      || leaf.key === ATOM_CONTRACT_REGISTRY['oscillator.rsi_gte'].key
    ) {
      return true
    }
    if (leaf.key !== 'indicator.threshold_lte' && leaf.key !== 'indicator.threshold_gte') {
      return false
    }
    return this.readStringParam(leaf.params, 'indicator') === 'rsi'
  }

  // RSI 比较/穿越叶子的阈值：兼容 value / threshold 两种 param 命名。
  private readRsiThreshold(leaf: AtomExprAtom): number | null {
    return this.readNumericParam(leaf.params, 'value')
      ?? this.readNumericParam(leaf.params, 'threshold')
  }

  private isRsiReclaimThresholdNoiseLeaf(leaf: AtomExprAtom): boolean {
    if (
      leaf.key === ATOM_CONTRACT_REGISTRY['oscillator.rsi_lte'].key
      || leaf.key === ATOM_CONTRACT_REGISTRY['oscillator.rsi_gte'].key
    ) {
      return true
    }
    if (
      leaf.key !== ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key
      && leaf.key !== 'indicator.threshold_lte'
      && leaf.key !== 'indicator.threshold_gte'
    ) {
      return false
    }
    return this.readStringParam(leaf.params, 'indicator') === 'rsi'
  }

  private extractRsiReclaimThreshold(text: string): number | null {
    const match = /RSI\s*(?:\d{1,3})?.{0,20}?(?:跌破|低于|下方)\s*(\d+(?:\.\d+)?).{0,30}?(?:重新上穿|上穿回|上穿|回到|重新站上)\s*(\d+(?:\.\d+)?)/iu.exec(text)
      ?? /RSI\s*(?:\d{1,3})?.{0,20}?(\d+(?:\.\d+)?)\s*(?:下方|以下|之下).{0,30}?(?:重新上穿|上穿回|上穿|回到|重新站上)\s*(\d+(?:\.\d+)?)/iu.exec(text)
    const first = match?.[1] ? Number(match[1]) : Number.NaN
    const second = match?.[2] ? Number(match[2]) : Number.NaN
    if (Number.isFinite(first) && Number.isFinite(second) && Math.abs(first - second) <= 1e-9) return first
    if (Number.isFinite(first) && !Number.isFinite(second)) return first
    return null
  }

  private isStandaloneRsiReclaimNoiseCondition(condition: AtomExpr): boolean {
    if (condition.kind !== 'atom') return false
    if (
      condition.key === ATOM_CONTRACT_REGISTRY['oscillator.rsi_lte'].key
      || condition.key === ATOM_CONTRACT_REGISTRY['oscillator.rsi_gte'].key
    ) {
      return true
    }
    if (condition.key !== ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key) return false
    return this.readStringParam(condition.params, 'indicator') === 'rsi'
  }

  private hydrateExplicitMacdTupleFromText(
    merged: InternalPlannerPatch,
    userMessage: string,
  ): void {
    const tuple = this.extractExplicitMacdTuple(userMessage)
    const rules = merged.rules
    if (!tuple || !rules?.length) return
    let mutated = false
    merged.rules = rules.map((rule) => {
      const condition = this.mapAtomExpr(rule.condition, (atom) => {
        if (
          atom.key !== ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key
          && atom.key !== ATOM_CONTRACT_REGISTRY['indicator.cross_under'].key
        ) return atom
        if (this.readStringParam(atom.params, 'indicator') !== 'macd') return atom
        const fastPeriod = this.readNumericParam(atom.params, 'fastPeriod')
        const slowPeriod = this.readNumericParam(atom.params, 'slowPeriod')
        const signalPeriod = this.readNumericParam(atom.params, 'signalPeriod')
        const hasExplicitTuple = fastPeriod !== null && slowPeriod !== null && signalPeriod !== null
        const alreadyMatches = fastPeriod === tuple.fastPeriod && slowPeriod === tuple.slowPeriod && signalPeriod === tuple.signalPeriod
        if (alreadyMatches) return atom
        const isDefaultTuple = fastPeriod === 12 && slowPeriod === 26 && signalPeriod === 9
        if (hasExplicitTuple && !isDefaultTuple) return atom
        mutated = true
        return {
          ...atom,
          params: {
            ...(atom.params ?? {}),
            indicator: 'macd',
            fastPeriod: tuple.fastPeriod,
            slowPeriod: tuple.slowPeriod,
            signalPeriod: tuple.signalPeriod,
          },
        }
      })
      return condition === rule.condition ? rule : { ...rule, condition }
    })
    if (!mutated) return
  }

  private extractExplicitMacdTuple(text: string): { fastPeriod: number, slowPeriod: number, signalPeriod: number } | null {
    const match = /MACD\s*(\d{1,3})\s*[\/／]\s*(\d{1,3})\s*[\/／]\s*(\d{1,3})/iu.exec(text)
    if (!match) return null
    const fastPeriod = Number(match[1])
    const slowPeriod = Number(match[2])
    const signalPeriod = Number(match[3])
    if (!Number.isFinite(fastPeriod) || !Number.isFinite(slowPeriod) || !Number.isFinite(signalPeriod)) return null
    return { fastPeriod, slowPeriod, signalPeriod }
  }

  private hydrateExplicitPercentRisksFromText(
    merged: InternalPlannerPatch,
    userMessage: string,
  ): void {
    const rules = merged.rules
    if (!rules?.length) return
    const additions = this.extractExplicitPercentRiskEffects(userMessage)
    if (additions.length === 0) return
    let mutated = false
    const entryRiskKeys = new Set<string>()
    const nextRules = rules.map((rule) => {
      if (rule.phase !== 'entry' || !this.ruleHasOpenAction(rule)) return rule
      const existingKeys = new Set(
        listRuleEffects(rule.effects)
          .flatMap(effect => collectAtomLeaves(effect))
          .map(leaf => leaf.key),
      )
      const explicitKeys = new Set(additions.map(addition => addition.key))
      const missing = additions.filter(addition => !existingKeys.has(addition.key))
      const replacing = additions.filter(addition => existingKeys.has(addition.key))
      if (missing.length === 0 && replacing.length === 0) return rule
      for (const addition of additions) entryRiskKeys.add(addition.key)
      mutated = true
      const effects = replacing.length > 0
        ? this.removeTypedRuleEffectAtoms(rule.effects, explicitKeys)
        : rule.effects
      return {
        ...rule,
        effects: this.appendTypedRuleEffects(effects, [...replacing, ...missing]),
      }
    })
    if (!mutated) return
    merged.rules = nextRules
      .map((rule): SemanticRule | null => {
        if (rule.phase === 'gate') {
          const effects = listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect))
          const hasOnlyRiskEffects = effects.length > 0 && effects.every(leaf => entryRiskKeys.has(leaf.key))
          return hasOnlyRiskEffects ? null : rule
        }
        if (rule.phase !== 'exit') return rule
        const conditionLeaves = collectAtomLeaves(rule.condition)
        if (!conditionLeaves.some(leaf => entryRiskKeys.has(leaf.key))) return rule
        if (this.closeActionSet(rule).size === 0) return rule
        // 出场 condition 含已迁移到入场 effect 的止盈止损 risk 叶子：剥掉这些冗余 risk 叶子，
        // 保留 cross_under 等真实信号出场，避免把死叉平多这类信号式出场连带删除。
        // 剥离后 condition 为空（纯风控冗余出场）才删除整条 rule。
        const strippedCondition = this.filterAtomExpr(rule.condition, leaf => entryRiskKeys.has(leaf.key))
        if (!strippedCondition) return null
        return { ...rule, condition: strippedCondition }
      })
      .filter((rule): rule is SemanticRule => rule !== null)
  }

  /**
   * Generic add_position hydration (#1633 staging s29 follow-up).
   *
   * 触发条件（不依赖 per-case 关键词）：
   *   - rule.phase === 'entry'
   *   - rule.condition 叶子含 `price.percent_change` 且 params.basis === 'entry_avg_price'
   *     （= 仓位相对盈利触发，typical "盈利 X% 后加仓" 语义）
   *   - rule.effects.positions 含 `position.pyramiding_limit`
   *   - rule.effects.actions 不含 `action.add_position`（避免重复）
   *
   * 行为：
   *   1. 从 userMessage 提取 `加仓\s*N%` → addPercent（百分比数）
   *   2. 同步覆盖 pyramiding_limit.params.layerSizing = addPercent（让 paramSlot
   *      kind:'percent' 渲染 → "金字塔加仓限制（M，N%）"）
   *   3. 追加 `action.add_position` effect，addMode='profit_pct'，
   *      profitThreshold=condition.valuePct，addRatio=addPercent/100，
   *      sizing={kind:'ratio',unit:'ratio',value:addRatio}
   *      → canonical-spec-builder 折叠到 DECISION_PROGRAMS metadata.addPosition
   *      → staging30 report 通过 addCompiledAddPositionTokens 自动 emit
   *        take_profit + ${profitPct}% + ${ratioPct}% tokens
   *
   * Fail-open：任何步骤缺数据（无 N%、无 valuePct、无 pyramiding）则直接 return，
   *   不破坏现有 rule。
   */
  private hydrateLifecycleAddPositionFromText(
    merged: InternalPlannerPatch,
    userMessage: string,
  ): void {
    const rules = merged.rules
    if (!rules?.length) return

    // 提取 "加仓 N%"（generic：百分比仓位补仓比例）。
    const addPercentMatch = /(?:加仓|补仓|scale\s*in)\D{0,8}(\d+(?:\.\d+)?)\s*%/iu.exec(userMessage)
    if (!addPercentMatch?.[1]) return
    const addPercent = Number(addPercentMatch[1])
    if (!Number.isFinite(addPercent) || addPercent <= 0 || addPercent > 100) return
    const addRatio = addPercent / 100

    const pyramidingKey = ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].key
    const priceChangeKey = ATOM_CONTRACT_REGISTRY['price.percent_change'].key
    let mutated = false

    const nextRules = rules.map((rule) => {
      if (rule.phase !== 'entry') return rule
      const conditionLeaves = collectAtomLeaves(rule.condition)
      const profitLeaf = conditionLeaves.find((leaf) => {
        if (leaf.key !== priceChangeKey) return false
        const basis = (leaf.params as Record<string, unknown> | undefined)?.basis
        return basis === 'entry_avg_price'
      })
      if (!profitLeaf) return rule

      // Guard：condition 必须是「纯盈利触发」——只能含 price.percent_change 叶子。
      // 若 condition 还包含 indicator.*（如 MA/EMA 突破）或 volume.*（如成交量放量）
      // 等指标语义，说明这是「指标触发开仓 + pyramiding 上限」组合，不是「盈利后加仓」
      // 场景；强行注入 action.add_position 会让 take_profit/% token 覆盖原指标语义
      // 导致 indicator/volume 关键字在 R2 token 报告中缺失（#1633 s04/s18 回归）。
      if (conditionLeaves.some(leaf => leaf.key !== priceChangeKey)) return rule

      const effectAtoms = listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect))
      const pyramiding = effectAtoms.find(leaf => leaf.key === pyramidingKey)
      if (!pyramiding) return rule
      const hasAddAction = effectAtoms.some(leaf => leaf.key === ADD_POSITION_ATOM_KEY)
      if (hasAddAction) return rule
      // Guard：若 rule 已含 action.open_long / action.open_short（指标驱动开仓），
      // 同样跳过——pyramiding 在此仅作为开仓限制存在，不应被 hydration 改写。
      if (this.ruleHasOpenAction(rule)) return rule

      const profitParams = (profitLeaf.params ?? {}) as Record<string, unknown>
      const valuePct = typeof profitParams.valuePct === 'number' ? profitParams.valuePct : null
      if (valuePct === null || !Number.isFinite(valuePct) || valuePct <= 0) return rule

      // 1. 同步覆盖 pyramiding_limit.params.layerSizing = addPercent（修复 planner emits 0）
      const updatedEffects = this.overridePyramidingLayerSizing(rule.effects, pyramidingKey, addPercent)

      // 2. 追加 action.add_position effect
      const addAtom: AtomExprAtom = {
        kind: 'atom',
        key: ADD_POSITION_ATOM_KEY,
        params: {
          addMode: 'profit_pct',
          profitThreshold: valuePct,
          addRatio,
          sizing: { kind: 'ratio', unit: 'ratio', value: addRatio },
        },
        evidence: { text: addPercentMatch[0].trim() },
      }

      mutated = true
      return {
        ...rule,
        effects: this.appendTypedRuleEffects(updatedEffects, [addAtom]),
      }
    })

    if (!mutated) return
    merged.rules = nextRules
  }

  private overridePyramidingLayerSizing(
    effects: RuleEffects,
    pyramidingKey: string,
    layerSizingPct: number,
  ): RuleEffects {
    const rewriteAtom = (atom: AtomExpr): AtomExpr => {
      if (atom.kind !== 'atom' || atom.key !== pyramidingKey) return atom
      return {
        ...atom,
        params: { ...(atom.params ?? {}), layerSizing: layerSizingPct },
      }
    }
    if (isRuleEffectsByRole(effects)) {
      return {
        actions: effects.actions.map(rewriteAtom),
        risks: effects.risks.map(rewriteAtom),
        positions: effects.positions.map(rewriteAtom),
        orchestration: effects.orchestration.map(rewriteAtom),
        programs: effects.programs.map(rewriteAtom),
      }
    }
    return effects.map(rewriteAtom)
  }

  private ruleHasOpenAction(rule: SemanticRule): boolean {
    return listRuleEffects(rule.effects)
      .flatMap(effect => collectAtomLeaves(effect))
      .some(leaf =>
        leaf.key === ATOM_CONTRACT_REGISTRY['action.open_long'].key
        || leaf.key === ATOM_CONTRACT_REGISTRY['action.open_short'].key
        || leaf.key === ADD_POSITION_ATOM_KEY,
      )
  }

  private extractExplicitPercentRiskEffects(userMessage: string): AtomExprAtom[] {
    const out: AtomExprAtom[] = []
    const stopLoss = /(?:(?:止损|stop\s*loss)\D{0,12}(\d+(?:\.\d+)?)\s*%|(?:亏损|亏|loss)\D{0,12}(\d+(?:\.\d+)?)\s*%\D{0,12}(?:止损|平仓|退出|stop\s*loss))/iu.exec(userMessage)
    const takeProfit = /(?:止盈|take\s*profit)\D{0,12}(\d+(?:\.\d+)?)\s*%/iu.exec(userMessage)
      // 兼容「盈利/获利/收益 达到 X% 时卖出平仓」这类出场式止盈表述（区间低买高卖模板）。
      // 要求百分比后近距离出现平仓动词，排除「盈利 X% 后加仓」的 pyramiding 语义。
      ?? this.matchProfitExitTakeProfit(userMessage)
    const stopLossPct = stopLoss?.[1] ?? stopLoss?.[2]
    if (stopLossPct) {
      const valuePct = Number(stopLossPct)
      if (Number.isFinite(valuePct) && valuePct > 0) {
        out.push({
          kind: 'atom',
          key: ATOM_CONTRACT_REGISTRY['risk.stop_loss_pct'].key,
          params: { basis: 'entry_avg_price', valuePct },
          evidence: { text: stopLoss[0].trim() },
        })
      }
    }
    if (takeProfit?.[1]) {
      const valuePct = Number(takeProfit[1])
      if (Number.isFinite(valuePct) && valuePct > 0) {
        out.push({
          kind: 'atom',
          key: ATOM_CONTRACT_REGISTRY['risk.take_profit_pct'].key,
          params: { basis: 'entry_avg_price', valuePct },
          evidence: { text: takeProfit[0].trim() },
        })
      }
    }
    return out
  }

  // 「盈利/获利/收益 [达到|超过] X% [时] 卖出/平仓/清仓/出场」→ 出场式止盈百分比。
  // 强约束百分比后须紧跟平仓动词，避免与「盈利 X% 后加仓」pyramiding 语义混淆。
  private matchProfitExitTakeProfit(userMessage: string): RegExpExecArray | null {
    return /(?:盈利|获利|收益)(?:达到|超过|到|达)?\s*(\d+(?:\.\d+)?)\s*%[^，。,.；;]{0,12}?(?:卖出|平仓|清仓|出场|离场|止盈)/iu.exec(userMessage)
  }

  private extractRsiPeriod(text: string): number | null {
    const match = /RSI\s*(\d{1,3})/iu.exec(text)
    if (!match?.[1]) return null
    const value = Number(match[1])
    return Number.isFinite(value) ? value : null
  }

  private dedupeRuleEffects(effects: RuleEffects): RuleEffects {
    if (isRuleEffectsByRole(effects)) {
      const dedupeRole = (role: keyof RuleEffectsByRole): AtomExprAtom[] => {
        return this.dedupeFallbackEffects(this.asEffectAtoms(effects[role] ?? []))
      }
      return {
        actions: dedupeRole('actions'),
        risks: dedupeRole('risks'),
        positions: dedupeRole('positions'),
        orchestration: dedupeRole('orchestration'),
        programs: dedupeRole('programs'),
      }
    }
    return this.dedupeFallbackEffects(this.asEffectAtoms(effects))
  }

  private asEffectAtoms(effects: ReadonlyArray<AtomExpr>): AtomExprAtom[] {
    return effects.filter((effect): effect is AtomExprAtom => effect.kind === 'atom')
  }

  private normalizeRuleConditionNoise(
    condition: AtomExpr,
    userMessage: string,
  ): AtomExpr {
    const normalized = this.mapAtomExpr(condition, (atom) => {
      atom = this.normalizeAtomNoise(atom)
      if (atom.key === ATOM_CONTRACT_REGISTRY['price.percent_change'].key) {
        const basis = this.readStringParam(atom.params, 'basis')
        const valuePct = this.readNumericParam(atom.params, 'valuePct')
        const direction = this.readStringParam(atom.params, 'direction')
        if (basis === 'current_price' && valuePct === 0 && (direction === 'up' || direction === 'down')) {
          return {
            ...atom,
            key: ATOM_CONTRACT_REGISTRY['price.candle_pattern'].key,
            params: {
              pattern: direction === 'up' ? 'single_bull_bar' : 'single_bear_bar',
              direction: direction === 'up' ? 'bullish' : 'bearish',
              ...(this.readStringParam(atom.params, 'window') ? { timeframe: this.readStringParam(atom.params, 'window') } : {}),
            },
          }
        }
      }
      if (atom.key === ATOM_CONTRACT_REGISTRY['price.candle_pattern'].key) {
        const pattern = this.readStringParam(atom.params, 'pattern')
        const evidence = `${this.readEvidenceText(atom) ?? ''} ${userMessage}`
        if (pattern === 'consecutive_body') {
          const direction = this.readStringParam(atom.params, 'direction')
          const minBars = this.readNumericParam(atom.params, 'minBars')
          return {
            ...atom,
            params: {
              ...atom.params,
              ...(direction ? {} : { direction: /跌|阴|bear/iu.test(evidence) ? 'bearish' : 'bullish' }),
              ...(minBars !== null ? {} : { minBars: this.extractConsecutiveBars(evidence) ?? 3 }),
            },
          }
        }
      }
      return atom
    })
    return this.removeContradictoryBollingerBandNoise(normalized, userMessage)
  }

  private removeContradictoryBollingerBandNoise(condition: AtomExpr, userMessage: string): AtomExpr {
    if (condition.kind !== 'and') return condition
    const children = condition.children.filter(child => !this.isNoisyBollingerSiblingInAnd(child, condition.children, userMessage))
    if (children.length === condition.children.length) return condition
    if (children.length === 1) return children[0]!
    return { ...condition, children }
  }

  private isNoisyBollingerSiblingInAnd(candidate: AtomExpr, siblings: readonly AtomExpr[], userMessage: string): boolean {
    if (candidate.kind !== 'atom') return false
    const isUpper = candidate.key === ATOM_CONTRACT_REGISTRY['bollinger.touch_upper'].key
    const isLower = candidate.key === ATOM_CONTRACT_REGISTRY['bollinger.touch_lower'].key
    if (!isUpper && !isLower) return false
    const hasOppositeSibling = siblings.some(sibling =>
      sibling.kind === 'atom'
      && sibling.key === (isUpper ? ATOM_CONTRACT_REGISTRY['bollinger.touch_lower'].key : ATOM_CONTRACT_REGISTRY['bollinger.touch_upper'].key),
    )
    if (!hasOppositeSibling) return false

    const evidence = `${this.readEvidenceText(candidate) ?? ''} ${userMessage}`
    const mentionsLower = /下轨|lower/iu.test(evidence)
    const mentionsUpper = /上轨|upper/iu.test(evidence)
    if (isUpper && mentionsLower && !mentionsUpper) return true
    if (isLower && mentionsUpper && !mentionsLower) return true
    return false
  }

  private normalizeRuleEffectsNoise(
    effects: RuleEffects,
    condition: AtomExpr,
  ): RuleEffects {
    const conditionLeaves = collectAtomLeaves(condition)
    const normalize = (effect: AtomExpr): AtomExpr => this.mapAtomExpr(effect, atom => this.normalizeAtomNoise(atom))
    const normalized = isRuleEffectsByRole(effects)
      ? {
          actions: (effects.actions ?? []).map(normalize),
          risks: (effects.risks ?? []).map(normalize),
          positions: (effects.positions ?? []).map(normalize),
          orchestration: (effects.orchestration ?? []).map(normalize),
          programs: (effects.programs ?? []).map(normalize),
      }
      : effects.map(normalize)

    return this.removeRiskEffectsCoveredByExitCondition(
      this.removeOpenActionsCoveredByReversePosition(normalized),
      condition,
    )
  }

  private removeOpenActionsCoveredByReversePosition(effects: RuleEffects): RuleEffects {
    const openKeysCoveredByReverse = this.resolveOpenKeysCoveredByReversePosition(listRuleEffects(effects))
    if (openKeysCoveredByReverse.size === 0) return effects
    const isCoveredOpen = (effect: AtomExpr): boolean => effect.kind === 'atom' && openKeysCoveredByReverse.has(effect.key)
    if (isRuleEffectsByRole(effects)) {
      return {
        actions: effects.actions.filter(effect => !isCoveredOpen(effect)),
        risks: effects.risks,
        positions: effects.positions,
        orchestration: effects.orchestration,
        programs: effects.programs,
      }
    }
    return effects.filter(effect => !isCoveredOpen(effect))
  }

  private resolveOpenKeysCoveredByReversePosition(effects: ReadonlyArray<AtomExpr>): Set<string> {
    const covered = new Set<string>()
    for (const leaf of effects.flatMap(effect => collectAtomLeaves(effect))) {
      if (leaf.key !== ATOM_CONTRACT_REGISTRY['action.reverse_position'].key) continue
      const toSide = this.readStringParam(leaf.params, 'toSide')
      const fromSide = this.readStringParam(leaf.params, 'fromSide')
      const leafSideScope = typeof (leaf as { sideScope?: unknown }).sideScope === 'string'
        ? (leaf as { sideScope: string }).sideScope
        : null
      const inferredToSide = toSide ?? (leafSideScope === 'long' || leafSideScope === 'short'
        ? leafSideScope
        : fromSide === 'long'
          ? 'short'
          : fromSide === 'short'
            ? 'long'
            : null)
      if (inferredToSide === 'long') covered.add(ATOM_CONTRACT_REGISTRY['action.open_long'].key)
      if (inferredToSide === 'short') covered.add(ATOM_CONTRACT_REGISTRY['action.open_short'].key)
    }
    return covered
  }

  private removeRiskEffectsCoveredByExitCondition(
    effects: RuleEffects,
    condition: AtomExpr,
  ): RuleEffects {
    const conditionLeaves = collectAtomLeaves(condition)
    const isRedundantRisk = (effect: AtomExpr): boolean => {
      const leaves = collectAtomLeaves(effect)
      return leaves.some(effectLeaf =>
        conditionLeaves.some(conditionLeaf =>
          this.riskPercentChangeRepresentsRisk(conditionLeaf, effectLeaf),
        ),
      )
    }
    if (isRuleEffectsByRole(effects)) {
      return {
        actions: effects.actions,
        risks: effects.risks.filter(effect => !isRedundantRisk(effect)),
        positions: effects.positions,
        orchestration: effects.orchestration,
        programs: effects.programs,
      }
    }
    return effects.filter(effect => !isRedundantRisk(effect))
  }

  private repairConditionFromEffects(
    condition: AtomExpr,
    effects: RuleEffects,
  ): AtomExpr {
    const conditionLeaves = collectAtomLeaves(condition)
    if (!conditionLeaves.some(leaf => leaf.key === 'volatility.atr_threshold')) return condition
    const atrTakeProfit = listRuleEffects(effects)
      .flatMap(effect => collectAtomLeaves(effect))
      .find(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['risk.atr_take_profit'].key)
    if (!atrTakeProfit) return condition
    return {
      kind: 'atom',
      key: ATOM_CONTRACT_REGISTRY['risk.atr_take_profit'].key,
      params: atrTakeProfit.params ?? {},
      ...(atrTakeProfit.evidence ? { evidence: atrTakeProfit.evidence } : {}),
    }
  }

  private repairLifecycleConditionNoise(
    condition: AtomExpr,
    effectLeaves: readonly AtomExprAtom[],
  ): AtomExpr {
    const hasDcaSchedule = effectLeaves.some(leaf => leaf.key === DCA_SCHEDULE_ATOM_KEY)
    if (!hasDcaSchedule || condition.kind !== 'atom') return condition
    if (
      condition.key !== ATOM_CONTRACT_REGISTRY['position.has_position'].key
      && condition.key !== ATOM_CONTRACT_REGISTRY['position.no_position'].key
    ) {
      return condition
    }
    return {
      kind: 'atom',
      key: EXECUTION_ON_START_ATOM_KEY,
      params: { timing: 'on_start', orderType: 'market', occurrence: 'once' },
      ...(condition.evidence ? { evidence: condition.evidence } : {}),
    }
  }

  private isEmptyPositionPresenceGateRule(
    rule: SemanticRule,
    conditionLeaves: readonly AtomExprAtom[],
    effectLeaves: readonly AtomExprAtom[],
  ): boolean {
    if (rule.phase !== 'gate' || effectLeaves.length > 0) return false
    return conditionLeaves.some(leaf =>
      leaf.key === ATOM_CONTRACT_REGISTRY['position.has_position'].key
      || leaf.key === ATOM_CONTRACT_REGISTRY['position.no_position'].key
      || leaf.key === ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].key,
    )
  }

  private normalizeAtomNoise(atom: AtomExprAtom): AtomExprAtom {
    const params = { ...(atom.params ?? {}) }
    delete params.phase
    delete params.timeframeOverride
    if (atom.key === ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key || atom.key === ATOM_CONTRACT_REGISTRY['indicator.cross_under'].key) {
      if (params.indicator === 'macd') {
        if (params.value === 0) delete params.value
        if (params.period === 0) delete params.period
      }
      else if (this.isMovingAverageIndicator(params.indicator)) {
        const period = this.readNumericParam(params, 'period') ?? this.readNumericParam(params, 'value')
        const fastPeriod = this.readNumericParam(params, 'fastPeriod')
        const slowPeriod = this.readNumericParam(params, 'slowPeriod')
        const hasSinglePeriod = period !== null && period > 0
        const hasMissingSlowPeriod = slowPeriod === null || slowPeriod === 0
        const hasSinglePeriodShape = hasMissingSlowPeriod && (fastPeriod === null || fastPeriod === 0 || fastPeriod === period)
        if (hasSinglePeriod && hasSinglePeriodShape) {
          params.priceCross = true
          params.period = period
          params.fastPeriod = period
          delete params.slowPeriod
          delete params.value
          if (params.signalPeriod === 0) delete params.signalPeriod
        }
      }
    }
    return { ...atom, params }
  }

  private extractExplicitPositionSizingFromText(text: string): {
    sizing:
      | { kind: 'ratio', unit: 'ratio', value: number }
      | { kind: 'quote', asset: 'USDT' | 'USDC' | 'USD', value: number }
      | { kind: 'base', asset: string, value: number }
    evidenceText: string
  } | null {
    const normalized = text.trim().replace(/\s+/gu, ' ').replace(/％/gu, '%')
    if (!normalized) return null
    type Candidate = {
      sizing:
        | { kind: 'ratio', unit: 'ratio', value: number }
        | { kind: 'quote', asset: 'USDT' | 'USDC' | 'USD', value: number }
        | { kind: 'base', asset: string, value: number }
      evidenceText: string
      score: number
      index: number
    }
    const riskNoise = /止损|止盈|亏损|盈利|收益|ATR|atr|回撤|熔断/u
    const lifecycleSizingNoise = /(?:DCA|dca|定投|加投|加仓|补仓|回撤)/u
    const exitPriceChangeNoise = /(?:上涨|下跌|涨|跌|突破|跌破|回落|回到|低于|高于|触及|相对入场均价).{0,12}(?:卖出|平仓|平多|平空|退出|止损|止盈)/u
    if (lifecycleSizingNoise.test(normalized) || exitPriceChangeNoise.test(normalized)) return null
    const candidates: Candidate[] = []
    const pushCandidate = (candidate: Candidate): void => {
      if (!Number.isFinite(candidate.sizing.value) || candidate.sizing.value <= 0) return
      const evidence = candidate.evidenceText
      const numberOffset = evidence.search(/\d/u)
      const beforeNumber = numberOffset >= 0 ? evidence.slice(0, numberOffset) : evidence
      if (riskNoise.test(beforeNumber)) return
      candidates.push(candidate)
    }
    const percentPatterns = [
      { re: /(?:单笔|每次|每笔|每单)\s*(?:使用|用|投入)?\s*(?:账户权益|账户资金|资金|仓位)?(?:的)?\s*(?:(?:百分之?|百分)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*%)(?:\s*资金)?/giu, score: 120 },
      { re: /(?:单笔|每次|每笔|每单)?\s*(?:仓位|固定仓位|资金|账户权益|账户资金)(?:的)?\s*(?:为|是|=|:|：)?\s*(?:(?:百分之?|百分)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*%)(?:\s*资金)?/giu, score: 110 },
      { re: /(?:使用|用|投入)\s*(?:账户权益|账户资金|资金)(?:的)?\s*(?:(?:百分之?|百分)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*%)(?:\s*资金)?/giu, score: 90 },
    ]
    for (const { re, score } of percentPatterns) {
      for (const match of normalized.matchAll(re)) {
        const value = Number(match[1] ?? match[2])
        if (!Number.isFinite(value) || value <= 0 || value > 100) continue
        pushCandidate({
          sizing: { kind: 'ratio', unit: 'ratio', value: value / 100 },
          evidenceText: match[0].trim(),
          score,
          index: match.index ?? normalized.length,
        })
      }
    }
    const quotePatterns = [
      { re: /(?:单笔|每次|每笔|每单|每格)\s*(?:使用|用|投入)?\s*(?:资金|仓位)?(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*(USDT|USDC|USD|U|刀|美元)/giu, score: 120 },
      { re: /(?:仓位|资金|固定仓位)(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*(USDT|USDC|USD|U|刀|美元)/giu, score: 100 },
    ]
    for (const { re, score } of quotePatterns) {
      for (const match of normalized.matchAll(re)) {
        const value = Number(match[1])
        if (!Number.isFinite(value) || value <= 0) continue
        const rawAsset = match[2].toUpperCase()
        const asset = rawAsset === 'USDC' ? 'USDC' : rawAsset === 'USD' ? 'USD' : 'USDT'
        pushCandidate({
          sizing: { kind: 'quote', asset, value },
          evidenceText: match[0].trim(),
          score,
          index: match.index ?? normalized.length,
        })
      }
    }
    candidates.sort((a, b) => b.score - a.score || a.index - b.index)
    if (candidates[0]) {
      const { score: _score, index: _index, ...result } = candidates[0]
      return result
    }
    return null
  }

  private removeUnsupportedEffectNoise(
    effects: RuleEffects,
    conditionLeaves: ReadonlyArray<AtomExprAtom>,
    hasAtrIntent: boolean,
  ): RuleEffects {
    const allEffectLeaves = listRuleEffects(effects).flatMap(effect => collectAtomLeaves(effect))
    const hasFixedGridProgramEffect = allEffectLeaves.some(leaf =>
      leaf.key === ATOM_CONTRACT_REGISTRY['program.fixed_grid_gated'].key,
    )
    const hasFixedRangeGridCondition = conditionLeaves.some(leaf =>
      leaf.key === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key
      && (
        (this.readNumericParam(leaf.params, 'rangeLower') !== null && this.readNumericParam(leaf.params, 'rangeUpper') !== null)
        || this.readNumericParam(leaf.params, 'centerOffsetPct') !== null
      ),
    )
    const shouldRemove = (leaf: AtomExprAtom): boolean => {
      if (!hasAtrIntent && leaf.key === ATOM_CONTRACT_REGISTRY['risk.atr_take_profit'].key) return true
      if ((hasFixedRangeGridCondition || hasFixedGridProgramEffect) && leaf.key === ATOM_CONTRACT_REGISTRY['program.dynamic_grid'].key) return true
      return false
    }
    const filterExpr = (effect: AtomExpr): AtomExpr | null => this.filterAtomExpr(effect, shouldRemove)
    if (isRuleEffectsByRole(effects)) {
      const filterRole = (role: keyof RuleEffectsByRole): AtomExpr[] => {
        return (effects[role] ?? []).map(filterExpr).filter((effect): effect is AtomExpr => effect !== null)
      }
      return {
        actions: filterRole('actions'),
        risks: filterRole('risks'),
        positions: filterRole('positions'),
        orchestration: filterRole('orchestration'),
        programs: filterRole('programs'),
      }
    }
    return effects.map(filterExpr).filter((effect): effect is AtomExpr => effect !== null)
  }

  private removeContradictorySideActionEffects(
    effects: RuleEffects,
    phase: SemanticRule['phase'],
    sideScope: SemanticRule['sideScope'],
  ): RuleEffects {
    if (sideScope === 'both' || phase === 'gate' || phase === 'program') return effects
    const banned = new Set<string>()
    if (sideScope === 'long') {
      banned.add(ATOM_CONTRACT_REGISTRY['action.open_short'].key)
      banned.add(ATOM_CONTRACT_REGISTRY['action.close_short'].key)
    }
    else {
      banned.add(ATOM_CONTRACT_REGISTRY['action.open_long'].key)
      banned.add(ATOM_CONTRACT_REGISTRY['action.close_long'].key)
    }
    const filterExpr = (effect: AtomExpr): AtomExpr | null => this.filterAtomExpr(effect, leaf =>
      this.readAtomBucket(leaf.key) === 'action' && banned.has(leaf.key),
    )
    if (isRuleEffectsByRole(effects)) {
      const filterRole = (role: keyof RuleEffectsByRole): AtomExpr[] => {
        return (effects[role] ?? []).map(filterExpr).filter((effect): effect is AtomExpr => effect !== null)
      }
      return {
        actions: filterRole('actions'),
        risks: filterRole('risks'),
        positions: filterRole('positions'),
        orchestration: filterRole('orchestration'),
        programs: filterRole('programs'),
      }
    }
    return effects.map(filterExpr).filter((effect): effect is AtomExpr => effect !== null)
  }

  private dropDuplicateGridProgramRules(rules: readonly SemanticRule[]): SemanticRule[] {
    const bestByGridSignature = new Map<string, SemanticRule>()
    const passthrough: SemanticRule[] = []
    for (const rule of rules) {
      const conditionLeaves = collectAtomLeaves(rule.condition)
      if (
        rule.phase !== 'program'
        || !conditionLeaves.some(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key)
      ) {
        passthrough.push(rule)
        continue
      }
      const signature = conditionLeaves
        .filter(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key)
        .map(leaf => this.gridRangeSignature(leaf))
        .sort()
        .join('|')
      const existing = bestByGridSignature.get(signature)
      if (!existing || this.ruleCompletenessScore(rule) > this.ruleCompletenessScore(existing)) {
        bestByGridSignature.set(signature, rule)
      }
    }
    return [...passthrough, ...bestByGridSignature.values()]
  }

  private gridRangeSignature(leaf: AtomExprAtom): string {
    const lower = this.readNumericParam(leaf.params, 'rangeLower') ?? this.readNumericParam(leaf.params, 'lowerBound')
    const upper = this.readNumericParam(leaf.params, 'rangeUpper') ?? this.readNumericParam(leaf.params, 'upperBound')
    const sideMode = this.readStringParam(leaf.params, 'sideMode') ?? 'both'
    return `${lower ?? ''}|${upper ?? ''}|${sideMode}`
  }

  private ruleCompletenessScore(rule: SemanticRule): number {
    const leaves = [
      ...collectAtomLeaves(rule.condition),
      ...listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect)),
    ]
    return leaves.reduce((score, leaf) => score + Object.keys(leaf.params ?? {}).length, 0)
      + listRuleEffects(rule.effects).length * 10
  }

  private dropDuplicateLifecycleRules(rules: readonly SemanticRule[]): SemanticRule[] {
    const out: SemanticRule[] = []
    for (const rule of rules) {
      const conditionLeaves = collectAtomLeaves(rule.condition)
      const closeActions = this.closeActionSet(rule)
      if (conditionLeaves.length > 0 && closeActions.size > 0) {
        const existingIndex = out.findIndex(existing =>
          existing.phase === rule.phase
          && this.sideScopesCompatible(existing.sideScope, rule.sideScope)
          && this.closeActionSet(existing).size > 0
          && this.conditionsRepresentSameLifecycle(existing, rule),
        )
        if (existingIndex >= 0) {
          const existing = out[existingIndex]
          if (this.closeActionSet(existing).size < closeActions.size) out[existingIndex] = rule
          continue
        }
      }
      out.push(rule)
    }
    return out
  }

  private closeActionSet(rule: SemanticRule): Set<string> {
    return new Set(listRuleEffects(rule.effects)
      .flatMap(effect => collectAtomLeaves(effect))
      .map(leaf => leaf.key)
      .filter(key =>
        key === ATOM_CONTRACT_REGISTRY['action.close_long'].key
        || key === ATOM_CONTRACT_REGISTRY['action.close_short'].key,
      ))
  }

  private conditionsRepresentSameLifecycle(left: SemanticRule, right: SemanticRule): boolean {
    const leftLeaves = collectAtomLeaves(left.condition)
    const rightLeaves = collectAtomLeaves(right.condition)
    if (leftLeaves.length === 0 || rightLeaves.length === 0) return false
    return leftLeaves.every(leftLeaf => rightLeaves.some(rightLeaf => this.conditionLeafRepresents(leftLeaf, rightLeaf)))
      && rightLeaves.every(rightLeaf => leftLeaves.some(leftLeaf => this.conditionLeafRepresents(leftLeaf, rightLeaf)))
  }

  private removeShortActionEffect(effect: AtomExpr): AtomExpr {
    if (effect.kind === 'atom') {
      if (effect.key === ATOM_CONTRACT_REGISTRY['action.close_short'].key) {
        return { kind: 'atom', key: ATOM_CONTRACT_REGISTRY['action.close_long'].key, params: {} }
      }
      if (effect.key === ATOM_CONTRACT_REGISTRY['action.open_short'].key) {
        return { kind: 'atom', key: ATOM_CONTRACT_REGISTRY['action.open_long'].key, params: {} }
      }
      return effect
    }
    if (effect.kind === 'and') return { ...effect, children: effect.children.map(child => this.removeShortActionEffect(child)) }
    if (effect.kind === 'or') return { ...effect, children: effect.children.map(child => this.removeShortActionEffect(child)) }
    if (effect.kind === 'not') return { ...effect, child: this.removeShortActionEffect(effect.child) }
    if (effect.kind === 'sequence') return { ...effect, steps: effect.steps.map(step => this.removeShortActionEffect(step)) }
    return effect
  }

  private mapAtomExpr(expr: AtomExpr, mapAtom: (atom: AtomExprAtom) => AtomExprAtom): AtomExpr {
    if (expr.kind === 'atom') return mapAtom(expr)
    if (expr.kind === 'and') return { ...expr, children: expr.children.map(child => this.mapAtomExpr(child, mapAtom)) }
    if (expr.kind === 'or') return { ...expr, children: expr.children.map(child => this.mapAtomExpr(child, mapAtom)) }
    if (expr.kind === 'not') return { ...expr, child: this.mapAtomExpr(expr.child, mapAtom) }
    if (expr.kind === 'sequence') return { ...expr, steps: expr.steps.map(step => this.mapAtomExpr(step, mapAtom)) }
    return expr
  }

  private filterAtomExpr(
    expr: AtomExpr,
    shouldRemove: (atom: AtomExprAtom) => boolean,
  ): AtomExpr | null {
    if (expr.kind === 'atom') return shouldRemove(expr) ? null : expr
    if (expr.kind === 'and' || expr.kind === 'or') {
      const children = expr.children
        .map(child => this.filterAtomExpr(child, shouldRemove))
        .filter((child): child is AtomExpr => child !== null)
      if (children.length === 0) return null
      if (children.length === 1) return children[0]
      return { ...expr, children }
    }
    if (expr.kind === 'not') {
      const child = this.filterAtomExpr(expr.child, shouldRemove)
      return child ? { ...expr, child } : null
    }
    if (expr.kind === 'sequence') {
      const steps = expr.steps
        .map(step => this.filterAtomExpr(step, shouldRemove))
        .filter((step): step is AtomExpr => step !== null)
      if (steps.length === 0) return null
      if (steps.length === 1) return steps[0]
      return { ...expr, steps }
    }
    return expr
  }

  private extractConsecutiveBars(text: string): number | null {
    if (/三|3/u.test(text)) return 3
    if (/两|二|2/u.test(text)) return 2
    if (/四|4/u.test(text)) return 4
    if (/五|5/u.test(text)) return 5
    return null
  }

  private omitEffectPhaseForSignature(effect: AtomExpr): unknown {
    if (effect.kind === 'atom') return { ...effect, params: this.omitParams(effect.params ?? {}, ['phase']) }
    return effect
  }

  private normalizeAtomExprForSignature(expr: AtomExpr): unknown {
    if (expr.kind === 'atom') {
      return {
        ...expr,
        evidence: undefined,
        params: this.omitParams(expr.params ?? {}, ['phase']),
      }
    }
    if (expr.kind === 'and' || expr.kind === 'or') {
      return { ...expr, children: expr.children.map(child => this.normalizeAtomExprForSignature(child)) }
    }
    if (expr.kind === 'not') return { ...expr, child: this.normalizeAtomExprForSignature(expr.child) }
    if (expr.kind === 'sequence') return { ...expr, steps: expr.steps.map(step => this.normalizeAtomExprForSignature(step)) }
    return expr
  }

  private appendDispatcherRulesForMissingLifecyclePhases(
    merged: InternalPlannerPatch,
    dispatcher: InternalPlannerPatch,
  ): void {
    const rules = merged.rules
    const dispatcherRules = dispatcher.rules
    if (!rules?.length || !dispatcherRules?.length) return

    const existingPhases = new Set(rules.map(rule => rule.phase))
    const toAppend = dispatcherRules.filter(rule => {
      if (rule.phase !== 'entry' && rule.phase !== 'exit') return false
      if (collectAtomLeaves(rule.condition).length === 0) return false
      const lifecycleActions = listRuleEffects(rule.effects)
        .flatMap(effect => collectAtomLeaves(effect))
        .filter(leaf => this.isLifecycleActionAtom(leaf.key))
      if (lifecycleActions.length === 0) return false
      if (!existingPhases.has(rule.phase)) return true
      return !rules.some(existing => this.lifecycleRuleAlreadyCovers(existing, rule))
    })
    if (toAppend.length === 0) return
    merged.rules = [...rules, ...toAppend]
  }

  private lifecycleRuleAlreadyCovers(existing: SemanticRule, candidate: SemanticRule): boolean {
    if (existing.phase !== candidate.phase) return false
    if (!this.sideScopesCompatible(existing.sideScope, candidate.sideScope)) return false
    if (!this.lifecycleActionsCompatible(existing, candidate)) return false
    const existingLeaves = collectAtomLeaves(existing.condition)
    const candidateLeaves = collectAtomLeaves(candidate.condition)
    if (existingLeaves.length === 0 || candidateLeaves.length === 0) return false
    return candidateLeaves.every(candidateLeaf =>
      existingLeaves.some(existingLeaf => this.conditionLeafRepresents(existingLeaf, candidateLeaf)),
    )
  }

  private dropEntriesDuplicatingSameSideExitConditions(merged: InternalPlannerPatch): void {
    const rules = merged.rules
    if (!rules?.length) return
    const exitRules = rules.filter(rule => rule.phase === 'exit' && this.closeActionSet(rule).size > 0)
    if (exitRules.length === 0) return
    const shouldDrop = (rule: SemanticRule): boolean => {
      if (rule.phase !== 'entry') return false
      const openActions = this.openActionSet(rule)
      if (openActions.size === 0) return false
      return exitRules.some(exitRule => {
        if (!this.sideScopesCompatible(rule.sideScope, exitRule.sideScope)) return false
        if (!this.sameSideOpenCloseActions(openActions, this.closeActionSet(exitRule))) return false
        return this.atomExprSignature(rule.condition) === this.atomExprSignature(exitRule.condition)
      })
    }
    merged.rules = rules.filter(rule => !shouldDrop(rule))
  }

  private pruneRulesConflictingWithExplicitDispatcherLifecycle(
    merged: InternalPlannerPatch,
    dispatcher: InternalPlannerPatch,
  ): void {
    const rules = merged.rules
    const dispatcherRules = dispatcher.rules?.filter(rule => this.explicitLifecycleRule(rule)) ?? []
    if (!rules?.length || dispatcherRules.length === 0) return

    merged.rules = rules.filter(rule => {
      if (!this.explicitLifecycleRule(rule)) return true
      return !dispatcherRules.some(dispatcherRule => {
        if (this.lifecycleRuleAlreadyCovers(rule, dispatcherRule)) return false
        if (!this.sideScopesCompatible(rule.sideScope, dispatcherRule.sideScope)) return false
        if (!this.lifecycleActionsConflict(rule, dispatcherRule)) return false
        return this.conditionsOverlap(rule.condition, dispatcherRule.condition)
      })
    })
  }

  private explicitLifecycleRule(rule: SemanticRule): boolean {
    return collectAtomLeaves(rule.condition).length > 0 && this.lifecycleActionKeys(rule).size > 0
  }

  private lifecycleActionsConflict(left: SemanticRule, right: SemanticRule): boolean {
    const leftActions = this.lifecycleActionKeys(left)
    const rightActions = this.lifecycleActionKeys(right)
    return (leftActions.has(ATOM_CONTRACT_REGISTRY['action.open_long'].key) && rightActions.has(ATOM_CONTRACT_REGISTRY['action.close_long'].key))
      || (leftActions.has(ATOM_CONTRACT_REGISTRY['action.close_long'].key) && rightActions.has(ATOM_CONTRACT_REGISTRY['action.open_long'].key))
      || (leftActions.has(ATOM_CONTRACT_REGISTRY['action.open_short'].key) && rightActions.has(ATOM_CONTRACT_REGISTRY['action.close_short'].key))
      || (leftActions.has(ATOM_CONTRACT_REGISTRY['action.close_short'].key) && rightActions.has(ATOM_CONTRACT_REGISTRY['action.open_short'].key))
  }

  private conditionsOverlap(left: AtomExpr, right: AtomExpr): boolean {
    const leftLeaves = collectAtomLeaves(left)
    const rightLeaves = collectAtomLeaves(right)
    if (leftLeaves.length === 0 || rightLeaves.length === 0) return false
    return leftLeaves.some(leftLeaf => rightLeaves.some(rightLeaf => this.conditionLeafRepresents(leftLeaf, rightLeaf)))
  }

  private openActionSet(rule: SemanticRule): Set<string> {
    return new Set(listRuleEffects(rule.effects)
      .flatMap(effect => collectAtomLeaves(effect))
      .map(leaf => leaf.key)
      .filter(key => key === ATOM_CONTRACT_REGISTRY['action.open_long'].key || key === ATOM_CONTRACT_REGISTRY['action.open_short'].key))
  }

  private sameSideOpenCloseActions(openActions: ReadonlySet<string>, closeActions: ReadonlySet<string>): boolean {
    return (openActions.has(ATOM_CONTRACT_REGISTRY['action.open_long'].key) && closeActions.has(ATOM_CONTRACT_REGISTRY['action.close_long'].key))
      || (openActions.has(ATOM_CONTRACT_REGISTRY['action.open_short'].key) && closeActions.has(ATOM_CONTRACT_REGISTRY['action.close_short'].key))
  }

  private preserveExplicitDispatcherSemanticsInPlannerSpine(
    merged: InternalPlannerPatch,
    dispatcher: InternalPlannerPatch,
  ): void {
    const rules = merged.rules
    const dispatcherRules = dispatcher.rules
    if (!rules?.length || !dispatcherRules?.length) return

    let nextRules = [...rules]
    for (const dispatcherRule of dispatcherRules) {
      const nonLifecycleEffects = listRuleEffects(dispatcherRule.effects)
        .flatMap(effect => collectAtomLeaves(effect))
        .filter(leaf => !this.isLifecycleActionAtom(leaf.key))
      const dispatcherConditionLeaves = collectAtomLeaves(dispatcherRule.condition)

      const targetIndex = nextRules.findIndex(rule => this.canMergeExplicitDispatcherRuleIntoPlannerRule(rule, dispatcherRule))
      if (targetIndex >= 0) {
        const target = nextRules[targetIndex]
        nextRules[targetIndex] = {
          ...target,
          condition: this.mergeMissingConditionLeaves(target.condition, dispatcherConditionLeaves),
          effects: this.appendDedupedTypedRuleEffects(target.effects, nonLifecycleEffects),
        }
        continue
      }

      const actionRepairTargetIndex = nextRules.findIndex(rule => this.canRepairLifecycleActionSide(rule, dispatcherRule))
      if (actionRepairTargetIndex >= 0) {
        const target = nextRules[actionRepairTargetIndex]
        nextRules[actionRepairTargetIndex] = {
          ...target,
          condition: this.mergeMissingConditionLeaves(target.condition, dispatcherConditionLeaves),
          effects: this.replaceLifecycleActions(
            this.appendDedupedTypedRuleEffects(target.effects, nonLifecycleEffects),
            this.collectLifecycleActionEffects(dispatcherRule),
          ),
        }
        continue
      }

      if (this.shouldAppendNonLifecycleDispatcherRule(dispatcherRule)) {
        if (!nextRules.some(rule => this.ruleCoversNonLifecycleDispatcherRule(rule, dispatcherRule))) {
          nextRules.push(dispatcherRule)
        }
      }
    }

    const globalRiskEffects = this.collectFallbackEffectAtoms(dispatcher)
      .filter(effect => this.readAtomBucket(effect.key) === 'risk')
    if (globalRiskEffects.length > 0) {
      nextRules = nextRules.map(rule => {
        if (rule.phase !== 'entry' || !this.ruleHasOpenAction(rule)) return rule
        return {
          ...rule,
          effects: this.appendDedupedTypedRuleEffects(rule.effects, globalRiskEffects),
        }
      })
    }

    merged.rules = nextRules
  }

  private canMergeExplicitDispatcherRuleIntoPlannerRule(
    plannerRule: SemanticRule,
    dispatcherRule: SemanticRule,
  ): boolean {
    if (plannerRule.phase !== dispatcherRule.phase) return false
    if (!this.sideScopesCompatible(plannerRule.sideScope, dispatcherRule.sideScope)) return false
    if (!this.lifecycleActionsCompatible(plannerRule, dispatcherRule)) return false
    const plannerLeaves = collectAtomLeaves(plannerRule.condition)
    const dispatcherLeaves = collectAtomLeaves(dispatcherRule.condition)
    if (plannerLeaves.length === 0 || dispatcherLeaves.length === 0) return false
    return plannerLeaves.some(plannerLeaf => dispatcherLeaves.some(dispatcherLeaf => this.conditionLeafRepresents(plannerLeaf, dispatcherLeaf)))
  }

  private lifecycleActionsCompatible(plannerRule: SemanticRule, dispatcherRule: SemanticRule): boolean {
    const plannerActions = this.lifecycleActionKeys(plannerRule)
    const dispatcherActions = this.lifecycleActionKeys(dispatcherRule)
    if (plannerActions.size === 0 || dispatcherActions.size === 0) return true
    for (const key of dispatcherActions) if (plannerActions.has(key)) return true
    return false
  }

  private canRepairLifecycleActionSide(plannerRule: SemanticRule, dispatcherRule: SemanticRule): boolean {
    if (plannerRule.phase !== dispatcherRule.phase) return false
    if (!this.sideScopesCompatible(plannerRule.sideScope, dispatcherRule.sideScope)) return false
    const plannerActions = this.lifecycleActionKeys(plannerRule)
    const dispatcherActions = this.lifecycleActionKeys(dispatcherRule)
    if (plannerActions.size === 0 || dispatcherActions.size === 0) return false
    for (const key of dispatcherActions) if (plannerActions.has(key)) return false
    const plannerLeaves = collectAtomLeaves(plannerRule.condition)
    const dispatcherLeaves = collectAtomLeaves(dispatcherRule.condition)
    return plannerLeaves.some(plannerLeaf => dispatcherLeaves.some(dispatcherLeaf => this.conditionLeafRepresents(plannerLeaf, dispatcherLeaf)))
  }

  private collectLifecycleActionEffects(rule: SemanticRule): AtomExprAtom[] {
    return listRuleEffects(rule.effects)
      .flatMap(effect => collectAtomLeaves(effect))
      .filter(leaf => this.isLifecycleActionAtom(leaf.key))
  }

  private replaceLifecycleActions(existing: RuleEffects, replacementActions: readonly AtomExprAtom[]): RuleEffectsByRole {
    const typed = isRuleEffectsByRole(existing)
      ? existing
      : this.toTypedRuleEffects(existing)
    const nonLifecycleActions = typed.actions.filter(effect =>
      !collectAtomLeaves(effect).some(leaf => this.isLifecycleActionAtom(leaf.key)),
    )
    return {
      ...typed,
      actions: this.dedupeFallbackEffects([...this.asEffectAtoms(nonLifecycleActions), ...replacementActions]),
    }
  }

  private shouldAppendNonLifecycleDispatcherRule(rule: SemanticRule): boolean {
    if (rule.phase !== 'gate' && rule.phase !== 'program') return false
    const effects = listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect))
    if (effects.some(effect => this.readAtomBucket(effect.key) === 'action')) return false
    return collectAtomLeaves(rule.condition).length > 0 && effects.length > 0
  }

  private rulesRepresentSameNonLifecycleSemantics(left: SemanticRule, right: SemanticRule): boolean {
    if (left.phase !== right.phase) return false
    if (!this.sideScopesCompatible(left.sideScope, right.sideScope)) return false
    const leftKeys = new Set([
      ...collectAtomLeaves(left.condition),
      ...listRuleEffects(left.effects).flatMap(effect => collectAtomLeaves(effect)),
    ].map(leaf => leaf.key))
    return [
      ...collectAtomLeaves(right.condition),
      ...listRuleEffects(right.effects).flatMap(effect => collectAtomLeaves(effect)),
    ].every(leaf => leftKeys.has(leaf.key))
  }

  private ruleCoversNonLifecycleDispatcherRule(existing: SemanticRule, dispatcherRule: SemanticRule): boolean {
    if (this.rulesRepresentSameNonLifecycleSemantics(existing, dispatcherRule)) return true
    if (!this.sideScopesCompatible(existing.sideScope, dispatcherRule.sideScope)) return false
    const dispatcherConditionLeaves = collectAtomLeaves(dispatcherRule.condition)
    const existingConditionLeaves = collectAtomLeaves(existing.condition)
    if (dispatcherConditionLeaves.length === 0 || existingConditionLeaves.length === 0) return false
    const conditionCovered = dispatcherConditionLeaves.every(dispatcherLeaf =>
      existingConditionLeaves.some(existingLeaf => this.conditionLeafRepresents(existingLeaf, dispatcherLeaf)),
    )
    if (!conditionCovered) return false

    const dispatcherEffects = listRuleEffects(dispatcherRule.effects).flatMap(effect => collectAtomLeaves(effect))
    if (dispatcherEffects.length === 0) return false
    const existingEffects = listRuleEffects(existing.effects).flatMap(effect => collectAtomLeaves(effect))
    return dispatcherEffects.every(dispatcherEffect =>
      existingEffects.some(existingEffect => this.effectLeafMatches(existingEffect, dispatcherEffect)),
    )
  }

  private mergeMissingConditionLeaves(existing: AtomExpr, additions: readonly AtomExprAtom[]): AtomExpr {
    const conditionAdditions = additions.filter(leaf => this.atomHasRole(leaf.key, 'predicate'))
    if (conditionAdditions.length === 0) return existing
    const existingLeaves = collectAtomLeaves(existing)
    const missing = conditionAdditions.filter(addition =>
      !existingLeaves.some(existingLeaf => this.conditionLeafRepresents(existingLeaf, addition))
      && !existingLeaves.some(existingLeaf => this.sameMovingAverageCrossConditionKey(existingLeaf, addition)),
    )
    if (missing.length === 0) return existing
    if (existing.kind === 'and') return { ...existing, children: [...existing.children, ...missing] }
    return { kind: 'and', children: [existing, ...missing] }
  }

  private appendDedupedTypedRuleEffects(existing: RuleEffects, additions: readonly AtomExpr[]): RuleEffectsByRole {
    const appended = this.appendTypedRuleEffects(existing, additions)
    return this.dedupeRuleEffects(appended) as RuleEffectsByRole
  }

  private isLifecycleActionAtom(key: string): boolean {
    return key === ATOM_CONTRACT_REGISTRY['action.open_long'].key
      || key === ATOM_CONTRACT_REGISTRY['action.open_short'].key
      || key === ATOM_CONTRACT_REGISTRY['action.close_long'].key
      || key === ATOM_CONTRACT_REGISTRY['action.close_short'].key
  }

  private sameMovingAverageCrossConditionKey(existing: AtomExprAtom, candidate: AtomExprAtom): boolean {
    if (existing.key !== candidate.key) return false
    if (
      existing.key !== ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key
      && existing.key !== ATOM_CONTRACT_REGISTRY['indicator.cross_under'].key
    ) return false
    const existingIndicator = this.readStringParam(existing.params, 'indicator')
    const candidateIndicator = this.readStringParam(candidate.params, 'indicator')
    return Boolean(
      existingIndicator
      && candidateIndicator
      && this.isMovingAverageIndicatorName(existingIndicator)
      && this.isMovingAverageIndicatorName(candidateIndicator),
    )
  }

  private findDispatcherTakeProfitReplacement(
    rule: SemanticRule,
    dispatcherRules: readonly SemanticRule[],
  ): AtomExprAtom | null {
    const candidates = [
      ...dispatcherRules.filter(candidate => this.ruleConditionLooselyMatches(rule, candidate)),
      ...dispatcherRules.filter(candidate =>
        candidate.phase === rule.phase
        && (candidate.sideScope === rule.sideScope || candidate.sideScope === 'both' || rule.sideScope === 'both'),
      ),
      ...dispatcherRules.filter(candidate =>
        candidate.sideScope === rule.sideScope || candidate.sideScope === 'both' || rule.sideScope === 'both',
      ),
    ]
    for (const candidate of candidates) {
      const takeProfit = listRuleEffects(candidate.effects)
        .flatMap(effect => collectAtomLeaves(effect))
        .find(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['risk.take_profit_pct'].key)
      if (takeProfit) return takeProfit
    }
    return null
  }

  private findDispatcherTakeProfitEffect(dispatcher: InternalPlannerPatch): AtomExprAtom | null {
    return this.collectFallbackEffectAtoms(dispatcher)
      .find(effect => effect.key === ATOM_CONTRACT_REGISTRY['risk.take_profit_pct'].key) ?? null
  }

  private derivePercentTakeProfitFromRuleCondition(rule: SemanticRule): AtomExprAtom | null {
    const leaves = collectAtomLeaves(rule.condition)
    const percentLeaf = leaves.find(leaf =>
      leaf.key === ATOM_CONTRACT_REGISTRY['price.percent_change'].key
      && (
        this.readStringParam(leaf.params, 'basis') === 'entry_avg_price'
        || this.readStringParam(leaf.params, 'basis') === 'position_pnl'
      )
      && (
        this.readStringParam(leaf.params, 'direction') === 'up'
        || this.readStringParam(leaf.params, 'direction') === 'increase'
        || this.readStringParam(leaf.params, 'direction') === 'profit'
      ),
    )
    if (!percentLeaf) return null
    const valuePct = this.readNumericParam(percentLeaf.params, 'valuePct')
      ?? this.readNumericParam(percentLeaf.params, 'pct')
      ?? this.readNumericParam(percentLeaf.params, 'thresholdPct')
    if (valuePct === null) return null
    return {
      kind: 'atom',
      key: ATOM_CONTRACT_REGISTRY['risk.take_profit_pct'].key,
      params: {
        valuePct,
        basis: this.readStringParam(percentLeaf.params, 'basis') ?? 'entry_avg_price',
      },
    }
  }

  private ruleConditionLooselyMatches(left: SemanticRule, right: SemanticRule): boolean {
    if (left.phase !== right.phase) return false
    if (left.sideScope !== right.sideScope && left.sideScope !== 'both' && right.sideScope !== 'both') return false
    const leftLeaves = collectAtomLeaves(left.condition)
    const rightLeaves = collectAtomLeaves(right.condition)
    if (leftLeaves.length !== rightLeaves.length) return false
    return leftLeaves.every(leftLeaf =>
      rightLeaves.some(rightLeaf =>
        leftLeaf.key === rightLeaf.key
        && this.atomParamsLooselyCompatible(leftLeaf.params, rightLeaf.params),
      ),
    )
  }

  private atomParamsLooselyCompatible(
    left: Record<string, unknown> | undefined,
    right: Record<string, unknown> | undefined,
  ): boolean {
    const leftParams = left ?? {}
    const rightParams = right ?? {}
    for (const [key, leftValue] of Object.entries(leftParams)) {
      if (!(key in rightParams)) continue
      const rightValue = rightParams[key]
      if (typeof leftValue === 'number' || typeof rightValue === 'number') {
        if (Math.abs(Number(leftValue) - Number(rightValue)) > 1e-9) return false
        continue
      }
      if (String(leftValue) !== String(rightValue)) return false
    }
    return true
  }

  private mergeDeterministicRulesIntoPlanner(
    merged: InternalPlannerPatch,
    dispatcher: InternalPlannerPatch,
    userMessage: string,
  ): void {
    const rules = merged.rules
    if (!rules || rules.length === 0) return

    const deterministicRules = this.buildFallbackRules(dispatcher, userMessage)
      .filter(rule => listRuleEffects(rule.effects).length > 0)
    if (deterministicRules.length === 0) return

    const corrected = rules.map((rule) => {
      const replacement = this.findMovingAverageBreakoutCorrection(rule, deterministicRules)
      if (!replacement) return rule
      return {
        ...rule,
        condition: replacement.condition,
        evidence: replacement.evidence ?? rule.evidence,
      }
    })

    const nextRules = [...corrected]
    for (const deterministicRule of deterministicRules) {
      if (!this.shouldAppendDeterministicCoreTradeRule(deterministicRule)) continue
      if (this.isDeterministicConditionAlreadyRepresented(nextRules, deterministicRule)) continue
      if (this.isDeterministicRuleCovered(nextRules, deterministicRule)) continue
      nextRules.push(deterministicRule)
    }
    merged.rules = this.dropPlannerRulesReplacedByDeterministicLifecycle(nextRules)
  }

  private shouldAppendDeterministicCoreTradeRule(rule: SemanticRule): boolean {
    const leaves = collectAtomLeaves(rule.condition)
    const effectKeys = listRuleEffects(rule.effects)
      .flatMap(effect => collectAtomLeaves(effect).map(leaf => leaf.key))
    const allowedActionKeys = new Set<string>([
      ATOM_CONTRACT_REGISTRY['action.open_long'].key,
      ATOM_CONTRACT_REGISTRY['action.open_short'].key,
      ATOM_CONTRACT_REGISTRY['action.close_long'].key,
      ATOM_CONTRACT_REGISTRY['action.close_short'].key,
      ADD_POSITION_ATOM_KEY,
    ])
    const hasTradeAction = effectKeys.some(key => allowedActionKeys.has(key))
    if (leaves.length !== 1) {
      return hasTradeAction && leaves.some(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['condition.sequence'].key)
    }
    const conditionKey = leaves[0]?.key
    const evidence = this.readEvidenceText(rule) ?? this.readEvidenceText(leaves[0] ?? {}) ?? ''
    if (
      conditionKey === ATOM_CONTRACT_REGISTRY['bollinger.touch_upper'].key
      && effectKeys.includes(ATOM_CONTRACT_REGISTRY['action.open_long'].key)
      && /卖出|平多|止盈|sell|close/iu.test(evidence)
    ) {
      return false
    }
    if (
      conditionKey === ATOM_CONTRACT_REGISTRY['bollinger.touch_upper'].key
      && /下轨|lower/iu.test(evidence)
    ) {
      return false
    }
    if (
      conditionKey === ATOM_CONTRACT_REGISTRY['bollinger.touch_lower'].key
      && effectKeys.includes(ATOM_CONTRACT_REGISTRY['action.open_short'].key)
      && /买入|开多|buy|long/iu.test(evidence)
    ) {
      return false
    }
    if (
      conditionKey === ATOM_CONTRACT_REGISTRY['bollinger.touch_lower'].key
      && /上轨|upper/iu.test(evidence)
    ) {
      return false
    }
    const allowedConditionKeys = new Set<string>([
      ATOM_CONTRACT_REGISTRY['indicator.above'].key,
      ATOM_CONTRACT_REGISTRY['indicator.below'].key,
      ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key,
      ATOM_CONTRACT_REGISTRY['indicator.cross_under'].key,
      ATOM_CONTRACT_REGISTRY['oscillator.rsi_lte'].key,
      ATOM_CONTRACT_REGISTRY['oscillator.rsi_gte'].key,
      ATOM_CONTRACT_REGISTRY['bollinger.touch_upper'].key,
      ATOM_CONTRACT_REGISTRY['bollinger.touch_lower'].key,
      ATOM_CONTRACT_REGISTRY['bollinger.touch_middle'].key,
      ATOM_CONTRACT_REGISTRY['price.percent_change'].key,
      ATOM_CONTRACT_REGISTRY['risk.stop_loss_pct'].key,
    ])
    if (!conditionKey || !allowedConditionKeys.has(conditionKey)) return false
    if (conditionKey === ATOM_CONTRACT_REGISTRY['risk.stop_loss_pct'].key && rule.phase !== 'exit') return false

    return hasTradeAction
  }

  private dropPlannerRulesReplacedByDeterministicLifecycle(
    rules: readonly SemanticRule[],
  ): SemanticRule[] {
    const hasAddPositionLifecycle = rules.some(rule =>
      listRuleEffects(rule.effects).some(effect =>
        collectAtomLeaves(effect).some(leaf => leaf.key === ADD_POSITION_ATOM_KEY),
      ),
    )
    if (!hasAddPositionLifecycle) return [...rules]
    return rules.filter((rule) => {
      if (listRuleEffects(rule.effects).length > 0) return true
      return !collectAtomLeaves(rule.condition).some(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['price.range_position_gte'].key)
    })
  }

  private findMovingAverageBreakoutCorrection(
    plannerRule: SemanticRule,
    deterministicRules: readonly SemanticRule[],
  ): SemanticRule | null {
    const leaves = collectAtomLeaves(plannerRule.condition)
    if (leaves.length !== 1) return null
    const leaf = leaves[0]
    if (!leaf) return null

    const replacementKey = leaf.key === ATOM_CONTRACT_REGISTRY['price.breakout_up'].key
      ? ATOM_CONTRACT_REGISTRY['indicator.above'].key
      : leaf.key === ATOM_CONTRACT_REGISTRY['price.breakout_down'].key
        ? ATOM_CONTRACT_REGISTRY['indicator.below'].key
        : null
    if (!replacementKey) return null
    if (!this.hasMovingAverageEvidence(plannerRule, leaf)) return null

    const plannerPeriod = this.readNumericParam(leaf.params, 'period')
    return deterministicRules.find((rule) => {
      if (rule.phase !== plannerRule.phase) return false
      if (rule.sideScope !== plannerRule.sideScope) return false
      const deterministicLeaves = collectAtomLeaves(rule.condition)
      if (deterministicLeaves.length !== 1) return false
      const deterministicLeaf = deterministicLeaves[0]
      if (!deterministicLeaf || deterministicLeaf.key !== replacementKey) return false
      if (plannerPeriod === null) return true
      return this.readNumericParam(deterministicLeaf.params, 'reference.period') === plannerPeriod
    }) ?? null
  }

  private hasMovingAverageEvidence(rule: SemanticRule, leaf: AtomExprAtom): boolean {
    const evidenceText = [
      rule.evidence?.text,
      leaf.evidence?.text,
      ...listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect).map(effectLeaf => effectLeaf.evidence?.text)),
    ].filter((text): text is string => typeof text === 'string')
      .join(' ')
    return /(?:EMA|SMA|MA)\s*\d{1,4}|\d{1,4}\s*(?:日|周期)?均线/iu.test(evidenceText)
  }

  private isDeterministicRuleCovered(
    rules: readonly SemanticRule[],
    deterministicRule: SemanticRule,
  ): boolean {
    const deterministicLeaves = collectAtomLeaves(deterministicRule.condition)
    if (deterministicLeaves.length === 0) return true

    return rules.some((rule) => {
      if (rule.phase !== deterministicRule.phase) return false
      if (rule.sideScope !== deterministicRule.sideScope) return false
      if (!this.ruleEffectsCover(rule, deterministicRule)) return false
      const leaves = collectAtomLeaves(rule.condition)
      return deterministicLeaves.every(candidate =>
        leaves.some(existing => this.atomLeafMatches(existing, candidate)),
      )
    })
  }

  private isDeterministicConditionAlreadyRepresented(
    rules: readonly SemanticRule[],
    deterministicRule: SemanticRule,
  ): boolean {
    const deterministicLeaves = collectAtomLeaves(deterministicRule.condition)
    if (deterministicLeaves.length !== 1) return false
    const deterministicLeaf = deterministicLeaves[0]
    if (!deterministicLeaf) return false
    if (this.readAtomBucket(deterministicLeaf.key) === 'risk') {
      return rules.some(rule => [
        ...collectAtomLeaves(rule.condition),
        ...listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect)),
      ].some(existing => this.conditionLeafRepresents(existing, deterministicLeaf)))
    }
    return rules.some((rule) => {
      if (rule.phase !== deterministicRule.phase) return false
      return collectAtomLeaves(rule.condition).some(existing => this.conditionLeafRepresents(existing, deterministicLeaf))
    })
  }

  private conditionLeafRepresents(existing: AtomExprAtom, candidate: AtomExprAtom): boolean {
    if (this.atomLeafMatches(existing, candidate)) return true
    if (this.percentChangeLeafMatches(existing, candidate)) return true
    if (this.riskPercentChangeRepresentsRisk(existing, candidate)) return true
    if (this.riskPercentChangeRepresentsRisk(candidate, existing)) return true
    if (
      existing.key === candidate.key
      && existing.key.startsWith('bollinger.')
    ) {
      return true
    }
    if (this.bollingerMiddleRepresentsNoisyBollingerMidlineEvidence(existing, candidate)) return true
    return this.bollingerMiddleRepresentsMovingAverageMidline(existing, candidate)
  }

  private riskPercentChangeRepresentsRisk(percentLeaf: AtomExprAtom, riskLeaf: AtomExprAtom): boolean {
    if (percentLeaf.key !== ATOM_CONTRACT_REGISTRY['price.percent_change'].key) return false
    if (
      riskLeaf.key !== ATOM_CONTRACT_REGISTRY['risk.stop_loss_pct'].key
      && riskLeaf.key !== ATOM_CONTRACT_REGISTRY['risk.take_profit_pct'].key
    ) return false
    const basis = this.readStringParam(percentLeaf.params, 'basis')
    if (basis !== 'entry_avg_price' && basis !== 'position_pnl') return false
    const direction = this.readStringParam(percentLeaf.params, 'direction')
    const percentValue = Math.abs(
      this.readNumericParam(percentLeaf.params, 'valuePct')
      ?? this.readNumericParam(percentLeaf.params, 'pct')
      ?? this.readNumericParam(percentLeaf.params, 'thresholdPct')
      ?? Number.NaN,
    )
    const riskValue = Math.abs(
      this.readNumericParam(riskLeaf.params, 'valuePct')
      ?? this.readNumericParam(riskLeaf.params, 'pct')
      ?? Number.NaN,
    )
    if (!Number.isFinite(percentValue) || !Number.isFinite(riskValue)) return false
    if (Math.abs(percentValue - riskValue) > 1e-9) return false
    if (riskLeaf.key === ATOM_CONTRACT_REGISTRY['risk.stop_loss_pct'].key) {
      return direction === 'down' || direction === 'decrease' || direction === 'loss'
    }
    return direction === 'up' || direction === 'increase' || direction === 'profit'
  }

  private percentChangeLeafMatches(existing: AtomExprAtom, candidate: AtomExprAtom): boolean {
    if (
      existing.key !== ATOM_CONTRACT_REGISTRY['price.percent_change'].key
      || candidate.key !== ATOM_CONTRACT_REGISTRY['price.percent_change'].key
    ) return false
    const existingBasis = this.normalizePercentChangeBasis(this.readStringParam(existing.params, 'basis'))
    const candidateBasis = this.normalizePercentChangeBasis(this.readStringParam(candidate.params, 'basis'))
    if (existingBasis !== candidateBasis) return false
    const existingDirection = this.readStringParam(existing.params, 'direction') ?? ''
    const candidateDirection = this.readStringParam(candidate.params, 'direction') ?? ''
    if (existingDirection !== candidateDirection) return false
    const existingValue = Math.abs(
      this.readNumericParam(existing.params, 'valuePct')
      ?? this.readNumericParam(existing.params, 'pct')
      ?? this.readNumericParam(existing.params, 'thresholdPct')
      ?? Number.NaN,
    )
    const candidateValue = Math.abs(
      this.readNumericParam(candidate.params, 'valuePct')
      ?? this.readNumericParam(candidate.params, 'pct')
      ?? this.readNumericParam(candidate.params, 'thresholdPct')
      ?? Number.NaN,
    )
    return Number.isFinite(existingValue)
      && Number.isFinite(candidateValue)
      && Math.abs(existingValue - candidateValue) <= 1e-9
  }

  private normalizePercentChangeBasis(basis: string | null): string {
    if (!basis || basis === 'current_price' || basis === 'previous_close' || basis === 'prev_close' || basis === 'entry_avg_price') {
      return 'price_window'
    }
    return basis
  }

  private ruleEffectsCover(existingRule: SemanticRule, candidateRule: SemanticRule): boolean {
    const existingEffects = listRuleEffects(existingRule.effects).flatMap(effect => collectAtomLeaves(effect))
    const candidateEffects = listRuleEffects(candidateRule.effects).flatMap(effect => collectAtomLeaves(effect))
    return candidateEffects.every(candidate =>
      existingEffects.some(existing => this.effectLeafMatches(existing, candidate)),
    )
  }

  private effectLeafMatches(existing: AtomExprAtom, candidate: AtomExprAtom): boolean {
    if (existing.key !== candidate.key) return false
    if (this.readAtomBucket(existing.key) === 'action') {
      return this.sideScopesCompatible(existing.sideScope, candidate.sideScope)
    }
    return this.atomLeafMatches(existing, candidate)
  }

  private sideScopesCompatible(
    existing: AtomExprAtom['sideScope'] | undefined,
    candidate: AtomExprAtom['sideScope'] | undefined,
  ): boolean {
    if (!existing || !candidate) return true
    if (existing === 'both' || candidate === 'both') return true
    return existing === candidate
  }

  private atomLeafMatches(existing: AtomExprAtom, candidate: AtomExprAtom): boolean {
    if (existing.key !== candidate.key) return false
    if (this.stableParamsHash(existing.params) === this.stableParamsHash(candidate.params)) return true
    if (this.stableParamsHash(this.omitZeroBuffer(existing.params)) === this.stableParamsHash(this.omitZeroBuffer(candidate.params))) return true
    if (this.semanticAtomLeafMatches(existing, candidate)) return true
    return this.paramsSubsetMatch(existing.params, candidate.params)
  }

  private omitZeroBuffer(params: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!params || params.bufferPct !== 0) return params
    const { bufferPct: _bufferPct, ...rest } = params
    return rest
  }

  private bollingerMiddleRepresentsMovingAverageMidline(existing: AtomExprAtom, candidate: AtomExprAtom): boolean {
    if (existing.key !== ATOM_CONTRACT_REGISTRY['bollinger.touch_middle'].key) return false
    if (
      candidate.key !== ATOM_CONTRACT_REGISTRY['indicator.above'].key
      && candidate.key !== ATOM_CONTRACT_REGISTRY['indicator.below'].key
    ) return false
    const candidateIndicator = this.readStringParam(candidate.params, 'indicator')
    if (candidateIndicator && !this.indicatorAliasesMatch(candidateIndicator, 'ma')) return false
    const existingPeriod = this.readNumericParam(existing.params, 'period')
    const candidatePeriod = this.readNumericParam(candidate.params, 'reference.period')
    return existingPeriod !== null && candidatePeriod !== null && Math.abs(existingPeriod - candidatePeriod) <= 1e-9
  }

  private bollingerMiddleRepresentsNoisyBollingerMidlineEvidence(existing: AtomExprAtom, candidate: AtomExprAtom): boolean {
    if (existing.key !== ATOM_CONTRACT_REGISTRY['bollinger.touch_middle'].key) return false
    if (
      candidate.key !== ATOM_CONTRACT_REGISTRY['bollinger.touch_upper'].key
      && candidate.key !== ATOM_CONTRACT_REGISTRY['bollinger.touch_lower'].key
    ) return false
    const evidence = this.readEvidenceText(candidate)
    if (!evidence || !/中轨|middle|MA\s*20/iu.test(evidence)) return false
    const existingPeriod = this.readNumericParam(existing.params, 'period')
    const candidatePeriod = this.readNumericParam(candidate.params, 'period')
    return existingPeriod === null || candidatePeriod === null || Math.abs(existingPeriod - candidatePeriod) <= 1e-9
  }

  private semanticAtomLeafMatches(existing: AtomExprAtom, candidate: AtomExprAtom): boolean {
    if (
      existing.key.startsWith('bollinger.')
      && candidate.key.startsWith('bollinger.')
      && existing.key === candidate.key
    ) {
      const existingBand = this.readStringParam(existing.params, 'band')
      const candidateBand = this.readStringParam(candidate.params, 'band')
      const existingPeriod = this.readNumericParam(existing.params, 'period')
      const candidatePeriod = this.readNumericParam(candidate.params, 'period')
      const existingStdDev = this.readNumericParam(existing.params, 'stdDev')
      const candidateStdDev = this.readNumericParam(candidate.params, 'stdDev')
      return Boolean(existingBand && candidateBand && existingBand === candidateBand)
        && (existingPeriod === null || candidatePeriod === null || Math.abs(existingPeriod - candidatePeriod) <= 1e-9)
        && (existingStdDev === null || candidateStdDev === null || Math.abs(existingStdDev - candidateStdDev) <= 1e-9)
    }

    const existingIndicator = this.readStringParam(existing.params, 'indicator')
    const candidateIndicator = this.readStringParam(candidate.params, 'indicator')
    if (existingIndicator && candidateIndicator && !this.indicatorAliasesMatch(existingIndicator, candidateIndicator)) return false

    if (
      existing.key === ATOM_CONTRACT_REGISTRY['indicator.above'].key
      || existing.key === ATOM_CONTRACT_REGISTRY['indicator.below'].key
    ) {
      const existingPeriod = this.readIndicatorPeriodParam(existing.params)
      const candidatePeriod = this.readIndicatorPeriodParam(candidate.params)
      if (existingPeriod !== null || candidatePeriod !== null) return existingPeriod === candidatePeriod
      return Boolean(existingIndicator && candidateIndicator)
    }

    if (
      existing.key === ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key
      || existing.key === ATOM_CONTRACT_REGISTRY['indicator.cross_under'].key
    ) {
      if (existingIndicator === 'macd' && candidateIndicator === 'macd') return true
      if (existingIndicator && candidateIndicator && this.isMovingAverageIndicatorName(existingIndicator) && this.isMovingAverageIndicatorName(candidateIndicator)) {
        return this.movingAverageCrossParamsMatch(existing.params, candidate.params)
      }
    }

    return false
  }

  private movingAverageCrossParamsMatch(
    existingParams: Record<string, unknown> | undefined,
    candidateParams: Record<string, unknown> | undefined,
  ): boolean {
    const pairs: Array<[string, string]> = [
      ['fastPeriod', 'fastPeriod'],
      ['slowPeriod', 'slowPeriod'],
      ['period', 'period'],
      ['value', 'value'],
    ]
    let compared = false
    for (const [existingKey, candidateKey] of pairs) {
      const existingValue = this.readNumericParam(existingParams, existingKey)
      const candidateValue = this.readNumericParam(candidateParams, candidateKey)
      if (existingValue === null && candidateValue === null) continue
      if (existingValue === 0 || candidateValue === 0) {
        compared = true
        continue
      }
      if (existingValue === null || candidateValue === null) {
        compared = true
        continue
      }
      if (Math.abs(existingValue - candidateValue) > 1e-9) return false
      compared = true
    }
    return compared
  }

  private paramsSubsetMatch(
    existingParams: Record<string, unknown> | undefined,
    candidateParams: Record<string, unknown> | undefined,
  ): boolean {
    const candidate = candidateParams ?? {}
    const existing = existingParams ?? {}
    for (const [key, candidateValue] of Object.entries(candidate)) {
      const existingValue = this.readParamByPath(existing, key)
      if (existingValue === undefined) return false
      if (!this.paramValuesMatch(existingValue, candidateValue)) return false
    }
    return true
  }

  private readIndicatorPeriodParam(params: Record<string, unknown> | undefined): number | null {
    return this.readNumericParam(params, 'reference.period')
      ?? this.readNumericParam(params, 'period')
      ?? this.readNumericParam(params, 'value')
  }

  private dropRulesCoveredByStrongerComposite(
    rules: readonly SemanticRule[],
  ): SemanticRule[] {
    return rules.filter((rule, index) => {
      const leaves = collectAtomLeaves(rule.condition)
      if (leaves.length === 0) return true
      const effects = listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect))
      return !rules.some((other, otherIndex) => {
        if (otherIndex === index) return false
        if (other.phase !== rule.phase) return false
        if (other.sideScope !== rule.sideScope && other.sideScope !== 'both' && rule.sideScope !== 'both') return false
        const otherLeaves = collectAtomLeaves(other.condition)
        if (otherLeaves.length < leaves.length) return false
        if (otherLeaves.length === leaves.length && otherIndex > index) return false
        if (!this.ruleEffectsCover(other, rule)) return false
        if (effects.length === 0) return false
        return leaves.every(leaf =>
          otherLeaves.some(otherLeaf => this.conditionLeafRepresents(otherLeaf, leaf)),
        )
      })
    })
  }

  private readParamByPath(params: Record<string, unknown>, key: string): unknown {
    if (Object.prototype.hasOwnProperty.call(params, key)) return params[key]
    return key.split('.').reduce<unknown>((current, part) => {
      if (!current || typeof current !== 'object') return undefined
      return (current as Record<string, unknown>)[part]
    }, params)
  }

  private readStringParam(params: Record<string, unknown> | undefined, key: string): string | null {
    const direct = params?.[key]
    return typeof direct === 'string' && direct.trim().length > 0 ? direct.trim().toLowerCase() : null
  }

  private indicatorAliasesMatch(left: string, right: string): boolean {
    return this.normalizeIndicatorAlias(left) === this.normalizeIndicatorAlias(right)
  }

  private normalizeIndicatorAlias(value: string): string {
    const normalized = value.trim().toLowerCase()
    return normalized === 'sma' ? 'ma' : normalized
  }

  private isMovingAverageIndicatorName(value: string): boolean {
    const normalized = this.normalizeIndicatorAlias(value)
    return normalized === 'ma' || normalized === 'ema'
  }

  private paramValuesMatch(existingValue: unknown, candidateValue: unknown): boolean {
    if (typeof existingValue === 'number' || typeof candidateValue === 'number') {
      return Number.isFinite(Number(existingValue))
        && Number.isFinite(Number(candidateValue))
        && Math.abs(Number(existingValue) - Number(candidateValue)) <= 1e-9
    }
    if (typeof existingValue === 'string' || typeof candidateValue === 'string') {
      return this.normalizeIndicatorAlias(String(existingValue)) === this.normalizeIndicatorAlias(String(candidateValue))
    }
    return JSON.stringify(existingValue) === JSON.stringify(candidateValue)
  }

  private bindDispatcherLifecycleEffectsIntoPlannerRules(
    merged: InternalPlannerPatch,
    dispatcher: InternalPlannerPatch,
  ): void {
    void merged
    void dispatcher
  }

  private removeLifecycleOpenScaffoldEffects(
    effects: readonly AtomExpr[],
    sideScope: 'long' | 'short' | 'both' | undefined,
  ): AtomExpr[] {
    const openKeys = new Set<string>()
    if (sideScope === 'short') {
      openKeys.add(ATOM_CONTRACT_REGISTRY['action.open_short'].key)
    }
    else if (sideScope === 'both') {
      openKeys.add(ATOM_CONTRACT_REGISTRY['action.open_long'].key)
      openKeys.add(ATOM_CONTRACT_REGISTRY['action.open_short'].key)
    }
    else {
      openKeys.add(ATOM_CONTRACT_REGISTRY['action.open_long'].key)
    }
    return effects.filter(effect => !collectAtomLeaves(effect).some(leaf => openKeys.has(leaf.key)))
  }

  private emptyRuleEffects(): RuleEffectsByRole {
    return {
      actions: [],
      risks: [],
      positions: [],
      orchestration: [],
      programs: [],
    }
  }

  private appendTypedRuleEffects(existing: RuleEffects, additions: readonly AtomExpr[]): RuleEffectsByRole {
    const typed = isRuleEffectsByRole(existing)
      ? {
          actions: [...existing.actions],
          risks: [...existing.risks],
          positions: [...existing.positions],
          orchestration: [...existing.orchestration],
          programs: [...existing.programs],
        }
      : this.toTypedRuleEffects(existing)
    const classifiedAdditions = this.toTypedRuleEffects(additions)
    return {
      actions: [...typed.actions, ...classifiedAdditions.actions],
      risks: [...typed.risks, ...classifiedAdditions.risks],
      positions: [...typed.positions, ...classifiedAdditions.positions],
      orchestration: [...typed.orchestration, ...classifiedAdditions.orchestration],
      programs: [...typed.programs, ...classifiedAdditions.programs],
    }
  }

  private removeTypedRuleEffectAtoms(existing: RuleEffects, keys: ReadonlySet<string>): RuleEffectsByRole {
    const typed = isRuleEffectsByRole(existing)
      ? existing
      : this.toTypedRuleEffects(existing)
    const remove = (effect: AtomExpr): AtomExpr | null => this.filterAtomExpr(effect, leaf => keys.has(leaf.key))
    const keep = (effects: readonly AtomExpr[]): AtomExpr[] => effects
      .map(remove)
      .filter((effect): effect is AtomExpr => effect !== null)
    return {
      actions: keep(typed.actions),
      risks: keep(typed.risks),
      positions: keep(typed.positions),
      orchestration: keep(typed.orchestration),
      programs: keep(typed.programs),
    }
  }

  private toTypedRuleEffects(effects: readonly AtomExpr[]): RuleEffectsByRole {
    const typed: Record<keyof RuleEffectsByRole, AtomExpr[]> = {
      actions: [],
      risks: [],
      positions: [],
      orchestration: [],
      programs: [],
    }
    for (const effect of effects) {
      typed[this.resolveRuleEffectRole(effect)].push(effect)
    }
    return typed
  }

  private resolveRuleEffectRole(effect: AtomExpr): keyof RuleEffectsByRole {
    const leaves = collectAtomLeaves(effect)
    if (leaves.some(leaf => leaf.key.startsWith('program.'))) return 'programs'
    if (leaves.some(leaf => ATOM_CONTRACT_REGISTRY[leaf.key]?.bucket === 'risk')) return 'risks'
    if (leaves.some(leaf => ATOM_CONTRACT_REGISTRY[leaf.key]?.bucket === 'positionConstraint')) return 'positions'
    if (leaves.some(leaf => ATOM_CONTRACT_REGISTRY[leaf.key]?.bucket === 'orchestration')) return 'orchestration'
    return 'actions'
  }

  private shouldAttachDcaSchedule(rule: SemanticRule): boolean {
    const leaves = [
      ...collectAtomLeaves(rule.condition),
      ...listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect)),
    ]
    const hasDca = leaves.some(leaf => leaf.key === DCA_SCHEDULE_ATOM_KEY)
    if (hasDca) return false
    const hasOpenLong = leaves.some(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['action.open_long'].key)
    const hasSchedulePredicate = leaves.some(leaf =>
      leaf.key === ATOM_CONTRACT_REGISTRY['strategy.time_window'].key
      || leaf.key === ATOM_CONTRACT_REGISTRY['execution.on_start'].key,
    )
    return rule.phase === 'entry' && hasOpenLong && hasSchedulePredicate
  }

  private paramsLooselyMatch(left: Record<string, unknown> | undefined, right: Record<string, unknown> | undefined): boolean {
    const leftParams = left ?? {}
    const rightParams = right ?? {}
    const comparableKeys = ['basis', 'direction', 'valuePct']
    for (const key of comparableKeys) {
      if (!(key in leftParams) || !(key in rightParams)) continue
      const l = leftParams[key]
      const r = rightParams[key]
      if (typeof l === 'number' || typeof r === 'number') {
        if (Math.abs(Math.abs(Number(l)) - Math.abs(Number(r))) > 1e-9) return false
      }
      else if (String(l) !== String(r)) return false
    }
    return true
  }

  /**
   * Issue #1443：过滤 "always-on condition + action effects" 噪音 rule。
   *
   * 触发条件（全部满足）：
   *   1. rule.condition.kind === 'atom' 且 key ∈ MERGE_ALWAYS_ON_ATOM_KEYS
   *   2. rule.effects 中至少含一个 leaf 在 atom contract registry 的 bucket === 'action'
   *
   * 行为：整条 rule 从 merged.rules 移除。risk/positionConstraint/orchestration effects
   *   不视为噪音（持续生效语义合理）。
   *
   * 通用机制：基于 ALWAYS_ON 集合 + atom contract bucket 派生，不针对单 atom 写特例。
   */
  private filterAlwaysOnActionNoiseRules(merged: InternalPlannerPatch): void {
    const rules = merged.rules
    if (!rules || rules.length === 0) return

    type ContractShape = { bucket?: string }
    const getBucket = (atomKey: string): string | undefined =>
      (ATOM_CONTRACT_REGISTRY as Record<string, ContractShape | undefined>)[atomKey]?.bucket

    const isAlwaysOnCondition = (rule: SemanticRule): boolean =>
      rule.condition.kind === 'atom' && MERGE_ALWAYS_ON_ATOM_KEYS.has(rule.condition.key)

    const effectHasAction = (effect: AtomExpr): boolean => {
      for (const leaf of collectAtomLeaves(effect)) {
        if (getBucket(leaf.key) === 'action') return true
      }
      return false
    }
    const hasActionEffect = (rule: SemanticRule): boolean => {
      for (const eff of listRuleEffects(rule.effects)) {
        if (effectHasAction(eff)) return true
      }
      return false
    }
    const hasLifecycleEffect = (rule: SemanticRule): boolean =>
      listRuleEffects(rule.effects).some(effect => collectAtomLeaves(effect).some(leaf => leaf.key === DCA_SCHEDULE_ATOM_KEY))

    let mutated = false
    const kept = rules.flatMap((rule) => {
      if (isAlwaysOnCondition(rule) && listRuleEffects(rule.effects).length === 0) {
        mutated = true
        return []
      }
      if (!isAlwaysOnCondition(rule) || !hasActionEffect(rule)) return [rule]
      if (!hasLifecycleEffect(rule)) {
        mutated = true
        return []
      }
      const ruleEffects = listRuleEffects(rule.effects)
      const effects = ruleEffects.filter(effect => !effectHasAction(effect))
      mutated = mutated || effects.length !== ruleEffects.length
      return effects.length > 0 ? [{ ...rule, effects }] : []
    })
    if (mutated) {
      merged.rules = kept
    }
  }

  /**
   * Issue #1633 C1：subset-condition entry/exit rule fold pass。
   *
   * 背景：staging s18 复测（sessionId cmpoucjvv01qw842nwj871dwj），planner 把同语义
   * 入场拆成两条 entry rule：
   *   - rule A: condition = atom(candle_pattern) → effects.actions = [open_long]
   *   - rule B: condition = and(candle_pattern, volume.threshold) → effects.actions = [add_position]
   * rule A 只剩 state-only 叶子，被 canonical-spec-v2-ir-compiler 抛
   * EntryRuleRequiresEventLeafException；rule B 的 lifecycle action 又被改成了
   * add_position 而非 open_long。
   *
   * 通用判定：同 phase ∈ {entry, exit}、sideScope 兼容、共享至少一个 lifecycle action
   * key、其中一条的 condition 顶层 atom 集合是另一条 condition 顶层 and(...) 直接子
   * 的严格子集 → 折叠为「保留 superset 条件 + 合并 effects」一条。
   *
   * 守门：
   *  - 仅 entry / exit phase
   *  - subset 条件必须是单 atom 或顶层 and(...) 全 atom 子；含 or/not/sequence 不折叠
   *  - superset 条件必须是顶层 and(...) 且所有子是 atom；含 or/not/sequence 不折叠
   *  - 共享至少一个 lifecycle action（open_long/short/close_long/short），避免无关 rule 合并
   *  - sideScope：相等，或一方 'both'
   */
  private foldSubsetConditionRules(merged: InternalPlannerPatch): void {
    const rules = merged.rules
    if (!rules || rules.length < 2) return

    const candidateShape = (rule: SemanticRule): {
      kind: 'atom' | 'and'
      atomSigs: Set<string>
    } | null => {
      if (rule.phase !== 'entry' && rule.phase !== 'exit') return null
      const cond = rule.condition
      if (cond.kind === 'atom') {
        return { kind: 'atom', atomSigs: new Set([this.atomExprSignature(cond)]) }
      }
      if (cond.kind === 'and') {
        const sigs = new Set<string>()
        for (const child of cond.children) {
          if (child.kind !== 'atom') return null
          sigs.add(this.atomExprSignature(child))
        }
        return { kind: 'and', atomSigs: sigs }
      }
      return null
    }

    const sideScopeCompatible = (a: SemanticRule, b: SemanticRule): boolean => {
      if (a.sideScope === b.sideScope) return true
      return a.sideScope === 'both' || b.sideScope === 'both'
    }

    const isStrictSubset = (small: Set<string>, large: Set<string>): boolean => {
      if (small.size >= large.size) return false
      for (const s of small) if (!large.has(s)) return false
      return true
    }

    const meta = rules.map((rule) => {
      const shape = candidateShape(rule)
      const actions = shape ? this.lifecycleActionKeys(rule) : new Set<string>()
      return { rule, shape, actions }
    })

    const removed = new Set<number>()
    const replaced = new Map<number, SemanticRule>()

    for (let i = 0; i < meta.length; i++) {
      if (removed.has(i)) continue
      const a = meta[i]
      if (!a.shape || a.actions.size === 0) continue
      for (let j = i + 1; j < meta.length; j++) {
        if (removed.has(j)) continue
        const b = meta[j]
        if (!b.shape || b.actions.size === 0) continue
        if (a.rule.phase !== b.rule.phase) continue
        if (!sideScopeCompatible(a.rule, b.rule)) continue
        let sharedAction = false
        for (const k of a.actions) if (b.actions.has(k)) { sharedAction = true; break }
        if (!sharedAction) continue

        let subsetIdx: number, supersetIdx: number
        if (isStrictSubset(a.shape.atomSigs, b.shape.atomSigs) && b.shape.kind === 'and') {
          subsetIdx = i; supersetIdx = j
        }
        else if (isStrictSubset(b.shape.atomSigs, a.shape.atomSigs) && a.shape.kind === 'and') {
          subsetIdx = j; supersetIdx = i
        }
        else continue

        const subsetRule = meta[subsetIdx].rule
        const supersetRule = meta[supersetIdx].rule
        const mergedEffects = this.mergeMissingRuleEffectParams(subsetRule.effects, supersetRule.effects)
        const mergedSide = subsetRule.sideScope === 'both' ? supersetRule.sideScope : subsetRule.sideScope
        const folded: SemanticRule = {
          ...subsetRule,
          condition: structuredClone(supersetRule.condition),
          sideScope: mergedSide,
          effects: mergedEffects,
        }
        replaced.set(subsetIdx, folded)
        removed.add(supersetIdx)
        break
      }
    }

    if (removed.size === 0 && replaced.size === 0) return
    const next: SemanticRule[] = []
    for (let i = 0; i < meta.length; i++) {
      if (removed.has(i)) continue
      next.push(replaced.get(i) ?? meta[i].rule)
    }
    merged.rules = next
  }

  private prunePlannerShortActionsWithoutDispatcherIntent(
    merged: InternalPlannerPatch,
    dispatcher: InternalPlannerPatch,
  ): void {
    const rules = merged.rules
    if (!rules || rules.length === 0) return

    const dispatcherLeaves = (dispatcher.rules ?? []).flatMap(rule => [
      ...collectAtomLeaves(rule.condition),
      ...listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect)),
    ])
    const hasDispatcherShortIntent = dispatcherLeaves.some(leaf =>
      (leaf as { sideScope?: unknown }).sideScope === 'short'
      || leaf.key === ATOM_CONTRACT_REGISTRY['action.open_short'].key
      || leaf.key === ATOM_CONTRACT_REGISTRY['action.close_short'].key,
    )
    if (hasDispatcherShortIntent) return

    const hasDispatcherLongIntent = dispatcherLeaves.some(leaf =>
      (leaf as { sideScope?: unknown }).sideScope === 'long'
      || leaf.key === ATOM_CONTRACT_REGISTRY['action.open_long'].key
      || leaf.key === ATOM_CONTRACT_REGISTRY['action.close_long'].key,
    )
    if (!hasDispatcherLongIntent) return

    const shortActionKeys: ReadonlySet<string> = new Set([
      ATOM_CONTRACT_REGISTRY['action.open_short'].key,
      ATOM_CONTRACT_REGISTRY['action.close_short'].key,
    ])
    const isShortActionExpr = (expr: AtomExpr): boolean =>
      collectAtomLeaves(expr).some(leaf => shortActionKeys.has(leaf.key))

    const nextRules = rules.flatMap((rule) => {
      const ruleEffects = listRuleEffects(rule.effects)
      const hasShortAction = ruleEffects.some(isShortActionExpr)
      if (rule.sideScope === 'short' && hasShortAction) return []
      const effects = ruleEffects.filter(effect => !isShortActionExpr(effect))
      if (hasShortAction && ruleEffects.length > 0 && effects.length === 0) return []
      return [{ ...rule, effects }]
    })

    if (nextRules.length !== rules.length || nextRules.some((rule, index) => listRuleEffects(rule.effects).length !== listRuleEffects(rules[index]?.effects).length)) {
      merged.rules = nextRules
    }
  }

  /**
   * Issue #1428 R-D：rules leaf params dispatcher fill（非破坏式补齐）。
   *
   * 触发条件（必须全部满足）：
   *   1. merged.rules 非空
   *   2. dispatcher 桶（atoms / triggers / actions / risk）含同 (key, sideScope) entry
   *   3. dispatcher entry params 含 leaf 缺失的 key
   *
   * 不触发：
   *   - 两者 params 完全相同 → 没必要补齐
   *   - 两者 params 有交集但值冲突 → 保留 planner 对应 key，仅补齐其它缺失 key
   *   - dispatcher 无同 key entry → 保留 planner
   *
   * 行为：缺失 key 从 dispatcher 候选中按发现顺序填入；不动 condition 树结构。
   */
  private overrideRulesLeafParamsFromDispatcher(
    merged: InternalPlannerPatch,
    dispatcher: InternalPlannerPatch,
  ): void {
    const rules = merged.rules
    if (!rules || rules.length === 0) return

    // 收集 dispatcher rules leaf，按 (key, sideScope) 索引；同签名保留全部候选，
    // 让互补候选可共同补齐同一个 planner leaf。
    const dispatcherByKey = new Map<string, Array<Record<string, unknown>>>()
    const indexLeaf = (
      entry: { key: string, sideScope?: 'long' | 'short' | 'both', params?: Record<string, unknown> },
      ruleSideScope: 'long' | 'short' | 'both',
    ): void => {
      const params = entry.params
      if (!params || Object.keys(params).length === 0) return
      const sig = `${entry.key}|${entry.sideScope ?? ruleSideScope}`
      const bucket = dispatcherByKey.get(sig) ?? []
      bucket.push(params)
      dispatcherByKey.set(sig, bucket)
    }
    for (const rule of dispatcher.rules ?? []) {
      for (const leaf of collectAtomLeaves(rule.condition)) indexLeaf(leaf, rule.sideScope)
      for (const effect of listRuleEffects(rule.effects)) {
        for (const leaf of collectAtomLeaves(effect)) indexLeaf(leaf, rule.sideScope)
      }
    }
    if (dispatcherByKey.size === 0) return

    const overrideLeaf = (leaf: AtomExprAtom, ruleSideScope: 'long' | 'short' | 'both'): AtomExprAtom => {
      const leafSide = leaf.sideScope ?? ruleSideScope
      const sig = `${leaf.key}|${leafSide}`
      // sideScope 回退保守：仅 planner leaf 标 long/short 时允许从 dispatcher 'both'
      //   抓（'both' 是更宽泛的 side，覆盖 long/short 安全）。不反向（planner 'both'
      //   不抓 dispatcher 'long'/'short'），避免把宽泛 leaf 误绑到具体 side params。
      //   反向 long↔short 也不互换（避免做空策略被覆盖为做多 params）。
      const candidates = [
        ...(dispatcherByKey.get(sig) ?? []),
        ...(sig === `${leaf.key}|both` ? [] : (dispatcherByKey.get(`${leaf.key}|both`) ?? [])),
      ]
      if (candidates.length === 0) return leaf
      const filledParams = this.repairMovingAverageCrossPlaceholderParams(
        leaf.key,
        this.fillMissingParams(leaf.params, candidates),
        candidates,
      )
      if (filledParams === leaf.params) return leaf
      return { ...leaf, params: filledParams }
    }

    const overrideExpr = (expr: AtomExpr, ruleSideScope: 'long' | 'short' | 'both'): AtomExpr => {
      if (expr.kind === 'atom') return overrideLeaf(expr, ruleSideScope)
      if (expr.kind === 'and') return { ...expr, children: expr.children.map(c => overrideExpr(c, ruleSideScope)) }
      if (expr.kind === 'or') return { ...expr, children: expr.children.map(c => overrideExpr(c, ruleSideScope)) }
      if (expr.kind === 'not') return { ...expr, child: overrideExpr(expr.child, ruleSideScope) }
      if (expr.kind === 'sequence') return { ...expr, steps: expr.steps.map(s => overrideExpr(s, ruleSideScope)) }
      return expr
    }

    let mutated = false
    const nextRules: SemanticRule[] = rules.map((rule) => {
      const newCondition = overrideExpr(rule.condition, rule.sideScope)
      const oldEffects = listRuleEffects(rule.effects)
      const newEffects = mapRuleEffectsByRole(rule.effects, eff => overrideExpr(eff, rule.sideScope))
      const newFlatEffects = listRuleEffects(newEffects)
      if (newCondition !== rule.condition || newFlatEffects.some((e, i) => e !== oldEffects[i])) {
        mutated = true
        return { ...rule, condition: newCondition, effects: newEffects }
      }
      return rule
    })
    if (mutated) {
      merged.rules = nextRules
    }
  }

  private fillMissingParams(
    base: Record<string, unknown> | undefined,
    candidates: ReadonlyArray<Record<string, unknown>>,
  ): Record<string, unknown> | undefined {
    let filled: Record<string, unknown> | undefined
    for (const candidate of candidates) {
      for (const [key, value] of Object.entries(candidate)) {
        if (base && key in base) continue
        if (filled && key in filled) continue
        filled = filled ? { ...filled, [key]: value } : { ...(base ?? {}), [key]: value }
      }
    }
    return filled ?? base
  }

  private repairMovingAverageCrossPlaceholderParams(
    key: string,
    base: Record<string, unknown> | undefined,
    candidates: ReadonlyArray<Record<string, unknown>>,
  ): Record<string, unknown> | undefined {
    if (key !== 'indicator.cross_over' && key !== 'indicator.cross_under') return base
    if (!base || !this.isMovingAverageIndicator(base.indicator)) return base

    const candidate = candidates.find(params => this.isMovingAverageIndicator(params.indicator))
    if (!candidate) return base

    if (candidate.priceCross === true) {
      const period = this.readPositiveNumberParam(candidate, 'period')
        ?? this.readPositiveNumberParam(candidate, 'fastPeriod')
      if (period === null) return base
      const next: Record<string, unknown> = {
        ...base,
        priceCross: true,
        period: this.isZeroPlaceholder(base.period) ? period : base.period,
        fastPeriod: this.isZeroPlaceholder(base.fastPeriod) ? period : base.fastPeriod,
      }
      delete next.slowPeriod
      return next
    }

    const fastPeriod = this.readPositiveNumberParam(candidate, 'fastPeriod')
    const slowPeriod = this.readPositiveNumberParam(candidate, 'slowPeriod')
    if (fastPeriod === null || slowPeriod === null) return base

    let next = base
    const setIfPlaceholder = (paramKey: string, value: number): void => {
      if (!this.isZeroPlaceholder(next[paramKey])) return
      next = { ...next, [paramKey]: value }
    }
    setIfPlaceholder('fastPeriod', fastPeriod)
    setIfPlaceholder('slowPeriod', slowPeriod)
    return next
  }

  private isMovingAverageIndicator(value: unknown): boolean {
    return value === 'ma' || value === 'sma' || value === 'ema'
  }

  private readPositiveNumberParam(params: Record<string, unknown>, key: string): number | null {
    const raw = params[key]
    const value = typeof raw === 'number' ? raw : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN)
    if (!Number.isFinite(value) || value <= 0) return null
    return value
  }

  private isZeroPlaceholder(value: unknown): boolean {
    return value === 0 || value === '0' || value === null
  }

  /**
   * Issue #1428 R-B：rules-first 路径下，把 dispatcher trigger/action/risk 桶里
   * 在 merged.rules 找不到等价 leaf 的 atom 提升为 single-leaf SemanticRule。
   *
   * 适用场景：planner LLM 只产了部分 rules，但 dispatcher 通过 regex + cross-clause
   * inheritance（#1383）抽到了更多 sibling/mirror。lift 后下游 projection / readiness /
   * IR compiler 走 rules-tree 时仍能看到这些 sibling，不丢策略语义。
   *
   * 守门：
   *   - merged.rules 为空（dispatcher-only 路径或 planner 未产 rules）→ 直接 return；
   *     下游照旧走扁平桶路径，零行为差
   *   - dispatcher.risk 桶 phase='risk' → 归位为 'exit'（rule.phase 不允许 risk）
   */
  private liftDispatcherAtomsIntoRules(
    merged: InternalPlannerPatch,
    dispatcher: InternalPlannerPatch,
  ): void {
    void merged
    void dispatcher
  }

  private composeDispatcherRulesIntoMergedRules(
    merged: InternalPlannerPatch,
    dispatcher: InternalPlannerPatch,
  ): void {
    const rules = merged.rules
    if (!rules || rules.length === 0) return
    const predicates = this.collectFallbackPredicateAtoms(dispatcher)
    const compositeRules = this.buildCompositeFallbackRules(
      predicates,
      this.collectFallbackEffectAtoms(dispatcher),
      '',
    )
    if (compositeRules.length === 0) return
    const hasEquivalentComposite = rules.some(rule =>
      collectAtomLeaves(rule.condition).some(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['condition.sequence'].key)
      && collectAtomLeaves(rule.condition).some(leaf => leaf.key === ATOM_CONTRACT_REGISTRY['indicator.above'].key),
    )
    if (hasEquivalentComposite) return

    const covered = this.collectCompositeCoveredPredicates(predicates, '')
    const kept = rules.filter(rule => !this.isRuleCoveredByComposite(rule, covered))
    merged.rules = [...compositeRules, ...kept]
  }

  private isRuleCoveredByComposite(
    rule: SemanticRule,
    coveredPredicates: ReadonlySet<FallbackPredicateAtom>,
  ): boolean {
    if (coveredPredicates.size === 0) return false
    const conditionLeaves = collectAtomLeaves(rule.condition)
    if (conditionLeaves.length === 0) return false
    return conditionLeaves.every(leaf =>
      Array.from(coveredPredicates).some(predicate => this.fallbackPredicateMatchesLeaf(predicate, leaf)),
    )
  }

  private fallbackPredicateMatchesLeaf(predicate: FallbackPredicateAtom, leaf: AtomExprAtom): boolean {
    if (predicate.key !== leaf.key) return false
    const predicatePeriod = this.readNumericParam(predicate.params, 'reference.period')
    const leafPeriod = this.readNumericParam(leaf.params, 'reference.period')
    if (predicatePeriod !== null || leafPeriod !== null) return predicatePeriod === leafPeriod
    return true
  }

  /**
   * 审查问题 Major #3：dedup 签名包含 phase 是**有意分轨**——同一 atom key 在不同
   * phase（如 entry 触发 vs exit 风控）语义是两个独立 rule，必须分别 lift。例：
   *   - planner: entry rule 含 `price.percent_change` 作为开仓触发
   *   - dispatcher.risk: 同 key `price.percent_change` 作为止损触发（phase=risk → exit）
   * 两者在下游 readiness/projection 各算一次是正确的（一个 trigger，一个 risk effect）。
   * 若日后 phase 枚举扩展需要软去重，再在此处加 (key, sideScope, paramsHash) fallback。
   */
  private leafSignature(
    key: string,
    phase: string,
    sideScope: 'long' | 'short' | 'both' | undefined,
    params: Record<string, unknown> | undefined,
  ): string {
    return `${key}|${phase}|${sideScope ?? 'both'}|${this.stableParamsHash(params)}`
  }

  private isNonEmpty(patch: InternalPlannerPatch | null | undefined): boolean {
    if (!patch) return false
    if (patch.contextSlots && Object.keys(patch.contextSlots).length > 0) return true
    return Array.isArray(patch.rules) && patch.rules.length > 0
  }

  private unionDedupByIdentity<T extends { key: string, phase?: string, params?: Record<string, unknown> }>(
    plannerList: readonly T[] | undefined,
    dispatcherList: readonly T[] | undefined,
  ): T[] | undefined {
    if (!plannerList?.length && !dispatcherList?.length) return undefined
    const seen = new Map<string, T>()
    const order: string[] = []
    // planner 先入队，享有 identity 优先权。
    for (const entry of plannerList ?? []) {
      const id = this.atomIdentity(entry)
      if (!seen.has(id)) {
        seen.set(id, entry)
        order.push(id)
      }
    }
    for (const entry of dispatcherList ?? []) {
      const id = this.atomIdentity(entry)
      if (!seen.has(id)) {
        seen.set(id, entry)
        order.push(id)
      }
    }
    return order.map(id => seen.get(id) as T)
  }

  private unionDedupByKeyAndHash<T extends { key: string, params?: Record<string, unknown> }>(
    plannerList: readonly T[] | undefined,
    dispatcherList: readonly T[] | undefined,
    primary: 'left' | 'right',
  ): T[] | undefined {
    if (!plannerList?.length && !dispatcherList?.length) return undefined
    const first = primary === 'left' ? plannerList : dispatcherList
    const second = primary === 'left' ? dispatcherList : plannerList
    const seen = new Map<string, T>()
    const order: string[] = []
    for (const entry of first ?? []) {
      const id = `${entry.key}::${this.stableParamsHash(entry.params)}`
      if (!seen.has(id)) {
        seen.set(id, entry)
        order.push(id)
      }
    }
    for (const entry of second ?? []) {
      const id = `${entry.key}::${this.stableParamsHash(entry.params)}`
      if (!seen.has(id)) {
        seen.set(id, entry)
        order.push(id)
      }
    }
    return order.map(id => seen.get(id) as T)
  }

  private atomIdentity(entry: { key: string, phase?: string, params?: Record<string, unknown> }): string {
    const phase = entry.phase ?? 'entry'
    return `${entry.key}::${phase}::${this.stableParamsHash(entry.params)}`
  }

  private orchestrationIdentity(node: { id?: string, key?: string, params?: Record<string, unknown> }): string {
    if (node.id && typeof node.id === 'string' && node.id.length > 0) {
      return `id::${node.id}`
    }
    const key = node.key ?? '__nokey__'
    return `${key}::${this.stableParamsHash(node.params)}`
  }

  private stableParamsHash(params: Record<string, unknown> | undefined): string {
    if (!params) return 'null'
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
}
