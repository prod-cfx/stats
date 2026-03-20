import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

export class MarketQuoteQueryDto {
  @ApiProperty({ description: '交易对代码（如 BTCUSDT）' })
  @IsString()
  symbol!: string
}

