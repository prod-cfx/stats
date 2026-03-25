import type { BacktestRunInput } from '../types/backtesting.types'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsBoolean,
  Min,
  ValidateNested,
} from 'class-validator'

export class BacktestStrategyInputDto {
  @IsString()
  @IsNotEmpty()
  id!: string

  @IsIn(['v1'])
  protocolVersion!: 'v1'

  @IsString()
  @IsNotEmpty()
  scriptCode!: string

  @IsObject()
  params!: Record<string, unknown>
}

type RunBacktestDtoShape = Omit<BacktestRunInput, 'strategy' | 'bars'> & {
  strategy: BacktestStrategyInputDto
  bars?: BacktestRunInput['bars']
}

export class RunBacktestDto implements RunBacktestDtoShape {
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

  @IsOptional()
  @IsBoolean()
  allowPartial?: boolean

  @IsObject()
  execution!: BacktestRunInput['execution']

  @ValidateNested()
  @Type(() => BacktestStrategyInputDto)
  strategy!: BacktestStrategyInputDto

  @IsObject()
  dataRange!: BacktestRunInput['dataRange']

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  bars?: BacktestRunInput['bars']
}
