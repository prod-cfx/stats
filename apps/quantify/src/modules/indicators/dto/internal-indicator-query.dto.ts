import type { MarketTimeframe } from '@ai/shared'
import { MARKET_TIMEFRAMES } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator'

export class IndicatorSnapshotQueryDto {
  @ApiProperty({ description: 'Symbol 浠ｇ爜锛屼緥濡?BTCUSDT' })
  @IsString()
  @IsNotEmpty()
  symbol!: string

  @ApiProperty({ description: '鏃堕棿鍛ㄦ湡', enum: MARKET_TIMEFRAMES })
  @IsString()
  @IsIn(MARKET_TIMEFRAMES)
  timeframe!: MarketTimeframe

  @ApiPropertyOptional({ description: '鎸囧畾鏃跺埢锛圛SO 瀛楃涓诧級锛屼负绌哄垯鍙栨渶鏂颁竴鏍?K 绾挎椂闂? })
  @IsOptional()
  @IsDateString()
  at?: string

  @ApiPropertyOptional({
    description: '闄愬畾閰嶇疆 ID 鍒楄〃锛屼笉浼犲垯浣跨敤璇?symbol/timeframe 涓嬫墍鏈夊惎鐢ㄩ厤缃?,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  configIds?: string[]
}

export class IndicatorSeriesQueryDto {
  @ApiProperty({ description: 'Symbol 浠ｇ爜锛屼緥濡?BTCUSDT' })
  @IsString()
  @IsNotEmpty()
  symbol!: string

  @ApiProperty({ description: '鏃堕棿鍛ㄦ湡', enum: MARKET_TIMEFRAMES })
  @IsString()
  @IsIn(MARKET_TIMEFRAMES)
  timeframe!: MarketTimeframe

  @ApiPropertyOptional({ description: '寮€濮嬫椂闂达紙ISO 瀛楃涓诧級' })
  @IsOptional()
  @IsDateString()
  start?: string

  @ApiPropertyOptional({ description: '缁撴潫鏃堕棿锛圛SO 瀛楃涓诧級' })
  @IsOptional()
  @IsDateString()
  end?: string

  @ApiPropertyOptional({ description: '闄愬畾閰嶇疆 ID 鍒楄〃', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  configIds?: string[]

  @ApiPropertyOptional({ description: '鏈€澶氳繑鍥炲灏戞潯锛岄粯璁?500锛屾渶澶?5000' })
  @IsOptional()
  @Min(1)
  @Max(5000)
  limit?: number
}
