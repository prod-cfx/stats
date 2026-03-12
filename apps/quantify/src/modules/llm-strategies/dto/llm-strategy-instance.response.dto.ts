import type { LlmStrategyInstance, LlmStrategyInstanceMode, LlmStrategyInstanceStatus } from '@prisma/client'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class LlmStrategyInstanceResponseDto {
  @ApiProperty({ description: '瀹炰緥ID' })
  id: string

  @ApiProperty({ description: '鎵€灞濴LM绛栫暐ID' })
  strategyId: string

  @ApiProperty({ description: '瀹炰緥鍚嶇О' })
  name: string

  @ApiProperty({ description: '瀹炰緥鐘舵€?, enum: ['running', 'paused', 'stopped'] })
  status: LlmStrategyInstanceStatus

  @ApiProperty({ description: '杩愯妯″紡', enum: ['LIVE', 'PAPER', 'BACKTEST'] })
  mode: LlmStrategyInstanceMode

  @ApiProperty({ description: '浣跨敤鐨凩LM妯″瀷' })
  llmModel: string

  @ApiPropertyOptional({ description: '璋冨害cron琛ㄨ揪寮?, nullable: true })
  scheduleCron?: string | null

  @ApiPropertyOptional({ description: '姣忔杩愯鏈€澶у伐鍏疯皟鐢ㄦ鏁?, nullable: true })
  maxToolCallsPerRun?: number | null

  @ApiPropertyOptional({ description: '姣忓皬鏃舵渶澶ц繍琛屾鏁?, nullable: true })
  maxRunsPerHour?: number | null

  @ApiPropertyOptional({ description: '鍐峰嵈鏃堕棿锛堢锛?, nullable: true })
  cooldownSeconds?: number | null

  @ApiPropertyOptional({
    description: '閰嶇疆瑕嗙洊',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  configOverrides?: Record<string, unknown> | null

  @ApiProperty({ description: '鍒涘缓浜篒D' })
  createdBy: string

  @ApiProperty({ description: '鏇存柊浜篒D' })
  updatedBy: string

  @ApiPropertyOptional({
    description: '鍏冩暟鎹?,
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  metadata?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '鏈€鍚庤繍琛屾椂闂?, nullable: true })
  lastRunAt?: Date | null

  @ApiProperty({ description: '鍒涘缓鏃堕棿' })
  createdAt: Date

  @ApiProperty({ description: '鏇存柊鏃堕棿' })
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
