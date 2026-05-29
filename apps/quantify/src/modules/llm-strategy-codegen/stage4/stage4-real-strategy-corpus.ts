import type { Stage4BlockerKind } from './staging-dialogue-runner'

export type Stage4RealStrategyCategory =
  | 'simple_trend'
  | 'mean_reversion'
  | 'grid'
  | 'dca'
  | 'add_position'
  | 'portfolio_risk'
  | 'multi_timeframe'
  | 'multi_symbol'

export interface Stage4ClarificationTurn {
  readonly assistantSlotPath: string
  readonly userAnswer: string
}

export interface Stage4RealStrategyCase {
  readonly id: string
  readonly category: Stage4RealStrategyCategory
  readonly initialUserMessage: string
  readonly expectedAtomKeys: readonly string[]
  readonly expectedSemanticIntent: readonly string[]
  readonly clarificationTurns: readonly Stage4ClarificationTurn[]
  readonly expectedFailure: Stage4BlockerKind | null
}

export const STAGE4_REAL_STRATEGY_CORPUS = [] as const satisfies readonly Stage4RealStrategyCase[]
