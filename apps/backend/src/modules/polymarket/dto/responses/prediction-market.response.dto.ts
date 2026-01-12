import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class PredictionMarketOutcomeDto {
  @ApiProperty({ description: 'Outcome 标签（用于前端显示）' })
  label!: string

  @ApiProperty({ description: '概率字符串，例如 0.86 或 86' })
  probability!: string
}

export class PredictionMarketRulesDto {
  @ApiProperty({ type: [String], description: '规则文案段落' })
  paragraphs!: string[]

  @ApiPropertyOptional({ description: '规则创建或更新时间（ISO 字符串）' })
  createdAt?: string
}

export class PredictionMarketCardDto {
  @ApiProperty({ description: '市场外部 ID（marketId）' })
  id!: string

  @ApiProperty({ description: '市场标题，优先使用 question，其次 eventTitle' })
  title!: string

  @ApiPropertyOptional({ type: [PredictionMarketOutcomeDto] })
  options?: PredictionMarketOutcomeDto[]

  @ApiPropertyOptional({ description: '单一概率（某些只有总概率的市场）' })
  probability?: string

  @ApiPropertyOptional({ description: '市场状态，如 LIVE/RESOLVED 等' })
  status?: string

  @ApiPropertyOptional({ description: '24 小时成交额（字符串）' })
  volume24h?: string

  @ApiPropertyOptional({ description: '总成交额（字符串）' })
  volumeTotal?: string

  @ApiPropertyOptional({ description: '未平仓量（字符串）' })
  openInterest?: string

  @ApiPropertyOptional({ type: PredictionMarketRulesDto })
  rules?: PredictionMarketRulesDto
}


