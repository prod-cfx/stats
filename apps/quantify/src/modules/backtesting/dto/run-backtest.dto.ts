import type { ValidationArguments, ValidatorConstraintInterface } from 'class-validator'
import type { BacktestRunInput } from '../types/backtesting.types'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidatorConstraint,
  Validate,
  ValidateNested,
} from 'class-validator'

@ValidatorConstraint({ name: 'backtestStrategyPayloadConstraint', async: false })
class BacktestStrategyPayloadConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args?: ValidationArguments): boolean {
    const objectValue = args?.object
    if (!objectValue || typeof objectValue !== 'object') {
      return false
    }

    const strategy = objectValue as { publishedSnapshotId?: unknown }
    const snapshotId = typeof strategy.publishedSnapshotId === 'string' ? strategy.publishedSnapshotId.trim() : ''

    return snapshotId.length > 0
  }

  defaultMessage(_args?: ValidationArguments): string {
    return 'strategy requires publishedSnapshotId'
  }
}

export class BacktestStrategyInputDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  id?: string

  @IsIn(['v1'])
  protocolVersion!: 'v1'

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  publishedSnapshotId?: string

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>

  @Validate(BacktestStrategyPayloadConstraint)
  private readonly __payloadGuard = true
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
