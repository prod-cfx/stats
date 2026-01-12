import { ApiProperty } from '@nestjs/swagger'

export class VenueDetailDto {
  @ApiProperty({ description: '交易所ID', example: 'binance-perp' })
  venueId!: string

  @ApiProperty({ description: '该交易所在此价格的数量', example: 1.5 })
  size!: number
}

export class AggregatedLevelDto {
  @ApiProperty({ description: '价格', example: 95000.5 })
  price!: number

  @ApiProperty({ description: '总数量', example: 10.5 })
  sizeTotal!: number

  @ApiProperty({ type: [VenueDetailDto], description: '各交易所明细' })
  details!: VenueDetailDto[]
}

export class AggregatedOrderbookResponseDto {
  @ApiProperty({ description: '市场标识', example: 'BTC-USD:perp' })
  marketKey!: string

  @ApiProperty({ description: '基础资产', example: 'BTC' })
  base!: string

  @ApiProperty({ description: '市场类型', example: 'perp' })
  type!: string

  @ApiProperty({
    type: [AggregatedLevelDto],
    description: '聚合卖单 (价格从低到高)',
  })
  asks!: AggregatedLevelDto[]

  @ApiProperty({
    type: [AggregatedLevelDto],
    description: '聚合买单 (价格从高到低)',
  })
  bids!: AggregatedLevelDto[]

  @ApiProperty({ description: '中间价', example: 95000.25 })
  midPrice!: number

  @ApiProperty({ description: '更新时间戳', example: 1704067200000 })
  updatedAt!: number

  @ApiProperty({
    type: [String],
    description: '返回数据的交易所列表',
    example: ['binance', 'okx'],
  })
  venues!: string[]

  @ApiProperty({
    type: [String],
    description: '合并的计价资产',
    example: ['USDT', 'USDC'],
  })
  mergedQuotes!: string[]
}
