import type { BacktestRunInput } from '../types/backtesting.types'
import { IsArray, IsIn, IsNumber, IsObject, IsPositive, IsString, Min, ValidateNested } from 'class-validator'

export class RunBacktestDto implements BacktestRunInput {
  @IsArray()
  @IsString({ each: true })
  symbols!: string[]

  @IsIn(['5m', '15m', '1h', '4h', '1d'])
  baseTimeframe!: BacktestRunInput['baseTimeframe']

  @IsArray()
  @IsIn(['5m', '15m', '1h', '4h', '1d'], { each: true })
  stateTimeframes!: BacktestRunInput['stateTimeframes']

  @IsNumber()
  @Min(0)
  initialCash!: number

  @IsNumber()
  @IsPositive()
  leverage!: number

  @IsObject()
  execution!: BacktestRunInput['execution']

  @IsObject()
  strategy!: BacktestRunInput['strategy']

  @IsObject()
  dataRange!: BacktestRunInput['dataRange']

  @IsArray()
  @ValidateNested({ each: true })
  bars!: BacktestRunInput['bars']
}
