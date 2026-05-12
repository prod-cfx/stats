import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'

export const DEFAULT_INDICATOR_PARAMS = {
  bollingerBands: { period: 20, stdDev: 2 },
  sma: { period: 20 },
  ema: { period: 20 },
  rsi: { period: 14 },
  atr: { period: 14 },
  macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
} as const

export const CANONICAL_RULE_KEYS = {
  executionOnStart: 'execution.on_start',
  bollingerUpperBreak: 'bollinger.upper_break',
  bollingerLowerBreak: 'bollinger.lower_break',
  bollingerMiddleRevert: 'bollinger.middle_revert',
  bollingerBarsOutside: 'bollinger.bars_outside',
  movingAverageGoldenCross: 'ma.golden_cross',
  movingAverageDeathCross: 'ma.death_cross',
  rsiThresholdLte: 'rsi.threshold_lte',
  rsiThresholdGte: 'rsi.threshold_gte',
  rsiCrossOver: 'rsi.cross_over',
  rsiCrossUnder: 'rsi.cross_under',
  macdGoldenCross: 'macd.golden_cross',
  macdDeathCross: 'macd.death_cross',
  positionLossPct: 'position_loss_pct',
} as const

export type CanonicalRuleKeyValue = (typeof CANONICAL_RULE_KEYS)[keyof typeof CANONICAL_RULE_KEYS]

type Registry = typeof ATOM_CONTRACT_REGISTRY
type RegistryKey = keyof Registry

export type FirstWaveTriggerAtom = {
  [K in RegistryKey]:
    Extract<Registry[K]['canonicalWave'], 'first-wave'> extends never
      ? never
      : K
}[RegistryKey]

export const FIRST_WAVE_TRIGGER_ATOMS = Object.values(ATOM_CONTRACT_REGISTRY)
  .filter((contract): contract is Registry[FirstWaveTriggerAtom] =>
    contract.bucket === 'trigger' && contract.canonicalWave === 'first-wave',
  )
  .map(contract => contract.key) as FirstWaveTriggerAtom[]

export type FirstWaveStateTriggerAtom = Extract<
  FirstWaveTriggerAtom,
  'trend.direction' | 'market.regime' | 'volatility.state'
>

export const FIRST_WAVE_STATE_TRIGGER_ATOMS = FIRST_WAVE_TRIGGER_ATOMS
  .filter((atom): atom is FirstWaveStateTriggerAtom =>
    atom === 'trend.direction' || atom === 'market.regime' || atom === 'volatility.state',
  )

export const FIRST_WAVE_FAMILIES = [
  'single-leg',
  'grid.range_rebalance',
  'state-gated',
] as const

export type FirstWaveStrategyFamily = (typeof FIRST_WAVE_FAMILIES)[number]

export const GRID_STRATEGY_FAMILY = 'grid.range_rebalance' as const
