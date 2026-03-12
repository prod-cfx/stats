import { MARKET_TIMEFRAMES } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class MarketBarsQueryDto {
  @ApiProperty({ description: '浜ゆ槗瀵逛唬鐮侊紙濡?BTCUSDT锛? })
  @IsString()
  symbol!: string

  @ApiProperty({ description: 'K 绾垮懆鏈?, enum: MARKET_TIMEFRAMES })
  @IsIn(MARKET_TIMEFRAMES as unknown as string[])
  timeframe!: string

  @ApiPropertyOptional({ description: '寮€濮嬫椂闂达紙ISO 瀛楃涓诧級' })
  @IsOptional()
  @IsDateString()
  start?: string

  @ApiPropertyOptional({ description: '缁撴潫鏃堕棿锛圛SO 瀛楃涓诧級' })
  @IsOptional()
  @IsDateString()
  end?: string

  @ApiPropertyOptional({ description: '杩斿洖鏁伴噺锛屾渶澶?1000', default: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit: number = 500
}
