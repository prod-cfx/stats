import { ApiProperty } from '@nestjs/swagger'

export class MarketSymbolDto {
  @ApiProperty({ description: '浜ゆ槗瀵逛唬鐮?, example: 'BTCUSDT' })
  code!: string

  @ApiProperty({ description: '鍩虹璧勪骇', example: 'BTC' })
  baseAsset!: string

  @ApiProperty({ description: '璁′环璧勪骇', example: 'USDT' })
  quoteAsset!: string

  @ApiProperty({ description: '浜ゆ槗鎵€', example: 'BINANCE' })
  exchange!: string

  @ApiProperty({ description: '鍝佺绫诲瀷', example: 'CRYPTO' })
  type!: string

  @ApiProperty({ description: '鍚堢害褰㈡€?, example: 'SPOT' })
  instrumentType!: string

  @ApiProperty({ description: '鐘舵€?, example: 'ACTIVE' })
  status!: string

  @ApiProperty({ description: '浠锋牸绮惧害', example: 2 })
  precisionPrice!: number

  @ApiProperty({ description: '鏁伴噺绮惧害', example: 6 })
  precisionQuantity!: number

  @ApiProperty({ description: '鏈€灏忓彉鍔ㄤ环浣?, example: '0.01', nullable: true })
  tickSize?: string | null

  @ApiProperty({ description: '鏈€灏忎笅鍗曟暟閲?, example: '0.0001', nullable: true })
  lotSize?: string | null

  @ApiProperty({ description: '鏄惁鏀寔鏉犳潌', example: true })
  isMarginEnabled!: boolean

  @ApiProperty({ description: '鏈€鍚庢洿鏂版椂闂?, example: new Date().toISOString() })
  updatedAt!: string
}
