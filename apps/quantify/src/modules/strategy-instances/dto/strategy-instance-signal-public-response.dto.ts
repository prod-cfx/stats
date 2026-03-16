import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { convertDecimalToString } from '@/common/utils/decimal-converter'

import { SignalDirection, SignalType } from '@/prisma/prisma.types'

/**
 * 面向外部调用方的策略实例信号响应 DTO（已脱敏）
 * 仅包含对外消费所需的关键信息，避免暴露内部 prompt、原始响应和上下文细节
 */
export class StrategyInstanceSignalPublicResponseDto {
  @ApiProperty({ description: '信号 ID' })
  id: string

  @ApiPropertyOptional({ description: '标的代码', example: 'BTCUSDT', nullable: true })
  symbolCode?: string

  @ApiProperty({ description: '信号类型', enum: SignalType })
  signalType: SignalType

  @ApiProperty({ description: '方向', enum: SignalDirection })
  direction: SignalDirection

  @ApiPropertyOptional({ description: '入场价格', nullable: true })
  entryPrice?: string | null

  @ApiPropertyOptional({ description: '建议仓位大小（报价币种金额）', nullable: true })
  positionSizeQuote?: string | null

  @ApiPropertyOptional({ description: 'AI 文本理由', nullable: true })
  aiReasoning?: string | null

  @ApiProperty({ description: '发布时间' })
  publishedAt: string

  constructor(data: any) {
    this.id = data.id
    this.symbolCode = data.symbol?.code
    this.signalType = data.signalType
    this.direction = data.direction
    this.entryPrice = convertDecimalToString(data.entryPrice)
    this.positionSizeQuote = convertDecimalToString(data.positionSizeQuote)
    this.aiReasoning = data.aiReasoning
    this.publishedAt = data.publishedAt?.toISOString()
  }
}
