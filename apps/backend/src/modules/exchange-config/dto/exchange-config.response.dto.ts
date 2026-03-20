import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ExchangeConfigResponseDto {
  @ApiProperty({ description: '配置ID' })
  id!: string

  @ApiProperty({ description: '交易所唯一标识（建议与 venue 对齐）', example: 'BINANCE' })
  code!: string

  @ApiProperty({ description: '交易所展示名称', example: 'Binance' })
  name!: string

  @ApiPropertyOptional({ description: '头像/Logo URL', nullable: true })
  avatarUrl?: string | null

  @ApiPropertyOptional({ description: '简介', nullable: true })
  intro?: string | null

  @ApiPropertyOptional({ description: '官网链接', nullable: true })
  websiteUrl?: string | null

  @ApiPropertyOptional({ description: '交易场所类型', enum: ['CEX', 'DEX'], nullable: true })
  venueType?: 'CEX' | 'DEX' | null

  @ApiProperty({ description: '是否启用' })
  enabled!: boolean

  @ApiProperty({ description: '排序（数字越小越靠前）' })
  sort!: number

  @ApiPropertyOptional({ description: '扩展信息（JSON）', nullable: true })
  metadata?: Record<string, unknown> | null

  @ApiProperty({ description: '创建时间' })
  createdAt!: Date

  @ApiProperty({ description: '更新时间' })
  updatedAt!: Date
}

