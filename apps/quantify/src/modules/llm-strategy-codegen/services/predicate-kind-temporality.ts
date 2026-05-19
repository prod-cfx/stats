import type { PredicateDef } from '../types/canonical-strategy-ir'

/**
 * Issue #1457 闸 2 — graph-IR predicate kind 的 temporality 真相源。
 *
 * 注意：本表是 IR compiler 层的 invariant 锚点，与 atom-contract-registry.ts 中的
 * `ATOM_TEMPORALITY` 是 **两个独立概念**（见 review round 1 M1）：
 *
 *   - ATOM_TEMPORALITY（47 atom 级）：表达 atom 在语义层"是否带持续状态"。
 *     用途：Issue #1458 directional pairs 对称配对 / 业务侧 atom 语义 lint。
 *   - PREDICATE_KIND_TEMPORALITY（18 kind）：表达 PredicateDef.kind 在 IR
 *     compiler 层编译出来的形态是否为 rising-edge。
 *     用途：本文件下 invariant —— compiler 层判断 entry rule 是否含 event leaf。
 *
 * 两表无映射关系：一个 atom（如 price.percent_change，atom 层 'event'）可能编译
 *   成 GT 比较谓词（kind 层 'state'）。compiler 层的语义判断必须以 PredicateDef
 *   kind 为准，atom 层 temporality 不参与本判断。
 *
 *   'state'     持续真值类比较谓词（每根 K 线状态满足即触发）
 *   'event'     rising-edge 一次性触发谓词（仅在状态翻转/触碰瞬间发射）
 *   'composite' 组合算子（AND/OR/allOf/anyOf/NOT），temporality 由子节点决定
 *
 * NOT 走 composite 但语义上需翻转——NOT(event) 等价"非翻转瞬间"，本质是持续
 *   状态；NOT(state) 仍是持续状态。collectEntryRuleLeafKinds 内 visit() 通过
 *   `negated` flag 与 `NOT:<kind>` 占位串实现翻转（review round 1 M3）。
 */
export type PredicateKindTemporality = 'state' | 'event' | 'composite'

export const PREDICATE_KIND_TEMPORALITY: Readonly<Record<PredicateDef['kind'], PredicateKindTemporality>> = {
  // ── state：持续真值比较 ──
  GT: 'state', // 数值持续大于
  GTE: 'state', // 数值持续大于等于
  LT: 'state', // 数值持续小于
  LTE: 'state', // 数值持续小于等于
  EQ: 'state', // 数值相等比较（在浮点维度退化为状态）
  compare: 'state', // 显式持有 op 的通用比较器（与 GT/LT/GTE/LTE 同构）
  WITHIN_LEVEL_SET: 'state', // close 位于 level set 区间内，持续判定
  // ── event：rising-edge / 触碰 / 序列 ──
  CROSS_OVER: 'event', // 上穿瞬间发射
  CROSS_UNDER: 'event', // 下穿瞬间发射
  cross: 'event', // 通用 cross 算子（含 above/below 翻转）
  TOUCH_LEVEL_UP: 'event', // 自下而上触及一根 level 时触发
  TOUCH_LEVEL_DOWN: 'event', // 自上而下触及一根 level 时触发
  sequence: 'event', // 多步序列条件，最终 step 满足时一次触发
  externalSignal: 'event', // webhook / 外部事件到达时触发
  // ── composite：组合算子，由子节点判定 ──
  AND: 'composite',
  OR: 'composite',
  NOT: 'composite', // 见上：collectEntryRuleLeafKinds 做 temporality 翻转
  allOf: 'composite',
  anyOf: 'composite',
}

/**
 * 从 entry rule 顶层 predicate id 出发，递归收集"effective leaf"的 kind 列表。
 *
 * Composite 规则：
 *   - AND/OR/allOf/anyOf → 透明递归子节点
 *   - NOT(child)         → 把 child 视作 leaf，但 effective temporality 翻转
 *                          （event → state；state → state）。实现上 NOT-wrapped
 *                          child 以 `NOT:<kind>` 占位串入 leafKinds，调用方
 *                          通过 leafKindsContainEvent 统一处理。
 */
export function collectEntryRuleLeafKinds(
  rootPredicateId: string,
  predicateById: ReadonlyMap<string, PredicateDef>,
): string[] {
  const leafKinds: string[] = []
  const visited = new Set<string>()

  const visit = (predicateId: string, negated: boolean): void => {
    const key = `${negated ? 'N' : 'P'}:${predicateId}`
    if (visited.has(key)) return
    visited.add(key)

    const predicate = predicateById.get(predicateId)
    if (!predicate) return

    const temporality = PREDICATE_KIND_TEMPORALITY[predicate.kind]

    // NOT 翻转：递归 NOT 子节点，并把 negated 取反；NOT(NOT(x)) 抵消
    if (predicate.kind === 'NOT') {
      for (const arg of predicate.args) visit(arg, !negated)
      return
    }
    if (temporality === 'composite') {
      for (const arg of predicate.args) visit(arg, negated)
      return
    }

    if (negated) {
      leafKinds.push(`NOT:${predicate.kind}`)
      return
    }
    leafKinds.push(predicate.kind)
  }

  visit(rootPredicateId, false)
  return leafKinds
}

/**
 * 判定一个"原始 leaf kind 串"（含 NOT-prefix 占位）是否包含 event。
 *   - NOT:X 一律视为 state（NOT 翻转后必为持续状态）
 *   - X 自身按 PREDICATE_KIND_TEMPORALITY 查表
 */
export function leafKindsContainEvent(leafKinds: readonly string[]): boolean {
  return leafKinds.some((kind) => {
    if (kind.startsWith('NOT:')) return false
    return PREDICATE_KIND_TEMPORALITY[kind as PredicateDef['kind']] === 'event'
  })
}
