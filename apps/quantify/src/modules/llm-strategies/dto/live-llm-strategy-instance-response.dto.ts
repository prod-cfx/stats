import type { LlmStrategyInstanceMode, LlmStrategyInstanceStatus } from '@/prisma/prisma.types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class LlmStrategyInstancePublicResponseDto {
  @ApiProperty({ description: '实例ID' })
  id: string

  @ApiProperty({ description: '所属LLM策略ID' })
  strategyId: string

  @ApiProperty({ description: '所属LLM策略名称' })
  strategyName: string

  @ApiPropertyOptional({ description: '所属LLM策略描述', nullable: true })
  strategyDescription?: string | null

  @ApiProperty({ description: '实例名称' })
  name: string

  @ApiPropertyOptional({ description: '实例描述（可选，当前从策略描述回退）', nullable: true })
  description?: string | null

  @ApiProperty({ description: '实例状态', enum: ['running', 'paused', 'stopped'] })
  status: LlmStrategyInstanceStatus

  @ApiProperty({ description: '运行模式', enum: ['LIVE', 'PAPER', 'BACKTEST'] })
  mode: LlmStrategyInstanceMode

  @ApiProperty({ description: '使用的LLM模型' })
  llmModel: string

  @ApiPropertyOptional({ description: '最后运行时间', nullable: true })
  lastRunAt?: Date | null

  @ApiProperty({ description: '指定业务用户是否已订阅该实例' })
  isSubscribed: boolean

  @ApiProperty({ description: '创建时间' })
  createdAt: Date

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date

  constructor(model: {
    id: string
    strategyId: string
    name: string
    description?: string | null
    status: LlmStrategyInstanceStatus
    mode: LlmStrategyInstanceMode
    llmModel: string
    lastRunAt?: Date | null
    createdAt: Date
    updatedAt: Date
    strategy: {
      name: string
      description: string
    }
  }, opts?: { isSubscribed?: boolean }) {
    this.id = model.id
    this.strategyId = model.strategyId
    this.strategyName = model.strategy.name
    this.strategyDescription = model.strategy.description
    this.name = model.name
    this.description = model.description ?? model.strategy.description
    this.status = model.status
    this.mode = model.mode
    this.llmModel = model.llmModel
    this.lastRunAt = model.lastRunAt ?? null
    this.isSubscribed = opts?.isSubscribed ?? false
    this.createdAt = model.createdAt
    this.updatedAt = model.updatedAt
  }
}
