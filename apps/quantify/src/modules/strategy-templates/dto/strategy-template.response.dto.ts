import type { StrategyTemplate as StrategyTemplateModel } from '@prisma/client'
import type { JsonValue, StrategyDataRequirements, StrategyExecutionConfig, StrategyStatus } from '../types/strategy-template.types'

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { StrategyExecutionConfigDto, StrategyLegDefinitionDto } from '../dto/create-strategy-template.dto'
import { STRATEGY_STATUS_VALUES } from '../types/strategy-template.types'

const normalizeLegs = (value: unknown): StrategyLegDefinitionDto[] | undefined => {
  if (!value) return undefined
  if (Array.isArray(value)) {
    return value as StrategyLegDefinitionDto[]
  }
  return undefined
}

const normalizeJson = (value: unknown): JsonValue | undefined => {
  if (value === undefined) return undefined
  return value as JsonValue
}

export class StrategyTemplateResponseDto {
  @ApiProperty({ description: '策略模板 ID' })
  id: string

  @ApiProperty({ description: '策略名称' })
  name: string

  @ApiProperty({ description: '策略描述' })
  description: string

  @ApiPropertyOptional({
    description: 'Leg 定义列表',
    type: () => [StrategyLegDefinitionDto],
  })
  legs?: StrategyLegDefinitionDto[]

  @ApiPropertyOptional({
    description: '策略执行配置',
    type: () => StrategyExecutionConfigDto,
  })
  execution?: StrategyExecutionConfig

  @ApiPropertyOptional({
    description: '数据需求配置',
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
  })
  dataRequirements?: StrategyDataRequirements

  @ApiProperty({ description: 'LLM 模型' })
  llmModel: string

  @ApiProperty({ description: 'Prompt 模板' })
  promptTemplate: string

  @ApiPropertyOptional({ description: '策略脚本代码', nullable: true })
  script?: string | null

  @ApiProperty({ description: '参数 schema' })
  paramsSchema: JsonValue

  @ApiPropertyOptional({ description: '默认参数' })
  defaultParams?: JsonValue

  @ApiPropertyOptional({ description: '策略规则 JSON' })
  rulesJson: JsonValue | null

  @ApiProperty({ description: '@deprecated 使用 dataRequirements 替代', type: [String], deprecated: true })
  requiredFields: string[]

  @ApiProperty({ description: '规则版本号' })
  rulesVersion: number

  @ApiProperty({ description: '策略状态', enum: STRATEGY_STATUS_VALUES })
  status: StrategyStatus

  @ApiPropertyOptional({ description: '创建人 ID' })
  createdBy?: string | null

  @ApiPropertyOptional({ description: '更新人 ID' })
  updatedBy?: string | null

  @ApiPropertyOptional({ description: '最近一次规则生成摘要' })
  lastGenerationSummary?: string | null

  @ApiPropertyOptional({ description: '附加元数据' })
  metadata?: JsonValue

  @ApiProperty({ description: '创建时间' })
  createdAt: Date

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date

  constructor(model: StrategyTemplateModel) {
    this.id = model.id
    this.name = model.name
    this.description = model.description
    this.legs = normalizeLegs(model.legs)
    this.execution = model.execution as unknown as StrategyExecutionConfig | undefined
    this.dataRequirements = model.dataRequirements as unknown as StrategyDataRequirements | undefined
    this.llmModel = model.llmModel
    this.promptTemplate = model.promptTemplate
    this.script = model.script ?? null
    this.paramsSchema = normalizeJson(model.paramsSchema) ?? {}
    this.defaultParams = normalizeJson(model.defaultParams) ?? undefined
    this.rulesJson = normalizeJson(model.rulesJson) ?? null
    this.requiredFields = model.requiredFields ?? []
    this.rulesVersion = model.rulesVersion
    this.status = model.status as StrategyStatus
    this.createdBy = model.createdBy
    this.updatedBy = model.updatedBy
    this.lastGenerationSummary = model.lastGenerationSummary
    this.metadata = normalizeJson(model.metadata)
    this.createdAt = model.createdAt
    this.updatedAt = model.updatedAt
  }
}


