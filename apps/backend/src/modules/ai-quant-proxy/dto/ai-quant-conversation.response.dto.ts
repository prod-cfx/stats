import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

class AiQuantConversationMessageResponseDto {
  @ApiProperty({ description: 'Conversation message role', enum: ['user', 'assistant'] })
  role!: 'user' | 'assistant'

  @ApiProperty({ description: 'Conversation message content' })
  content!: string
}

class AiQuantConversationLastBacktestSummaryResponseDto {
  @ApiProperty()
  maxDrawdownPct!: number

  @ApiProperty()
  totalReturnPct!: number

  @ApiProperty()
  winRatePct!: number

  @ApiProperty()
  tradeCount!: number

  @ApiPropertyOptional()
  openTradeCount?: number

  @ApiPropertyOptional()
  openPnl?: number

  @ApiPropertyOptional({ enum: ['spot', 'perp'] })
  marketType?: 'spot' | 'perp'
}

export class AiQuantConversationBacktestRangeResponseDto {
  @ApiProperty({ enum: ['7D', '30D', '90D', '1Y', 'CUSTOM'] })
  preset!: '7D' | '30D' | '90D' | '1Y' | 'CUSTOM'

  @ApiPropertyOptional()
  startAt?: string

  @ApiPropertyOptional()
  endAt?: string
}

export class AiQuantConversationBacktestExecutionResponseDto {
  @ApiProperty()
  initialCash!: number

  @ApiPropertyOptional({ nullable: true })
  leverage!: number | null

  @ApiProperty()
  slippageBps!: number

  @ApiProperty()
  feeBps!: number

  @ApiProperty({ enum: ['open', 'close', 'mid'] })
  priceSource!: 'open' | 'close' | 'mid'

  @ApiProperty()
  allowPartial!: boolean
}

export class AiQuantConversationBacktestConfigResponseDto {
  @ApiProperty({ type: AiQuantConversationBacktestRangeResponseDto })
  range!: AiQuantConversationBacktestRangeResponseDto

  @ApiProperty({ type: AiQuantConversationBacktestExecutionResponseDto })
  execution!: AiQuantConversationBacktestExecutionResponseDto
}

class AiQuantConversationLastBacktestRefResponseDto {
  @ApiProperty()
  jobId!: string

  @ApiProperty()
  publishedSnapshotId!: string

  @ApiProperty({ type: AiQuantConversationBacktestConfigResponseDto })
  config!: AiQuantConversationBacktestConfigResponseDto

  @ApiProperty({ type: AiQuantConversationLastBacktestSummaryResponseDto })
  summary!: AiQuantConversationLastBacktestSummaryResponseDto

  @ApiProperty()
  completedAt!: string
}

export class AiQuantConversationResponseDto {
  @ApiProperty({ description: 'Conversation id' })
  id!: string

  @ApiPropertyOptional({ description: 'Current linked codegen session id' })
  activeCodegenSessionId?: string | null

  @ApiPropertyOptional({ description: 'Conversation title' })
  conversationTitle?: string

  @ApiPropertyOptional({ description: 'Structured conversation transcript', type: [AiQuantConversationMessageResponseDto] })
  conversationMessages?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>

  @ApiPropertyOptional({ description: 'Current codegen status' })
  status?: string

  @ApiPropertyOptional({ description: 'Conversation created timestamp' })
  createdAt?: string

  @ApiPropertyOptional({ description: 'Conversation updated timestamp' })
  updatedAt?: string

  @ApiPropertyOptional({ description: 'Current explicit backtest draft configuration', type: AiQuantConversationBacktestConfigResponseDto, nullable: true })
  backtestDraftConfig?: AiQuantConversationBacktestConfigResponseDto | null

  @ApiPropertyOptional({ description: 'Most recent recoverable backtest reference', type: AiQuantConversationLastBacktestRefResponseDto, nullable: true })
  lastBacktestRef?: AiQuantConversationLastBacktestRefResponseDto | null

  @ApiPropertyOptional({ description: 'Pending canonical digest awaiting confirmation' })
  canonicalDigest?: string | null

  @ApiPropertyOptional({ description: 'Structured strategy description payload', type: 'object', additionalProperties: true })
  specDesc?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: 'Semantic graph payload', type: 'object', additionalProperties: true })
  semanticGraph?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: 'Semantic graph validation report', type: 'object', additionalProperties: true })
  validationReport?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: 'Clarification gate payload', type: 'object', additionalProperties: true })
  clarificationGate?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: 'Publication gate payload', type: 'object', additionalProperties: true })
  publicationGate?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: 'Published script code' })
  scriptCode?: string | null

  @ApiPropertyOptional({ description: 'Published snapshot id' })
  publishedSnapshotId?: string | null

  @ApiPropertyOptional({ description: 'Snapshot-bound param values for published backtest/display semantics', type: 'object', additionalProperties: true })
  publishedSnapshotParamValues?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: 'Published snapshot formal strategy configuration', type: 'object', additionalProperties: true, nullable: true })
  publishedSnapshotStrategyConfig?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: 'Published snapshot formal backtest defaults', type: 'object', additionalProperties: true, nullable: true })
  publishedSnapshotBacktestConfigDefaults?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: 'Published snapshot formal deploy defaults', type: 'object', additionalProperties: true, nullable: true })
  publishedSnapshotDeploymentExecutionDefaults?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: 'Published snapshot formal deploy constraints', type: 'object', additionalProperties: true, nullable: true })
  publishedSnapshotDeploymentExecutionConstraints?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: 'Published snapshot compatibility metadata', type: 'object', additionalProperties: true, nullable: true })
  publishedSnapshotCompatibilityMetadata?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: 'Published strategy instance id' })
  strategyInstanceId?: string | null

  @ApiPropertyOptional({ description: 'Terminal reject reason' })
  rejectReason?: string | null
}
