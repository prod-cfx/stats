/**
 * indicator.divergence atom 示例 fixture
 *
 * atom 编译为 INDICATOR_DIVERGENCE 系列 + EQ predicate。
 * 白名单：RSI / MACD 的顶背离（bearish）/ 底背离（bullish）。
 *
 * 字段约定：
 *   params.indicator:        'rsi' | 'macd'
 *   params.direction:        'bullish' | 'bearish'
 *   params.pivotWindow:      滚动窗口大小（默认 14）
 *   params.confirmationBars: 确认 K 线数（默认 3）
 *
 * executableSinceVersion: '2026.05.W02'
 */

export const DIVERGENCE_EXAMPLES = {
  /** zh RSI 顶背离（bearish）：价格创新高，RSI 未创新高 */
  rsiBearish: {
    indicator: 'rsi' as const,
    direction: 'bearish' as const,
    pivotWindow: 14,
    confirmationBars: 3,
  },
  /** zh MACD 底背离（bullish）：价格创新低，MACD 未创新低 */
  macdBullish: {
    indicator: 'macd' as const,
    direction: 'bullish' as const,
    pivotWindow: 14,
    confirmationBars: 3,
  },
  /** en RSI bullish divergence，自定义窗口 */
  rsiBullishCustomWindow: {
    indicator: 'rsi' as const,
    direction: 'bullish' as const,
    pivotWindow: 20,
    confirmationBars: 2,
  },
  /** zh MACD 顶背离（bearish） */
  macdBearish: {
    indicator: 'macd' as const,
    direction: 'bearish' as const,
    pivotWindow: 14,
    confirmationBars: 3,
  },
} as const
