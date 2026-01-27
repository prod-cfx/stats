import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class OrderbookSubscriptionDto {
  @IsEnum(['BINANCE', 'OKX', 'BYBIT'], { message: 'exchange must be one of: BINANCE, OKX, BYBIT' })
  exchange: 'BINANCE' | 'OKX' | 'BYBIT'

  @IsEnum(['SPOT', 'PERPETUAL'])
  instrumentType: 'SPOT' | 'PERPETUAL'

  @IsString()
  symbol: string // 'BTCUSDT'

  @IsBoolean()
  @IsOptional()
  isAggregated?: boolean // true: 聚合模式, false: 单交易所模式

  @IsInt()
  @Min(10)
  @Max(100)
  @IsOptional()
  depth?: number // 深度档位，默认 60
}
