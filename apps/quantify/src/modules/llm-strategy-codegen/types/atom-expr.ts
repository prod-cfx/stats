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
// zod schema（递归 union；z.lazy 解 forward-ref）
//
// 类型断言为 z.ZodType<AtomExpr> 时，TS 在 discriminatedUnion + lazy 组合下推断会
// 给出 readonly vs mutable 数组差异。这里用 z.ZodType<AtomExpr, z.ZodTypeDef,
// AtomExpr> 的形式锁定 input/output 同型，并显式 cast，避免类型噪音。
// ─────────────────────────────────────────────────────────────────────────────

const atomExprAtomSchema = z.object({
  kind: z.literal('atom'),
  key: z.string().min(1),
  params: z.record(z.unknown()),
  sideScope: z.enum(['long', 'short', 'both']).optional(),
})

export const atomExprSchema: z.ZodType<AtomExpr> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    atomExprAtomSchema,
    z.object({
      kind: z.literal('and'),
      children: z.array(atomExprSchema).min(ATOM_EXPR_MIN_CHILDREN),
    }),
    z.object({
      kind: z.literal('or'),
      children: z.array(atomExprSchema).min(ATOM_EXPR_MIN_CHILDREN),
    }),
    z.object({
      kind: z.literal('not'),
      child: atomExprSchema,
    }),
    z.object({
      kind: z.literal('sequence'),
      steps: z.array(atomExprSchema).min(ATOM_EXPR_MIN_CHILDREN),
      withinBars: z.number().int().positive().optional(),
      nextBarOnly: z.boolean().optional(),
    }),
  ]),
) as unknown as z.ZodType<AtomExpr>

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

export function pruneAtomExprToValid(node: unknown): AtomExpr | null {
  if (!node || typeof node !== 'object') return null
  const kind = (node as { kind?: unknown }).kind
  if (kind === 'atom') {
    const parsed = atomExprAtomSchema.safeParse(node)
    if (!parsed.success) return null
    const atom = parsed.data as AtomExprAtom
    // Issue #1395 mute-spider S5：在 zod 结构校验通过后追加 params 值域严校
    if (!isAtomParamsStrictlyValid(atom.key, atom.params)) return null
    return atom as AtomExpr
  }
  if (kind === 'and' || kind === 'or') {
    const raw = (node as { children?: unknown }).children
    if (!Array.isArray(raw)) return null
    const pruned = raw
      .map(c => pruneAtomExprToValid(c))
      .filter((c): c is AtomExpr => c !== null)
    if (pruned.length >= ATOM_EXPR_MIN_CHILDREN) {
      return { kind, children: pruned } as AtomExpr
    }
    if (pruned.length === 1) {
      // 退化：保留唯一 valid child，丢掉 and/or 包裹
      return pruned[0]
    }
    return null
  }
  if (kind === 'not') {
    const child = pruneAtomExprToValid((node as { child?: unknown }).child)
    return child ? { kind: 'not', child } : null
  }
  if (kind === 'sequence') {
    const raw = (node as { steps?: unknown }).steps
    if (!Array.isArray(raw) || raw.length === 0) return null
    const prunedSteps: AtomExpr[] = []
    for (const step of raw) {
      const v = pruneAtomExprToValid(step)
      if (!v) return null // sequence 顺序不可残缺
      prunedSteps.push(v)
    }
    const original = node as {
      withinBars?: unknown
      nextBarOnly?: unknown
    }
    const withinBars
      = typeof original.withinBars === 'number' && Number.isInteger(original.withinBars) && original.withinBars > 0
        ? original.withinBars
        : undefined
    const nextBarOnly = typeof original.nextBarOnly === 'boolean' ? original.nextBarOnly : undefined
    return {
      kind: 'sequence',
      steps: prunedSteps,
      ...(withinBars !== undefined ? { withinBars } : {}),
      ...(nextBarOnly !== undefined ? { nextBarOnly } : {}),
    }
  }
  return null
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
    const issues = headerParsed.error.issues.slice(0, 5)
      .map(i => `path=${i.path.join('.')} code=${i.code}`).join('; ')
    return { ok: false, errorPath: `header: ${issues}` }
  }
  const condition = pruneAtomExprToValid(obj.condition)
  if (!condition) {
    return { ok: false, errorPath: 'condition: pruned to empty' }
  }
  const rawEffects = Array.isArray(obj.effects) ? obj.effects : []
  const effects: AtomExpr[] = []
  for (const eff of rawEffects) {
    const pruned = pruneAtomExprToValid(eff)
    if (pruned) effects.push(pruned)
  }
  return {
    ok: true,
    rule: {
      id: headerParsed.data.id,
      phase: headerParsed.data.phase,
      sideScope: headerParsed.data.sideScope,
      condition,
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
