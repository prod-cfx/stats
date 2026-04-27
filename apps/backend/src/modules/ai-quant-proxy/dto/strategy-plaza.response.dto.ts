import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class StrategyPlazaDisplayMetricsResponseDto {
  @ApiProperty({ enum: ['official_sample_backtest'] })
  label!: 'official_sample_backtest'

  @ApiPropertyOptional({ nullable: true })
  returnPct!: number | null

  @ApiPropertyOptional({ nullable: true })
  winRatePct!: number | null

  @ApiPropertyOptional({ nullable: true })
  maxDrawdownPct!: number | null
}

export class StrategyPlazaTemplateResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  name!: string

  @ApiProperty()
  description!: string

  @ApiProperty()
  logicDescription!: string

  @ApiProperty({ type: [String] })
  tags!: string[]

  @ApiProperty({ enum: ['low', 'medium', 'high'] })
  riskLevel!: 'low' | 'medium' | 'high'

  @ApiProperty()
  scenario!: string

  @ApiProperty({ enum: ['okx'] })
  exchange!: 'okx'

  @ApiProperty({ enum: ['demo'] })
  environment!: 'demo'

  @ApiProperty({ enum: ['spot', 'perp'] })
  marketType!: 'spot' | 'perp'

  @ApiProperty()
  symbol!: string

  @ApiProperty()
  timeframe!: string

  @ApiProperty()
  positionPct!: number

  @ApiPropertyOptional({ nullable: true })
  leverage!: number | null

  @ApiProperty({ enum: ['live', 'hidden'] })
  status!: 'live' | 'hidden'

  @ApiProperty()
  displayOrder!: number

  @ApiProperty({ type: StrategyPlazaDisplayMetricsResponseDto })
  displayMetrics!: StrategyPlazaDisplayMetricsResponseDto
}

export class StrategyPlazaEditSessionResponseDto {
  @ApiProperty()
  sessionId!: string

  @ApiProperty()
  templateId!: string

  @ApiProperty()
  initialMessage!: string
}
