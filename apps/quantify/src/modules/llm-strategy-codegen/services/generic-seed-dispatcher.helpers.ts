/**
 * GenericSeedDispatcher 纯函数 helpers — Issue #1279 PR2 Run 1 (C3)
 *
 * 这些 helper 是 Run 2 (C4) dispatcher 主体的基础积木：
 *
 *   matchKeyword(clause, keywords)         — 关键词匹配（surface.intent.keywords 路径）
 *   matchVerbDirection(clause, verbs)      — 动词匹配并派生 Direction（surface.intent.verbs 路径）
 *   resolvePhaseFromClause(clause, spec)   — phase 推断（surface.phaseResolver 路径）
 *
 * 设计约束：
 *   - 全部纯函数：不依赖 NestJS DI / 全局状态 / 外部 service
 *   - 不读 ATOM_CONTRACT_REGISTRY：caller 把 surface 字段传进来
 *   - 不出现 atom-key 字面量：通过 no-atom-key-literal lint rule 守门
 *   - 返回 null 表示"没命中/无法推断"，不抛错；抛错由 dispatcher 主体决定时机
 *
 * 命名约定：
 *   - clause: 已切分的单个子句字符串
 *   - keywords: surface.intent.keywords 数组（atom 自身声明的同义词）
 *   - verbs: surface.intent.verbs Record<Direction, string[]>
 *
 * Refs: #1279
 */
import type { Direction, PhaseResolverSpec, ResolveCtx } from '../atom-contracts/atom-contract-surface.types'

/**
 * matchKeyword
 *
 * 在 clause 中查找 keywords 数组里任一字符串是否出现（大小写不敏感）。
 *
 * @returns 首个命中的 keyword（原大小写），找不到返回 null
 *
 * 行为：
 *   - 空 clause → null
 *   - 空 keywords → null
 *   - 大小写不敏感（'RSI' 命中 'rsi 大于 70'；'ATR' 命中 'atr波动'）
 *   - 不做 word boundary 检查（中文场景无 word boundary，'RSI14' 也能命中 'RSI'）
 */
export function matchKeyword(
  clause: string,
  keywords: readonly string[],
): string | null {
  if (!clause || keywords.length === 0) {
    return null
  }
  const lower = clause.toLowerCase()
  for (const kw of keywords) {
    if (!kw) {
      continue
    }
    if (lower.includes(kw.toLowerCase())) {
      return kw
    }
  }
  return null
}

/**
 * matchVerbDirection
 *
 * 遍历 verbs Record<Direction, string[]>，对每个 Direction 检查其动词集是否在 clause 中出现。
 *
 * @returns 首个命中的 Direction（按 verbs 对象自身的 key 顺序），找不到返回 null
 *
 * 行为：
 *   - verbs key 顺序由调用方决定（Object.entries 保留插入顺序）
 *   - 任一 direction 的 verb 数组里任一 verb 命中即返回该 direction
 *   - verb 字符串大小写不敏感（与 matchKeyword 一致）
 *   - 子句不命中任何 verb → null（caller 决定是否抛错）
 */
export function matchVerbDirection(
  clause: string,
  verbs: Readonly<Partial<Record<Direction, readonly string[]>>>,
): Direction | null {
  if (!clause) {
    return null
  }
  const lower = clause.toLowerCase()
  for (const direction of Object.keys(verbs) as Direction[]) {
    const verbList = verbs[direction]
    if (!verbList || verbList.length === 0) {
      continue
    }
    for (const verb of verbList) {
      if (!verb) {
        continue
      }
      if (lower.includes(verb.toLowerCase())) {
        return direction
      }
    }
  }
  return null
}

/**
 * resolvePhaseFromClause
 *
 * 按 PhaseResolverSpec 推断 phase ('entry' | 'exit' | null)。
 *
 * 三种 spec：
 *   'fixed-entry'         恒返回 'entry'（如 grid.range_rebalance）
 *   'fixed-exit'          恒返回 'exit'（如 risk.partial_take_profit）
 *   'by-clause-verb'      按子句动词的入场/出场词法判断
 *   { kind: 'fn', fn }    委托给自定义函数
 *
 * by-clause-verb 内置词法：
 *   入场: 开多 / 开空 / 进场 / 开仓 / 做多 / 做空 / 加仓 / open / long / short / enter
 *   出场: 平仓 / 平多 / 平空 / 止盈 / 止损 / 离场 / 卖出 / close / exit / take[ -]?profit / stop[ -]?loss
 *   两者都不含 → null
 *
 * 设计取舍：
 *   - 词法表是写死的（无法做成数据驱动 —— phase 概念本身就只有 entry/exit 两个枚举，
 *     不会因为加 atom 而需要扩展，所以不算补丁路径，不算字面量分支）
 *   - lint 规则只阻 atom-key 字面量（action./price./oscillator. 等），不阻业务词法
 */
const ENTRY_PHRASES = [
  '开多', '开空', '进场', '开仓', '做多', '做空', '加仓', '入场',
  'open', 'long ', 'short ', 'enter',
]

const EXIT_PHRASES = [
  '平仓', '平多', '平空', '止盈', '止损', '离场', '卖出', '出场',
  'close', 'exit', 'take profit', 'take-profit', 'stop loss', 'stop-loss',
]

export function resolvePhaseFromClause(
  clause: string,
  spec: PhaseResolverSpec,
  ctx: ResolveCtx = { atomKey: '', params: {} },
): 'entry' | 'exit' | 'gate' | null {
  if (spec === 'fixed-entry') {
    return 'entry'
  }
  if (spec === 'fixed-exit') {
    return 'exit'
  }
  if (spec === 'fixed-gate') {
    return 'gate'
  }
  if (typeof spec === 'object' && spec !== null && spec.kind === 'fn') {
    return spec.fn(clause, ctx)
  }
  // 'by-clause-verb'
  if (!clause) {
    return null
  }
  const lower = clause.toLowerCase()
  const hasEntry = ENTRY_PHRASES.some(p => lower.includes(p.toLowerCase()))
  const hasExit = EXIT_PHRASES.some(p => lower.includes(p.toLowerCase()))
  // 优先级：出场词高于入场词（典型句"RSI 70 卖出平仓"应判 exit 而非 entry）
  if (hasExit) {
    return 'exit'
  }
  if (hasEntry) {
    return 'entry'
  }
  return null
}
