import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

export class GridRuntimeActionDto {
  @ApiPropertyOptional({ description: '操作原因' })
  @IsOptional()
  @IsString()
  reason?: string
}

export class GridRuntimeLevelDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  levelIndex!: number

  @ApiProperty()
  price!: string

  @ApiProperty()
  side!: string

  @ApiPropertyOptional({ nullable: true })
  role!: string | null

  @ApiProperty()
  status!: string
}

export class GridRuntimeInstanceDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  strategyInstanceId!: string

  @ApiProperty()
  publishedSnapshotId!: string

  @ApiProperty()
  userId!: string

  @ApiProperty()
  exchangeAccountId!: string

  @ApiProperty()
  exchangeId!: string

  @ApiProperty()
  marketType!: string

  @ApiProperty()
  symbol!: string

  @ApiProperty()
  mode!: string

  @ApiProperty()
  status!: string

  @ApiPropertyOptional({ nullable: true })
  stopReason!: string | null

  @ApiProperty({ type: [GridRuntimeLevelDto] })
  levels!: GridRuntimeLevelDto[]
}

export class GridRuntimeOrderDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  gridRuntimeInstanceId!: string

  @ApiProperty()
  gridLevelId!: string

  @ApiPropertyOptional({ nullable: true })
  clientOrderId!: string | null

  @ApiPropertyOptional({ nullable: true })
  exchangeOrderId!: string | null

  @ApiProperty()
  side!: string

  @ApiPropertyOptional({ nullable: true })
  role!: string | null

  @ApiProperty()
  orderType!: string

  @ApiProperty()
  timeInForce!: string

  @ApiProperty()
  price!: string

  @ApiProperty()
  quantity!: string

  @ApiProperty()
  filledQuantity!: string

  @ApiProperty()
  status!: string
}

export class GridRuntimeFillDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  gridRuntimeInstanceId!: string

  @ApiProperty()
  gridOrderId!: string

  @ApiProperty()
  exchangeFillId!: string

  @ApiProperty()
  side!: string

  @ApiProperty()
  price!: string

  @ApiProperty()
  quantity!: string

  @ApiProperty()
  filledAt!: string
}
