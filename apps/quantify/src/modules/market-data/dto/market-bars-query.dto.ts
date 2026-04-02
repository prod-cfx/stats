import { MARKET_TIMEFRAMES } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base-pagination.request.dto'

const MARKET_BAR_PROVIDERS = ['BINANCE', 'OKX', 'HYPERLIQUID'] as const

export class MarketBarsQueryDto extends BasePaginationRequestDto {
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

  @ApiPropertyOptional({ description: '返回数量，最大 1000', default: 500, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  override limit: number = 500

  @ApiPropertyOptional({
    description: '可选 provider 过滤（仅返回该来源的 K 线）',
    enum: MARKET_BAR_PROVIDERS,
    example: 'OKX',
  })
  @IsOptional()
  @IsIn(MARKET_BAR_PROVIDERS as unknown as string[])
  provider?: (typeof MARKET_BAR_PROVIDERS)[number]
}
