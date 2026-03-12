import type { LlmStrategyInstanceMode, LlmStrategyInstanceStatus } from '@prisma/client'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class LlmStrategyInstancePublicResponseDto {
  @ApiProperty({ description: '瀹炰緥ID' })
  id: string

  @ApiProperty({ description: '鎵€灞濴LM绛栫暐ID' })
  strategyId: string

  @ApiProperty({ description: '鎵€灞濴LM绛栫暐鍚嶇О' })
  strategyName: string

  @ApiPropertyOptional({ description: '鎵€灞濴LM绛栫暐鎻忚堪', nullable: true })
  strategyDescription?: string | null

  @ApiProperty({ description: '瀹炰緥鍚嶇О' })
  name: string

  @ApiPropertyOptional({ description: '瀹炰緥鎻忚堪锛堝彲閫夛紝褰撳墠浠庣瓥鐣ユ弿杩板洖閫€锛?, nullable: true })
  description?: string | null

  @ApiProperty({ description: '瀹炰緥鐘舵€?, enum: ['running', 'paused', 'stopped'] })
  status: LlmStrategyInstanceStatus

  @ApiProperty({ description: '杩愯妯″紡', enum: ['LIVE', 'PAPER', 'BACKTEST'] })
  mode: LlmStrategyInstanceMode

  @ApiProperty({ description: '浣跨敤鐨凩LM妯″瀷' })
  llmModel: string

  @ApiPropertyOptional({ description: '鏈€鍚庤繍琛屾椂闂?, nullable: true })
  lastRunAt?: Date | null

  @ApiProperty({ description: '鎸囧畾涓氬姟鐢ㄦ埛鏄惁宸茶闃呰瀹炰緥' })
  isSubscribed: boolean

  @ApiProperty({ description: '鍒涘缓鏃堕棿' })
  createdAt: Date

  @ApiProperty({ description: '鏇存柊鏃堕棿' })
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
