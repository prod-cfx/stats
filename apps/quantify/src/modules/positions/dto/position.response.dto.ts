import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PositionSide, PositionStatus } from '@prisma/client'

export class PositionResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty({ description: '璐︽埛 ID' })
  userStrategyAccountId!: string

  @ApiProperty()
  symbol!: string

  @ApiProperty({ enum: PositionSide })
  positionSide!: PositionSide

  @ApiProperty({ description: '鏉犳潌', nullable: true })
  leverage?: string | null

  @ApiProperty({ description: '鎸佷粨鏁伴噺' })
  quantity!: string

  @ApiProperty({ description: '骞冲潎寮€浠撲环' })
  avgEntryPrice!: string

  @ApiProperty({ description: '绱宸插疄鐜扮泩浜? })
  realizedPnl!: string

  @ApiProperty({ description: '鏈疄鐜扮泩浜? })
  unrealizedPnl!: string

  @ApiProperty({ enum: PositionStatus })
  status!: PositionStatus

  @ApiProperty({ description: '寮€浠撴椂闂? })
  openedAt!: string

  @ApiProperty({ description: '骞充粨鏃堕棿', nullable: true })
  closedAt?: string | null

  @ApiPropertyOptional({ description: '浜ゆ槗鎵€ ID', example: 'hyperliquid' })
  exchangeId?: string | null

  @ApiPropertyOptional({ description: '甯傚満绫诲瀷', example: 'perp' })
  marketType?: string | null
}
