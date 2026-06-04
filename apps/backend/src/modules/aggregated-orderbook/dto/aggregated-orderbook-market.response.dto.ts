import { ApiProperty } from '@nestjs/swagger'

export class AggregatedOrderbookMarketResponseDto {
  @ApiProperty({ description: '基础资产', example: 'BTC' })
  base!: string

  @ApiProperty({ description: '市场类型', enum: ['spot', 'perp'], example: 'perp' })
  type!: 'spot' | 'perp'

  @ApiProperty({ type: [String], description: '该币对可用交易所', example: ['binance', 'okx', 'hyperliquid'] })
  venues!: string[]
}
