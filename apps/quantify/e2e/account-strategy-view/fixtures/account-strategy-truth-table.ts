export const ACCOUNT_STRATEGY_TRUTH_TABLE = {
  S1: {
    strategyId: 'e2e-strategy-s1',
    status: 'running',
    totalPnl: 320.12,
    todayPnl: 18.34,
  },
  S2: {
    strategyId: 'e2e-strategy-s2',
    status: 'stopped',
    totalPnl: 320.12,
    todayPnl: null,
    equitySeries: [10000, 10080, 10050],
  },
  S3: {
    strategyId: 'e2e-strategy-s3',
    status: 'paused',
    totalPnl: 0,
    todayPnl: 0,
  },
  S4: {
    strategyId: 'e2e-strategy-s4',
    status: 'stopped',
    totalPnl: null,
    todayPnl: null,
    equitySeries: [10000, 10120, 10070],
  },
} as const

export type AccountStrategyTruthKey = keyof typeof ACCOUNT_STRATEGY_TRUTH_TABLE

