import { ApiProperty } from '@nestjs/swagger'

export class MarketTradeResponseDto {
  @ApiProperty({
    description: '交易记录ID',
    example: 1,
  })
  id!: number

  @ApiProperty({
    description: '交易所代码',
    example: 'OKX',
  })
  exchange!: string

  @ApiProperty({
    description: '合约类型',
    example: 'SPOT',
    enum: ['SPOT', 'PERPETUAL', 'FUTURE'],
  })
  instrumentType!: string

  @ApiProperty({
    description: '交易对符号',
    example: 'BTC-USDT',
  })
  symbol!: string

  @ApiProperty({
    description: '基础资产',
    example: 'BTC',
  })
  baseAsset!: string

  @ApiProperty({
    description: '计价资产',
    example: 'USDT',
  })
  quoteAsset!: string

  @ApiProperty({
    description: '交易ID（交易所提供）',
    example: '123456789',
  })
  tradeId!: string

  @ApiProperty({
    description: '交易价格',
    example: '45000.50',
  })
  price!: string

  @ApiProperty({
    description: '交易数量',
    example: '0.5',
  })
  size!: string

  @ApiProperty({
    description: '交易方向',
    example: 'buy',
    enum: ['buy', 'sell'],
  })
  side!: string

  @ApiProperty({
    description: '交易时间戳（毫秒）',
    example: '1704067200000',
  })
  tradeTimestamp!: string

  @ApiProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: string
}


