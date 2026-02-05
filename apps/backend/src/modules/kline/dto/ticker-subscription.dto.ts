import { IsEnum, IsOptional, IsString } from 'class-validator'

export class TickerSubscriptionDto {
  @IsString()
  symbol!: string

  @IsOptional()
  @IsString()
  quoteAsset?: string

  @IsOptional()
  @IsString()
  exchange?: string

  @IsOptional()
  @IsEnum(['SPOT', 'PERPETUAL'], {
    message: 'instrumentType must be either SPOT or PERPETUAL',
  })
  instrumentType?: 'SPOT' | 'PERPETUAL'
}
