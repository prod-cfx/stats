import type { OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

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

  @ApiProperty({
    type: 'object',
    properties: {
      label: { type: 'string', enum: ['official_sample_backtest'] },
      returnPct: { type: 'number', nullable: true },
      winRatePct: { type: 'number', nullable: true },
      maxDrawdownPct: { type: 'number', nullable: true },
    },
  })
  displayMetrics!: OfficialStrategyPlazaTemplate['displayMetrics']

  constructor(template: OfficialStrategyPlazaTemplate) {
    this.id = template.id
    this.name = template.name
    this.description = template.description
    this.logicDescription = template.logicDescription
    this.tags = [...template.tags]
    this.riskLevel = template.riskLevel
    this.scenario = template.scenario
    this.exchange = template.exchange
    this.environment = template.environment
    this.marketType = template.runConfig.marketType
    this.symbol = template.runConfig.symbol
    this.timeframe = template.runConfig.timeframe
    this.positionPct = template.runConfig.positionPct
    this.leverage = template.runConfig.leverage
    this.status = template.status
    this.displayOrder = template.displayOrder
    this.displayMetrics = { ...template.displayMetrics }
  }
}
