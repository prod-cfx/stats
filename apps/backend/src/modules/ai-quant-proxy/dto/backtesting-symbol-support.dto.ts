import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsString } from 'class-validator'

export class BacktestingSymbolSupportRequestDto {
  @ApiProperty({ enum: ['binance', 'okx', 'hyperliquid'] })
  @IsIn(['binance', 'okx', 'hyperliquid'])
  exchange!: 'binance' | 'okx' | 'hyperliquid'

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  symbol!: string
}

export class BacktestingSymbolSupportResponseDto {
  @ApiProperty({ enum: ['supported', 'refreshed_then_supported', 'not_supported'] })
  status!: 'supported' | 'refreshed_then_supported' | 'not_supported'
}
