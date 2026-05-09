/**
 * price.candle_pattern atom 示例 fixture
 *
 * atom 编译为 CANDLE_PATTERN 系列 + EQ predicate。
 * 白名单 4 patterns：engulfing / hammer / doji / consecutive_body。
 *
 * 字段约定：
 *   params.pattern:   'engulfing' | 'hammer' | 'doji' | 'consecutive_body'
 *   params.direction: 'bullish' | 'bearish'
 *   params.minBars:   number（仅 consecutive_body 时必填，其他 pattern 可省略）
 *
 * executableSinceVersion: '2026.05.W02'
 */

export const CANDLE_PATTERN_EXAMPLES = {
  /** zh 看涨吞没（bullish engulfing）：前一根阴线被后一根更大阳线完全覆盖 */
  engulfingBullish: {
    pattern: 'engulfing' as const,
    direction: 'bullish' as const,
  },
  /** zh 看跌锤子线（bearish hammer / hanging man）：上影线极短、下影线极长反转信号 */
  hammerBearish: {
    pattern: 'hammer' as const,
    direction: 'bearish' as const,
  },
  /** zh 看涨十字星（bullish doji）：开盘=收盘，反转不确定性高 */
  dojiBullish: {
    pattern: 'doji' as const,
    direction: 'bullish' as const,
  },
  /** zh 看涨连续实体（bullish consecutive_body）：连续 3 根阳线后做多 */
  consecutiveBodyBullish: {
    pattern: 'consecutive_body' as const,
    direction: 'bullish' as const,
    minBars: 3,
  },
} as const
