/**
 * Issue #1395 — Atom Expression Tree
 *
 * 唯一新增组合数据结构：递归表达式树，五桶原子合约可以在任意层级
 * 嵌套 AND / OR / NOT / SEQUENCE。单 atom 是退化的单叶树，零特殊代码。
 *
 * 词汇对齐（用户口径 → 代码 enum）：
 *   trigger / action / risk / 仓位(positionConstraint) / context(orchestration)
 *
 * 见 docs/superpowers/specs/2026-05-15-atom-expression-tree-design.md
 */

import { z } from 'zod'
import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'
import type { ParamSlotSchema } from '../atom-contracts/atom-contract-surface.types'

export const ATOM_EXPR_MAX_DEPTH = 8
export const ATOM_EXPR_MIN_CHILDREN = 2

/**
 * 叶子：原子节点
 * sideScope 缺省时由父 rule.sideScope 派生
 */
export interface AtomExprAtom {
  readonly kind: 'atom'
  readonly key: string
  readonly params: Record<string, unknown>
  readonly sideScope?: 'long' | 'short' | 'both'
}

/** AND：≥2 个子节点，全部满足 */
export interface AtomExprAnd {
  readonly kind: 'and'
  readonly children: ReadonlyArray<AtomExpr>
}

/** OR：≥2 个子节点，任一满足 */
export interface AtomExprOr {
  readonly kind: 'or'
  readonly children: ReadonlyArray<AtomExpr>
}

/** NOT：单子节点取反 */
export interface AtomExprNot {
  readonly kind: 'not'
  readonly child: AtomExpr
}

/**
 * SEQUENCE：顺序敏感，steps[i] 满足后才进入 steps[i+1]
 * withinBars: 整体序列必须在 N 根 K 线内完成（可选）
 * nextBarOnly: 每步必须发生在前一步的下一根 K 线（如 S2「下一根放量反弹」）
 */
export interface AtomExprSequence {
  readonly kind: 'sequence'
  readonly steps: ReadonlyArray<AtomExpr>
  readonly withinBars?: number
  readonly nextBarOnly?: boolean
}

export type AtomExpr =
  | AtomExprAtom
  | AtomExprAnd
  | AtomExprOr
  | AtomExprNot
  | AtomExprSequence

export type AtomExprKind = AtomExpr['kind']

// ─────────────────────────────────────────────────────────────────────────────
// zod schema —— discriminated union（Issue #1399）
//
// 5 个 kind 各自命名导出，便于 IDE narrow、复用与单测精确定位。递归引用通过
// `z.lazy(() => atomExprSchema)` 解 forward-ref；顶层用 `z.discriminatedUnion`
// 按 `kind` 字段路由。这样 zod 报错路径直接精确到具体分支节点（例如
// `condition.children[1].key`），不再因为 union refine 把整对象包成一团。
// ─────────────────────────────────────────────────────────────────────────────

/** 叶子 atom 节点 schema */
export const atomSchema = z.object({
  kind: z.literal('atom'),
  key: z.string().min(1),
  params: z.record(z.unknown()),
  sideScope: z.enum(['long', 'short', 'both']).optional(),
})

/** AND 组合：≥2 个子节点 */
export const andSchema = z.object({
  kind: z.literal('and'),
  children: z.array(z.lazy(() => atomExprSchema)).min(ATOM_EXPR_MIN_CHILDREN),
})

/** OR 组合：≥2 个子节点 */
export const orSchema = z.object({
  kind: z.literal('or'),
  children: z.array(z.lazy(() => atomExprSchema)).min(ATOM_EXPR_MIN_CHILDREN),
})

/** NOT 一元：单子节点取反 */
export const notSchema = z.object({
  kind: z.literal('not'),
  child: z.lazy(() => atomExprSchema),
})

/** SEQUENCE 顺序敏感：≥2 个 step，可选 withinBars/nextBarOnly */
export const sequenceSchema = z.object({
  kind: z.literal('sequence'),
  steps: z.array(z.lazy(() => atomExprSchema)).min(ATOM_EXPR_MIN_CHILDREN),
  withinBars: z.number().int().positive().optional(),
  nextBarOnly: z.boolean().optional(),
})

