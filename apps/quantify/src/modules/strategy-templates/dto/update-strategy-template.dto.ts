import type { StrategyDataRequirements, StrategyExecutionConfig, StrategyStatus } from '../types/strategy-template.types'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'

import { IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateIf, ValidateNested } from 'class-validator'
import {
  STRATEGY_STATUS_VALUES,
} from '../types/strategy-template.types'
import { IsSafeFieldNameArray } from '../validators/safe-field-name.validator'
import { StrategyExecutionConfigDto, StrategyLegDefinitionDto } from './create-strategy-template.dto'

/**
 * Update DTO 允许更新模板的大部分字段。
 */
export class UpdateStrategyTemplateDto {
  @ApiPropertyOptional({
    description: '操作者 ID（可信环境内由调用方显式传入）',
    example: 'system-operator',
  })
  @IsOptional()
  @IsString()
  updatedBy?: string

  @ApiPropertyOptional({ description: '策略名称', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional({ description: '策略描述', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @ApiPropertyOptional({ description: 'Leg 定义列表', type: [StrategyLegDefinitionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StrategyLegDefinitionDto)
  legs?: StrategyLegDefinitionDto[]

  @ApiPropertyOptional({ description: '策略执行配置', type: StrategyExecutionConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StrategyExecutionConfigDto)
  execution?: StrategyExecutionConfig

  @ApiPropertyOptional({
    description: '数据需求配置，key 为 leg id，value 为需要的时间周期数组',
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    example: { btc: ['15m', '1h', '4h'], eth: ['1h'] },
  })
  @IsOptional()
  @IsObject()
  dataRequirements?: StrategyDataRequirements

  @ApiPropertyOptional({ description: 'LLM 模型名称', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  llmModel?: string

  @ApiPropertyOptional({ description: 'Prompt 模板', maxLength: 20000 })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  promptTemplate?: string

  @ApiPropertyOptional({ description: '策略脚本代码', maxLength: 100000, nullable: true })
  @IsOptional()
  @ValidateIf(o => o.script !== null)
  @IsString()
  @MaxLength(100000)
  script?: string | null

  @ApiPropertyOptional({ description: '参数 schema', type: 'object', additionalProperties: true, nullable: true })
  @IsOptional()
  @ValidateIf(o => o.paramsSchema !== null)
  @IsObject()
  paramsSchema?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '参数默认值', type: 'object', additionalProperties: true, nullable: true })
  @IsOptional()
  @ValidateIf(o => o.defaultParams !== null)
  @IsObject()
  defaultParams?: Record<string, unknown> | null

  @ApiPropertyOptional({
    description: '@deprecated 使用 dataRequirements 替代',
    type: [String],
    example: ['price_close', 'ma_20', 'rsi_14'],
    deprecated: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsSafeFieldNameArray()
  requiredFields?: string[]

  @ApiPropertyOptional({ description: '策略状态', enum: STRATEGY_STATUS_VALUES })
  @IsOptional()
  @IsIn(STRATEGY_STATUS_VALUES)
  status?: StrategyStatus

  @ApiPropertyOptional({ description: '附加元信息', type: 'object', additionalProperties: true, nullable: true })
  @IsOptional()
  @ValidateIf(o => o.metadata !== null)
  @IsObject()
  metadata?: Record<string, unknown> | null
}

