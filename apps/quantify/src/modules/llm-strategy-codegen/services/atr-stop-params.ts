/**
 * Issue #1383 Round 1 M3：抽出 ATR 止损参数提取规则。
 *
 * canonical-spec-builder 与 canonical-spec-v2-ir-compiler 两处都需要从用户/IR 输入
 * 中解析 `risk.atr_stop` 的 multiplier + period，原本两份复制粘贴会双源漂移。
 *
 * 输入约定：
 *   - multiplier 接受 `params.multiplier` 优先，回退到 `params.multiple` alias；
 *     必须是 finite number 且 > 0，否则返回 null
 *   - period 严格只接受 typeof === 'number'（整数 + 正）；其他类型一律默认 14
 *     与 helpers/technical-indicators.atr 默认行为对齐
 */
export interface AtrStopParams extends Record<string, number> {
  period: number
  multiplier: number
}

export function extractAtrStopParams(params: Record<string, unknown> | undefined | null): AtrStopParams | null {
  if (!params || typeof params !== 'object') return null

  const multiplierCandidate = typeof (params as { multiplier?: unknown }).multiplier === 'number'
    ? ((params as { multiplier: number }).multiplier)
    : typeof (params as { multiple?: unknown }).multiple === 'number'
      ? ((params as { multiple: number }).multiple)
      : null
  if (multiplierCandidate === null || !Number.isFinite(multiplierCandidate) || multiplierCandidate <= 0) {
    return null
  }

  const periodRaw = (params as { period?: unknown }).period
  const period = typeof periodRaw === 'number' && Number.isInteger(periodRaw) && periodRaw > 0
    ? periodRaw
    : 14

  return { period, multiplier: multiplierCandidate }
}
