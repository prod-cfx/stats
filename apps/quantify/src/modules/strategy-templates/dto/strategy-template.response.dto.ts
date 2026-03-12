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
  @ApiProperty({ description: '绛栫暐妯℃澘 ID' })
  id: string

  @ApiProperty({ description: '绛栫暐鍚嶇О' })
  name: string

  @ApiProperty({ description: '绛栫暐鎻忚堪' })
  description: string

  @ApiPropertyOptional({
    description: 'Leg 瀹氫箟鍒楄〃',
    type: () => [StrategyLegDefinitionDto],
  })
  legs?: StrategyLegDefinitionDto[]

  @ApiPropertyOptional({
    description: '绛栫暐鎵ц閰嶇疆',
    type: () => StrategyExecutionConfigDto,
  })
  execution?: StrategyExecutionConfig

  @ApiPropertyOptional({
    description: '鏁版嵁闇€姹傞厤缃?,
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
  })
  dataRequirements?: StrategyDataRequirements

  @ApiProperty({ description: 'LLM 妯″瀷' })
  llmModel: string

  @ApiProperty({ description: 'Prompt 妯℃澘' })
  promptTemplate: string

  @ApiPropertyOptional({ description: '绛栫暐鑴氭湰浠ｇ爜', nullable: true })
  script?: string | null

  @ApiProperty({ description: '鍙傛暟 schema' })
  paramsSchema: JsonValue

  @ApiPropertyOptional({ description: '榛樿鍙傛暟' })
  defaultParams?: JsonValue

  @ApiPropertyOptional({ description: '绛栫暐瑙勫垯 JSON' })
  rulesJson: JsonValue | null

  @ApiProperty({ description: '@deprecated 浣跨敤 dataRequirements 鏇夸唬', type: [String], deprecated: true })
  requiredFields: string[]

  @ApiProperty({ description: '瑙勫垯鐗堟湰鍙? })
  rulesVersion: number

  @ApiProperty({ description: '绛栫暐鐘舵€?, enum: STRATEGY_STATUS_VALUES })
  status: StrategyStatus

  @ApiPropertyOptional({ description: '鍒涘缓浜?ID' })
  createdBy?: string | null

  @ApiPropertyOptional({ description: '鏇存柊浜?ID' })
  updatedBy?: string | null

  @ApiPropertyOptional({ description: '鏈€杩戜竴娆¤鍒欑敓鎴愭憳瑕? })
  lastGenerationSummary?: string | null

  @ApiPropertyOptional({ description: '闄勫姞鍏冩暟鎹? })
  metadata?: JsonValue

  @ApiProperty({ description: '鍒涘缓鏃堕棿' })
  createdAt: Date

  @ApiProperty({ description: '鏇存柊鏃堕棿' })
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
