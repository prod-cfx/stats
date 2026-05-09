/**
 * action.reverse_position atom 示例 fixture
 *
 * atom 编译为 CLOSE_LONG/SHORT + OPEN_LONG/SHORT 双 action，
 * metadata.reversePosition 携带 fromSide / toSide / sameBarPolicy / sizingSource。
 *
 * 字段约定：
 *   params.fromSide: 'long' | 'short'
 *   params.toSide:   'long' | 'short'
 *   params.sameBarPolicy: 'allow' | 'next_bar_only'
 *   params.sizingSource:  'current_position' | 'explicit'
 *
 * executableSinceVersion: '2026.05.W02'
 */

export const REVERSE_POSITION_EXAMPLES = {
  /** 多翻空，同 K 线反手，沿用当前仓位 */
  longToShortSameBar: {
    fromSide: 'long' as const,
    toSide: 'short' as const,
    sameBarPolicy: 'allow' as const,
    sizingSource: 'current_position' as const,
  },
  /** 空翻多，下根 K 线执行，固定仓位 */
  shortToLongNextBar: {
    fromSide: 'short' as const,
    toSide: 'long' as const,
    sameBarPolicy: 'next_bar_only' as const,
    sizingSource: 'explicit' as const,
  },
  /** 多翻空，默认下根 K 线，固定仓位 */
  longToShortDefault: {
    fromSide: 'long' as const,
    toSide: 'short' as const,
    sameBarPolicy: 'next_bar_only' as const,
    sizingSource: 'explicit' as const,
  },
} as const
