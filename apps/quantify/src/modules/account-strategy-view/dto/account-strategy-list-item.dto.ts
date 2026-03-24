import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class AccountStrategyMetricsDto {
  @ApiPropertyOptional({ description: '收益率(%)', nullable: true })
  returnPct!: number | null

  @ApiPropertyOptional({ description: '最大回撤(%)', nullable: true })
  maxDrawdownPct!: number | null

  @ApiPropertyOptional({ description: '胜率(%)', nullable: true })
  winRatePct!: number | null

  @ApiPropertyOptional({ description: '交易次数', nullable: true })
  tradeCount!: number | null
}

export class AccountStrategyListItemDto {
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

  @ApiPropertyOptional({ nullable: true, type: 'object' })
  paramSchema!: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true, type: 'object' })
  paramValues!: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true })
  schemaVersion!: string | null

  @ApiProperty()
  isSubscribed!: boolean

  @ApiProperty({ type: AccountStrategyMetricsDto })
  metrics!: AccountStrategyMetricsDto

  @ApiProperty()
  updatedAt!: string
}
