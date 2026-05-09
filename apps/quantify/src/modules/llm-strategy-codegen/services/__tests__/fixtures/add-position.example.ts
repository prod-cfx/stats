/**
 * action.add_position atom 示例 fixture
 *
 * atom 编译为 ADD_LONG / ADD_SHORT action，metadata.addPosition 携带
 * stateKey='pyramiding_layer_count'，配合 position.pyramiding_limit 约束使用。
 *
 * 字段约定：
 *   params.addMode: 'signal_confirm' | 'profit_pct' | 'drawdown_pct'
 *   params.addRatio: number (0–1，相对原仓比例)
 *   params.sideScope: 'long' | 'short' | 'both'
 *
 * executableSinceVersion: '2026.05.W02'
 */

export const ADD_POSITION_EXAMPLES = {
  /** 信号再次确认加仓 50%（多头） */
  signalConfirmLong: {
    addMode: 'signal_confirm' as const,
    addRatio: 0.5,
    sideScope: 'long' as const,
  },
  /** 盈利 5% 后加仓 30%（多头） */
  profitPctLong: {
    addMode: 'profit_pct' as const,
    addRatio: 0.3,
    sideScope: 'long' as const,
  },
  /** 回撤补仓 20%（多头） */
  drawdownPctLong: {
    addMode: 'drawdown_pct' as const,
    addRatio: 0.2,
    sideScope: 'long' as const,
  },
  /** 信号确认加仓（空头） */
  signalConfirmShort: {
    addMode: 'signal_confirm' as const,
    addRatio: 0.5,
    sideScope: 'short' as const,
  },
} as const
