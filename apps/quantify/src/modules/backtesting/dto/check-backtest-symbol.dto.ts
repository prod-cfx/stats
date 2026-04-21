import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsString } from 'class-validator'
import { SUPPORTED_MARKET_TIMEFRAMES } from '@/common/utils/prisma-enum-mappers'

export class CheckBacktestSymbolDto {
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

  @ApiProperty({ enum: SUPPORTED_MARKET_TIMEFRAMES })
  @IsIn(SUPPORTED_MARKET_TIMEFRAMES)
  baseTimeframe!: string
}
