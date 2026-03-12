import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'

export const SUBSCRIPTION_STATUS_VALUES = ['active', 'paused', 'cancelled'] as const

export type SubscriptionStatusType = (typeof SUBSCRIPTION_STATUS_VALUES)[number]

export class UpdateSubscriptionDto {
  @ApiProperty({
    description: '涓氬姟鐢ㄦ埛 ID',
    example: 'usr_123',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiPropertyOptional({
    description: '璁㈤槄鐘舵€?,
    enum: SUBSCRIPTION_STATUS_VALUES,
  })
  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUS_VALUES)
  status?: SubscriptionStatusType

  @ApiPropertyOptional({ description: '鍏宠仈鐨勪氦鏄撴墍璐︽埛 ID', nullable: true })
  @IsString()
  @IsOptional()
  exchangeAccountId?: string | null

  @ApiPropertyOptional({ description: '鑷畾涔夊弬鏁?JSON', nullable: true })
  @IsObject()
  @IsOptional()
  customParams?: Record<string, unknown> | null
}

export type SubscriptionStatus = SubscriptionStatusType
