import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  STRATEGY_CLARIFICATION_FIELDS,
  STRATEGY_CLARIFICATION_ITEM_STATUSES,
  STRATEGY_CLARIFICATION_REASONS,
  STRATEGY_CLARIFICATION_STATUSES,
} from '../types/strategy-clarification'
import type { StrategyClarificationState } from '../types/strategy-clarification'

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

export class CodegenSessionResponseDto {
  @ApiProperty({ description: '会话 ID' })
  id!: string

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

  @ApiPropertyOptional({ description: '规则语义澄清状态', type: StrategyClarificationStateDto })
  clarificationState?: StrategyClarificationState | null

  @ApiPropertyOptional({ description: '拒绝原因' })
  rejectReason?: string | null

  @ApiPropertyOptional({ description: '引导提示' })
  assistantPrompt?: string
}
