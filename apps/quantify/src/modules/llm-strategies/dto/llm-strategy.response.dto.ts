import type { LlmStrategy, LlmStrategyStatus } from '@/prisma/prisma.types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class LlmStrategyResponseDto {
  @ApiProperty({ description: 'LLM策略ID' })
  id: string

  @ApiProperty({ description: '策略名称' })
  name: string

  @ApiProperty({ description: '策略描述' })
  description: string

  @ApiProperty({ description: '策略状态', enum: ['draft', 'live', 'archived'] })
  status: LlmStrategyStatus

  @ApiPropertyOptional({ description: '系统提示词', nullable: true })
  systemPrompt?: string | null

  @ApiPropertyOptional({ description: '初始提示词模板', nullable: true })
  initialPromptTemplate?: string | null

  @ApiPropertyOptional({
    description: '允许的交易对',
    type: String,
    isArray: true,
  })
  allowedSymbols?: string[]

  @ApiPropertyOptional({
    description: '允许的时间周期',
    type: String,
    isArray: true,
  })
  allowedTimeframes?: string[]

  @ApiPropertyOptional({
    description: '风险配置',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  riskConfig?: Record<string, unknown> | null

  @ApiProperty({ description: '创建人ID' })
  createdBy: string

  @ApiProperty({ description: '更新人ID' })
  updatedBy: string

  @ApiPropertyOptional({
    description: '元数据',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  metadata?: Record<string, unknown> | null

  @ApiProperty({ description: '创建时间' })
  createdAt: Date

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date

  constructor(model: LlmStrategy) {
    this.id = model.id
    this.name = model.name
    this.description = model.description
    this.status = model.status
    this.systemPrompt = model.systemPrompt
    this.initialPromptTemplate = model.initialPromptTemplate
    this.allowedSymbols = Array.isArray(model.allowedSymbols) ? (model.allowedSymbols as string[]) : undefined
    this.allowedTimeframes = Array.isArray(model.allowedTimeframes) ? (model.allowedTimeframes as string[]) : undefined
    this.riskConfig = model.riskConfig as Record<string, unknown> | null
    this.createdBy = model.createdBy
    this.updatedBy = model.updatedBy
    this.metadata = model.metadata as Record<string, unknown> | null
    this.createdAt = model.createdAt
    this.updatedAt = model.updatedAt
  }
}
