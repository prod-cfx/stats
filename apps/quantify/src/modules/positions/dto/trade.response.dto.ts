import { ApiProperty } from '@nestjs/swagger'
import { PositionSide, TradeSide } from '@prisma/client'

export class TradeResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  userStrategyAccountId!: string

  @ApiProperty({ nullable: true })
  positionId!: string | null

  @ApiProperty()
  symbol!: string

  @ApiProperty({ enum: TradeSide })
  side!: TradeSide

  @ApiProperty({ enum: PositionSide })
  positionSide!: PositionSide

  @ApiProperty()
  price!: string

  @ApiProperty()
  quantity!: string

  @ApiProperty()
  fee!: string

  @ApiProperty({ nullable: true })
  feeCurrency?: string | null

  @ApiProperty({ nullable: true })
  orderId?: string | null

  @ApiProperty({ nullable: true })
  externalTradeId?: string | null

  @ApiProperty({ nullable: true })
  provider?: string | null

  @ApiProperty()
  executedAt!: string
}