export const atomExprSchema: z.ZodType<AtomExpr> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    atomSchema,
    andSchema,
    orSchema,
    notSchema,
    sequenceSchema,
  ]),
) as unknown as z.ZodType<AtomExpr>

/** @deprecated 历史命名；新代码请用 {@link atomSchema}。保留为别名以避免破坏外部引用。 */
export const atomExprAtomSchema = atomSchema

// ─────────────────────────────────────────────────────────────────────────────
// SemanticRule —— state 主体
// ─────────────────────────────────────────────────────────────────────────────

export type SemanticRulePhase = 'entry' | 'exit' | 'gate'
export type SemanticRuleSideScope = 'long' | 'short' | 'both'

export interface SemanticRule {
  readonly id: string
  readonly phase: SemanticRulePhase
  readonly sideScope: SemanticRuleSideScope
  /** 谓词树；所有叶子 atom 的 roles 必须包含 'predicate' */
  readonly condition: AtomExpr
  /** 副作用绑定（开/平仓、风控、加仓约束等）；顶层不组合，每条独立 */
  readonly effects: ReadonlyArray<AtomExpr>
}

export const semanticRuleSchema = z.object({
  id: z.string().min(1),
  phase: z.enum(['entry', 'exit', 'gate']),
  sideScope: z.enum(['long', 'short', 'both']),
  condition: atomExprSchema,
  effects: z.array(atomExprSchema),
})

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1395 (mute-spider): AtomExpr 子树 graceful degradation
//
// fail-open 替代 fail-closed：rules[] 逐条独立 parse 时，AtomExpr 子树内单个
// invalid 节点不再让整棵树丢失；可以剪掉无效兄弟保留有效子集。
//
// 行为规约：
//   - atom 叶：用 atomExprAtomSchema.safeParse 验，pass 原样返；fail 返 null
//   - and / or（commutative）：剪枝后 valid children
//       * ≥ 2  → 保留同 kind 组合
//       * = 1  → 退化为该单一 child（去掉组合节点）
//       * = 0  → 整树 null
//   - not（一元）：子节点剪枝后 null → 整树 null；否则 wrap not(child)
//   - sequence（顺序敏感）：任一 step 剪枝后 null → 整树 null（顺序语义不可残缺）
//
// 注：纯函数，调用方负责把整 rule 入 quarantine（剪枝丢弃的子节点信息在 service 层
// errorPath 已记录），这里只输出"剩下什么有效"。
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Issue #1395 mute-spider S5：atom params 值域严校
 *
 * 规则（保守 fail-open）：
 *   1) 若 atom.key 不在 ATOM_CONTRACT_REGISTRY → 跳过严校（保持 A3 mock atom 兼容）
 *   2) 若 registry entry 无 surface.paramSlots → 跳过严校
 *   3) 若声明 paramPresetCombos 且 params 命中任一 preset（全部 key 严等）→ 直接判合法
 *   4) 否则按声明的 slot：
 *      - kind=enum + enum 列表：值必须 ∈ enum；不在 → 非法
 *      - kind=number + range：值必须 ∈ [min,max]；越界 → 非法
 *      - kind=number + multipleOf：值必须能被 multipleOf 整除（容差 1e-9）→ 否则非法
 *   5) 未在 paramSlots 声明的 param key → 不校（容忍 LLM 多写字段）
 *
 * 返回 true=合法，false=应被 quarantine。
 */
