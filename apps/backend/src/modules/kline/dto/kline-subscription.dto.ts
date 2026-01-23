import { IsEnum, IsString } from 'class-validator'

export class KlineSubscriptionDto {
  @IsString()
  symbol!: string

  @IsEnum(['1m', '5m', '15m', '1h', '4h', '1d'])
  interval!: string
}
