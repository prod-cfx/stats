import { ApiProperty } from '@nestjs/swagger'

export class MarketQuoteDto {
  @ApiProperty({ description: '交易对代码', example: 'BTCUSDT' })
  symbol!: string

  @ApiProperty({ description: '最新成交价', example: '60020.11' })
  lastPrice!: string

  @ApiProperty({ description: '24h 涨跌额', example: '200.5', nullable: true })
  priceChange?: string | null

  @ApiProperty({ description: '24h 涨跌幅（百分比）', example: '0.35', nullable: true })
  priceChangePercent?: string | null

  @ApiProperty({ description: '开盘价', example: '59800.00', nullable: true })
  openPrice?: string | null

  @ApiProperty({ description: '最高价', example: '60500.00', nullable: true })
  highPrice?: string | null

  @ApiProperty({ description: '最低价', example: '59500.00', nullable: true })
  lowPrice?: string | null

  @ApiProperty({ description: '成交量', example: '1500.25', nullable: true })
  volume?: string | null

  @ApiProperty({ description: '成交额', example: '90000000', nullable: true })
  quoteVolume?: string | null

  @ApiProperty({ description: '买一价', example: '60019.99', nullable: true })
  bidPrice?: string | null

  @ApiProperty({ description: '买一量', example: '0.5', nullable: true })
  bidQty?: string | null

  @ApiProperty({ description: '卖一价', example: '60020.20', nullable: true })
  askPrice?: string | null

  @ApiProperty({ description: '卖一量', example: '0.7', nullable: true })
  askQty?: string | null

  @ApiProperty({ description: '事件时间', example: new Date().toISOString() })
  eventTime!: string

  @ApiProperty({ description: '行情来源', example: 'BINANCE_WS', nullable: true })
  source?: string | null
}

