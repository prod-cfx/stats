import type { SubscriptionStatus as SubscriptionStatusType } from '@prisma/client'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { SubscriptionStatus } from '@prisma/client'

export class SubscriptionResponseDto {
  @ApiProperty({ description: '璁㈤槄 ID' })
  id!: string

  @ApiProperty({ description: '鐢ㄦ埛 ID' })
  userId!: string

  @ApiProperty({ description: '绛栫暐瀹炰緥 ID' })
  strategyInstanceId!: string

  @ApiProperty({ description: '绛栫暐瀹炰緥鍚嶇О' })
  strategyInstanceName!: string

  @ApiProperty({ description: '绛栫暐鎻忚堪' })
  strategyDescription!: string

  @ApiProperty({ description: '璁㈤槄鐘舵€?, enum: SubscriptionStatus, enumName: 'SubscriptionStatus' })
  status!: SubscriptionStatusType

  @ApiPropertyOptional({ description: '鑷畾涔夊弬鏁?, nullable: true })
  customParams?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '浜ゆ槗鎵€璐︽埛 ID', nullable: true })
  exchangeAccountId?: string | null

  @ApiPropertyOptional({ description: '浜ゆ槗鎵€鏍囪瘑', nullable: true })
  exchangeName?: string | null

  @ApiProperty({ description: '璁㈤槄鏃堕棿' })
  subscribedAt!: Date

  @ApiPropertyOptional({ description: '鍙栨秷璁㈤槄鏃堕棿', nullable: true })
  unsubscribedAt?: Date | null

  @ApiProperty({ description: '鍒涘缓鏃堕棿' })
  createdAt!: Date

  @ApiProperty({ description: '鏇存柊鏃堕棿' })
  updatedAt!: Date
}
