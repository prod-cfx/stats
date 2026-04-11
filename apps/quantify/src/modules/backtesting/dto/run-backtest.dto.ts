import type { ValidationArguments, ValidatorConstraintInterface } from 'class-validator'
import type { BacktestRunInput } from '../types/backtesting.types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
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

export class BacktestBarDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  symbol!: string

  @ApiProperty({ enum: ['5m', '15m', '1h', '4h', '1d'] })
  @IsIn(['5m', '15m', '1h', '4h', '1d'])
  timeframe!: BacktestRunInput['baseTimeframe']

  @ApiProperty()
  @IsNumber()
  openTime!: number

  @ApiProperty()
  @IsNumber()
  closeTime!: number

  @ApiProperty()
  @IsNumber()
  open!: number

  @ApiProperty()
  @IsNumber()
  high!: number

  @ApiProperty()
  @IsNumber()
  low!: number

  @ApiProperty()
  @IsNumber()
  close!: number

  @ApiProperty()
  @IsNumber()
  volume!: number
}

export class BacktestExecutionConfigDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  slippageBps!: number

  @ApiProperty()
  @IsNumber()
  @Min(0)
  feeBps!: number

  @ApiProperty({ enum: ['open', 'close', 'mid'] })
  @IsIn(['open', 'close', 'mid'])
  priceSource!: 'open' | 'close' | 'mid'
}

export class BacktestDataRangeDto {
  @ApiProperty()
  @IsNumber()
  fromTs!: number

  @ApiProperty()
  @IsNumber()
  toTs!: number
}

export class BacktestStrategyInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  id?: string

  @ApiProperty({ enum: ['v1'] })
  @IsIn(['v1'])
  protocolVersion!: 'v1'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  publishedSnapshotId?: string

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
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
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  symbols!: string[]

  @ApiProperty({ enum: ['5m', '15m', '1h', '4h', '1d'] })
  @IsIn(['5m', '15m', '1h', '4h', '1d'])
  baseTimeframe!: BacktestRunInput['baseTimeframe']

  @ApiProperty({ type: [String], enum: ['5m', '15m', '1h', '4h', '1d'] })
  @IsArray()
  @IsIn(['5m', '15m', '1h', '4h', '1d'], { each: true })
  stateTimeframes!: BacktestRunInput['stateTimeframes']

  @ApiProperty()
  @IsNumber()
  @Min(0)
  initialCash!: number

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  leverage!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowPartial?: boolean

  @ApiProperty({ type: BacktestExecutionConfigDto })
  @ValidateNested()
  @Type(() => BacktestExecutionConfigDto)
  execution!: BacktestExecutionConfigDto

  @ApiProperty({ type: BacktestStrategyInputDto })
  @ValidateNested()
  @Type(() => BacktestStrategyInputDto)
  strategy!: BacktestStrategyInputDto

  @ApiProperty({ type: BacktestDataRangeDto })
  @ValidateNested()
  @Type(() => BacktestDataRangeDto)
  dataRange!: BacktestDataRangeDto

  @ApiPropertyOptional({ type: [BacktestBarDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BacktestBarDto)
  bars?: BacktestRunInput['bars']
}
