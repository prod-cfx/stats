import type { MarketTimeframe } from '@ai/shared'
import { MARKET_TIMEFRAMES } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator'

export class IndicatorSnapshotQueryDto {
  @ApiProperty({ description: 'Symbol 代码，例如 BTCUSDT' })
  @IsString()
  @IsNotEmpty()
  symbol!: string

  @ApiProperty({ description: '时间周期', enum: MARKET_TIMEFRAMES })
  @IsString()
  @IsIn(MARKET_TIMEFRAMES)
  timeframe!: MarketTimeframe

  @ApiPropertyOptional({ description: '指定时刻（ISO 字符串），为空则取最新一根 K 线时间' })
  @IsOptional()
  @IsDateString()
  at?: string

  @ApiPropertyOptional({
    description: '限定配置 ID 列表，不传则使用该 symbol/timeframe 下所有启用配置',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  configIds?: string[]
}

export class IndicatorSeriesQueryDto {
  @ApiProperty({ description: 'Symbol 代码，例如 BTCUSDT' })
  @IsString()
  @IsNotEmpty()
  symbol!: string

  @ApiProperty({ description: '时间周期', enum: MARKET_TIMEFRAMES })
  @IsString()
  @IsIn(MARKET_TIMEFRAMES)
  timeframe!: MarketTimeframe

  @ApiPropertyOptional({ description: '开始时间（ISO 字符串）' })
  @IsOptional()
  @IsDateString()
  start?: string

  @ApiPropertyOptional({ description: '结束时间（ISO 字符串）' })
  @IsOptional()
  @IsDateString()
  end?: string

  @ApiPropertyOptional({ description: '限定配置 ID 列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  configIds?: string[]

  @ApiPropertyOptional({ description: '最多返回多少条，默认 500，最大 5000' })
  @IsOptional()
  @Min(1)
  @Max(5000)
  limit?: number
}


