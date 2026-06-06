import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class AccountAiQuantStrategyListItemResponseDto {
  @ApiProperty({ description: '策略 ID', example: 'strat_01HXYZ' })
  id!: string

  @ApiProperty({ description: '策略名称', example: '我的趋势策略' })
  name!: string

  @ApiProperty({ description: '策略运行状态', enum: ['running', 'stopped', 'draft'] })
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

  @ApiProperty({ description: '当前用户是否已订阅该策略', example: true })
  isSubscribed!: boolean

  @ApiProperty({ description: '策略展示指标集合', type: 'object', additionalProperties: true })
  metrics!: Record<string, unknown>

  @ApiProperty({ description: '更新时间（ISO 8601）', example: '2026-06-06T09:00:00.000Z' })
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

export class AccountAiQuantStrategyDeployResultResponseDto {
  @ApiPropertyOptional({ nullable: true, type: AccountAiQuantStrategyDetailResponseDto })
  data!: AccountAiQuantStrategyDetailResponseDto | null

  @ApiPropertyOptional()
  message?: string
}
