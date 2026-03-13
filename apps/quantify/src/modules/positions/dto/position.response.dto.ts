import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PositionSide, PositionStatus } from '@/prisma/prisma.types'

export class PositionResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty({ description: '账户 ID' })
  userStrategyAccountId!: string

  @ApiProperty()
  symbol!: string

  @ApiProperty({ enum: PositionSide })
  positionSide!: PositionSide

  @ApiProperty({ description: '杠杆', nullable: true })
  leverage?: string | null

  @ApiProperty({ description: '持仓数量' })
  quantity!: string

  @ApiProperty({ description: '平均开仓价' })
  avgEntryPrice!: string

  @ApiProperty({ description: '累计已实现盈亏' })
  realizedPnl!: string

  @ApiProperty({ description: '未实现盈亏' })
  unrealizedPnl!: string

  @ApiProperty({ enum: PositionStatus })
  status!: PositionStatus

  @ApiProperty({ description: '开仓时间' })
  openedAt!: string

  @ApiProperty({ description: '平仓时间', nullable: true })
  closedAt?: string | null

  @ApiPropertyOptional({ description: '交易所 ID', example: 'hyperliquid' })
  exchangeId?: string | null

  @ApiPropertyOptional({ description: '市场类型', example: 'perp' })
  marketType?: string | null
}



