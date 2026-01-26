import { ApiProperty } from '@nestjs/swagger'

export class TickerResponseDto {
  @ApiProperty({ description: '币种符号', example: 'BTC' })
  symbol!: string

  @ApiProperty({ description: '交易所名称（聚合数据时为空）', example: 'Binance', required: false })
  exchange?: string

  @ApiProperty({ description: '当前价格', example: '87010.5' })
  currentPrice!: string

  @ApiProperty({ description: '指数价格', example: '87053.2', required: false })
  indexPrice?: string

  @ApiProperty({ description: '24小时价格变化百分比', example: '-0.45', required: false })
  priceChangePercent24h?: string

  @ApiProperty({ description: '24小时成交量（USD）', example: '1234567890.12' })
  volumeUsd!: string

  @ApiProperty({ description: '持仓量（USD）', example: '987654321.00', required: false })
  openInterestUsd?: string

  @ApiProperty({ description: '资金费率', example: '0.0001', required: false })
  fundingRate?: string

  @ApiProperty({ description: '下次资金费率时间（毫秒时间戳）', example: '1706000000000', required: false })
  nextFundingTime?: string
}