export function isAtomParamsStrictlyValid(key: string, params: Record<string, unknown>): boolean {
  const entry = (ATOM_CONTRACT_REGISTRY as Record<string, { surface?: { paramSlots?: Record<string, ParamSlotSchema>; paramPresetCombos?: ReadonlyArray<Readonly<Record<string, string | number | boolean>>> } }>)[key]
  if (!entry || !entry.surface || !entry.surface.paramSlots) return true
  const slots = entry.surface.paramSlots
  const presetCombos = entry.surface.paramPresetCombos
  if (presetCombos && presetCombos.length > 0) {
    for (const combo of presetCombos) {
      let matched = true
      for (const ck of Object.keys(combo)) {
        if (params[ck] !== combo[ck]) {
          matched = false
          break
        }
      }
      if (matched) return true
    }
    // preset 声明且未命中 → 继续走单 slot 校验（容忍 indicator!='macd' 等非 preset 场景）
  }
  for (const [slotKey, raw] of Object.entries(params)) {
    const slot = slots[slotKey]
    if (!slot) continue // 未声明 slot → 不校
    if (slot.kind === 'enum' && slot.enum && slot.enum.length > 0) {
      if (typeof raw !== 'string' && typeof raw !== 'number') return false
      if (!slot.enum.includes(String(raw))) return false
    }
    if (slot.kind === 'number' || slot.kind === 'percent') {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return false
      if (slot.range) {
        const [min, max] = slot.range
        if (raw < min || raw > max) return false
      }
      if (typeof slot.multipleOf === 'number' && slot.multipleOf > 0) {
        const q = raw / slot.multipleOf
        if (Math.abs(q - Math.round(q)) > 1e-9) return false
      }
    }
  }
  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1399 — 剪枝时携带精确 path 的诊断
//
// 旧实现把剪枝过程的失败信息丢弃（只返回 null），调用方只能在 quarantine 里写
// "condition: pruned to empty" 这种笼统串。换用 discriminated union 后，叶子
// zod safeParse 自带 `issues[].path`，组合节点剪枝时把 basePath 透传下去即可
// 拼出 `condition.children[1].key` / `condition.steps[2].kind` 级别的路径。
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 自定义聚合 reason（叠加在 zod 内置 ZodIssueCode 之上）
 *
 * - `pruned_to_empty`：and / or 的 children 全部失效 / not 唯一子节点失效
 * - `sequence_step_invalid`：顺序敏感的 sequence 任一 step 失效（整树失败）
 * - `params_strict`：atom params 通过 zod 但 paramSlots 严校越界
 * - `not_object`：节点不是 object（数组 / 原语）
 * - `invalid_kind`：kind 字段不在 5 桶（atom/and/or/not/sequence）内
 */
export type AtomExprPruneReason
  = | z.ZodIssueCode
    | 'pruned_to_empty'
    | 'sequence_step_invalid'
    | 'params_strict'
    | 'not_object'
    | 'invalid_kind'

export interface AtomExprPruneError {
  /** dot/bracket 路径，例如 `condition.steps[0].key` */
  readonly path: string
  /** zod issue.code 或本地枚举的聚合 reason */
  readonly reason: AtomExprPruneReason
  /** zod issue.message 或简短描述 */
  readonly message: string
}

/**
 * `errors` 数组顺序约定（公开契约）：
 *   - 自底向上累积：叶子层 zod 错误最先 push，组合层聚合错误（`pruned_to_empty` /
 *     `sequence_step_invalid`）最后追加
 *   - 因此 `errors[0]` 永远是「最具体的叶子失败路径」，适合做诊断 errorPath
 *   - 末尾若存在 `pruned_to_empty / sequence_step_invalid` 则代表整体失败的语义根因
 *   - 当 `result !== null` 时 `errors` 仍可能非空（and/or 退化时被丢弃 child 的 path
 *     仍保留，供观测层做"warnings"分流）
 */
export interface AtomExprPruneResult {
  readonly result: AtomExpr | null
  readonly errors: ReadonlyArray<AtomExprPruneError>
}

/**
 * 拼路径：
 *   - 字符串段：空 base 不前置点号（避免出现 `.foo`），否则拼 `base.seg`
 *   - 数字段：始终拼 `base[N]`；当 base 为空时输出 `[N]`（合法但只用于 array root）
 *
 * 注：AtomExpr 树根永远是 object（discriminated union），不会触发 `[N]` 形式的
 * root 路径；这里保留无前缀写法作为工具函数的边界行为。Atom key 受 ATOM_REGISTRY
 * 控制（无 `.` / `[` 字符），不做 path 段转义。
 */
function joinPath(base: string, segment: string | number): string {
  if (typeof segment === 'number') return `${base}[${segment}]`
  if (!base) return segment
  return `${base}.${segment}`
}

function zodPathToString(base: string, path: ReadonlyArray<string | number>): string {
  let acc = base
  for (const seg of path) acc = joinPath(acc, seg)
  return acc
}

/**
 * Issue #1399：带 path 的递归剪枝。
 *
 * - atom：用 {@link atomSchema} safeParse；失败时把每个 issue.path 拼到 basePath 后回传
 * - and/or：≥2 valid 保留；=1 退化；=0 上报 `pruned_to_empty`
 * - not：唯一子节点剪空则上报
 * - sequence：任一 step 剪空则整树失败（顺序不可残缺）
 */
export function pruneAtomExprWithErrors(node: unknown, basePath = ''): AtomExprPruneResult {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return {
      result: null,
      errors: [{ path: basePath || '<root>', reason: 'not_object', message: 'expected object' }],
    }
  }
  const kind = (node as { kind?: unknown }).kind

  if (kind === 'atom') {
    const parsed = atomSchema.safeParse(node)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(issue => ({
        path: zodPathToString(basePath, issue.path as ReadonlyArray<string | number>),
        reason: issue.code,
        message: issue.message,
      }))
      return { result: null, errors }
    }
    const atom = parsed.data as AtomExprAtom
    // Issue #1395 mute-spider S5：zod 通过后追加 params 值域严校
    if (!isAtomParamsStrictlyValid(atom.key, atom.params)) {
      return {
        result: null,
        errors: [{
          path: joinPath(basePath, 'params'),
          reason: 'params_strict',
          message: `atom params out of slot range for key=${atom.key}`,
        }],
      }
    }
    return { result: atom as AtomExpr, errors: [] }
  }

  if (kind === 'and' || kind === 'or') {
    const raw = (node as { children?: unknown }).children
    if (!Array.isArray(raw)) {
      return {
        result: null,
        errors: [{ path: joinPath(basePath, 'children'), reason: 'invalid_type', message: 'expected array' }],
      }
    }
    const errors: AtomExprPruneError[] = []
    const pruned: AtomExpr[] = []
    for (let i = 0; i < raw.length; i++) {
      const childPath = joinPath(joinPath(basePath, 'children'), i)
      const sub = pruneAtomExprWithErrors(raw[i], childPath)
      errors.push(...sub.errors)
      if (sub.result) pruned.push(sub.result)
    }
    if (pruned.length >= ATOM_EXPR_MIN_CHILDREN) {
      return { result: { kind, children: pruned } as AtomExpr, errors }
    }
    if (pruned.length === 1) {
      // 退化：保留唯一 valid child，丢掉 and/or 包裹
      return { result: pruned[0], errors }
    }
    return {
      result: null,
      errors: [...errors, { path: basePath || '<root>', reason: 'pruned_to_empty', message: `${kind} children all invalid` }],
    }
  }

  if (kind === 'not') {
    const sub = pruneAtomExprWithErrors((node as { child?: unknown }).child, joinPath(basePath, 'child'))
    if (sub.result) {
      return { result: { kind: 'not', child: sub.result }, errors: sub.errors }
    }
    return {
      result: null,
      errors: [...sub.errors, { path: basePath || '<root>', reason: 'pruned_to_empty', message: 'not child invalid' }],
    }
  }

  if (kind === 'sequence') {
    const raw = (node as { steps?: unknown }).steps
    if (!Array.isArray(raw) || raw.length === 0) {
      return {
        result: null,
        errors: [{ path: joinPath(basePath, 'steps'), reason: 'invalid_type', message: 'expected non-empty array' }],
      }
    }
    // 注：剪枝阶段对 sequence steps 不再施加 `min(ATOM_EXPR_MIN_CHILDREN)=2` 校验
    // （fail-open）；schema 层的 sequenceSchema.min(2) 在 parse 时仍生效，但 graceful
    // 路径优先保留任何顺序完整的 steps 链——length=1 的 sequence 退化时被允许通过，
    // 以兼容 LLM 偶发产出"单步 sequence"且语义上仍等同于单 atom 的边界场景。
    const prunedSteps: AtomExpr[] = []
    const errors: AtomExprPruneError[] = []
    for (let i = 0; i < raw.length; i++) {
      const stepPath = joinPath(joinPath(basePath, 'steps'), i)
      const sub = pruneAtomExprWithErrors(raw[i], stepPath)
      errors.push(...sub.errors)
      if (!sub.result) {
        // sequence 顺序敏感，任一 step 失效即整树失效
        return {
          result: null,
          errors: [...errors, { path: stepPath, reason: 'sequence_step_invalid', message: 'sequence step pruned to null' }],
        }
      }
      prunedSteps.push(sub.result)
    }
    const original = node as { withinBars?: unknown, nextBarOnly?: unknown }
    const withinBars
      = typeof original.withinBars === 'number' && Number.isInteger(original.withinBars) && original.withinBars > 0
        ? original.withinBars
        : undefined
    const nextBarOnly = typeof original.nextBarOnly === 'boolean' ? original.nextBarOnly : undefined
    return {
      result: {
        kind: 'sequence',
        steps: prunedSteps,
        ...(withinBars !== undefined ? { withinBars } : {}),
        ...(nextBarOnly !== undefined ? { nextBarOnly } : {}),
      },
      errors,
    }
  }

  return {
    result: null,
    errors: [{
      path: joinPath(basePath, 'kind'),
      reason: 'invalid_kind',
      message: `unknown kind: ${String(kind)}`,
    }],
  }
}

