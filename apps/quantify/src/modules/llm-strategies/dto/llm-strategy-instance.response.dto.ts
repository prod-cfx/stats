import type { LlmStrategyInstance, LlmStrategyInstanceMode, LlmStrategyInstanceStatus } from '@/prisma/prisma.types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class LlmStrategyInstanceResponseDto {
  @ApiProperty({ description: '实例ID' })
  id: string

  @ApiProperty({ description: '所属LLM策略ID' })
  strategyId: string

  @ApiProperty({ description: '实例名称' })
  name: string

  @ApiProperty({ description: '实例状态', enum: ['running', 'paused', 'stopped'] })
  status: LlmStrategyInstanceStatus

  @ApiProperty({ description: '运行模式', enum: ['LIVE', 'PAPER', 'BACKTEST'] })
  mode: LlmStrategyInstanceMode

  @ApiProperty({ description: '使用的LLM模型' })
  llmModel: string

  @ApiPropertyOptional({ description: '调度cron表达式', nullable: true })
  scheduleCron?: string | null

  @ApiPropertyOptional({ description: '每次运行最大工具调用次数', nullable: true })
  maxToolCallsPerRun?: number | null

  @ApiPropertyOptional({ description: '每小时最大运行次数', nullable: true })
  maxRunsPerHour?: number | null

  @ApiPropertyOptional({ description: '冷却时间（秒）', nullable: true })
  cooldownSeconds?: number | null

  @ApiPropertyOptional({
    description: '配置覆盖',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  configOverrides?: Record<string, unknown> | null

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

  @ApiPropertyOptional({ description: '最后运行时间', nullable: true })
  lastRunAt?: Date | null

  @ApiProperty({ description: '创建时间' })
  createdAt: Date

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date

  constructor(model: LlmStrategyInstance) {
    this.id = model.id
    this.strategyId = model.strategyId
    this.name = model.name
    this.status = model.status
    this.mode = model.mode
    this.llmModel = model.llmModel
    this.scheduleCron = model.scheduleCron
    this.maxToolCallsPerRun = model.maxToolCallsPerRun
    this.maxRunsPerHour = model.maxRunsPerHour
    this.cooldownSeconds = model.cooldownSeconds
    this.configOverrides = model.configOverrides as Record<string, unknown> | null
    this.createdBy = model.createdBy
    this.updatedBy = model.updatedBy
    this.metadata = model.metadata as Record<string, unknown> | null
    this.lastRunAt = model.lastRunAt
    this.createdAt = model.createdAt
    this.updatedAt = model.updatedAt
  }
}
