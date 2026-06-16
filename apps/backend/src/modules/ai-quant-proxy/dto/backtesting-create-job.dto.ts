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
  @ApiProperty({ description: '交易对符号', example: 'BTCUSDT' })
  @IsString()
  @IsNotEmpty()
  symbol!: string

  @ApiProperty({ description: 'K 线周期', enum: MARKET_TIMEFRAMES, example: '1h' })
  @IsIn(MARKET_TIMEFRAMES)
  timeframe!: string

  @ApiProperty({ description: 'K 线开盘时间（毫秒时间戳）', example: 1706000000000 })
  @IsNumber()
  openTime!: number

  @ApiProperty({ description: 'K 线收盘时间（毫秒时间戳）', example: 1706003600000 })
  @IsNumber()
  closeTime!: number

  @ApiProperty({ description: '开盘价', example: 87010.5 })
  @IsNumber()
  open!: number

  @ApiProperty({ description: '最高价', example: 87500 })
  @IsNumber()
  high!: number

  @ApiProperty({ description: '最低价', example: 86000 })
  @IsNumber()
  low!: number

  @ApiProperty({ description: '收盘价', example: 87200.3 })
  @IsNumber()
  close!: number

  @ApiProperty({ description: '成交量', example: 1234.56 })
  @IsNumber()
  volume!: number
}

export class BacktestingCreateJobExecutionDto {
  @ApiProperty({ description: '滑点（基点 bps）', example: 5 })
  @IsNumber()
  @Min(0)
  slippageBps!: number

  @ApiProperty({ description: '手续费（基点 bps）', example: 10 })
  @IsNumber()
  @Min(0)
  feeBps!: number

  @ApiProperty({ description: '成交参考价来源', enum: ['open', 'close', 'mid'], example: 'close' })
  @IsIn(['open', 'close', 'mid'])
  priceSource!: 'open' | 'close' | 'mid'
}

export class BacktestingCreateJobRangeDto {
  @ApiProperty({ description: '区间起始时间（毫秒时间戳）', example: 1706000000000 })
  @IsNumber()
  fromTs!: number

  @ApiProperty({ description: '区间结束时间（毫秒时间戳）', example: 1708678400000 })
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

  @ApiProperty({ description: '初始资金', example: 10000 })
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sessionId?: string

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

  @ApiPropertyOptional({ type: Object, additionalProperties: true })
  @IsOptional()
  @IsObject()
  eventStreams?: Record<string, Array<Record<string, unknown>>>
}

export class BacktestingCreateJobErrorDetailsDto {
  @ApiPropertyOptional()
  code?: string

  @ApiProperty({ description: '错误信息', example: 'insufficient data for requested range' })
  message!: string

  @ApiPropertyOptional({ type: Object, additionalProperties: true })
  args?: Record<string, unknown>
}

export class BacktestingCreateJobSummaryDto {
  @ApiProperty({ description: '净利润（计价货币）', example: 1523.4 })
  netProfit!: number

  @ApiProperty({ description: '净利润百分比（%）', example: 15.23 })
  netProfitPct!: number

  @ApiProperty({ description: '最大回撤百分比（%）', example: 8.5 })
  maxDrawdownPct!: number

  @ApiProperty({ description: '胜率（0-1 之间的小数）', example: 0.62 })
  winRate!: number

  @ApiProperty({ description: '盈亏比（无可用数据时为 null）', example: 1.8, nullable: true })
  profitFactor!: number | null

  @ApiProperty({ description: '总交易次数', example: 42 })
  totalTrades!: number

  @ApiPropertyOptional()
  totalOpenTrades?: number

  @ApiPropertyOptional()
  openPnl?: number
}

export class BacktestingCreateJobInputSummaryDto {
  @ApiProperty({ description: '回测标的交易对列表', type: [String], example: ['BTCUSDT'] })
  symbols!: string[]

  @ApiProperty({ description: '基础 K 线周期', example: '1h' })
  baseTimeframe!: string

  @ApiProperty({ description: '状态 K 线周期列表', type: [String], example: ['4h', '1d'] })
  stateTimeframes!: string[]

  @ApiProperty({ description: '初始资金', example: 10000 })
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

  @ApiProperty({ description: '是否允许部分数据回测', example: false })
  allowPartial!: boolean

  @ApiProperty({ description: '本次回测是否使用了部分数据', example: false })
  isPartial!: boolean

  @ApiProperty({ description: '策略 ID', example: 'strat_01HXYZ' })
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
  @ApiProperty({ description: '回测任务 ID', example: 'job_01HXYZ' })
  id!: string

  @ApiProperty({ description: '回测任务状态', enum: ['queued', 'running', 'succeeded', 'failed'], example: 'queued' })
  status!: 'queued' | 'running' | 'succeeded' | 'failed'

  @ApiProperty({ description: '任务创建时间（ISO 8601）', example: '2026-06-06T08:00:00.000Z' })
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
