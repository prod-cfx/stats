import type { StrategyClarificationItem, StrategyClarificationState } from '../types/strategy-clarification'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  STRATEGY_CLARIFICATION_FIELDS,
  STRATEGY_CLARIFICATION_ITEM_STATUSES,
  STRATEGY_CLARIFICATION_REASONS,
  STRATEGY_CLARIFICATION_STATUSES,
} from '../types/strategy-clarification'

class StrategyClarificationItemDto {
  @ApiProperty({ description: '澄清项唯一键' })
  key!: string

  @ApiProperty({ description: '澄清触发原因', enum: STRATEGY_CLARIFICATION_REASONS })
  reason!: string

  @ApiProperty({ description: '澄清字段', enum: STRATEGY_CLARIFICATION_FIELDS })
  field!: string

  @ApiProperty({ description: '是否阻断主流程', example: true })
  blocking!: boolean

  @ApiPropertyOptional({ description: '可选回答集合', type: [String] })
  allowedAnswers?: string[]

  @ApiPropertyOptional({ description: '规则 ID' })
  ruleId?: string

  @ApiProperty({ description: '面向用户的问题' })
  question!: string

  @ApiProperty({ description: '澄清项状态', enum: STRATEGY_CLARIFICATION_ITEM_STATUSES })
  status!: string

  @ApiPropertyOptional({ description: '用户回答' })
  answer?: string
}

class StrategyClarificationStateDto {
  @ApiProperty({ description: '澄清总状态', enum: STRATEGY_CLARIFICATION_STATUSES })
  status!: string

  @ApiProperty({ description: '澄清项列表', type: [StrategyClarificationItemDto] })
  items!: StrategyClarificationItemDto[]
}

class StrategyClarificationGateDto {
  @ApiProperty({ description: '当前是否存在阻断性澄清项', example: false })
  blocked!: boolean

  @ApiProperty({ description: '标准化后的阻断性澄清项列表', type: [StrategyClarificationItemDto] })
  items!: StrategyClarificationItemDto[]

  @ApiProperty({ description: '仍待回答的阻断性澄清项', type: [StrategyClarificationItemDto] })
  pendingItems!: StrategyClarificationItemDto[]
}

class PublicationGateMismatchDto {
  @ApiProperty({ description: '不一致字段' })
  field!: string

  @ApiProperty({ description: '期望值' })
  expected!: string

  @ApiProperty({ description: '实际值' })
  actual!: string

  @ApiProperty({ description: '阻断原因' })
  reason!: string
}

class PublicationGateDto {
  @ApiProperty({ description: '发布门禁是否通过', example: true })
  passed!: boolean

  @ApiProperty({ description: '阻断性不一致明细', type: [PublicationGateMismatchDto] })
  blockingMismatches!: PublicationGateMismatchDto[]
}

class CodegenConversationMessageDto {
  @ApiProperty({ description: '消息角色', enum: ['user', 'assistant'] })
  role!: 'user' | 'assistant'

  @ApiProperty({ description: '消息内容' })
  content!: string
}

export class CodegenSessionResponseDto {
  @ApiProperty({ description: '会话 ID' })
  id!: string

  @ApiPropertyOptional({ description: '会话标题' })
  conversationTitle?: string

  @ApiPropertyOptional({ description: '结构化会话消息', type: [CodegenConversationMessageDto] })
  conversationMessages?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>

  @ApiProperty({
    description: '会话状态',
    enum: ['DRAFTING', 'CHECKLIST_GATE', 'GENERATING', 'VALIDATING_STATIC', 'VALIDATING_RUNTIME', 'VALIDATING_OUTPUT', 'VALIDATING_CONSISTENCY', 'PUBLISHED', 'CONSISTENCY_FAILED', 'REJECTED'],
  })
  status!: string

  @ApiPropertyOptional({ description: '缺失字段列表', type: [String] })
  missingFields?: string[]

  @ApiPropertyOptional({ description: '最终生成脚本' })
  scriptCode?: string | null

  @ApiPropertyOptional({ description: '最近一次一致性通过并发布的快照 ID' })
  publishedSnapshotId?: string | null

  @ApiPropertyOptional({ description: '策略一致性校验报告', type: 'object', additionalProperties: true })
  consistencyReport?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '结构化策略描述（用于推荐）', type: 'object', additionalProperties: true })
  specDesc?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '当前待确认 canonical spec digest' })
  canonicalDigest?: string | null

  @ApiPropertyOptional({ description: '结构化语义图（确认与编译真源）', type: 'object', additionalProperties: true })
  semanticGraph?: Record<string, unknown> | null

  @ApiPropertyOptional({
    description: '语义图校验结果',
    type: 'object',
    additionalProperties: true,
  })
  validationReport?: {
    ok: boolean
    errors: Array<{
      code: string
      message: string
      nodeId?: string
    }>
  } | null

  @ApiPropertyOptional({ description: '发布后生成的策略实例 ID' })
  strategyInstanceId?: string | null

  @ApiPropertyOptional({ description: '创建时间' })
  createdAt?: string

  @ApiPropertyOptional({ description: '更新时间' })
  updatedAt?: string

  @ApiPropertyOptional({ description: '规则语义澄清状态', type: StrategyClarificationStateDto })
  clarificationState?: StrategyClarificationState | null

  @ApiProperty({ description: '结构化澄清门控状态', type: StrategyClarificationGateDto })
  clarificationGate!: {
    blocked: boolean
    items: StrategyClarificationItem[]
    pendingItems: StrategyClarificationItem[]
  }

  @ApiPropertyOptional({ description: '发布门禁结果', type: PublicationGateDto })
  publicationGate?: {
    passed: boolean
    blockingMismatches: Array<{
      field: string
      expected: string
      actual: string
      reason: string
    }>
  } | null

  @ApiPropertyOptional({ description: '拒绝原因' })
  rejectReason?: string | null

  @ApiPropertyOptional({ description: '引导提示' })
  assistantPrompt?: string
}
