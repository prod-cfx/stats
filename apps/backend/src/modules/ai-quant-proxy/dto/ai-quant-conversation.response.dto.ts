import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

class AiQuantConversationMessageResponseDto {
  @ApiProperty({ description: 'Conversation message role', enum: ['user', 'assistant'] })
  role!: 'user' | 'assistant'

  @ApiProperty({ description: 'Conversation message content' })
  content!: string
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

  @ApiPropertyOptional({ description: 'Published strategy instance id' })
  strategyInstanceId?: string | null
}
