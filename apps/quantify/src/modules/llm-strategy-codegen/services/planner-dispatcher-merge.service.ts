import { Injectable, Logger } from '@nestjs/common'

import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import { collectAtomLeaves, listRuleEffects, mapRuleEffectsByRole, semanticRuleSchema, type AtomExpr, type AtomExprAtom, type SemanticRule } from '../types/atom-expr'
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
    dispatcherPatch: CodegenSemanticPatch | null | undefined,
    userMessage: string,
  ): CodegenSemanticPatch | null {
    if (!this.isNonEmpty(dispatcherPatch)) return null
    const dispatcher = this.expandRulesForInternalFlat(dispatcherPatch as CodegenSemanticPatch)
    const rules = this.buildFallbackRules(dispatcher, userMessage)
    if (rules.length === 0) return null
    const position = this.buildFallbackPositionFromDispatcherConstraints(dispatcher)
    return {
      ...(dispatcher.contextSlots ? { contextSlots: dispatcher.contextSlots } : {}),
      ...(position ? { position } : dispatcher.position ? { position: dispatcher.position } : {}),
      rules,
    }
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

  private expandRulesForInternalFlat(dispatcher: CodegenSemanticPatch): CodegenSemanticPatch {
    const rules = dispatcher.rules
    if (!rules || rules.length === 0) return dispatcher

    const expanded: CodegenSemanticPatch = { ...dispatcher }
    const atoms = [...(dispatcher.atoms ?? [])]
    const triggers = [...(dispatcher.triggers ?? [])]
    const actions = [...(dispatcher.actions ?? [])]
    const risk = [...(dispatcher.risk ?? [])]
    let position = dispatcher.position

    const pushLegacyAtom = (
      atom: AtomExprAtom,
      phase: SemanticRule['phase'],
      sideScope: 'long' | 'short' | 'both',
    ): void => {
      if (atom.key === 'position.sizing') {
        const sizing = atom.params.sizing
        if (sizing && typeof sizing === 'object' && !Array.isArray(sizing)) {
          const value = typeof (sizing as { value?: unknown }).value === 'number'
            ? (sizing as { value: number }).value
            : 0
          position = {
            mode: position?.mode ?? 'fixed',
            value: position?.value ?? value,
            positionMode: position?.positionMode ?? 'long_only',
            status: position?.status ?? 'locked',
            source: position?.source ?? 'user_explicit',
            openSlots: position?.openSlots ?? [],
            ...position,
            sizing: sizing as NonNullable<CodegenSemanticPatch['position']>['sizing'],
          }
        }
        return
      }

      const evidence = atom.evidence
        ? { evidence: { text: atom.evidence.text, source: 'user_explicit' as const } }
        : {}
      const node = {
        key: atom.key,
        phase,
        sideScope: atom.sideScope ?? sideScope,
        params: atom.params ?? {},
        ...evidence,
      }
      atoms.push(node)
      const bucket = this.readAtomBucket(atom.key)
      if (bucket === 'trigger') {
        triggers.push({
          key: atom.key,
          phase,
          sideScope: atom.sideScope ?? sideScope,
          params: atom.params ?? {},
          ...evidence,
        })
      }
      else if (bucket === 'action') {
        actions.push({
          key: atom.key,
          phase,
          params: atom.params ?? {},
          ...evidence,
        })
      }
      else if (bucket === 'risk') {
        risk.push({
          key: atom.key,
          params: atom.params ?? {},
          ...evidence,
        })
      }
    }

    for (const rule of rules) {
      for (const leaf of collectAtomLeaves(rule.condition)) {
        pushLegacyAtom(leaf, rule.phase, rule.sideScope)
      }
      for (const effect of listRuleEffects(rule.effects)) {
        for (const leaf of collectAtomLeaves(effect)) {
          pushLegacyAtom(leaf, rule.phase, rule.sideScope)
        }
      }
    }

    const dedupe = <T extends { key: string, phase?: unknown, sideScope?: unknown, params?: unknown }>(items: T[]): T[] =>
      this.dedupeFallbackAtoms(items)

    expanded.atoms = dedupe(atoms) as CodegenSemanticPatch['atoms']
    expanded.triggers = dedupe(triggers) as CodegenSemanticPatch['triggers']
    expanded.actions = dedupe(actions) as CodegenSemanticPatch['actions']
    expanded.risk = dedupe(risk) as CodegenSemanticPatch['risk']
    if (position) expanded.position = position
    return expanded
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

  private buildFallbackRules(dispatcher: CodegenSemanticPatch, userMessage: string): SemanticRule[] {
    const predicateAtoms = this.collectFallbackPredicateAtoms(dispatcher)
    if (predicateAtoms.length === 0) return []
    const effectAtoms = this.collectFallbackEffectAtoms(dispatcher)
    const rules: SemanticRule[] = this.buildCompositeFallbackRules(predicateAtoms, effectAtoms, userMessage)
    const compositeCoveredPredicates = this.collectCompositeCoveredPredicates(predicateAtoms)
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
      const signature = `${phase}|${sideScope}|${condition.key}|${JSON.stringify(condition.params)}|${effects.map(e => e.key).join(',')}`
      if (seen.has(signature)) continue
      seen.add(signature)
      rules.push({
        id: `deterministic-rule-${rules.length + 1}`,
        phase,
        sideScope,
        condition,
        effects,
        ...this.resolveFallbackEvidence(predicate, userMessage),
      })
    }

    return rules
  }

  private appendMultiTimeframeEntryRules(
    rules: SemanticRule[],
    predicateAtoms: ReadonlyArray<FallbackPredicateAtom>,
    effectAtoms: ReadonlyArray<AtomExprAtom>,
    dispatcher: CodegenSemanticPatch,
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
        effects,
        ...evidence,
      })
      group.forEach(predicate => covered.add(predicate))
    }
    return covered
  }

  private collectCompositeCoveredPredicates(
    predicateAtoms: ReadonlyArray<FallbackPredicateAtom>,
  ): ReadonlySet<FallbackPredicateAtom> {
    const covered = new Set<FallbackPredicateAtom>()
    const pullback = this.findPullbackReclaimPredicate(predicateAtoms)
    if (!pullback) return covered
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
    return covered
  }

  private buildCompositeFallbackRules(
    predicateAtoms: ReadonlyArray<FallbackPredicateAtom>,
    effectAtoms: ReadonlyArray<AtomExprAtom>,
    userMessage: string,
  ): SemanticRule[] {
    const rules: SemanticRule[] = []
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
      effects,
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

  private normalizeFallbackRuleSideScope(
    predicate: FallbackPredicateAtom,
    phase: SemanticRule['phase'],
    dispatcher: CodegenSemanticPatch,
    userMessage: string,
  ): 'long' | 'short' | 'both' {
    const current = predicate.sideScope ?? 'both'
    if (phase !== 'exit' || current !== 'short') return current
    const evidence = this.readEvidenceText(predicate) ?? userMessage
    const explicitShortExit = /平空|空单|空仓|close\s+short/iu.test(evidence)
    if (explicitShortExit) return current
    const hasShortIntent = this.hasShortEntryIntent(dispatcher, userMessage)
    return hasShortIntent ? current : 'long'
  }

  private hasShortEntryIntent(dispatcher: CodegenSemanticPatch, userMessage: string): boolean {
    const actionOpenShortKey = ATOM_CONTRACT_REGISTRY['action.open_short'].key
    if ([...(dispatcher.actions ?? []), ...(dispatcher.atoms ?? [])].some(atom => atom.key === actionOpenShortKey)) return true
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
    dispatcher: CodegenSemanticPatch,
  ): CodegenSemanticPatch['position'] | null {
    const constraints = (dispatcher.atoms ?? [])
      .filter(atom => this.readAtomBucket(atom.key) === 'positionConstraint')
      .map(atom => ({
        key: atom.key as NonNullable<CodegenSemanticPatch['position']>['constraints'][number]['key'],
        params: atom.params ?? {},
        ...(atom.evidence ? { evidence: atom.evidence } : {}),
        ...(atom.source ? { source: atom.source } : {}),
        ...(atom.openSlots ? { openSlots: atom.openSlots } : {}),
        ...(atom.contracts ? { contracts: atom.contracts } : {}),
      }))

    if (constraints.length === 0) return dispatcher.position ?? null

    const existingConstraints = dispatcher.position?.constraints ?? []
    return {
      mode: dispatcher.position?.mode ?? 'constraint_only',
      value: dispatcher.position?.value ?? 0,
      positionMode: dispatcher.position?.positionMode ?? 'long_only',
      status: dispatcher.position?.status ?? 'locked',
      source: dispatcher.position?.source ?? 'user_explicit',
      openSlots: dispatcher.position?.openSlots ?? [],
      ...(dispatcher.position?.sizing !== undefined ? { sizing: dispatcher.position.sizing } : {}),
      constraints: this.unionDedupByKeyAndHash(existingConstraints, constraints, 'right') ?? constraints,
    }
  }

  private collectFallbackPredicateAtoms(dispatcher: CodegenSemanticPatch): FallbackPredicateAtom[] {
    const out: FallbackPredicateAtom[] = []
    const push = (item: typeof out[number]): void => {
      if (typeof item.key !== 'string' || item.key.length === 0) return
      out.push(item)
    }
    for (const trigger of dispatcher.triggers ?? []) push(trigger)
    for (const atom of dispatcher.atoms ?? []) {
      const bucket = this.readAtomBucket(atom.key)
      if (
        this.atomHasRole(atom.key, 'predicate')
        || (bucket === 'positionConstraint' && CONDITION_ALLOWED_POSITION_CONSTRAINT_ATOMS.has(atom.key))
      ) {
        push(atom)
      }
      const addPositionPredicate = this.buildAddPositionTriggerPredicate(atom)
      if (addPositionPredicate) push(addPositionPredicate)
    }
    const dcaAtom = this.findDispatcherDcaScheduleAtom(dispatcher)
    if (dcaAtom) {
      push({
        key: EXECUTION_ON_START_ATOM_KEY,
        phase: 'entry',
        sideScope: 'long',
        params: { timing: 'on_start', orderType: 'market', occurrence: 'once' },
        evidence: dcaAtom.evidence,
        sourceActionKey: DCA_SCHEDULE_ATOM_KEY,
      })
    }
    return this.dedupeFallbackAtoms(out)
  }

  private collectFallbackEffectAtoms(dispatcher: CodegenSemanticPatch): AtomExprAtom[] {
    const out: AtomExprAtom[] = []
    const push = (key: string, params: Record<string, unknown> = {}, sideScope?: 'long' | 'short' | 'both'): void => {
      if (!key) return
      out.push({
        kind: 'atom',
        key,
        params,
        ...(sideScope ? { sideScope } : {}),
      })
    }
    for (const action of dispatcher.actions ?? []) {
      push(action.key, action.params ?? {})
    }
    for (const risk of dispatcher.risk ?? []) {
      push(risk.key, risk.params ?? {})
    }
    for (const atom of dispatcher.atoms ?? []) {
      const bucket = this.readAtomBucket(atom.key)
      if (bucket === 'action' || bucket === 'risk' || bucket === 'orchestration') {
        if (bucket === 'orchestration' && atom.key.startsWith('scope.')) continue
        push(atom.key, atom.params ?? {}, atom.sideScope)
      }
    }
    const dcaAtom = this.findDispatcherDcaScheduleAtom(dispatcher)
    if (dcaAtom && !out.some(effect => effect.key === ADD_POSITION_ATOM_KEY)) {
      push(ADD_POSITION_ATOM_KEY, {
        lifecycleKind: 'dca_schedule',
        sizing: (dcaAtom.params ?? {}).perOrderSizing,
        actionSide: 'long',
      }, 'long')
    }
    return this.dedupeFallbackEffects(out)
  }

  private findDispatcherDcaScheduleAtom(
    dispatcher: CodegenSemanticPatch,
  ): { params?: Record<string, unknown>, evidence?: { text?: unknown } } | null {
    return (dispatcher.atoms ?? []).find(atom => atom.key === DCA_SCHEDULE_ATOM_KEY) ?? null
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
      const defaults = this.defaultActionEffects(args.phase, args.sideScope)
      return this.dedupeFallbackEffects([...phaseMatched, ...defaults])
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
    const sideScope = atom.sideScope ?? 'long'
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

  private dedupeFallbackAtoms<T extends { key: string, phase?: unknown, sideScope?: unknown, params?: unknown }>(items: T[]): T[] {
    const seen = new Set<string>()
    const out: T[] = []
    for (const item of items) {
      const signature = `${item.key}|${String(item.phase ?? '')}|${String(item.sideScope ?? '')}|${JSON.stringify(item.params ?? {})}`
      if (seen.has(signature)) continue
      seen.add(signature)
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
    if (item.key.endsWith('_long')) return 'long'
    if (item.key.endsWith('_short')) return 'short'
    const paramSideScope = item.params.sideScope
    if (paramSideScope === 'long' || paramSideScope === 'short') return paramSideScope
    return item.sideScope === 'long' || item.sideScope === 'short' ? item.sideScope : 'both'
  }

  mergePlannerAndDispatcherPatches(
    plannerPatch: CodegenSemanticPatch | null | undefined,
    dispatcherPatch: CodegenSemanticPatch | null | undefined,
  ): CodegenSemanticPatch | null {
    const plannerHas = this.isNonEmpty(plannerPatch)
    const dispatcherHas = this.isNonEmpty(dispatcherPatch)
    if (!plannerHas && !dispatcherHas) return null
    // Issue #1443：planner-only / dispatcher-only 早返路径也必须走 filter pass
    //   过滤 always-on + action 噪音 rule（否则用户实测策略 1 这类 planner-only 场景
    //   下「出场：平多」噪音 rule 仍漏过）。
    if (plannerHas && !dispatcherHas) {
      const cloned = { ...(plannerPatch as CodegenSemanticPatch) }
      try {
        this.filterAlwaysOnActionNoiseRules(cloned)
      }
      catch (err) {
        this.logger.warn(`filterAlwaysOnActionNoiseRules (planner-only path) 抛出异常，已 fail-open：${err instanceof Error ? err.message : String(err)}`)
      }
      return cloned
    }
    if (!plannerHas && dispatcherHas) return dispatcherPatch as CodegenSemanticPatch

    const planner = plannerPatch as CodegenSemanticPatch
    const dispatcher = this.expandRulesForInternalFlat(dispatcherPatch as CodegenSemanticPatch)
    const merged: CodegenSemanticPatch = {}

    // contextSlots：planner 优先（NL 理解 symbol/timeframe 更广）。
    const ctxPlanner = planner.contextSlots
    const ctxDispatcher = dispatcher.contextSlots
    if (ctxPlanner || ctxDispatcher) {
      merged.contextSlots = { ...(ctxDispatcher ?? {}), ...(ctxPlanner ?? {}) }
    }

    // atoms / triggers / actions / risk：identity dedup，planner 条目优先。
    const atoms = this.unionDedupByIdentity(planner.atoms, dispatcher.atoms)
    if (atoms) merged.atoms = atoms
    const triggers = this.unionDedupByIdentity(planner.triggers, dispatcher.triggers)
    if (triggers) merged.triggers = triggers
    const actions = this.unionDedupByIdentity(planner.actions, dispatcher.actions)
    if (actions) merged.actions = actions
    const risk = this.unionDedupByIdentity(planner.risk, dispatcher.risk)
    if (risk) merged.risk = risk

    // position：dispatcher 优先（regex 数值更准），constraints union+dedup。
    if (planner.position || dispatcher.position) {
      const base = dispatcher.position ?? planner.position
      if (base) {
        const constraints = this.unionDedupByKeyAndHash(
          planner.position?.constraints,
          dispatcher.position?.constraints,
          dispatcher.position ? 'right' : 'left',
        )
        merged.position = {
          ...base,
          ...(constraints ? { constraints } : (base.constraints ? { constraints: base.constraints } : {})),
        }
      }
      else {
        merged.position = base
      }
    }

    // orchestration.nodes：union dedup。
    const plannerNodes = planner.orchestration?.nodes
    const dispatcherNodes = dispatcher.orchestration?.nodes
    if ((plannerNodes && plannerNodes.length) || (dispatcherNodes && dispatcherNodes.length)) {
      const nodes = this.unionDedupOrchestrationNodes(plannerNodes, dispatcherNodes)
      if (nodes && nodes.length > 0) {
        merged.orchestration = { nodes }
      }
    }

    // Issue #1395 Wave 4：rules[] 表达式树是 planner 独有产物，dispatcher 不产 rules。
    // 之前漏掉透传 → 整棵 rules 树被 merge 步骤吞掉，state.rules 永远为空，
    // 下游 readiness / projection / IR compiler 全部退化到 atoms[] 5-bucket 路径。
    const plannerRules = (planner as { rules?: unknown }).rules
    const dispatcherRules = (dispatcher as { rules?: unknown }).rules
    const rulesFromPlanner = Array.isArray(plannerRules) ? plannerRules : undefined
    const rulesFromDispatcher = Array.isArray(dispatcherRules) ? dispatcherRules : undefined
    if (rulesFromPlanner && rulesFromPlanner.length > 0) {
      (merged as { rules?: unknown }).rules = rulesFromPlanner
    }
    else if (rulesFromDispatcher && rulesFromDispatcher.length > 0) {
      (merged as { rules?: unknown }).rules = rulesFromDispatcher
    }

    // 同样透传 __zodQuarantine（planner rules zod 失败明细），供观测层消费。
    const plannerQuarantine = (planner as { __zodQuarantine?: unknown }).__zodQuarantine
    if (Array.isArray(plannerQuarantine) && plannerQuarantine.length > 0) {
      (merged as { __zodQuarantine?: unknown }).__zodQuarantine = plannerQuarantine
    }

    // Issue #1428 R-D（先于 R-B 跑）：对 merged.rules 中每个 atom leaf，若 dispatcher
    //   桶含同 (key, sideScope) entry，则从 dispatcher 候选补齐 leaf 缺失 params。
    //   已由 planner 明确给出的 params 永不覆盖；dispatcher regex 抽到的用户原话精细
    //   params（如 BOLL(5,1) / grid sizing）只作为缺省补充。
    //
    //   审查问题 Major #2：两条 pass 各自外层 try/catch，异常时 log + 保留 merged
    //     原状返回，绝不破坏现行 merge 的 fail-open 承诺。
    try {
      this.overrideRulesLeafParamsFromDispatcher(merged, dispatcher)
    }
    catch (err) {
      this.logger.warn(`overrideRulesLeafParamsFromDispatcher 抛出异常，已 fail-open 保留 merged 原状：${err instanceof Error ? err.message : String(err)}`)
    }

    // Issue #1428 R-B：rules 非空时把 dispatcher 桶里 rules 不含的 atom 提升为
    //   single-leaf SemanticRule 追加到 merged.rules，让 cross-clause inheritance
    //   (#1383) 派生的 sibling/mirror 在 rules-tree 上也可见。
    try {
      this.liftDispatcherAtomsIntoRules(merged, dispatcher)
    }
    catch (err) {
      this.logger.warn(`liftDispatcherAtomsIntoRules 抛出异常，已 fail-open 保留 merged 原状：${err instanceof Error ? err.message : String(err)}`)
    }

    try {
      this.composeDispatcherRulesIntoMergedRules(merged, dispatcher)
    }
    catch (err) {
      this.logger.warn(`composeDispatcherRulesIntoMergedRules 抛出异常，已 fail-open 保留 merged 原状：${err instanceof Error ? err.message : String(err)}`)
    }

    // Planner 可能把「买入/卖出」类 long-only 动词扩写成反手做空。
    // Dispatcher 的 verb-side resolver 是 deterministic 证据源；若 dispatcher 完全没有 short
    // 意图，则裁掉 planner rules 中的 short action/rule，避免展示层污染主链路。
    try {
      this.prunePlannerShortActionsWithoutDispatcherIntent(merged, dispatcher)
    }
    catch (err) {
      this.logger.warn(`prunePlannerShortActionsWithoutDispatcherIntent 抛出异常，已 fail-open 保留 merged 原状：${err instanceof Error ? err.message : String(err)}`)
    }

    try {
      this.bindDispatcherLifecycleEffectsIntoPlannerRules(merged, dispatcher)
    }
    catch (err) {
      this.logger.warn(`bindDispatcherLifecycleEffectsIntoPlannerRules 抛出异常，已 fail-open 保留 merged 原状：${err instanceof Error ? err.message : String(err)}`)
    }

    // Issue #1443：过滤掉 "always-on condition + action effects" 噪音 rule。
    //   这类 rule 通常是 planner/dispatcher 把 trigger 和 action 错绑（trigger 缺失或
    //   被识别为 execution.on_start always-on），让 UI 出现"出场：平多" / "入场：开多"
    //   等无条件动作的噪音。用户没明确说"启动即开/平仓"——这种 rule 应丢弃。
    //   risk effects（stop_loss/take_profit）允许 always-on（"持仓期间一直挂止损"是
    //   常见且合理语义）。
    try {
      this.filterAlwaysOnActionNoiseRules(merged)
    }
    catch (err) {
      this.logger.warn(`filterAlwaysOnActionNoiseRules 抛出异常，已 fail-open 保留 merged 原状：${err instanceof Error ? err.message : String(err)}`)
    }

    return merged
  }

  mergeDeterministicExecutionSlots(
    plannerPatch: CodegenSemanticPatch | null | undefined,
    dispatcherPatch: CodegenSemanticPatch | null | undefined,
    userMessage = '',
  ): CodegenSemanticPatch | null {
    if (!this.isNonEmpty(plannerPatch)) {
      return this.buildRulesTreeFallbackFromDispatcher(dispatcherPatch, userMessage) ?? plannerPatch ?? null
    }
    if (!this.isNonEmpty(dispatcherPatch)) return plannerPatch as CodegenSemanticPatch
    const planner = plannerPatch as CodegenSemanticPatch
    const dispatcher = this.expandRulesForInternalFlat(dispatcherPatch as CodegenSemanticPatch)
    const merged: CodegenSemanticPatch = { ...planner }
    if (planner.contextSlots || dispatcher.contextSlots) {
      const plannerContext = planner.contextSlots ?? {}
      const dispatcherContext = dispatcher.contextSlots ?? {}
      const dispatcherSymbol = (dispatcherContext as { symbol?: { source?: unknown } }).symbol
      merged.contextSlots = {
        ...plannerContext,
        ...dispatcherContext,
        ...(
          plannerContext.symbol
          && dispatcherSymbol
          && dispatcherSymbol.source !== 'user_explicit'
            ? { symbol: plannerContext.symbol }
            : {}
        ),
      }
    }
    if (dispatcher.position) {
      const constraints = this.unionDedupByKeyAndHash(
        planner.position?.constraints,
        dispatcher.position.constraints,
        'right',
      )
      merged.position = {
        ...dispatcher.position,
        ...(constraints ? { constraints } : {}),
      }
    }
    try {
      this.mergeDeterministicRulesIntoPlanner(merged, dispatcher, userMessage)
    }
    catch (err) {
      this.logger.warn(`mergeDeterministicRulesIntoPlanner 抛出异常，已 fail-open 保留 planner rules：${err instanceof Error ? err.message : String(err)}`)
    }
    return merged
  }

  private mergeDeterministicRulesIntoPlanner(
    merged: CodegenSemanticPatch,
    dispatcher: CodegenSemanticPatch,
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
      if (this.isDeterministicRuleCovered(nextRules, deterministicRule)) continue
      nextRules.push(deterministicRule)
    }
    merged.rules = nextRules
  }

  private shouldAppendDeterministicCoreTradeRule(rule: SemanticRule): boolean {
    const leaves = collectAtomLeaves(rule.condition)
    if (leaves.length !== 1) return false
    const conditionKey = leaves[0]?.key
    const allowedConditionKeys = new Set<string>([
      ATOM_CONTRACT_REGISTRY['indicator.above'].key,
      ATOM_CONTRACT_REGISTRY['indicator.below'].key,
      ATOM_CONTRACT_REGISTRY['indicator.cross_over'].key,
      ATOM_CONTRACT_REGISTRY['indicator.cross_under'].key,
    ])
    if (!conditionKey || !allowedConditionKeys.has(conditionKey)) return false

    const allowedActionKeys = new Set<string>([
      ATOM_CONTRACT_REGISTRY['action.open_long'].key,
      ATOM_CONTRACT_REGISTRY['action.open_short'].key,
      ATOM_CONTRACT_REGISTRY['action.close_long'].key,
      ATOM_CONTRACT_REGISTRY['action.close_short'].key,
    ])
    return listRuleEffects(rule.effects).some(effect =>
      collectAtomLeaves(effect).some(leaf => allowedActionKeys.has(leaf.key)),
    )
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

  private ruleEffectsCover(existingRule: SemanticRule, candidateRule: SemanticRule): boolean {
    const existingEffects = listRuleEffects(existingRule.effects).flatMap(effect => collectAtomLeaves(effect))
    const candidateEffects = listRuleEffects(candidateRule.effects).flatMap(effect => collectAtomLeaves(effect))
    return candidateEffects.every(candidate =>
      existingEffects.some(existing => this.atomLeafMatches(existing, candidate)),
    )
  }

  private atomLeafMatches(existing: AtomExprAtom, candidate: AtomExprAtom): boolean {
    if (existing.key !== candidate.key) return false
    if (this.stableParamsHash(existing.params) === this.stableParamsHash(candidate.params)) return true
    if (this.semanticAtomLeafMatches(existing, candidate)) return true
    return this.paramsSubsetMatch(existing.params, candidate.params)
  }

  private semanticAtomLeafMatches(existing: AtomExprAtom, candidate: AtomExprAtom): boolean {
    const existingIndicator = this.readStringParam(existing.params, 'indicator')
    const candidateIndicator = this.readStringParam(candidate.params, 'indicator')
    if (existingIndicator && candidateIndicator && !this.indicatorAliasesMatch(existingIndicator, candidateIndicator)) return false

    if (
      existing.key === ATOM_CONTRACT_REGISTRY['indicator.above'].key
      || existing.key === ATOM_CONTRACT_REGISTRY['indicator.below'].key
    ) {
      const existingPeriod = this.readNumericParam(existing.params, 'reference.period')
      const candidatePeriod = this.readNumericParam(candidate.params, 'reference.period')
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
      if (existingValue === null || candidateValue === null) return false
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
    merged: CodegenSemanticPatch,
    dispatcher: CodegenSemanticPatch,
  ): void {
    const rules = merged.rules
    if (!rules || rules.length === 0) return
    const dispatcherActions = [...(dispatcher.actions ?? []), ...(dispatcher.atoms ?? [])]
      .filter(atom => atom.key === ADD_POSITION_ATOM_KEY)
    const dispatcherDca = this.findDispatcherDcaScheduleAtom(dispatcher)
    if (dispatcherActions.length === 0 && !dispatcherDca) return

    let mutated = false
    const nextRules = rules.map((rule) => {
      if (rule.condition.kind === 'atom') {
        const condition = rule.condition
        const matched = dispatcherActions.find((action) => {
          const predicate = this.buildAddPositionTriggerPredicate(action)
          if (!predicate) return false
          return predicate.key === condition.key
            && this.paramsLooselyMatch(condition.params, predicate.params)
        })
        if (matched && !listRuleEffects(rule.effects).some(effect => collectAtomLeaves(effect).some(leaf => leaf.key === ADD_POSITION_ATOM_KEY))) {
          const matchedSideScope = (matched as { sideScope?: 'long' | 'short' | 'both' }).sideScope
          mutated = true
          return {
            ...rule,
            effects: [
              ...this.removeLifecycleOpenScaffoldEffects(listRuleEffects(rule.effects), matchedSideScope ?? rule.sideScope)
                .filter(effect => !collectAtomLeaves(effect).some(leaf => leaf.key === DCA_SCHEDULE_ATOM_KEY)),
              {
                kind: 'atom' as const,
                key: ADD_POSITION_ATOM_KEY,
                params: matched.params ?? {},
                ...(matchedSideScope ? { sideScope: matchedSideScope } : {}),
              },
            ],
          }
        }
      }
      if (dispatcherDca && this.shouldAttachDcaSchedule(rule)) {
        const evidenceText = typeof dispatcherDca.evidence?.text === 'string' && dispatcherDca.evidence.text.trim().length > 0
          ? dispatcherDca.evidence.text.trim()
          : null
        mutated = true
        return {
          ...rule,
          effects: [
            ...this.removeLifecycleOpenScaffoldEffects(listRuleEffects(rule.effects), rule.sideScope),
            {
              kind: 'atom' as const,
              key: DCA_SCHEDULE_ATOM_KEY,
              params: dispatcherDca.params ?? {},
              ...(evidenceText ? { evidence: { text: evidenceText } } : {}),
            },
          ],
        }
      }
      if (listRuleEffects(rule.effects).length > 0) return rule
      if (rule.condition.kind !== 'atom') return rule
      const condition = rule.condition
      const matched = dispatcherActions.find((action) => {
        const predicate = this.buildAddPositionTriggerPredicate(action)
        if (!predicate) return false
        return predicate.key === condition.key
          && this.paramsLooselyMatch(condition.params, predicate.params)
      })
      if (!matched) return rule
      const matchedSideScope = (matched as { sideScope?: 'long' | 'short' | 'both' }).sideScope
      mutated = true
      return {
        ...rule,
        effects: [{
          kind: 'atom' as const,
          key: ADD_POSITION_ATOM_KEY,
          params: matched.params ?? {},
          ...(matchedSideScope ? { sideScope: matchedSideScope } : {}),
        }],
      }
    })
    if (mutated) merged.rules = nextRules
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
  private filterAlwaysOnActionNoiseRules(merged: CodegenSemanticPatch): void {
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

  private prunePlannerShortActionsWithoutDispatcherIntent(
    merged: CodegenSemanticPatch,
    dispatcher: CodegenSemanticPatch,
  ): void {
    const rules = merged.rules
    if (!rules || rules.length === 0) return

    const dispatcherLeaves = [
      ...(dispatcher.atoms ?? []),
      ...(dispatcher.triggers ?? []),
      ...(dispatcher.actions ?? []),
      ...(dispatcher.risk ?? []),
    ]
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
    merged: CodegenSemanticPatch,
    dispatcher: CodegenSemanticPatch,
  ): void {
    const rules = merged.rules
    if (!rules || rules.length === 0) return

    // 收集 dispatcher 所有桶里的 atom，按 (key, sideScope) 索引；同签名保留全部候选，
    // 让互补候选可共同补齐同一个 planner leaf。
    const dispatcherByKey = new Map<string, Array<Record<string, unknown>>>()
    const indexBucket = (
      source: ReadonlyArray<{ key: string, sideScope?: 'long' | 'short' | 'both', params?: Record<string, unknown> }> | undefined,
    ): void => {
      if (!source) return
      for (const entry of source) {
        const params = entry.params
        if (!params || Object.keys(params).length === 0) continue
        const sig = `${entry.key}|${entry.sideScope ?? 'both'}`
        const bucket = dispatcherByKey.get(sig) ?? []
        bucket.push(params)
        dispatcherByKey.set(sig, bucket)
      }
    }
    indexBucket(dispatcher.atoms)
    indexBucket(dispatcher.triggers)
    indexBucket(dispatcher.actions)
    indexBucket(dispatcher.risk)
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
      const filledParams = this.fillMissingParams(leaf.params, candidates)
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
    merged: CodegenSemanticPatch,
    dispatcher: CodegenSemanticPatch,
  ): void {
    const rules = merged.rules
    if (!rules || rules.length === 0) return

    // Issue #1443：lift 的定位是「planner 漏 atom 时的兜底」，不应产生 sibling 重复。
    //   旧实现用 (key, phase, sideScope, paramsHash) 严格签名 dedup，但 planner LLM 与
    //   dispatcher 抽到的同一 atom 经常 params 不完全相同（如 planner 多 basis 字段、
    //   dispatcher 缺）→ paramsHash 不同 → lift 重复条目，UI 出现「入场×2/出场×2」。
    //
    //   通用修复：dedup 用 atom key only。planner rules 已含某 key 的 leaf（任何 phase/
    //   sideScope/params），就认为该 atom 已被"识别"，dispatcher 不再 lift 同 key 兜底。
    //   只在 planner 完全没产某 atom key 的场景下，dispatcher 才作为兜底 lift（如
    //   BOLL touch_lower 没产时由 dispatcher cross-clause inheritance 派生 → 仍 lift）。
    //
    //   边界：用户策略真有两条同 key 不同 params 的 entry（如「3 分钟内跌 1%」+
    //   「5 分钟内跌 2%」）时，planner 应产 2 条 rule，本 dedup 不影响；
    //   若 planner 只产 1 条 + dispatcher 抽到另一条不同 params，dispatcher 的额外那条
    //   会被 dedup 跳过——这是设计取舍：宁可丢一个边角识别，也不引入重复 sibling 噪音。
    const existingKeys = new Set<string>()
    for (const rule of rules) {
      for (const leaf of collectAtomLeaves(rule.condition)) {
        existingKeys.add(leaf.key)
      }
      for (const eff of listRuleEffects(rule.effects)) {
        for (const leaf of collectAtomLeaves(eff)) {
          existingKeys.add(leaf.key)
        }
      }
    }

    const lifted: SemanticRule[] = []
    let liftIndex = 0
    const liftPhase = (phase: 'entry' | 'exit' | 'risk' | 'gate' | 'program' | undefined): SemanticRule['phase'] => {
      if (phase === 'entry' || phase === 'exit' || phase === 'gate' || phase === 'program') return phase
      // TODO(#1428 R-A follow-up)：'risk' 硬降级为 'exit' 是 rule.phase 枚举不允许
      //   'risk' 时的合理映射；若 #1395 后续扩展 phase 枚举支持 'risk'，需重审。
      if (phase === 'risk') return 'exit'
      return 'entry'
    }
    const collectBucket = (
      source: ReadonlyArray<{ key: string, phase?: 'entry' | 'exit' | 'risk' | 'gate' | 'program', sideScope?: 'long' | 'short' | 'both', params?: Record<string, unknown> }> | undefined,
      defaultPhase: 'entry' | 'exit',
    ): void => {
      if (!source) return
      for (const entry of source) {
        // Issue #1443：dedup 用 key only（见 existingKeys 注释），不再用严格四元签名
        if (existingKeys.has(entry.key)) continue
        existingKeys.add(entry.key)
        const phase = liftPhase(entry.phase ?? defaultPhase)
        const sideScope = (entry.sideScope ?? 'both') as 'long' | 'short' | 'both'
        const params = entry.params ?? {}
        liftIndex += 1
        lifted.push({
          // 审查问题 #1：atom key 含 `.`（如 `price.percent_change`），下游 projection
          //   构造 `${rule.id}-cond-N` / `rule-${rule.id}-grp` 时点号会与既有 id 命名风格
          //   （kebab + `-` 分段）冲突；替换为 `_` 与 projection 现有命名对齐。
          id: `dispatcher-lift-${liftIndex}-${entry.key.replace(/\./g, '_')}`,
          phase,
          sideScope,
          condition: {
            kind: 'atom',
            key: entry.key,
            params: { ...params },
            sideScope,
          },
          effects: [],
        })
      }
    }

    // Issue #1441 通用收紧：只 collect `dispatcher.atoms` 总集。
    //
    // 真相源原则：dispatcher 每抽到一个 atom 同时 push `atomItems`（总集）+
    //   `slotItems[slot]`（triggers/actions/risk 分类子视图，见
    //   `generic-seed-dispatcher.service.ts:947-950`）。atoms 是 SoT，其它桶是子视图。
    //
    // 原 R-B 收 atoms + triggers + risk 三桶是重复 collect——同一 atom 第一次 lift 后
    //   第二桶虽因 leafSignature 签名相同被 dedup，但实测用户策略多 atom（不同 phase /
    //   sideScope / params）场景下，子桶 collect 仍能引入与 atoms 不同签名的派生条目，
    //   造成 UI 出现「入场×2 / 出场×2 / 入场(双向)：开多」等重复孤立 rule。
    //
    // 通用方案：只走 atoms 总集 → 重复源头消除；triggers/risk 子桶 lift 移除。
    //
    // Issue #1443 用户实测复测真因：dispatcher.atoms 是总集（含 trigger / action /
    //   risk / positionConstraint / orchestration 全部 bucket 的 atom）。一刀切 lift
    //   atoms 总集会把 action atom（如 action.close_long）也作为 single-leaf rule.
    //   condition——渲染时 UI 显示「出场：平多」noise（condition 被错渲染成 action 名），
    //   且 always-on filter（condition!=execution.on_start）不命中 → 保留 noise。
    //
    // 通用过滤：lift 时按 atom contract.bucket 过滤——只 lift bucket ∈ {trigger, risk}
    //   的真 condition 形态 atom。action / positionConstraint / orchestration 类
    //   atom 语义上不是 condition leaf，跳过 lift（action 走 dispatcher.actions 桶
    //   下游 effect-binding 链路，本 lift pass 不重复处理）。
    //   未注册 atom（contract miss）→ fail-open 允许 lift（与既有 unknown atom 兜底
    //   一致；避免新 atom 未注册时静默丢失）。
    type ContractShape = { bucket?: string }
    const LIFT_ALLOWED_BUCKETS: ReadonlySet<string> = new Set(['trigger', 'risk'])
    const isLiftableByBucket = (atomKey: string): boolean => {
      const bucket = (ATOM_CONTRACT_REGISTRY as Record<string, ContractShape | undefined>)[atomKey]?.bucket
      if (bucket === undefined) return true  // 未注册 fail-open
      return LIFT_ALLOWED_BUCKETS.has(bucket)
    }
    const liftableAtoms = (dispatcher.atoms ?? []).filter(a => isLiftableByBucket(a.key))
    collectBucket(liftableAtoms, 'entry')

    if (lifted.length > 0) {
      merged.rules = [...rules, ...lifted]
    }
  }

  private composeDispatcherRulesIntoMergedRules(
    merged: CodegenSemanticPatch,
    dispatcher: CodegenSemanticPatch,
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

    const covered = this.collectCompositeCoveredPredicates(predicates)
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

  private isNonEmpty(patch: CodegenSemanticPatch | null | undefined): boolean {
    if (!patch) return false
    if (patch.contextSlots && Object.keys(patch.contextSlots).length > 0) return true
    if (patch.atoms && patch.atoms.length > 0) return true
    if (patch.triggers && patch.triggers.length > 0) return true
    if (patch.actions && patch.actions.length > 0) return true
    if (patch.risk && patch.risk.length > 0) return true
    if (patch.position) return true
    if (patch.orchestration?.nodes && patch.orchestration.nodes.length > 0) return true
    // Issue #1395 Wave 4：rules[] 也算 non-empty 信号；planner 单产 rules（无 atoms）
    // 也必须被识别为有效 patch，否则会被当成 empty 整体丢弃。
    const rules = (patch as { rules?: unknown }).rules
    if (Array.isArray(rules) && rules.length > 0) return true
    return false
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

  private unionDedupOrchestrationNodes(
    plannerNodes: CodegenSemanticPatch['orchestration'] extends infer O
      ? O extends { nodes?: infer N } ? N : never
      : never,
    dispatcherNodes: CodegenSemanticPatch['orchestration'] extends infer O
      ? O extends { nodes?: infer N } ? N : never
      : never,
  ): NonNullable<CodegenSemanticPatch['orchestration']>['nodes'] {
    type NodeT = NonNullable<CodegenSemanticPatch['orchestration']>['nodes'] extends (infer U)[] | undefined
      ? U
      : never
    const seen = new Map<string, NodeT>()
    const order: string[] = []
    const collect = (list: readonly NodeT[] | undefined): void => {
      for (const node of list ?? []) {
        const id = this.orchestrationIdentity(node)
        if (!seen.has(id)) {
          seen.set(id, node)
          order.push(id)
        }
      }
    }
    collect(plannerNodes as readonly NodeT[] | undefined)
    collect(dispatcherNodes as readonly NodeT[] | undefined)
    return order.map(id => seen.get(id) as NodeT)
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
