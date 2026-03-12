import type { LlmStrategy, LlmStrategyStatus } from '@prisma/client'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class LlmStrategyResponseDto {
  @ApiProperty({ description: 'LLM绛栫暐ID' })
  id: string

  @ApiProperty({ description: '绛栫暐鍚嶇О' })
  name: string

  @ApiProperty({ description: '绛栫暐鎻忚堪' })
  description: string

  @ApiProperty({ description: '绛栫暐鐘舵€?, enum: ['draft', 'live', 'archived'] })
  status: LlmStrategyStatus

  @ApiPropertyOptional({ description: '绯荤粺鎻愮ず璇?, nullable: true })
  systemPrompt?: string | null

  @ApiPropertyOptional({ description: '鍒濆鎻愮ず璇嶆ā鏉?, nullable: true })
  initialPromptTemplate?: string | null

  @ApiPropertyOptional({
    description: '鍏佽鐨勪氦鏄撳',
    type: String,
    isArray: true,
  })
  allowedSymbols?: string[]

  @ApiPropertyOptional({
    description: '鍏佽鐨勬椂闂村懆鏈?,
    type: String,
    isArray: true,
  })
  allowedTimeframes?: string[]

  @ApiPropertyOptional({
    description: '椋庨櫓閰嶇疆',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  riskConfig?: Record<string, unknown> | null

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

  @ApiProperty({ description: '鍒涘缓鏃堕棿' })
  createdAt: Date

  @ApiProperty({ description: '鏇存柊鏃堕棿' })
  updatedAt: Date

  constructor(model: LlmStrategy) {
    this.id = model.id
    this.name = model.name
    this.description = model.description
    this.status = model.status
    this.systemPrompt = model.systemPrompt
    this.initialPromptTemplate = model.initialPromptTemplate
    this.allowedSymbols = Array.isArray(model.allowedSymbols) ? (model.allowedSymbols as string[]) : undefined
    this.allowedTimeframes = Array.isArray(model.allowedTimeframes) ? (model.allowedTimeframes as string[]) : undefined
    this.riskConfig = model.riskConfig as Record<string, unknown> | null
    this.createdBy = model.createdBy
    this.updatedBy = model.updatedBy
    this.metadata = model.metadata as Record<string, unknown> | null
    this.createdAt = model.createdAt
    this.updatedAt = model.updatedAt
  }
}
