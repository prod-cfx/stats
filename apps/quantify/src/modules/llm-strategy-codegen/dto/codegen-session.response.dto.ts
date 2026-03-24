import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CodegenSessionResponseDto {
  @ApiProperty({ description: '会话 ID' })
  id!: string

  @ApiProperty({
    description: '会话状态',
    enum: ['DRAFTING', 'CHECKLIST_GATE', 'GENERATING', 'VALIDATING_STATIC', 'VALIDATING_RUNTIME', 'VALIDATING_OUTPUT', 'PUBLISHED', 'REJECTED'],
  })
  status!: string

  @ApiPropertyOptional({ description: '缺失字段列表', type: [String] })
  missingFields?: string[]

  @ApiPropertyOptional({ description: '最终生成脚本' })
  scriptCode?: string | null

  @ApiPropertyOptional({ description: '结构化策略描述（用于推荐）', type: 'object', additionalProperties: true })
  specDesc?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '发布后生成的策略实例 ID' })
  strategyInstanceId?: string | null

  @ApiPropertyOptional({ description: '拒绝原因' })
  rejectReason?: string | null

  @ApiPropertyOptional({ description: '引导提示' })
  assistantPrompt?: string
}