/**
 * 兼容旧签名的 thin wrapper。新代码应直接使用 {@link pruneAtomExprWithErrors}
 * 以拿到精确诊断。
 */
export function pruneAtomExprToValid(node: unknown): AtomExpr | null {
  return pruneAtomExprWithErrors(node, '').result
}

/**
 * SemanticRule 级 graceful parse：
 *   - 顶层结构（id/phase/sideScope）必须合法，否则整 rule fail
 *   - condition 剪枝后 null → 整 rule fail（无谓词无意义）
 *   - effects 逐条剪枝，invalid 个体丢弃，整体保留剩余
 * 返回 { ok: true, rule } 或 { ok: false, errorPath }
 */
export type GracefulParseSemanticRuleResult =
  | { ok: true, rule: z.infer<typeof semanticRuleSchema> }
  | { ok: false, errorPath: string }

export function gracefulParseSemanticRule(input: unknown): GracefulParseSemanticRuleResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errorPath: 'root: not an object' }
  }
  const obj = input as Record<string, unknown>
  const headerSchema = z.object({
    id: z.string().min(1),
    phase: z.enum(['entry', 'exit', 'gate']),
    sideScope: z.enum(['long', 'short', 'both']),
  })
  const headerParsed = headerSchema.safeParse({ id: obj.id, phase: obj.phase, sideScope: obj.sideScope })
  if (!headerParsed.success) {
    // Issue #1399：直接拼出 `id` / `phase` / `sideScope` 级别的精确路径
    const issues = headerParsed.error.issues.slice(0, 5)
      .map((i) => {
        const path = zodPathToString('', i.path as ReadonlyArray<string | number>) || '<root>'
        return `${path}: ${i.code}`
      })
      .join('; ')
    return { ok: false, errorPath: issues }
  }
  const conditionPruned = pruneAtomExprWithErrors(obj.condition, 'condition')
  if (!conditionPruned.result) {
    // Issue #1399：用首个最深 path 暴露具体节点；附带 reason 与节点路径
    const first = conditionPruned.errors[0]
    const errorPath = first
      ? `${first.path}: ${first.reason}`
      : 'condition: pruned to empty'
    return { ok: false, errorPath }
  }
  const rawEffects = Array.isArray(obj.effects) ? obj.effects : []
  const effects: AtomExpr[] = []
  for (let i = 0; i < rawEffects.length; i++) {
    const pruned = pruneAtomExprWithErrors(rawEffects[i], `effects[${i}]`)
    if (pruned.result) effects.push(pruned.result)
  }
  return {
    ok: true,
    rule: {
      id: headerParsed.data.id,
      phase: headerParsed.data.phase,
      sideScope: headerParsed.data.sideScope,
      condition: conditionPruned.result,
      effects,
    } as import('zod').infer<typeof semanticRuleSchema>,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Walker / 树深度校验 / 叶子收集等纯函数工具
// ─────────────────────────────────────────────────────────────────────────────

export function walkAtomExpr(
  expr: AtomExpr,
  visit: (node: AtomExpr, depth: number) => void,
  depth = 0,
): void {
  visit(expr, depth)
  switch (expr.kind) {
    case 'atom':
      return
    case 'and':
    case 'or':
      for (const child of expr.children) walkAtomExpr(child, visit, depth + 1)
      return
    case 'not':
      walkAtomExpr(expr.child, visit, depth + 1)
      return
    case 'sequence':
      for (const step of expr.steps) walkAtomExpr(step, visit, depth + 1)
  }
}

export function collectAtomLeaves(expr: AtomExpr): AtomExprAtom[] {
  const leaves: AtomExprAtom[] = []
  walkAtomExpr(expr, (node) => {
    if (node.kind === 'atom') leaves.push(node)
  })
  return leaves
}


export function atomExprDepth(expr: AtomExpr): number {
  let max = 0
  walkAtomExpr(expr, (_, depth) => {
    if (depth > max) max = depth
  })
  return max
}

/**
 * 子树规范化 hash 输入（atom kind 字典序排序 commutative 节点子节点；sequence 保序）
 * 用于 dedup / coalesce 同构子树。
 */
export function canonicalizeAtomExpr(expr: AtomExpr): AtomExpr {
  switch (expr.kind) {
    case 'atom':
      return expr
    case 'and':
    case 'or': {
      const normalized = expr.children.map(canonicalizeAtomExpr)
      const sorted = [...normalized].sort((a, b) => canonicalKey(a).localeCompare(canonicalKey(b)))
      return { kind: expr.kind, children: sorted } as AtomExpr
    }
    case 'not':
      return { kind: 'not', child: canonicalizeAtomExpr(expr.child) }
    case 'sequence':
      return {
        kind: 'sequence',
        steps: expr.steps.map(canonicalizeAtomExpr),
        ...(expr.withinBars !== undefined ? { withinBars: expr.withinBars } : {}),
        ...(expr.nextBarOnly !== undefined ? { nextBarOnly: expr.nextBarOnly } : {}),
      }
  }
}

function canonicalKey(expr: AtomExpr): string {
  if (expr.kind === 'atom') return `atom:${expr.key}:${stableJson(expr.params)}`
  if (expr.kind === 'not') return `not:${canonicalKey(expr.child)}`
  if (expr.kind === 'sequence') return `seq:${expr.steps.map(canonicalKey).join('|')}`
  return `${expr.kind}:${expr.children.map(canonicalKey).sort().join('|')}`
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(',')}}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1493 — updateRuleAtomParams
//
// 不可变 helper：定位 ruleId 对应 rule，按 conditionPath 找到目标 atom 叶子，
// 应用 mutator 返回新 atom，并不可变重建 rule 子树。其它 rule 保持原引用复用。
//
// 路径语法（与 SemanticFlatAtomProvenance.conditionPath 对齐）：
//   condition.atom
//   condition.and.children[N].atom
//   condition.or.children[N].atom
//   condition.not.child.atom
//   condition.sequence.steps[N].atom
//   effects[N].atom
//   effects[N].and.children[M].atom
//   effects[N].sequence.steps[M].atom
//   ...（任意 condition/effects 子树叠加 and/or/not/sequence/atom）
//
// 路径不命中 → 抛 Error（不静默 fail）。
// ─────────────────────────────────────────────────────────────────────────────

