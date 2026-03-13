import { MARKET_TIMEFRAMES } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class MarketBarsQueryDto {
  @ApiProperty({ description: '交易对代码（如 BTCUSDT）' })
  @IsString()
  symbol!: string

  @ApiProperty({ description: 'K 线周期', enum: MARKET_TIMEFRAMES })
  @IsIn(MARKET_TIMEFRAMES as unknown as string[])
  timeframe!: string

  @ApiPropertyOptional({ description: '开始时间（ISO 字符串）' })
  @IsOptional()
  @IsDateString()
  start?: string

  @ApiPropertyOptional({ description: '结束时间（ISO 字符串）' })
  @IsOptional()
  @IsDateString()
  end?: string

  @ApiPropertyOptional({ description: '返回数量，最大 1000', default: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit: number = 500
}

