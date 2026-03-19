import { IsEnum, IsOptional, IsString } from 'class-validator'

export class KlineSubscriptionDto {
  @IsString()
  symbol!: string

  @IsEnum(['1m', '5m', '15m', '1h', '4h', '1d'])
  interval!: string

  @IsOptional()
  @IsString()
  exchange?: string  // 可选，默认 BINANCE

  @IsOptional()
  @IsString()
  instrumentType?: string  // 可选，默认 PERPETUAL
}