type AtomExprAtomReadonly = AtomExpr & { kind: 'atom' }

interface PathSegment {
  readonly key: string
  readonly index?: number
}

/**
 * 解析 dot/bracket 路径串为段序列。
 *   `condition.and.children[2].atom`
 *     → [{key:'condition'},{key:'and'},{key:'children',index:2},{key:'atom'}]
 */
function parseAtomPath(path: string): PathSegment[] {
  const segments: PathSegment[] = []
  // 拆 dot；每段再单独 match bracket index
  const parts = path.split('.')
  for (const part of parts) {
    if (part === '') continue
    const m = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(\[(\d+)\])?$/)
    if (!m) {
      throw new Error(`updateRuleAtomParams: malformed path segment "${part}" in "${path}"`)
    }
    const key = m[1]
    const idx = m[3] !== undefined ? Number(m[3]) : undefined
    segments.push({ key, index: idx })
  }
  return segments
}

/**
 * 沿 segments 递归下钻，在叶子 atom 节点上应用 mutator，回升时不可变重建路径上每层。
 *
 * @param node 当前节点
 * @param segments 剩余路径段
 * @param ruleIdForError 错误信息里展示的 rule id
 * @param fullPath 错误信息里展示的完整原始路径
 */
function applyAtomMutator(
  node: AtomExpr,
  segments: ReadonlyArray<PathSegment>,
  mutator: (atom: AtomExprAtomReadonly) => AtomExprAtomReadonly,
  ruleIdForError: string,
  fullPath: string,
): AtomExpr {
  // path 结尾约定为 `.atom`（与 SemanticFlatAtomProvenance.conditionPath 对齐）：
  //   - 当前 node 已是 atom 叶，剩余段恰好是 [{key:'atom'}] → 应用 mutator
  //   - 当前 node 已是 atom 叶，剩余段为空（caller 已消费完）→ 应用 mutator（兼容容错）
  if (node.kind === 'atom') {
    if (segments.length === 0) return mutator(node)
    if (segments.length === 1 && segments[0].key === 'atom' && segments[0].index === undefined) {
      return mutator(node)
    }
    throw new Error(
      `updateRuleAtomParams: path "${fullPath}" descends into atom leaf with extra segment "${segments[0].key}" in rule "${ruleIdForError}"`,
    )
  }
  if (segments.length === 0) {
    throw new Error(
      `updateRuleAtomParams: path "${fullPath}" did not resolve to atom leaf in rule "${ruleIdForError}"`,
    )
  }
  const [seg, ...rest] = segments
  switch (node.kind) {
    case 'and':
    case 'or': {
      if (seg.key !== node.kind) {
        throw new Error(
          `updateRuleAtomParams: path "${fullPath}" expected "${node.kind}" segment but got "${seg.key}" in rule "${ruleIdForError}"`,
        )
      }
      // 下一段必须是 children[i]
      const [childSeg, ...afterChild] = rest
      if (!childSeg || childSeg.key !== 'children' || childSeg.index === undefined) {
        throw new Error(
          `updateRuleAtomParams: path "${fullPath}" expected "children[N]" after "${node.kind}" in rule "${ruleIdForError}"`,
        )
      }
      const idx = childSeg.index
      if (idx < 0 || idx >= node.children.length) {
        throw new Error(
          `updateRuleAtomParams: path "${fullPath}" children index ${idx} out of range in rule "${ruleIdForError}"`,
        )
      }
      const newChild = applyAtomMutator(node.children[idx], afterChild, mutator, ruleIdForError, fullPath)
      const newChildren = node.children.map((c, i) => (i === idx ? newChild : c))
      return { kind: node.kind, children: newChildren } as AtomExpr
    }
    case 'not': {
      if (seg.key !== 'not') {
        throw new Error(
          `updateRuleAtomParams: path "${fullPath}" expected "not" segment but got "${seg.key}" in rule "${ruleIdForError}"`,
        )
      }
      const [childSeg, ...afterChild] = rest
      if (!childSeg || childSeg.key !== 'child') {
        throw new Error(
          `updateRuleAtomParams: path "${fullPath}" expected "child" after "not" in rule "${ruleIdForError}"`,
        )
      }
      const newChild = applyAtomMutator(node.child, afterChild, mutator, ruleIdForError, fullPath)
      return { kind: 'not', child: newChild }
    }
    case 'sequence': {
      if (seg.key !== 'sequence') {
        throw new Error(
          `updateRuleAtomParams: path "${fullPath}" expected "sequence" segment but got "${seg.key}" in rule "${ruleIdForError}"`,
        )
      }
      const [stepSeg, ...afterStep] = rest
      if (!stepSeg || stepSeg.key !== 'steps' || stepSeg.index === undefined) {
        throw new Error(
          `updateRuleAtomParams: path "${fullPath}" expected "steps[N]" after "sequence" in rule "${ruleIdForError}"`,
        )
      }
      const idx = stepSeg.index
      if (idx < 0 || idx >= node.steps.length) {
        throw new Error(
          `updateRuleAtomParams: path "${fullPath}" steps index ${idx} out of range in rule "${ruleIdForError}"`,
        )
      }
      const newStep = applyAtomMutator(node.steps[idx], afterStep, mutator, ruleIdForError, fullPath)
      const newSteps = node.steps.map((s, i) => (i === idx ? newStep : s))
      return {
        kind: 'sequence',
        steps: newSteps,
        ...(node.withinBars !== undefined ? { withinBars: node.withinBars } : {}),
        ...(node.nextBarOnly !== undefined ? { nextBarOnly: node.nextBarOnly } : {}),
      }
    }
  }
}

