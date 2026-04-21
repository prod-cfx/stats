import { MARKET_TIMEFRAMES } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsString } from 'class-validator'

export class BacktestingSymbolSupportRequestDto {
  @ApiProperty({ enum: ['binance', 'okx', 'hyperliquid'] })
  @IsIn(['binance', 'okx', 'hyperliquid'])
  exchange!: 'binance' | 'okx' | 'hyperliquid'

  @ApiProperty({ enum: ['spot', 'perp'] })
  @IsIn(['spot', 'perp'])
  marketType!: 'spot' | 'perp'

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  symbol!: string

  @ApiProperty({ enum: MARKET_TIMEFRAMES })
  @IsIn(MARKET_TIMEFRAMES)
  baseTimeframe!: string
}

export class BacktestingSymbolSupportResponseDto {
  @ApiProperty({ enum: ['supported', 'refreshed_then_supported', 'not_supported'] })
  status!: 'supported' | 'refreshed_then_supported' | 'not_supported'

  @ApiPropertyOptional()
  reasonCode?: string

  @ApiPropertyOptional({ type: Object, additionalProperties: true })
  args?: Record<string, unknown>
}
