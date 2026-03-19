import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class OrderbookPairConfigResponseDto {
  @ApiProperty({ description: '配置ID' })
  id!: string

  @ApiProperty({ description: '交易对唯一标识' })
  pairId!: string

  @ApiProperty({ description: '交易所/DEX 标识' })
  venue!: string

  @ApiProperty({ description: '交易对符号' })
  symbol!: string

  @ApiProperty({ description: '基础资产' })
  baseAsset!: string

  @ApiProperty({ description: '计价资产' })
  quoteAsset!: string

  @ApiProperty({ description: '交易场所类型', enum: ['CEX', 'DEX'] })
  venueType!: string

  @ApiProperty({ description: '交易品种类型', enum: ['SPOT', 'PERPETUAL', 'FUTURE'] })
  instrumentType!: string

  @ApiProperty({ description: '是否启用' })
  enabled!: boolean

  @ApiPropertyOptional({ description: '拉取频率（秒）', nullable: true })
  pullIntervalSeconds?: number | null

  @ApiPropertyOptional({ description: '深度层级', nullable: true })
  depthLevels?: number | null

  @ApiProperty({ description: '优先级' })
  priority!: number

  @ApiPropertyOptional({ description: '扩展配置', nullable: true })
  metadata?: Record<string, any> | null

  @ApiPropertyOptional({ description: '备注说明', nullable: true })
  description?: string | null

  @ApiProperty({ description: '创建时间' })
  createdAt!: Date

  @ApiProperty({ description: '更新时间' })
  updatedAt!: Date
}

