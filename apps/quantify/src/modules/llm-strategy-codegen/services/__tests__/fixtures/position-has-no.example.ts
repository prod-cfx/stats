/**
 * position.has_position / position.no_position atom 示例 fixture
 *
 * 两个 atom 均编译为 gate 规则，产出 MAX_POSITION_PCT guard（value=0 BLOCK_NEW_ENTRY）。
 *
 * 字段约定：
 *   params.sideScope: 'long' | 'short' | 'both'
 *   phase: 'gate'
 *
 * IR 输出：
 *   kind: 'MAX_POSITION_PCT', scope: 'position', value: 0, onBreach: 'BLOCK_NEW_ENTRY'
 */

export const POSITION_HAS_POSITION_EXAMPLES = {
  /** 已有多头仓位 → 阻止开多 */
  hasLong: {
    sideScope: 'long',
  },
  /** 已有空头仓位 → 阻止开空 */
  hasShort: {
    sideScope: 'short',
  },
  /** 任意方向有仓位 → 阻止新开仓 */
  hasBoth: {
    sideScope: 'both',
  },
} as const

export const POSITION_NO_POSITION_EXAMPLES = {
  /** 无多头仓位时允许开多（有仓位时 gate 拦截） */
  noLong: {
    sideScope: 'long',
  },
  /** 无空头仓位时允许开空（有仓位时 gate 拦截） */
  noShort: {
    sideScope: 'short',
  },
  /** 无任意仓位时允许开仓（有仓位时 gate 拦截） */
  noBoth: {
    sideScope: 'both',
  },
} as const
