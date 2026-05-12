/**
 * NaturalLanguageGatewayService — per-order sizing 自然语言识别器
 *
 * 识别以下四类 per-order sizing 表达，返回标准化 PerOrderSizingResult：
 *   1. 每次下单 N USDT / 每次 N U / N USDT 每次  → notional_quote
 *   2. 账户 X% / X% 仓位 / 每次 X%              → equity_ratio (value = X/100)
 *   3. N 张 / N 张合约                           → fixed_base_qty
 *
 * 识别成功后调用方可 emit `capital.allocate.per_order_budget` capability。
 *
 * @internal nl-gateway 内部 API。本 PR (#1230) 仅落地 parser；接入主流程
 * 由后续 PR #1237 / #1248 完成。**禁止在 nl-gateway 目录外直接导入**，
 * 避免绕过 codegen pipeline 路由规划。
 *
 * Refs: #1230
 */

export type PerOrderSizingMode = 'notional_quote' | 'equity_ratio' | 'fixed_base_qty'

export interface PerOrderSizingResult {
  mode: PerOrderSizingMode
  value: number
}

// 匹配 "每次下单 N USDT" / "每次 N U" / "N USDT 每次" 等 notional_quote 表达
const NOTIONAL_QUOTE_RE =
  /(?:每次下单\s*(\d+(?:\.\d+)?)\s*U(?:SDT)?|每次\s*(\d+(?:\.\d+)?)\s*U(?:SDT)?|(\d+(?:\.\d+)?)\s*U(?:SDT)\s*每次)/i

// 匹配 "账户 X%" / "X% 仓位" / "每次 X%" 等 equity_ratio 表达
const EQUITY_RATIO_RE =
  /(?:账户\s*(\d+(?:\.\d+)?)%|(\d+(?:\.\d+)?)%\s*仓位|每次\s*(\d+(?:\.\d+)?)%)/

// 匹配 "N 张" / "N 张合约" 等 fixed_base_qty 表达
const FIXED_BASE_QTY_RE = /(\d+(?:\.\d+)?)\s*张(?:合约)?/

// 检测负号前缀：判断匹配到的数字前一个字符是否为 '-'
function hasNegativePrefix(utterance: string, match: RegExpExecArray): boolean {
  const idx = match.index
  return idx > 0 && utterance[idx - 1] === '-'
}

/**
 * 从自然语言文本中提取 per-order sizing 信息。
 *
 * @param utterance 用户输入的自然语言字符串
 * @returns 识别到的 PerOrderSizingResult，未识别则返回 null
 */
export function parsePerOrderSizing(utterance: string): PerOrderSizingResult | null {
  if (!utterance || utterance.trim().length === 0) return null

  // 1. notional_quote: 每次下单 N USDT / 每次 N U / N USDT 每次
  const notionalMatch = NOTIONAL_QUOTE_RE.exec(utterance)
  if (notionalMatch && !hasNegativePrefix(utterance, notionalMatch)) {
    const raw = notionalMatch[1] ?? notionalMatch[2] ?? notionalMatch[3]
    const value = parseFloat(raw)
    if (Number.isFinite(value) && value > 0) {
      return { mode: 'notional_quote', value }
    }
  }

  // 2. equity_ratio: 账户 X% / X% 仓位 / 每次 X%
  const ratioMatch = EQUITY_RATIO_RE.exec(utterance)
  if (ratioMatch) {
    const raw = ratioMatch[1] ?? ratioMatch[2] ?? ratioMatch[3]
    const pct = parseFloat(raw)
    if (Number.isFinite(pct) && pct > 0) {
      return { mode: 'equity_ratio', value: pct / 100 }
    }
  }

  // 3. fixed_base_qty: N 张 / N 张合约
  const qtyMatch = FIXED_BASE_QTY_RE.exec(utterance)
  if (qtyMatch) {
    const value = parseFloat(qtyMatch[1])
    if (Number.isFinite(value) && value > 0) {
      return { mode: 'fixed_base_qty', value }
    }
  }

  return null
}

/**
 * 将 PerOrderSizingResult 转换为 capital.allocate.per_order_budget capability shape。
 * 调用方将此 shape 与 DCA_PER_ORDER_BUDGET_CAPABILITY 三元组合并后 emit。
 */
export function toPerOrderBudgetCapabilityShape(
  result: PerOrderSizingResult,
  triggerSource: string,
): Record<string, string | number> {
  const kindMap: Record<PerOrderSizingMode, string> = {
    notional_quote: 'quote',
    equity_ratio: 'ratio',
    fixed_base_qty: 'base_qty',
  }
  return {
    kind: kindMap[result.mode],
    value: result.value,
    triggerSource,
  }
}
