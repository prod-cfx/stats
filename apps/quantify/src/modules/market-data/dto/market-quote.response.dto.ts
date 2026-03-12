import { ApiProperty } from '@nestjs/swagger'

export class MarketQuoteDto {
  @ApiProperty({ description: '浜ゆ槗瀵逛唬鐮?, example: 'BTCUSDT' })
  symbol!: string

  @ApiProperty({ description: '鏈€鏂版垚浜や环', example: '60020.11' })
  lastPrice!: string

  @ApiProperty({ description: '24h 娑ㄨ穼棰?, example: '200.5', nullable: true })
  priceChange?: string | null

  @ApiProperty({ description: '24h 娑ㄨ穼骞咃紙鐧惧垎姣旓級', example: '0.35', nullable: true })
  priceChangePercent?: string | null

  @ApiProperty({ description: '寮€鐩樹环', example: '59800.00', nullable: true })
  openPrice?: string | null

  @ApiProperty({ description: '鏈€楂樹环', example: '60500.00', nullable: true })
  highPrice?: string | null

  @ApiProperty({ description: '鏈€浣庝环', example: '59500.00', nullable: true })
  lowPrice?: string | null

  @ApiProperty({ description: '鎴愪氦閲?, example: '1500.25', nullable: true })
  volume?: string | null

  @ApiProperty({ description: '鎴愪氦棰?, example: '90000000', nullable: true })
  quoteVolume?: string | null

  @ApiProperty({ description: '涔颁竴浠?, example: '60019.99', nullable: true })
  bidPrice?: string | null

  @ApiProperty({ description: '涔颁竴閲?, example: '0.5', nullable: true })
  bidQty?: string | null

  @ApiProperty({ description: '鍗栦竴浠?, example: '60020.20', nullable: true })
  askPrice?: string | null

  @ApiProperty({ description: '鍗栦竴閲?, example: '0.7', nullable: true })
  askQty?: string | null

  @ApiProperty({ description: '浜嬩欢鏃堕棿', example: new Date().toISOString() })
  eventTime!: string

  @ApiProperty({ description: '琛屾儏鏉ユ簮', example: 'BINANCE_WS', nullable: true })
  source?: string | null
}
