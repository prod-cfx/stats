import type { LlmStrategyRun, LlmStrategyRunStatus, TradingSignal } from '@prisma/client'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

import { TradingSignalResponseDto } from '@/modules/strategy-signals/dto/trading-signal-response.dto'

export class LlmStrategyRunResponseDto {
  @ApiProperty({ description: '杩愯璁板綍ID' })
  id: string

  @ApiProperty({ description: '鎵€灞炲疄渚婭D' })
  strategyInstanceId: string

  @ApiProperty({ description: '寮€濮嬫椂闂? })
  startedAt: Date

  @ApiPropertyOptional({ description: '缁撴潫鏃堕棿', nullable: true })
  finishedAt?: Date | null

  @ApiProperty({ description: '杩愯鐘舵€?, enum: ['success', 'failed', 'skipped'] })
  status: LlmStrategyRunStatus

  @ApiPropertyOptional({ description: '杩愯鍘熷洜鎴栨弿杩?, nullable: true })
  reason?: string | null

  @ApiPropertyOptional({ description: '宸ュ叿璋冪敤娆℃暟', nullable: true })
  toolCallsCount?: number | null

  @ApiPropertyOptional({ description: '浣跨敤鐨凩LM妯″瀷', nullable: true })
  llmModel?: string | null

  @ApiPropertyOptional({
    description: '鍘熷瀵硅瘽蹇収',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  rawDialogSnapshot?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '鐢熸垚鐨勪俊鍙稩D', nullable: true })
  generatedSignalId?: string | null

  @ApiPropertyOptional({
    description: '鐢熸垚鐨勪氦鏄撲俊鍙疯鎯?,
    type: () => TradingSignalResponseDto,
    nullable: true
  })
  generatedSignal?: TradingSignalResponseDto | null

  @ApiPropertyOptional({ description: '閿欒娑堟伅', nullable: true })
  errorMessage?: string | null

  @ApiPropertyOptional({
    description: '鍏冩暟鎹?,
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  metadata?: Record<string, unknown> | null

  @ApiProperty({ description: '鍒涘缓鏃堕棿' })
  createdAt: Date

  @ApiProperty({ description: '鏇存柊鏃堕棿' })
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
