import type { LlmStrategyInstanceMode, LlmStrategyInstanceStatus } from '@ai/shared'
import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator'

export class UpdateLlmStrategyInstanceDto {
  @ApiPropertyOptional({ description: '实例名称', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional({ description: '实例状态', enum: ['running', 'paused', 'stopped'] })
  @IsOptional()
  @IsEnum(['running', 'paused', 'stopped'])
  status?: LlmStrategyInstanceStatus

  @ApiPropertyOptional({ description: '运行模式', enum: ['LIVE', 'PAPER', 'BACKTEST'] })
  @IsOptional()
  @IsEnum(['LIVE', 'PAPER', 'BACKTEST'])
  mode?: LlmStrategyInstanceMode

  @ApiPropertyOptional({ description: '使用的LLM模型名称', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  llmModel?: string

  @ApiPropertyOptional({ description: '调度cron表达式', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  scheduleCron?: string

  @ApiPropertyOptional({ description: '每次运行最大工具调用次数', minimum: 1, maximum: 100, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(100)
  maxToolCallsPerRun?: number | null

  @ApiPropertyOptional({ description: '每小时最大运行次数', minimum: 1, maximum: 60, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(60)
  maxRunsPerHour?: number | null

  @ApiPropertyOptional({ description: '冷却时间（秒）', minimum: 0, maximum: 86400, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(86400)
  cooldownSeconds?: number | null

  @ApiPropertyOptional({
    description: '配置覆盖参数',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  configOverrides?: Record<string, unknown> | null

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
