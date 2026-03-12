import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { SignalDirection, SignalSourceType, SignalStatus, SignalType } from '@prisma/client'

import { convertDecimalToString } from '@/common/utils/decimal-converter'

export class TradingSignalResponseDto {
  @ApiProperty({ description: '淇″彿 ID' })
  id: string

  @ApiPropertyOptional({ description: '绛栫暐妯℃澘 ID锛堟棫鐗堢瓥鐣ワ級', nullable: true })
  strategyId?: string | null

  @ApiPropertyOptional({ description: '绛栫暐瀹炰緥 ID锛堟棫鐗堢瓥鐣ワ級', nullable: true })
  strategyInstanceId?: string | null

  @ApiPropertyOptional({ description: 'LLM 绛栫暐 ID', nullable: true })
  llmStrategyId?: string | null

  @ApiPropertyOptional({ description: 'LLM 绛栫暐瀹炰緥 ID', nullable: true })
  llmStrategyInstanceId?: string | null

  @ApiProperty({ description: '鏍囩殑 ID' })
  symbolId: string

  @ApiPropertyOptional({ description: '鏍囩殑浠ｇ爜', example: 'BTCUSDT', nullable: true })
  symbolCode?: string

  @ApiProperty({ description: '淇″彿鏉ユ簮绫诲瀷', enum: SignalSourceType })
  sourceType: SignalSourceType

  @ApiProperty({ description: '淇″彿绫诲瀷', enum: SignalType })
  signalType: SignalType

  @ApiProperty({ description: '鏂瑰悜', enum: SignalDirection })
  direction: SignalDirection

  @ApiPropertyOptional({ description: '缃俊搴?, example: 85.5, nullable: true })
  confidence?: string | null

  @ApiPropertyOptional({ description: '鍏ュ満浠锋牸', nullable: true })
  entryPrice?: string | null

  @ApiPropertyOptional({ description: '鐩爣浠锋牸', nullable: true })
  targetPrice?: string | null

  @ApiPropertyOptional({ description: '姝㈡崯浠锋牸', nullable: true })
  stopLoss?: string | null

  @ApiPropertyOptional({ description: '姝㈢泩浠锋牸', nullable: true })
  takeProfit?: string | null

  @ApiPropertyOptional({ description: '寤鸿浠撲綅澶у皬锛堟姤浠峰竵绉嶉噾棰濓級', nullable: true })
  positionSizeQuote?: string | null

  @ApiPropertyOptional({ description: '寤鸿浠撲綅姣斾緥锛?-1锛?, nullable: true })
  positionSizeRatio?: string | null

  @ApiPropertyOptional({ description: 'AI 妯″瀷鍚嶇О', nullable: true })
  aiModel?: string | null

  @ApiPropertyOptional({ description: 'AI 鎺ㄧ悊杩囩▼', nullable: true })
  aiReasoning?: string | null

  @ApiPropertyOptional({ description: 'AI 鍘熷鍝嶅簲', nullable: true })
  aiRawResponse?: any

  @ApiPropertyOptional({ description: '甯傚満涓婁笅鏂?, nullable: true })
  marketContext?: any

  @ApiPropertyOptional({ description: '鍏冩暟鎹?, nullable: true })
  metadata?: any

  @ApiProperty({ description: '鐘舵€?, enum: SignalStatus })
  status: SignalStatus

  @ApiProperty({ description: '鍙戝竷鏃堕棿' })
  publishedAt: string

  @ApiPropertyOptional({ description: '杩囨湡鏃堕棿', nullable: true })
  expiresAt?: string | null

  @ApiProperty({ description: '鍒涘缓鏃堕棿' })
  createdAt: string

  @ApiProperty({ description: '鏇存柊鏃堕棿' })
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
