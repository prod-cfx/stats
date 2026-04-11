import type { LlmCodegenSessionStatus } from '../types/codegen-session-status'
import type { CodegenSessionResponseDto } from './codegen-session.response.dto'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

class AiQuantConversationMessageDto {
  @ApiProperty({ description: '消息角色', enum: ['user', 'assistant'] })
  role!: 'user' | 'assistant'

  @ApiProperty({ description: '消息内容' })
  content!: string
}

export class AiQuantConversationResponseDto {
  @ApiProperty({ description: '会话 ID' })
  id!: string

  @ApiPropertyOptional({ description: '当前关联的 codegen session ID' })
  activeCodegenSessionId?: string | null

  @ApiPropertyOptional({ description: '会话标题' })
  conversationTitle?: string

  @ApiPropertyOptional({ description: '结构化会话消息', type: [AiQuantConversationMessageDto] })
  conversationMessages?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>

  @ApiPropertyOptional({ description: '当前会话对应的 codegen 状态' })
  status?: LlmCodegenSessionStatus

  @ApiPropertyOptional({ description: '创建时间' })
  createdAt?: string

  @ApiPropertyOptional({ description: '更新时间' })
  updatedAt?: string

  @ApiPropertyOptional({ description: '当前待确认 canonical spec digest' })
  canonicalDigest?: string | null

  @ApiPropertyOptional({ description: '结构化策略描述（用于推荐）', type: 'object', additionalProperties: true })
  specDesc?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '结构化语义图（确认与编译真源）', type: 'object', additionalProperties: true })
  semanticGraph?: CodegenSessionResponseDto['semanticGraph']

  @ApiPropertyOptional({ description: '语义图校验结果', type: 'object', additionalProperties: true })
  validationReport?: CodegenSessionResponseDto['validationReport']

  @ApiPropertyOptional({ description: '结构化澄清门控状态', type: 'object', additionalProperties: true })
  clarificationGate?: CodegenSessionResponseDto['clarificationGate']

  @ApiPropertyOptional({ description: '发布门禁结果', type: 'object', additionalProperties: true })
  publicationGate?: CodegenSessionResponseDto['publicationGate']

  @ApiPropertyOptional({ description: '最终生成脚本' })
  scriptCode?: string | null

  @ApiPropertyOptional({ description: '最近一次一致性通过并发布的快照 ID' })
  publishedSnapshotId?: string | null

  @ApiPropertyOptional({ description: '已发布快照绑定的参数视图（用于前端回测/展示对齐）', type: 'object', additionalProperties: true })
  publishedSnapshotParamValues?: CodegenSessionResponseDto['publishedSnapshotParamValues']

  @ApiPropertyOptional({ description: '发布后生成的策略实例 ID' })
  strategyInstanceId?: string | null
}
