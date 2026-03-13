import type { LlmStrategyStatus } from '@/prisma/prisma.types'
import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator'

export class UpdateLlmStrategyDto {
  @ApiPropertyOptional({ description: '策略名称', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional({ description: '策略描述', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string

  @ApiPropertyOptional({ description: '策略状态', enum: ['draft', 'live', 'archived'] })
  @IsOptional()
  @IsEnum(['draft', 'live', 'archived'])
  status?: LlmStrategyStatus

  @ApiPropertyOptional({ description: '系统提示词', maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  systemPrompt?: string

  @ApiPropertyOptional({ description: '初始提示词模板', maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  initialPromptTemplate?: string

  @ApiPropertyOptional({
    description: '允许的交易对列表',
    type: [String],
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsArray()
  @IsString({ each: true })
  allowedSymbols?: string[] | null

  @ApiPropertyOptional({
    description: '允许的时间周期',
    type: [String],
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsArray()
  @IsString({ each: true })
  allowedTimeframes?: string[] | null

  @ApiPropertyOptional({
    description: '风险配置参数',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  riskConfig?: Record<string, unknown> | null

  @ApiPropertyOptional({
    description: '额外元数据',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  metadata?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '更新人标识', example: 'system-operator' })
  @IsOptional()
  @IsString()
  updatedBy?: string
}
