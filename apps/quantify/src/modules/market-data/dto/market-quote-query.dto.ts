import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

export class MarketQuoteQueryDto {
  @ApiProperty({ description: '浜ゆ槗瀵逛唬鐮侊紙濡?BTCUSDT锛? })
  @IsString()
  symbol!: string
}
