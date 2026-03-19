import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class TradesPairConfigResponseDto {
  @ApiProperty({ description: '配置ID' })
  id!: string

  @ApiProperty({ description: '交易对唯一标识' })
  pairId!: string

  @ApiProperty({ description: '交易所标识' })
  exchange!: string

  @ApiProperty({ description: '交易对符号' })
  symbol!: string

  @ApiProperty({ description: '基础资产' })
  baseAsset!: string

  @ApiProperty({ description: '计价资产' })
  quoteAsset!: string

  @ApiProperty({ description: '交易品种类型', enum: ['SPOT', 'PERPETUAL', 'FUTURE'] })
  instrumentType!: string

  @ApiPropertyOptional({ description: '标准化 OKX instId（用于订阅/查询一致性）', nullable: true })
  canonicalInstId?: string | null

  @ApiProperty({ description: '是否启用订阅' })
  enabled!: boolean

  @ApiProperty({ description: '优先级' })
  priority!: number

  @ApiPropertyOptional({ description: '扩展配置', nullable: true })
  metadata?: Record<string, any> | null

  @ApiPropertyOptional({ description: '备注说明', nullable: true })
  description?: string | null

  @ApiProperty({ description: '创建时间' })
  createdAt!: string

  @ApiProperty({ description: '更新时间' })
  updatedAt!: string
}







