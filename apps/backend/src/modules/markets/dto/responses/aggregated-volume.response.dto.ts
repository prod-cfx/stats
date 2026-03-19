import { ApiProperty } from '@nestjs/swagger'

export class AggregatedVolumeResponseDto {
  @ApiProperty({
    description: '记录ID',
    example: 1,
  })
  id!: number

  @ApiProperty({
    description: '交易所代码（All 表示聚合总量）',
    example: 'Binance',
  })
  exchange!: string

  @ApiProperty({
    description: '币种符号',
    example: 'BTC',
  })
  symbol!: string

  @ApiProperty({
    description: '合约类型',
    example: 'PERPETUAL',
    enum: ['SPOT', 'PERPETUAL'],
    required: false,
  })
  instrumentType?: string

  @ApiProperty({
    description: '24h 成交量（USD）',
    example: '1234567890.50',
  })
  volumeUsd!: string

  @ApiProperty({
    description: '数据时间戳',
    example: '2024-01-01T00:00:00.000Z',
  })
  dataTimestamp!: string

  @ApiProperty({
    description: '数据来源',
    example: 'COINGLASS',
  })
  source!: string

  @ApiProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: string

  @ApiProperty({
    description: '更新时间',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt!: string
}
