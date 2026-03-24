import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { convertDecimalToString } from '@/common/utils/decimal-converter'

import { SignalDirection, SignalSourceType, SignalStatus, SignalType } from '@ai/shared'

export class TradingSignalResponseDto {
  @ApiProperty({ description: '信号 ID' })
  id: string

  @ApiPropertyOptional({ description: '策略模板 ID（旧版策略）', nullable: true })
  strategyId?: string | null

  @ApiPropertyOptional({ description: '策略实例 ID（旧版策略）', nullable: true })
  strategyInstanceId?: string | null

  @ApiPropertyOptional({ description: 'LLM 策略 ID', nullable: true })
  llmStrategyId?: string | null

  @ApiPropertyOptional({ description: 'LLM 策略实例 ID', nullable: true })
  llmStrategyInstanceId?: string | null

  @ApiProperty({ description: '标的 ID' })
  symbolId: string

  @ApiPropertyOptional({ description: '标的代码', example: 'BTCUSDT', nullable: true })
  symbolCode?: string

  @ApiProperty({ description: '信号来源类型', enum: SignalSourceType })
  sourceType: SignalSourceType

  @ApiProperty({ description: '信号类型', enum: SignalType })
  signalType: SignalType

  @ApiProperty({ description: '方向', enum: SignalDirection })
  direction: SignalDirection

  @ApiPropertyOptional({ description: '置信度', example: 85.5, nullable: true })
  confidence?: string | null

  @ApiPropertyOptional({ description: '入场价格', nullable: true })
  entryPrice?: string | null

  @ApiPropertyOptional({ description: '目标价格', nullable: true })
  targetPrice?: string | null

  @ApiPropertyOptional({ description: '止损价格', nullable: true })
  stopLoss?: string | null

  @ApiPropertyOptional({ description: '止盈价格', nullable: true })
  takeProfit?: string | null

  @ApiPropertyOptional({ description: '建议仓位大小（报价币种金额）', nullable: true })
  positionSizeQuote?: string | null

  @ApiPropertyOptional({ description: '建议仓位比例（0-1）', nullable: true })
  positionSizeRatio?: string | null

  @ApiPropertyOptional({ description: 'AI 模型名称', nullable: true })
  aiModel?: string | null

  @ApiPropertyOptional({ description: 'AI 推理过程', nullable: true })
  aiReasoning?: string | null

  @ApiPropertyOptional({ description: 'AI 原始响应', nullable: true })
  aiRawResponse?: any

  @ApiPropertyOptional({ description: '市场上下文', nullable: true })
  marketContext?: any

  @ApiPropertyOptional({ description: '元数据', nullable: true })
  metadata?: any

  @ApiProperty({ description: '状态', enum: SignalStatus })
  status: SignalStatus

  @ApiProperty({ description: '发布时间' })
  publishedAt: string

  @ApiPropertyOptional({ description: '过期时间', nullable: true })
  expiresAt?: string | null

  @ApiProperty({ description: '创建时间' })
  createdAt: string

  @ApiProperty({ description: '更新时间' })
  updatedAt: string

  constructor(data: any) {
    this.id = data.id
    this.strategyId = data.strategyId || null
    this.strategyInstanceId = data.strategyInstanceId || null
    this.llmStrategyId = data.llmStrategyId || null
    this.llmStrategyInstanceId = data.llmStrategyInstanceId || null
    this.symbolId = data.symbolId
    this.symbolCode = data.symbol?.code
    this.sourceType = data.sourceType
    this.signalType = data.signalType
    this.direction = data.direction
    this.confidence = convertDecimalToString(data.confidence)
    this.entryPrice = convertDecimalToString(data.entryPrice)
    this.targetPrice = convertDecimalToString(data.targetPrice)
    this.stopLoss = convertDecimalToString(data.stopLoss)
    this.takeProfit = convertDecimalToString(data.takeProfit)
    this.positionSizeQuote = convertDecimalToString(data.positionSizeQuote)
    this.positionSizeRatio = convertDecimalToString(data.positionSizeRatio)
    this.aiModel = data.aiModel
    this.aiReasoning = data.aiReasoning
    this.aiRawResponse = data.aiRawResponse
    this.marketContext = data.marketContext
    this.metadata = data.metadata
    this.status = data.status
    this.publishedAt = data.publishedAt?.toISOString()
    this.expiresAt = data.expiresAt?.toISOString() || null
    this.createdAt = data.createdAt?.toISOString()
    this.updatedAt = data.updatedAt?.toISOString()
  }
}
