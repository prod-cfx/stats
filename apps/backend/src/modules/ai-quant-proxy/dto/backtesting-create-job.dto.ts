import { MARKET_TIMEFRAMES } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator'

@ValidatorConstraint({ name: 'backtestingProxyCreateJobStrategyPayloadConstraint', async: false })
class BacktestingCreateJobStrategyPayloadConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args?: ValidationArguments): boolean {
    const objectValue = args?.object
    if (!objectValue || typeof objectValue !== 'object') {
      return false
    }

    const strategy = objectValue as { publishedSnapshotId?: unknown, params?: { marketType?: unknown } }
    const publishedSnapshotId = typeof strategy.publishedSnapshotId === 'string' ? strategy.publishedSnapshotId.trim() : ''
    const marketType = typeof strategy.params?.marketType === 'string'
      ? strategy.params.marketType.trim().toLowerCase()
      : ''

    return publishedSnapshotId.length > 0 && (marketType === 'spot' || marketType === 'perp')
  }

  defaultMessage(): string {
    return 'strategy requires publishedSnapshotId and params.marketType in spot|perp'
  }
}

@ValidatorConstraint({ name: 'backtestingProxyCreateJobLeverageConstraint', async: false })
class BacktestingCreateJobLeverageConstraint implements ValidatorConstraintInterface {
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

  defaultMessage(): string {
    return 'perp backtests require leverage and spot/perp marketType must be confirmed before backtest'
  }
}

export class BacktestingCreateJobBarDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  symbol!: string

  @ApiProperty({ enum: MARKET_TIMEFRAMES })
  @IsIn(MARKET_TIMEFRAMES)
  timeframe!: string

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

export class BacktestingCreateJobExecutionDto {
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

export class BacktestingCreateJobRangeDto {
  @ApiProperty()
  @IsNumber()
  fromTs!: number

  @ApiProperty()
  @IsNumber()
  toTs!: number
}

export class BacktestingCreateJobRequestedRangeInputDto {
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

export class BacktestingCreateJobStrategyDto {
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

  @ApiPropertyOptional({ type: Object, additionalProperties: true })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>

  @Validate(BacktestingCreateJobStrategyPayloadConstraint)
  private readonly __payloadGuard = true
}

export class BacktestingCreateJobRequestDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  symbols!: string[]

  @ApiProperty({ enum: MARKET_TIMEFRAMES })
  @IsIn(MARKET_TIMEFRAMES)
  baseTimeframe!: string

  @ApiProperty({ type: [String], enum: MARKET_TIMEFRAMES })
  @IsArray()
  @IsIn(MARKET_TIMEFRAMES, { each: true })
  stateTimeframes!: string[]

  @ApiProperty()
  @IsNumber()
  @Min(0)
  initialCash!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  leverage?: number

  @Validate(BacktestingCreateJobLeverageConstraint)
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

  @ApiProperty({ type: BacktestingCreateJobExecutionDto })
  @ValidateNested()
  @Type(() => BacktestingCreateJobExecutionDto)
  execution!: BacktestingCreateJobExecutionDto

  @ApiProperty({ type: BacktestingCreateJobStrategyDto })
  @ValidateNested()
  @Type(() => BacktestingCreateJobStrategyDto)
  strategy!: BacktestingCreateJobStrategyDto

  @ApiProperty({ type: BacktestingCreateJobRangeDto })
  @ValidateNested()
  @Type(() => BacktestingCreateJobRangeDto)
  dataRange!: BacktestingCreateJobRangeDto

  @ApiPropertyOptional({ type: BacktestingCreateJobRequestedRangeInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BacktestingCreateJobRequestedRangeInputDto)
  requestedRangeInput?: BacktestingCreateJobRequestedRangeInputDto

  @ApiPropertyOptional({ type: [BacktestingCreateJobBarDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BacktestingCreateJobBarDto)
  bars?: BacktestingCreateJobBarDto[]
}

export class BacktestingCreateJobErrorDetailsDto {
  @ApiPropertyOptional()
  code?: string

  @ApiProperty()
  message!: string

  @ApiPropertyOptional({ type: Object, additionalProperties: true })
  args?: Record<string, unknown>
}

export class BacktestingCreateJobSummaryDto {
  @ApiProperty()
  netProfit!: number

  @ApiProperty()
  netProfitPct!: number

  @ApiProperty()
  maxDrawdownPct!: number

  @ApiProperty()
  winRate!: number

  @ApiProperty({ nullable: true })
  profitFactor!: number | null

  @ApiProperty()
  totalTrades!: number

  @ApiPropertyOptional()
  totalOpenTrades?: number

  @ApiPropertyOptional()
  openPnl?: number
}

export class BacktestingCreateJobInputSummaryDto {
  @ApiProperty({ type: [String] })
  symbols!: string[]

  @ApiProperty()
  baseTimeframe!: string

  @ApiProperty({ type: [String] })
  stateTimeframes!: string[]

  @ApiProperty()
  initialCash!: number

  @ApiPropertyOptional({ nullable: true })
  leverage?: number | null

  @ApiProperty({ enum: ['spot', 'perp'] })
  marketType!: 'spot' | 'perp'

  @ApiProperty({ type: BacktestingCreateJobRangeDto })
  dataRange!: BacktestingCreateJobRangeDto

  @ApiProperty({ type: BacktestingCreateJobRangeDto })
  requestedRange!: BacktestingCreateJobRangeDto

  @ApiPropertyOptional({ type: BacktestingCreateJobRangeDto })
  appliedRange?: BacktestingCreateJobRangeDto

  @ApiProperty()
  allowPartial!: boolean

  @ApiProperty()
  isPartial!: boolean

  @ApiProperty()
  strategyId!: string

  @ApiPropertyOptional()
  strategyInstanceId?: string

  @ApiPropertyOptional()
  strategyTemplateId?: string

  @ApiPropertyOptional()
  snapshotId?: string

  @ApiPropertyOptional()
  snapshotHash?: string

  @ApiPropertyOptional()
  scriptHash?: string

  @ApiPropertyOptional()
  specHash?: string
}

export class BacktestingCreateJobResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty({ enum: ['queued', 'running', 'succeeded', 'failed'] })
  status!: 'queued' | 'running' | 'succeeded' | 'failed'

  @ApiProperty()
  createdAt!: string

  @ApiPropertyOptional()
  startedAt?: string

  @ApiPropertyOptional()
  finishedAt?: string

  @ApiPropertyOptional()
  error?: string

  @ApiPropertyOptional({ type: BacktestingCreateJobErrorDetailsDto })
  errorDetails?: BacktestingCreateJobErrorDetailsDto

  @ApiProperty({ type: BacktestingCreateJobInputSummaryDto })
  inputSummary!: BacktestingCreateJobInputSummaryDto

  @ApiPropertyOptional({ type: BacktestingCreateJobSummaryDto })
  resultSummary?: BacktestingCreateJobSummaryDto
}
