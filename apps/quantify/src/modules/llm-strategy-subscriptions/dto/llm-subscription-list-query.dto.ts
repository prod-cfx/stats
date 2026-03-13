import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator'

import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class LlmSubscriptionListQueryDto extends BasePaginationRequestDto {
  @ApiProperty({ description: '业务用户 ID', example: 'usr_123' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiPropertyOptional({ description: '订阅状态筛选', required: false, enum: ['active', 'paused', 'cancelled'] })
  @IsOptional()
  @IsIn(['active', 'paused', 'cancelled'])
  status?: 'active' | 'paused' | 'cancelled'
}
