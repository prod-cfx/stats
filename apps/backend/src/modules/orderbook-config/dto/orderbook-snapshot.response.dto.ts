import { ApiProperty } from '@nestjs/swagger'

export class OrderBookLevelDto {
  @ApiProperty({ description: '价格（统一为 base-quote 价格，例如 BTC/USDT）' })
  price!: number

  @ApiProperty({ description: '数量（base 数量，例如 0.1 BTC）' })
  size!: number
}

export class VenueOrderBookDto {
  @ApiProperty({ description: '流动性来源唯一标识，例如 binance-spot、okx-spot 等' })
  venueId!: string

  @ApiProperty({
    description: '内部统一市场标识，格式如 BTC-USDT:spot / BTC-USDT:perp',
    example: 'BTC-USDT:spot',
  })
  marketKey!: string

  @ApiProperty({ type: [OrderBookLevelDto], description: '买盘深度（按价格从高到低排序）' })
  bids!: OrderBookLevelDto[]

  @ApiProperty({ type: [OrderBookLevelDto], description: '卖盘深度（按价格从低到高排序）' })
  asks!: OrderBookLevelDto[]

  @ApiProperty({
    description: '交易所侧事件时间戳（毫秒），如有',
    required: false,
    nullable: true,
  })
  exchangeTs?: number | null

  @ApiProperty({ description: '本地接收时间戳（毫秒）' })
  receivedTs!: number

  @ApiProperty({ description: '本地版本号 / 序列号，用于去重与连续性检查' })
  version!: number
}

