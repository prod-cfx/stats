import { IsIn, IsNotEmpty, IsString } from 'class-validator'

export class CheckBacktestSymbolDto {
  @IsIn(['binance', 'okx', 'hyperliquid'])
  exchange!: 'binance' | 'okx' | 'hyperliquid'

  @IsString()
  @IsNotEmpty()
  symbol!: string
}
