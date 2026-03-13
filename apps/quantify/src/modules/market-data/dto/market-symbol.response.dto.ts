import { ApiProperty } from '@nestjs/swagger'

export class MarketSymbolDto {
  @ApiProperty({ description: '交易对代码', example: 'BTCUSDT' })
  code!: string

  @ApiProperty({ description: '基础资产', example: 'BTC' })
  baseAsset!: string

  @ApiProperty({ description: '计价资产', example: 'USDT' })
  quoteAsset!: string

  @ApiProperty({ description: '交易所', example: 'BINANCE' })
  exchange!: string

  @ApiProperty({ description: '品种类型', example: 'CRYPTO' })
  type!: string

  @ApiProperty({ description: '合约形态', example: 'SPOT' })
  instrumentType!: string

  @ApiProperty({ description: '状态', example: 'ACTIVE' })
  status!: string

  @ApiProperty({ description: '价格精度', example: 2 })
  precisionPrice!: number

  @ApiProperty({ description: '数量精度', example: 6 })
  precisionQuantity!: number

  @ApiProperty({ description: '最小变动价位', example: '0.01', nullable: true })
  tickSize?: string | null

  @ApiProperty({ description: '最小下单数量', example: '0.0001', nullable: true })
  lotSize?: string | null

  @ApiProperty({ description: '是否支持杠杆', example: true })
  isMarginEnabled!: boolean

  @ApiProperty({ description: '最后更新时间', example: new Date().toISOString() })
  updatedAt!: string
}

