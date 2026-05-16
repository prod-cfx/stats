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
// Issue #1413 — rulesFromFlatBuckets：扁平桶 → SemanticRule[] 反向投影
//
// projectToFlat 的精确逆运算（语义层等价；id 命名按 projection 约定还原）：
//   - trigger 桶中含 combinationContract(predicate_group) 的节点按 groupId 归组
//     → 重建 AND/OR rule.condition；单 member 退化为 atom；多 member 拼组合节点
//   - 不含 combinationContract 的 trigger 节点 → single-leaf rule
//   - action / risk / positionConstraint 桶按 id `${ruleId}-eff-${i}` 命名约定挂回
//     原 rule.effects；解析失败者按 phase 匹配 fallback；都不命中则单建 effect-only rule
//   - orchestration 桶暂不参与反投影（与 projectToFlat 当前不投 orchestration effects 对称）
//
// 设计上不依赖 NestJS DI，纯函数；放在 atom-expr.ts 与 collectAtomLeaves / canonicalize
// 同模块，便于 seed-builder / 测试直接 import。
// ─────────────────────────────────────────────────────────────────────────────

/** 与 SemanticState 五桶对齐的输入结构（readonly，避免误修改原 state）。 */
export interface FlatSemanticBuckets {
  readonly trigger: ReadonlyArray<{
    readonly id: string
    readonly key: string
    readonly phase: 'entry' | 'exit' | 'risk' | 'gate'
    readonly params: Record<string, unknown>
    readonly sideScope?: 'long' | 'short' | 'both'
    readonly contracts?: ReadonlyArray<{
      readonly capabilities: ReadonlyArray<{ domain: string, verb: string, object: string }>
      readonly params: Record<string, unknown>
    }>
  }>
  readonly action: ReadonlyArray<{
    readonly id: string
    readonly key: string
    readonly params?: Record<string, unknown>
  }>
  readonly risk: ReadonlyArray<{
    readonly id: string
    readonly key: string
    readonly params: Record<string, unknown>
  }>
  readonly positionConstraint: ReadonlyArray<{
    readonly id: string
    readonly key: string
    readonly params: Record<string, unknown>
  }>
  readonly orchestration: ReadonlyArray<unknown>
}

function isPredicateGroupContractShape(contract: {
  capabilities: ReadonlyArray<{ domain: string, verb: string, object: string }>
}): boolean {
  return contract.capabilities.some(c =>
    c.domain === 'market' && c.verb === 'combine' && c.object === 'predicate_group',
  )
}

/** 从 projectToFlat 写入的 `rule-${ruleId}-grp` groupId 反推 rule.id；不匹配返回 null。 */
function parseRuleIdFromGroupId(groupId: string): string | null {
  const m = /^rule-(.+)-grp$/.exec(groupId)
  return m ? m[1]! : null
}

/** 从 projectToFlat 写入的 `${ruleId}-cond-${i}` trigger.id 反推 rule.id；不匹配返回 null。 */
function parseRuleIdFromTriggerId(triggerId: string): string | null {
  const m = /^(.+)-cond-\d+$/.exec(triggerId)
  return m ? m[1]! : null
}

/** 从 projectToFlat 写入的 `${ruleId}-eff-${i}` effect.id 反推 rule.id；不匹配返回 null。 */
function parseRuleRefFromEffectId(effId: string): { ruleId: string, index: number } | null {
  const m = /^(.+)-eff-(\d+)$/.exec(effId)
  return m ? { ruleId: m[1]!, index: Number(m[2]) } : null
}

function triggerPhaseToRulePhase(p: 'entry' | 'exit' | 'risk' | 'gate'): SemanticRulePhase {
  // trigger 'risk' phase 在 rule 层没有直接对应；统一映射到 'gate'（与 IR 层
  // compileAtomExpr 对 risk 触发器的解读一致：作为 gate 性质的守门规则）。
  if (p === 'risk') return 'gate'
  return p
}

function flatTriggerToAtomExpr(t: FlatSemanticBuckets['trigger'][number]): AtomExprAtom {
  return {
    kind: 'atom',
    key: t.key,
    params: { ...t.params },
    ...(t.sideScope ? { sideScope: t.sideScope } : {}),
  }
}

