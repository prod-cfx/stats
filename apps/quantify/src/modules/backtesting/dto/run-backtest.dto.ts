import type { BacktestRunInput } from '../types/backtesting.types'

export class RunBacktestDto implements BacktestRunInput {
  symbols!: string[]
  baseTimeframe!: BacktestRunInput['baseTimeframe']
  stateTimeframes!: BacktestRunInput['stateTimeframes']
  initialCash!: number
  leverage!: number
  execution!: BacktestRunInput['execution']
  strategy!: BacktestRunInput['strategy']
  dataRange!: BacktestRunInput['dataRange']
  bars!: BacktestRunInput['bars']
}
