import type { SubscriptionStatus } from '@prisma/client'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class LlmSubscriptionResponseDto {
  @ApiProperty({ description: '璁㈤槄ID' })
  id: string

  @ApiProperty({ description: '鐢ㄦ埛ID' })
  userId: string

  @ApiProperty({ description: 'LLM 绛栫暐瀹炰緥ID' })
  llmStrategyInstanceId: string

  @ApiProperty({ description: 'LLM 绛栫暐瀹炰緥鍚嶇О' })
  llmStrategyInstanceName: string

  @ApiProperty({ description: 'LLM 绛栫暐鍚嶇О' })
  llmStrategyName: string

  @ApiPropertyOptional({ description: 'LLM 绛栫暐鎻忚堪', nullable: true })
  llmStrategyDescription?: string | null

  @ApiProperty({ description: '璁㈤槄鐘舵€?, enum: ['active', 'paused', 'cancelled'] })
  status: SubscriptionStatus

  @ApiPropertyOptional({
    description: '鐢ㄦ埛鑷畾涔夊弬鏁?,
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  customParams?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '缁戝畾鐨勪氦鏄撴墍璐︽埛 ID锛堝彲閫夛級', nullable: true })
  exchangeAccountId?: string | null

  @ApiPropertyOptional({ description: '浜ゆ槗鎵€鏍囪瘑锛堝 binance, okx, hyperliquid锛?, nullable: true })
  exchangeId?: string | null

  @ApiPropertyOptional({ description: '浜ゆ槗鎵€璐︽埛鍒悕锛堝彲閫夛級', nullable: true })
  exchangeName?: string | null

  @ApiProperty({ description: '璁㈤槄鏃堕棿' })
  subscribedAt: Date

  @ApiPropertyOptional({ description: '鍙栨秷璁㈤槄鏃堕棿', nullable: true })
  unsubscribedAt?: Date | null

  @ApiProperty({ description: '鍒涘缓鏃堕棿' })
  createdAt: Date

  @ApiProperty({ description: '鏇存柊鏃堕棿' })
  updatedAt: Date
}
