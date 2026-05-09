/**
 * price.chart_pattern atom 示例 fixture
 *
 * atom 编译为 CHART_PATTERN 系列 + EQ predicate。
 * 白名单 4 patterns：head_and_shoulders / double_top / double_bottom / triangle。
 *
 * 字段约定：
 *   params.pattern:   'head_and_shoulders' | 'double_top' | 'double_bottom' | 'triangle'
 *   params.direction: 'bullish' | 'bearish'
 *
 * executableSinceVersion: '2026.05.W02'
 */

export const CHART_PATTERN_EXAMPLES = {
  /** zh 头肩底（inverse head and shoulders）：底部反转看涨形态 */
  headAndShouldersBullish: {
    pattern: 'head_and_shoulders' as const,
    direction: 'bullish' as const,
  },
  /** zh 双顶（double top）：顶部反转看跌形态 */
  doubleTopBearish: {
    pattern: 'double_top' as const,
    direction: 'bearish' as const,
  },
  /** zh 双底（double bottom）：底部反转看涨形态 */
  doubleBottomBullish: {
    pattern: 'double_bottom' as const,
    direction: 'bullish' as const,
  },
  /** zh 三角形向上突破（bullish triangle breakout） */
  triangleBullish: {
    pattern: 'triangle' as const,
    direction: 'bullish' as const,
  },
} as const
