import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class AccountAiQuantStrategyListItemResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiProperty({ enum: ['running', 'stopped', 'draft'] })
  status!: 'running' | 'stopped' | 'draft'

  @ApiPropertyOptional({ nullable: true })
  exchange!: string | null

  @ApiPropertyOptional({ nullable: true })
  symbol!: string | null

  @ApiPropertyOptional({ nullable: true })
  timeframe!: string | null

  @ApiPropertyOptional({ nullable: true })
  positionPct!: number | null

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  paramSchema!: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  paramValues!: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true })
  schemaVersion!: string | null

  @ApiProperty()
  isSubscribed!: boolean

  @ApiProperty({ type: 'object', additionalProperties: true })
  metrics!: Record<string, unknown>

  @ApiProperty()
  updatedAt!: string
}

export class AccountAiQuantStrategyDetailResponseDto extends AccountAiQuantStrategyListItemResponseDto {
  @ApiPropertyOptional({ nullable: true })
  totalPnl!: number | null

  @ApiPropertyOptional({ nullable: true })
  todayPnl!: number | null

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  equitySeries!: Record<string, unknown>[]

  @ApiProperty({ type: 'object', additionalProperties: true })
  snapshot!: Record<string, unknown>

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  timeline!: Record<string, unknown>[]

  @ApiProperty({ type: 'object', additionalProperties: true })
  accountOverview!: Record<string, unknown>

  @ApiProperty({ type: 'object', additionalProperties: true })
  positionOverview!: Record<string, unknown>

  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  latestOrders!: Record<string, unknown>[]

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  deployment!: Record<string, unknown> | null
}