/**
 * 反向投影：把 SemanticState 扁平五桶还原为 SemanticRule[]。
 *
 * 还原约定：
 *   - 触发器：扫 contracts[] 找 predicate_group combinationContract；按 groupId
 *     归组（同 groupId 的 member 顺序保留），多 member → AND/OR 组合 condition；
 *     单 member 退化为单 atom condition；无 contract 触发器 → 单叶 rule。
 *   - 副作用：action / risk / positionConstraint 优先按 id `${ruleId}-eff-${i}`
 *     命名约定挂回原 rule；解析失败者按 phase fallback（action → entry rule，
 *     risk → exit rule，positionConstraint → entry rule）；仍无目标则单建
 *     effect-only rule（condition = atom 自身，effects 空）。
 *   - orchestration：projectToFlat 当前不投影 orchestration effects（MVP 占位），
 *     反向同样跳过，保持对称。
 *
 * NOT / SEQUENCE：当前 flat 桶不携带 NOT/SEQUENCE 元数据（projectToFlat 也仅
 * 处理 AND/OR），反投影不会重建它们；调用方若需要 NOT/SEQUENCE 应直接产出
 * explicit rules，而非走 flat → rules 路径。
 */
export function rulesFromFlatBuckets(flat: FlatSemanticBuckets): SemanticRule[] {
  // 1) 归组触发器
  interface GroupAcc {
    readonly members: Array<FlatSemanticBuckets['trigger'][number]>
    readonly join: 'AND' | 'OR'
    readonly phase: 'entry' | 'exit' | 'risk' | 'gate'
    readonly sideScope?: 'long' | 'short' | 'both'
    readonly groupId: string
    readonly insertOrder: number
  }
  const groups = new Map<string, GroupAcc>()
  type Slot
    = | { kind: 'group', groupId: string }
      | { kind: 'standalone', trigger: FlatSemanticBuckets['trigger'][number] }
  const slots: Slot[] = []
  let order = 0

  for (const t of flat.trigger) {
    const grp = (t.contracts ?? []).find(isPredicateGroupContractShape)
    if (grp) {
      const params = grp.params
      const rawGroupId = params.groupId
      const groupId = typeof rawGroupId === 'string' ? rawGroupId : ''
      if (!groupId) {
        slots.push({ kind: 'standalone', trigger: t })
        continue
      }
      const rawJoin = typeof params.join === 'string' ? params.join.toUpperCase() : 'AND'
      const join: 'AND' | 'OR' = rawJoin === 'OR' ? 'OR' : 'AND'
      const existing = groups.get(groupId)
      if (existing) {
        existing.members.push(t)
      } else {
        groups.set(groupId, {
          members: [t],
          join,
          phase: t.phase,
          sideScope: t.sideScope,
          groupId,
          insertOrder: order++,
        })
        slots.push({ kind: 'group', groupId })
      }
    } else {
      slots.push({ kind: 'standalone', trigger: t })
    }
  }

  const rules: SemanticRule[] = []
  const ruleEffects = new Map<string, AtomExpr[]>() // ruleId → effects 累积
  let ruleSeq = 0

  const newRuleId = (prefix: string): string => `${prefix}-${++ruleSeq}`

  for (const slot of slots) {
    if (slot.kind === 'group') {
      const info = groups.get(slot.groupId)!
      const ruleId = parseRuleIdFromGroupId(info.groupId) ?? newRuleId('rule-grp')
      const condition: AtomExpr = info.members.length === 1
        ? flatTriggerToAtomExpr(info.members[0]!)
        : {
            kind: info.join === 'OR' ? 'or' : 'and',
            children: info.members.map(flatTriggerToAtomExpr),
          }
      rules.push({
        id: ruleId,
        phase: triggerPhaseToRulePhase(info.phase),
        sideScope: info.sideScope ?? 'both',
        condition,
        effects: [],
      })
      ruleEffects.set(ruleId, [])
    } else {
      const t = slot.trigger
      const ruleId = parseRuleIdFromTriggerId(t.id) ?? newRuleId('rule-leaf')
      rules.push({
        id: ruleId,
        phase: triggerPhaseToRulePhase(t.phase),
        sideScope: t.sideScope ?? 'both',
        condition: flatTriggerToAtomExpr(t),
        effects: [],
      })
      ruleEffects.set(ruleId, [])
    }
  }

  // 2) 收集所有 effects 候选；按 id 反查 rule 优先，否则 phase fallback
  interface EffectCandidate {
    readonly id: string
    readonly key: string
    readonly params: Record<string, unknown>
    readonly bucket: 'action' | 'risk' | 'positionConstraint'
  }
  const candidates: EffectCandidate[] = []
  for (const a of flat.action) {
    candidates.push({ id: a.id, key: a.key, params: { ...(a.params ?? {}) }, bucket: 'action' })
  }
  for (const r of flat.risk) {
    candidates.push({ id: r.id, key: r.key, params: { ...r.params }, bucket: 'risk' })
  }
  for (const p of flat.positionConstraint) {
    candidates.push({ id: p.id, key: p.key, params: { ...p.params }, bucket: 'positionConstraint' })
  }

  const rulesById = new Map<string, SemanticRule>()
  for (const r of rules) rulesById.set(r.id, r)

  const fallbackPhaseForBucket = (bucket: EffectCandidate['bucket']): SemanticRulePhase =>
    bucket === 'risk' ? 'exit' : 'entry'

  for (const eff of candidates) {
    const atom: AtomExprAtom = { kind: 'atom', key: eff.key, params: { ...eff.params } }
    const parsed = parseRuleRefFromEffectId(eff.id)
    let target: SemanticRule | undefined
    if (parsed && rulesById.has(parsed.ruleId)) {
      target = rulesById.get(parsed.ruleId)!
    } else {
      const phase = fallbackPhaseForBucket(eff.bucket)
      target = rules.find(r => r.phase === phase) ?? rules[0]
    }
    if (target) {
      ruleEffects.get(target.id)!.push(atom)
    } else {
      const ruleId = newRuleId('rule-effect')
      const newRule: SemanticRule = {
        id: ruleId,
        phase: fallbackPhaseForBucket(eff.bucket),
        sideScope: 'both',
        condition: atom,
        effects: [],
      }
      rules.push(newRule)
      rulesById.set(ruleId, newRule)
      ruleEffects.set(ruleId, [])
    }
  }

  // 3) 用累积的 effects 重写 rules（保持 readonly contract）
  return rules.map(r => ({
    ...r,
    effects: ruleEffects.get(r.id) ?? [],
  }))
}

