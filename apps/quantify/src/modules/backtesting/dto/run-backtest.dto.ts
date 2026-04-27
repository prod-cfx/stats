import type { ValidationArguments, ValidatorConstraintInterface } from 'class-validator'
import type { BacktestRunInput } from '../types/backtesting.types'
import { MARKET_TIMEFRAMES } from '@ai/shared'
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

    const strategy = objectValue as { publishedSnapshotId?: unknown, params?: { marketType?: unknown } }
    const snapshotId = typeof strategy.publishedSnapshotId === 'string' ? strategy.publishedSnapshotId.trim() : ''
    const marketType = typeof strategy.params?.marketType === 'string'
      ? strategy.params.marketType.trim().toLowerCase()
      : ''

    return snapshotId.length > 0 && (marketType === 'spot' || marketType === 'perp')
  }

  defaultMessage(_args?: ValidationArguments): string {
    return 'strategy requires publishedSnapshotId and params.marketType in spot|perp'
  }
}

@ValidatorConstraint({ name: 'backtestLeverageConstraint', async: false })
class BacktestLeverageConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args?: ValidationArguments): boolean {
    const objectValue = args?.object as { leverage?: unknown, strategy?: { params?: { marketType?: unknown } } } | undefined
    const marketType = typeof objectValue?.strategy?.params?.marketType === 'string'
      ? objectValue.strategy.params.marketType.trim().toLowerCase()
      : ''
    const leverage = typeof objectValue?.leverage === 'number' ? objectValue.leverage : null

    if (marketType === 'spot') {
      return leverage === null || (Number.isFinite(leverage) && leverage > 0)
    }
    if (marketType === 'perp') {
      return leverage !== null && Number.isFinite(leverage) && leverage > 0
    }
    return false
  }

  defaultMessage(_args?: ValidationArguments): string {
    return 'perp backtests require leverage and spot/perp marketType must be confirmed before backtest'
  }
}

export class BacktestBarDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  symbol!: string

  @ApiProperty({ enum: MARKET_TIMEFRAMES })
  @IsIn(MARKET_TIMEFRAMES)
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

export class BacktestRequestedRangeInputDto {
  @ApiProperty({ enum: ['7D', '30D', '90D', '1Y', 'CUSTOM'] })
  @IsIn(['7D', '30D', '90D', '1Y', 'CUSTOM'])
  preset!: '7D' | '30D' | '90D' | '1Y' | 'CUSTOM'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startAt?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endAt?: string
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

  @ApiProperty({ enum: MARKET_TIMEFRAMES })
  @IsIn(MARKET_TIMEFRAMES)
  baseTimeframe!: BacktestRunInput['baseTimeframe']

  @ApiProperty({ type: [String], enum: MARKET_TIMEFRAMES })
  @IsArray()
  @IsIn(MARKET_TIMEFRAMES, { each: true })
  stateTimeframes!: BacktestRunInput['stateTimeframes']

  @ApiProperty()
  @IsNumber()
  @Min(0)
  initialCash!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  leverage?: number

  @Validate(BacktestLeverageConstraint)
  private readonly __leverageGuard = true

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowPartial?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  conversationId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sessionId?: string

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

  @ApiPropertyOptional({ type: BacktestRequestedRangeInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BacktestRequestedRangeInputDto)
  requestedRangeInput?: BacktestRunInput['requestedRangeInput']

  @ApiPropertyOptional({ type: [BacktestBarDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BacktestBarDto)
  bars?: BacktestRunInput['bars']
}
