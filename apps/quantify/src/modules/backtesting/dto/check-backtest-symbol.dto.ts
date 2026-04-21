import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsString } from 'class-validator'

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

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  baseTimeframe!: string
}
