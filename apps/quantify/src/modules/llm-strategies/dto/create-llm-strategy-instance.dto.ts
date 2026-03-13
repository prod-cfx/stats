import type { LlmStrategyInstanceMode } from '@prisma/client'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class CreateLlmStrategyInstanceDto {
  @ApiProperty({ description: '所属LLM策略ID' })
  @IsString()
  @IsNotEmpty()
  strategyId!: string

  @ApiProperty({ description: '实例名称（在同一策略下唯一）', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @ApiProperty({ description: '运行模式', enum: ['LIVE', 'PAPER', 'BACKTEST'] })
  @IsEnum(['LIVE', 'PAPER', 'BACKTEST'])
  mode!: LlmStrategyInstanceMode

  @ApiProperty({ description: '使用的LLM模型名称', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  llmModel!: string

  @ApiPropertyOptional({ description: '调度cron表达式', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  scheduleCron?: string

  @ApiPropertyOptional({ description: '每次运行最大工具调用次数', minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxToolCallsPerRun?: number

  @ApiPropertyOptional({ description: '每小时最大运行次数', minimum: 1, maximum: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  maxRunsPerHour?: number

  @ApiPropertyOptional({ description: '冷却时间（秒）', minimum: 0, maximum: 86400 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  cooldownSeconds?: number

  @ApiPropertyOptional({
    description: '配置覆盖参数',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  configOverrides?: Record<string, unknown>

  @ApiPropertyOptional({
    description: '额外元数据',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>

  @ApiPropertyOptional({ description: '创建人标识', example: 'system-operator' })
  @IsOptional()
  @IsString()
  createdBy?: string
}
