import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

class CodegenConversationMessageResponseDto {
  @ApiProperty({ description: 'Conversation message role', enum: ['user', 'assistant'] })
  role!: 'user' | 'assistant'

  @ApiProperty({ description: 'Conversation message content' })
  content!: string
}

export class CodegenSessionResponseDto {
  @ApiProperty({ description: 'Session id' })
  id!: string

  @ApiPropertyOptional({ description: 'Current linked conversation id', nullable: true })
  conversationId?: string | null

  @ApiPropertyOptional({ description: 'Conversation title' })
  conversationTitle?: string

  @ApiPropertyOptional({ description: 'Structured conversation transcript', type: [CodegenConversationMessageResponseDto] })
  conversationMessages?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>

  @ApiProperty({
    description: 'Current codegen status',
    enum: ['DRAFTING', 'CHECKLIST_GATE', 'GENERATING', 'VALIDATING_STATIC', 'VALIDATING_RUNTIME', 'VALIDATING_OUTPUT', 'VALIDATING_CONSISTENCY', 'PUBLISHED', 'CONSISTENCY_FAILED', 'REJECTED'],
  })
  status!: string

  @ApiPropertyOptional({ description: 'Missing fields', type: [String] })
  missingFields?: string[]

  @ApiPropertyOptional({ description: 'Latest generated script', nullable: true })
  scriptCode?: string | null

  @ApiPropertyOptional({ description: 'Latest published snapshot id', nullable: true })
  publishedSnapshotId?: string | null

  @ApiPropertyOptional({ description: 'Snapshot-bound param values for published backtest/display semantics', type: 'object', additionalProperties: true, nullable: true })
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

  @ApiPropertyOptional({ description: 'Consistency report payload', type: 'object', additionalProperties: true, nullable: true })
  consistencyReport?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: 'Structured strategy description payload', type: 'object', additionalProperties: true, nullable: true })
  specDesc?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: 'Pending canonical digest awaiting confirmation', nullable: true })
  canonicalDigest?: string | null

  @ApiPropertyOptional({ description: 'Semantic graph payload', type: 'object', additionalProperties: true, nullable: true })
  semanticGraph?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: 'Validation report payload', type: 'object', additionalProperties: true, nullable: true })
  validationReport?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: 'Clarification state payload', type: 'object', additionalProperties: true, nullable: true })
  clarificationState?: Record<string, unknown> | null

  @ApiProperty({ description: 'Clarification gate payload', type: 'object', additionalProperties: true })
  clarificationGate!: Record<string, unknown>

  @ApiPropertyOptional({ description: 'Publication gate payload', type: 'object', additionalProperties: true, nullable: true })
  publicationGate?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: 'Published strategy instance id', nullable: true })
  strategyInstanceId?: string | null

  @ApiPropertyOptional({ description: 'Terminal reject reason', nullable: true })
  rejectReason?: string | null

  @ApiPropertyOptional({ description: 'Assistant follow-up prompt' })
  assistantPrompt?: string
}
