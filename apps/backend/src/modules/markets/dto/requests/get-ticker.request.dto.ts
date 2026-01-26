import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

export class GetTickerRequestDto {
  @ApiProperty({
    description: '币种符号，如 BTC、ETH',
    example: 'BTC',
    required: true,
  })
  @IsString()
  symbol!: string

  @ApiProperty({
    description: '交易所名称，如 Binance、OKX。不传则返回聚合数据',
    example: 'Binance',
    required: false,
  })
  @IsOptional()
  @IsString()
  exchange?: string
}
