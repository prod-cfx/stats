import type { SubscriptionStatus as SubscriptionStatusType } from '@ai/shared'
import { SubscriptionStatus as SharedSubscriptionStatus } from '@ai/shared'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'

export const SUBSCRIPTION_STATUS_VALUES = Object.values(SharedSubscriptionStatus)

export class UpdateSubscriptionDto {
  @ApiProperty({
    description: '业务用户 ID',
    example: 'usr_123',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiPropertyOptional({
    description: '订阅状态',
    enum: SUBSCRIPTION_STATUS_VALUES,
  })
  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUS_VALUES)
  status?: SubscriptionStatusType

  @ApiPropertyOptional({ description: '关联的交易所账户 ID', nullable: true })
  @IsString()
  @IsOptional()
  exchangeAccountId?: string | null

  @ApiPropertyOptional({ description: '自定义参数 JSON', nullable: true })
  @IsObject()
  @IsOptional()
  customParams?: Record<string, unknown> | null
}

export type { SubscriptionStatusType }
