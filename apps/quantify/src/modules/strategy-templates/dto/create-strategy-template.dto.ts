import type { MarketTimeframe } from '@ai/shared'
import type { StrategyDataRequirements, StrategyExecutionConfig, StrategyLegDefinition, StrategyLegRole } from '../types/strategy-template.types'
import { MARKET_TIMEFRAMES } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'

import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'
import {
  STRATEGY_LEG_ROLES,
} from '../types/strategy-template.types'
import { IsSafeFieldNameArray } from '../validators/safe-field-name.validator'

/**
 * 策略腿定义 DTO
 */
export class StrategyLegDefinitionDto implements StrategyLegDefinition {
  @ApiProperty({ description: '在策略模板内唯一的 leg ID，例如 btc、eth', example: 'btc' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  id!: string

  @ApiProperty({ description: '交易对代码', example: 'BTCUSDT' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  symbol!: string

  @ApiProperty({ description: 'leg 角色', enum: STRATEGY_LEG_ROLES })
  @IsString()
  @IsIn(STRATEGY_LEG_ROLES)
  role!: StrategyLegRole

  @ApiPropertyOptional({ description: '该 leg 的补充说明', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string
}

/**
 * 策略执行配置 DTO
 */
export class StrategyExecutionConfigDto implements StrategyExecutionConfig {
  @ApiProperty({ description: '信号触发周期', enum: MARKET_TIMEFRAMES, example: '1h' })
  @IsString()
  @IsIn(MARKET_TIMEFRAMES as unknown as string[])
  timeframe!: MarketTimeframe

  @ApiPropertyOptional({ description: '冷却时间（分钟）', example: 15, minimum: 1, maximum: 1440 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  cooldownMinutes?: number
}

export class CreateStrategyTemplateDto {
  @ApiPropertyOptional({
    description: '操作者 ID（可信环境内由调用方显式传入）',
    example: 'system-operator',
  })
  @IsOptional()
  @IsString()
  createdBy?: string

  @ApiProperty({ description: '策略名称', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @ApiProperty({ description: '策略描述', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string

  @ApiProperty({
    description: '策略的 leg 定义列表，至少需要一个 primary leg',
    type: [StrategyLegDefinitionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StrategyLegDefinitionDto)
  legs!: StrategyLegDefinition[]

  @ApiProperty({
    description: '策略执行配置',
    type: StrategyExecutionConfigDto,
  })
  @ValidateNested()
  @Type(() => StrategyExecutionConfigDto)
  execution!: StrategyExecutionConfig

  @ApiProperty({
    description: '数据需求配置，key 为 leg id，value 为需要的时间周期数组',
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    example: { btc: ['15m', '1h', '4h'], eth: ['1h'] },
  })
  @IsObject()
  dataRequirements!: StrategyDataRequirements

  @ApiProperty({ description: 'LLM 模型名称', example: 'gpt-4.1-mini' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  llmModel!: string

  @ApiProperty({ description: 'Prompt 模板，支持占位符', maxLength: 20000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  promptTemplate!: string

  @ApiProperty({ description: '策略脚本代码，用于处理多腿数据并生成 AI prompt 变量', maxLength: 100000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100000)
  script!: string

  @ApiProperty({ description: '策略参数 schema，JSON Schema 结构', type: 'object', additionalProperties: true })
  @IsObject()
  paramsSchema!: Record<string, unknown>

  @ApiPropertyOptional({ description: '参数默认值', type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  defaultParams?: Record<string, unknown>

  @ApiPropertyOptional({
    description: '@deprecated 使用 dataRequirements 替代。策略依赖的字段列表',
    type: [String],
    example: ['price_close', 'ma_20', 'rsi_14'],
    deprecated: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsSafeFieldNameArray()
  requiredFields?: string[]

  @ApiPropertyOptional({ description: '额外元信息', type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}

