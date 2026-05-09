/**
 * liquidity.sweep atom 示例 fixture
 *
 * atom 编译为 LIQUIDITY_SWEEP 系列 + EQ predicate。
 * 白名单方向：bullish / bearish；白名单 reference：prev_low / prev_high / session_low / session_high。
 *
 * 字段约定：
 *   params.direction:   'bullish' | 'bearish'
 *   params.reference:   'prev_low' | 'prev_high' | 'session_low' | 'session_high'
 *   params.reclaimBars: number（默认 3）
 *
 * executableSinceVersion: '2026.05.W02'
 */

export const LIQUIDITY_SWEEP_EXAMPLES = {
  /** 扫前低 + reclaim 3 根 → 看涨反转入场 */
  bullishSweepPrevLow: {
    direction: 'bullish' as const,
    reference: 'prev_low' as const,
    reclaimBars: 3,
  },
  /** 扫前高 + reclaim 3 根 → 看跌反转入场 */
  bearishSweepPrevHigh: {
    direction: 'bearish' as const,
    reference: 'prev_high' as const,
    reclaimBars: 3,
  },
  /** 扫日内低 + reclaim 5 根 → 看涨入场 */
  bullishSweepSessionLow: {
    direction: 'bullish' as const,
    reference: 'session_low' as const,
    reclaimBars: 5,
  },
  /** 扫日内高 + reclaim 5 根 → 看跌入场 */
  bearishSweepSessionHigh: {
    direction: 'bearish' as const,
    reference: 'session_high' as const,
    reclaimBars: 5,
  },
} as const
