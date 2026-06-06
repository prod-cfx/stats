import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class LlmStrategyInstanceSignalResponseDto {
  @ApiProperty()
  id!: string

  @ApiPropertyOptional({ nullable: true })
  strategyId?: string | null

  @ApiPropertyOptional({ nullable: true })
  strategyInstanceId?: string | null

  @ApiPropertyOptional({ nullable: true })
  llmStrategyId?: string | null

  @ApiPropertyOptional({ nullable: true })
  llmStrategyInstanceId?: string | null

  @ApiProperty()
  symbolId!: string

  @ApiPropertyOptional({ nullable: true })
  symbolCode?: string | null

  @ApiProperty({ enum: ['AI_GENERATED', 'MANUAL', 'SYSTEM'] })
  sourceType!: 'AI_GENERATED' | 'MANUAL' | 'SYSTEM'

  @ApiProperty({ enum: ['ENTRY', 'EXIT', 'ADJUSTMENT', 'ALERT'] })
  signalType!: 'ENTRY' | 'EXIT' | 'ADJUSTMENT' | 'ALERT'

  @ApiProperty({ enum: ['BUY', 'SELL', 'CLOSE_LONG', 'CLOSE_SHORT'] })
  direction!: 'BUY' | 'SELL' | 'CLOSE_LONG' | 'CLOSE_SHORT'

  @ApiPropertyOptional({ nullable: true })
  confidence?: string | null

  @ApiPropertyOptional({ nullable: true })
  entryPrice?: string | null

  @ApiPropertyOptional({ nullable: true })
  targetPrice?: string | null

  @ApiPropertyOptional({ nullable: true })
  stopLoss?: string | null

  @ApiPropertyOptional({ nullable: true })
  takeProfit?: string | null

  @ApiPropertyOptional({ nullable: true })
  positionSizeQuote?: string | null

  @ApiPropertyOptional({ nullable: true })
  positionSizeRatio?: string | null

  @ApiPropertyOptional({ nullable: true })
  aiModel?: string | null

  @ApiPropertyOptional({ nullable: true })
  aiReasoning?: string | null

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  aiRawResponse?: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  marketContext?: Record<string, unknown> | null

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  metadata?: Record<string, unknown> | null

  @ApiProperty({ enum: ['PENDING', 'EXECUTED', 'PARTIAL', 'EXPIRED', 'CANCELLED', 'FAILED'] })
  status!: 'PENDING' | 'EXECUTED' | 'PARTIAL' | 'EXPIRED' | 'CANCELLED' | 'FAILED'

  @ApiProperty()
  publishedAt!: string

  @ApiPropertyOptional({ nullable: true })
  expiresAt?: string | null

  @ApiProperty()
  createdAt!: string

  @ApiProperty()
  updatedAt!: string
}