/**
 * 规则规范化：用于 round-trip 比较——抹平 id 命名分歧、子节点排序差异（AND/OR
 * commutative）、effects 排序，仅保留语义形状。
 *
 * - rule.id / atom 内部命名信息全部 strip → 用占位 `_`
 * - rule[] 按 (phase, sideScope, canonical condition hash) 排序
 * - effects 按 canonical hash 排序（rule 内 effects 顺序在 projectToFlat 中由
 *   index 编码到 id，但语义上 effects 是无序集合）
 */
/** 递归剥掉 atom.sideScope 中与 parent rule.sideScope 相同的冗余声明（atom 缺省继承父）。 */
function stripRedundantSideScope(expr: AtomExpr, parentSide: SemanticRuleSideScope): AtomExpr {
  switch (expr.kind) {
    case 'atom':
      if (expr.sideScope && expr.sideScope === parentSide) {
        const { sideScope: _drop, ...rest } = expr
        return { ...rest, kind: 'atom' }
      }
      return expr
    case 'and':
    case 'or':
      return { kind: expr.kind, children: expr.children.map(c => stripRedundantSideScope(c, parentSide)) } as AtomExpr
    case 'not':
      return { kind: 'not', child: stripRedundantSideScope(expr.child, parentSide) }
    case 'sequence':
      return {
        kind: 'sequence',
        steps: expr.steps.map(s => stripRedundantSideScope(s, parentSide)),
        ...(expr.withinBars !== undefined ? { withinBars: expr.withinBars } : {}),
        ...(expr.nextBarOnly !== undefined ? { nextBarOnly: expr.nextBarOnly } : {}),
      }
  }
}

export function canonicalizeSemanticRule(rule: SemanticRule): SemanticRule {
  const condition = canonicalizeAtomExpr(stripRedundantSideScope(rule.condition, rule.sideScope))
  const normalizedEffects = rule.effects.map(eff =>
    canonicalizeAtomExpr(stripRedundantSideScope(eff, rule.sideScope)),
  )
  const sortedEffects = [...normalizedEffects].sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b)),
  )
  return {
    id: '_',
    phase: rule.phase,
    sideScope: rule.sideScope,
    condition,
    effects: sortedEffects,
  }
}

export function canonicalizeSemanticRules(rules: ReadonlyArray<SemanticRule>): SemanticRule[] {
  const canon = rules.map(canonicalizeSemanticRule)
  return [...canon].sort((a, b) => {
    const ka = `${a.phase}|${a.sideScope}|${JSON.stringify(a.condition)}|${JSON.stringify(a.effects)}`
    const kb = `${b.phase}|${b.sideScope}|${JSON.stringify(b.condition)}|${JSON.stringify(b.effects)}`
    return ka.localeCompare(kb)
  })
}