/**
 * Issue #1493：定位 rule[ruleId] 对应的 atom 叶子，应用 mutator，不可变重建子树。
 *
 * @param rules    rules 数组（不变）
 * @param ruleId   目标 rule.id
 * @param conditionPath 形如 `condition.and.children[2].atom` / `effects[0].atom`
 * @param mutator  接收当前 atom 返回新 atom（必须 kind:'atom'）
 * @returns 新 rules 数组；未命中 rule 保持原引用复用
 * @throws 路径不命中 / atom kind 不匹配 / index 越界 时抛 Error
 */
export function updateRuleAtomParams(
  rules: readonly SemanticRule[],
  ruleId: string,
  conditionPath: string,
  mutator: (atom: AtomExprAtomReadonly) => AtomExprAtomReadonly,
): SemanticRule[] {
  const idx = rules.findIndex(r => r.id === ruleId)
  if (idx < 0) {
    throw new Error(`updateRuleAtomParams: rule "${ruleId}" not found`)
  }
  const segments = parseAtomPath(conditionPath)
  if (segments.length === 0) {
    throw new Error(`updateRuleAtomParams: path "${conditionPath}" is empty for rule "${ruleId}"`)
  }
  const head = segments[0]
  const target = rules[idx]
  let newRule: SemanticRule
  if (head.key === 'condition' && head.index === undefined) {
    const newCondition = applyAtomMutator(target.condition, segments.slice(1), mutator, ruleId, conditionPath)
    newRule = { ...target, condition: newCondition }
  }
  else if (head.key === 'effects' && head.index !== undefined) {
    const effIdx = head.index
    if (effIdx < 0 || effIdx >= target.effects.length) {
      throw new Error(
        `updateRuleAtomParams: path "${conditionPath}" effects index ${effIdx} out of range in rule "${ruleId}"`,
      )
    }
    const newEffect = applyAtomMutator(target.effects[effIdx], segments.slice(1), mutator, ruleId, conditionPath)
    const newEffects = target.effects.map((e, i) => (i === effIdx ? newEffect : e))
    newRule = { ...target, effects: newEffects }
  }
  else {
    throw new Error(
      `updateRuleAtomParams: path "${conditionPath}" not found in rule "${ruleId}" (expected to start with "condition" or "effects[N]")`,
    )
  }
  // 其它 rule 保持原引用，仅替换命中 rule
  return rules.map((r, i) => (i === idx ? newRule : r))
}
