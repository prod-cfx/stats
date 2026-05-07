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

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  paramSchema!: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  paramValues!: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true })
  schemaVersion!: string | null

  @ApiProperty()
  isSubscribed!: boolean

  @ApiProperty({ type: AccountStrategyMetricsDto })
  metrics!: AccountStrategyMetricsDto

  @ApiProperty()
  updatedAt!: string

  @ApiPropertyOptional({ description: '只读态时间戳；非空表示策略已转为只读', nullable: true, type: String })
  viewOnlyAt!: string | null

  @ApiProperty({ description: '是否仍有活跃 AI Quant 关联会话' })
  hasActiveConversation!: boolean
}
