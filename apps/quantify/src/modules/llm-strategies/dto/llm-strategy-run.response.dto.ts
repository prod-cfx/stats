import type { LlmStrategyRun, LlmStrategyRunStatus, TradingSignal } from '@/prisma/prisma.types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

import { TradingSignalResponseDto } from '@/modules/strategy-signals/dto/trading-signal-response.dto'

export class LlmStrategyRunResponseDto {
  @ApiProperty({ description: '运行记录ID' })
  id: string

  @ApiProperty({ description: '所属实例ID' })
  strategyInstanceId: string

  @ApiProperty({ description: '开始时间' })
  startedAt: Date

  @ApiPropertyOptional({ description: '结束时间', nullable: true })
  finishedAt?: Date | null

  @ApiProperty({ description: '运行状态', enum: ['success', 'failed', 'skipped'] })
  status: LlmStrategyRunStatus

  @ApiPropertyOptional({ description: '运行原因或描述', nullable: true })
  reason?: string | null

  @ApiPropertyOptional({ description: '工具调用次数', nullable: true })
  toolCallsCount?: number | null

  @ApiPropertyOptional({ description: '使用的LLM模型', nullable: true })
  llmModel?: string | null

  @ApiPropertyOptional({
    description: '原始对话快照',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  rawDialogSnapshot?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '生成的信号ID', nullable: true })
  generatedSignalId?: string | null

  @ApiPropertyOptional({ 
    description: '生成的交易信号详情', 
    type: () => TradingSignalResponseDto,
    nullable: true 
  })
  generatedSignal?: TradingSignalResponseDto | null

  @ApiPropertyOptional({ description: '错误消息', nullable: true })
  errorMessage?: string | null

  @ApiPropertyOptional({
    description: '元数据',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  metadata?: Record<string, unknown> | null

  @ApiProperty({ description: '创建时间' })
  createdAt: Date

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date

  constructor(model: LlmStrategyRun & { generatedSignal?: TradingSignal | null }) {
    this.id = model.id
    this.strategyInstanceId = model.strategyInstanceId
    this.startedAt = model.startedAt
    this.finishedAt = model.finishedAt
    this.status = model.status
    this.reason = model.reason
    this.toolCallsCount = model.toolCallsCount
    this.llmModel = model.llmModel
    this.rawDialogSnapshot = model.rawDialogSnapshot as Record<string, unknown> | null
    this.generatedSignalId = model.generatedSignalId
    this.generatedSignal = model.generatedSignal ? new TradingSignalResponseDto(model.generatedSignal) : null
    this.errorMessage = model.errorMessage
    this.metadata = model.metadata as Record<string, unknown> | null
    this.createdAt = model.createdAt
    this.updatedAt = model.updatedAt
  }
}
