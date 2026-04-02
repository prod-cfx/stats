import type { SubscriptionStatusType } from './update-subscription.dto'

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator'

import { BasePaginationRequestDto } from '@/common/dto/base-pagination.request.dto'
import { SUBSCRIPTION_STATUS_VALUES } from './update-subscription.dto'

export class SubscriptionListQueryDto extends BasePaginationRequestDto {
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
  @IsString()
  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUS_VALUES)
  status?: SubscriptionStatusType
}
