/**
 * position.dca_schedule atom 示例 fixture
 *
 * atom 编译为 ADD_LONG/SHORT action，
 * metadata.dcaSchedule 携带 maxCount / capitalCap / triggerMode / exitRule / stateKey。
 *
 * 字段约定：
 *   params.maxCount:        最多补仓次数
 *   params.capitalCap:      总资金上限（USDT）
 *   params.perOrderSizing:  每次补仓金额或比例
 *   params.triggerMode:     'price_interval' | 'time_interval' | 'signal'
 *   params.exitRule:        退出规则对象（可选）
 *
 * executableSinceVersion: '2026.05.W02'
 */

export const DCA_SCHEDULE_EXAMPLES = {
  /** zh 价格间隔触发，带最大次数，带资金上限 */
  priceIntervalWithCap: {
    maxCount: 3,
    capitalCap: { kind: 'quote', value: 1000, asset: 'USDT' },
    perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' },
    triggerMode: 'price_interval' as const,
  },
  /** zh 价格间隔触发，带退出规则（跌破前低停止） */
  priceIntervalWithExitRule: {
    maxCount: 4,
    capitalCap: { kind: 'quote', value: 2000, asset: 'USDT' },
    perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' },
    triggerMode: 'price_interval' as const,
    exitRule: {
      type: 'stop_on_break_previous_low',
      reference: 'previous_low',
    },
  },
  /** en signal-triggered DCA */
  signalTriggered: {
    maxCount: 2,
    capitalCap: { kind: 'quote', value: 500, asset: 'USDT' },
    perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' },
    triggerMode: 'signal' as const,
  },
} as const
