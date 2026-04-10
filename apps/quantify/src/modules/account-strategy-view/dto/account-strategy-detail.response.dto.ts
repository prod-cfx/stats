import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { AccountStrategyListItemDto } from './account-strategy-list-item.dto'

export class AccountStrategyEquityPointDto {
  @ApiProperty()
  ts!: string

  @ApiProperty()
  value!: number
}

export class AccountStrategyTimelineEventDto {
  @ApiProperty()
  at!: string

  @ApiProperty({ enum: ['system', 'trade'] })
  eventType!: 'system' | 'trade'

  @ApiProperty()
  event!: string

  @ApiPropertyOptional({ nullable: true })
  note?: string | null
}

export class AccountStrategyAccountOverviewDto {
  @ApiPropertyOptional({ nullable: true })
  initialBalance!: number | null

  @ApiPropertyOptional({ nullable: true })
  totalEquity!: number | null

  @ApiPropertyOptional({ nullable: true })
  availableBalance!: number | null

  @ApiPropertyOptional({ nullable: true })
  totalPnl!: number | null

  @ApiPropertyOptional({ nullable: true })
  todayPnl!: number | null

  @ApiPropertyOptional({ nullable: true })
  baseCurrency!: string | null
}

export class AccountStrategyPositionOverviewDto {
  @ApiPropertyOptional({ nullable: true })
  openPositionsCount!: number | null

  @ApiPropertyOptional({ nullable: true })
  closedPositionsCount!: number | null

  @ApiPropertyOptional({ nullable: true })
  totalRealizedPnl!: number | null

  @ApiPropertyOptional({ nullable: true })
  totalUnrealizedPnl!: number | null
}

export class AccountStrategyLatestOrderDto {
  @ApiProperty()
  executedAt!: string

  @ApiProperty()
  side!: string

  @ApiProperty()
  symbol!: string

  @ApiPropertyOptional({ nullable: true })
  price!: number | null

  @ApiPropertyOptional({ nullable: true })
  quantity!: number | null

  @ApiPropertyOptional({ nullable: true })
  fee!: number | null

  @ApiPropertyOptional({ nullable: true })
  feeCurrency!: string | null

  @ApiPropertyOptional({ nullable: true })
  orderId!: string | null
}

export class AccountStrategySnapshotDto {
  @ApiPropertyOptional({ nullable: true })
  publishedSnapshotId!: string | null

  @ApiPropertyOptional({ nullable: true })
  snapshotHash!: string | null

  @ApiPropertyOptional({ nullable: true })
  exchange!: string | null

  @ApiPropertyOptional({ nullable: true })
  symbol!: string | null

  @ApiPropertyOptional({ nullable: true })
  timeframe!: string | null

  @ApiPropertyOptional({ nullable: true })
  positionPct!: number | null

  @ApiPropertyOptional({ nullable: true })
  publishedSnapshotId!: string | null

  @ApiPropertyOptional({ nullable: true })
  snapshotHash!: string | null

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  paramSchema!: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  paramValues!: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true })
  schemaVersion!: string | null

  @ApiPropertyOptional({ nullable: true })
  deployAccountName?: string | null

  @ApiPropertyOptional({ nullable: true })
  deployAt?: string | null
}

export class AccountStrategyDetailResponseDto extends AccountStrategyListItemDto {
  @ApiPropertyOptional({ nullable: true })
  totalPnl!: number | null

  @ApiPropertyOptional({ nullable: true })
  todayPnl!: number | null

  @ApiProperty({ type: [AccountStrategyEquityPointDto] })
  equitySeries!: AccountStrategyEquityPointDto[]

  @ApiProperty({ type: AccountStrategySnapshotDto })
  snapshot!: AccountStrategySnapshotDto

  @ApiProperty({ type: [AccountStrategyTimelineEventDto] })
  timeline!: AccountStrategyTimelineEventDto[]

  @ApiProperty({ type: AccountStrategyAccountOverviewDto })
  accountOverview!: AccountStrategyAccountOverviewDto

  @ApiProperty({ type: AccountStrategyPositionOverviewDto })
  positionOverview!: AccountStrategyPositionOverviewDto

  @ApiProperty({ type: [AccountStrategyLatestOrderDto] })
  latestOrders!: AccountStrategyLatestOrderDto[]
}
