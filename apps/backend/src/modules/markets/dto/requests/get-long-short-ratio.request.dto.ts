import type { MarketTimeframe } from '@ai/shared'
import { MARKET_TIMEFRAMES } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class GetLongShortRatioRequestDto {
  @ApiProperty({
    description: '交易对唯一 ID（TradingPairConfig.id），例如 BTCUSDT.BINANCE.PERP',
    example: 'BTCUSDT.BINANCE.PERP',
  })
  @IsString({ message: 'tradingPairId 必须是字符串' })
  tradingPairId!: string

  @ApiPropertyOptional({
    description: '时间粒度，可选值：1m / 5m / 15m / 1h / 4h / 1d',
    example: '4h',
    enum: MARKET_TIMEFRAMES,
  })
  @IsOptional()
  @IsIn(MARKET_TIMEFRAMES, { message: `interval 必须是以下值之一：${MARKET_TIMEFRAMES.join(', ')}` })
  interval?: MarketTimeframe

  @ApiPropertyOptional({
    description: '开始时间（ISO 时间字符串，例如 2025-01-01T00:00:00Z）',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'from 必须是合法的 ISO 时间字符串' })
  from?: string

  @ApiPropertyOptional({
    description: '结束时间（ISO 时间字符串，例如 2025-01-01T23:59:59Z）',
    example: '2025-01-01T23:59:59Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'to 必须是合法的 ISO 时间字符串' })
  to?: string

  @ApiPropertyOptional({
    description: '最多返回的数据点数量，默认 500，最大 2000',
    example: 500,
    minimum: 1,
    maximum: 2000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit 必须是整数' })
  @Min(1, { message: 'limit 必须大于 0' })
  @Max(2000, { message: 'limit 不能超过 2000' })
  limit?: number
}


