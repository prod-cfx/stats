import { ApiProperty } from '@nestjs/swagger'

export class ExchangeLongShortRatioResponseDto {
  @ApiProperty({
    description: '交易所排名（按总持仓金额从高到低排序，从 1 开始）',
    example: 1,
  })
  rank!: number

  @ApiProperty({
    description: '交易所名称，例如 Binance / OKX / Bybit / DEX',
    example: 'Binance',
  })
  name!: string

  @ApiProperty({
    description: '交易所 Logo URL，可选',
    example: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png',
    required: false,
  })
  logoUrl?: string

  @ApiProperty({
    description: '做多账户或持仓占比（百分比，0-100）',
    example: 52.44,
  })
  longPercent!: number

  @ApiProperty({
    description: '做空账户或持仓占比（百分比，0-100）',
    example: 47.56,
  })
  shortPercent!: number

  @ApiProperty({
    description: '做多名义持仓金额（USD）',
    example: 1170000000,
  })
  longAmountUsd!: number

  @ApiProperty({
    description: '做空名义持仓金额（USD）',
    example: 1061000000,
  })
  shortAmountUsd!: number
}

