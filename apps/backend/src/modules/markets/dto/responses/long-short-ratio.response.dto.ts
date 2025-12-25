import type { MarketTimeframe } from '@ai/shared'
import { MARKET_TIMEFRAMES } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class LongShortRatioPointResponseDto {
  @ApiProperty({
    description: '交易对唯一 ID（TradingPairConfig.id）',
    example: 'BTCUSDT.BINANCE.PERP',
  })
  tradingPairId!: string

  @ApiProperty({
    description: '时间粒度，可选值：1m / 5m / 15m / 1h / 4h / 1d',
    example: '4h',
    enum: MARKET_TIMEFRAMES,
  })
  interval!: MarketTimeframe

  @ApiProperty({
    description: '时间戳（ISO 字符串），通常为该时间粒度区间的起始时间',
    example: '2025-01-01T00:00:00.000Z',
  })
  timestamp!: string

  @ApiProperty({
    description: '多空比（多/空），字符串形式返回以避免精度丢失',
    example: '1.23',
  })
  longShortRatio!: string

  @ApiPropertyOptional({
    description: '多头账户占比，字符串形式返回',
    example: '0.56',
    nullable: true,
  })
  longAccountRatio?: string | null

  @ApiPropertyOptional({
    description: '空头账户占比，字符串形式返回',
    example: '0.44',
    nullable: true,
  })
  shortAccountRatio?: string | null

  @ApiPropertyOptional({
    description: '多头仓位名义价值 / 数量，字符串形式返回',
    example: '12345.6789',
    nullable: true,
  })
  longVolume?: string | null

  @ApiPropertyOptional({
    description: '空头仓位名义价值 / 数量，字符串形式返回',
    example: '9876.5432',
    nullable: true,
  })
  shortVolume?: string | null

  @ApiPropertyOptional({
    description: '账户多空比，字符串形式返回',
    example: '1.10',
    nullable: true,
  })
  longShortAccountRatio?: string | null

  @ApiProperty({
    description: '数据来源，例如 COINGLASS',
    example: 'COINGLASS',
  })
  source!: string
}


