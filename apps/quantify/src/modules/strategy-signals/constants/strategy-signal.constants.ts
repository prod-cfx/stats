export const StrategySignalEvents = {
  CREATED: 'strategy-signal.created',
  EXECUTION_COMPLETED: 'strategy-signal.execution.completed',
} as const

export type StrategySignalEvent = typeof StrategySignalEvents[keyof typeof StrategySignalEvents]
