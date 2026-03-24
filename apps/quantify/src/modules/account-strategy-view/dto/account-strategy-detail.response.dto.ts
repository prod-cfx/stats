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

export class AccountStrategySnapshotDto {
  @ApiPropertyOptional({ nullable: true })
  exchange!: string | null

  @ApiPropertyOptional({ nullable: true })
  symbol!: string | null

  @ApiPropertyOptional({ nullable: true })
  timeframe!: string | null

  @ApiPropertyOptional({ nullable: true })
  positionPct!: number | null

  @ApiPropertyOptional({ nullable: true, type: 'object' })
  paramSchema!: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true, type: 'object' })
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
}
