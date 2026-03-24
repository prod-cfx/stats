import type { SubscriptionStatus as SubscriptionStatusType } from '@ai/shared'
import { SubscriptionStatus } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class SubscriptionResponseDto {
  @ApiProperty({ description: '订阅 ID' })
  id!: string

  @ApiProperty({ description: '用户 ID' })
  userId!: string

  @ApiProperty({ description: '策略实例 ID' })
  strategyInstanceId!: string

  @ApiProperty({ description: '策略实例名称' })
  strategyInstanceName!: string

  @ApiProperty({ description: '策略描述' })
  strategyDescription!: string

  @ApiProperty({ description: '订阅状态', enum: SubscriptionStatus, enumName: 'SubscriptionStatus' })
  status!: SubscriptionStatusType

  @ApiPropertyOptional({ description: '自定义参数', nullable: true })
  customParams?: Record<string, unknown> | null

  @ApiPropertyOptional({ description: '交易所账户 ID', nullable: true })
  exchangeAccountId?: string | null

  @ApiPropertyOptional({ description: '交易所标识', nullable: true })
  exchangeName?: string | null

  @ApiProperty({ description: '订阅时间' })
  subscribedAt!: Date

  @ApiPropertyOptional({ description: '取消订阅时间', nullable: true })
  unsubscribedAt?: Date | null

  @ApiProperty({ description: '创建时间' })
  createdAt!: Date

  @ApiProperty({ description: '更新时间' })
  updatedAt!: Date
}
