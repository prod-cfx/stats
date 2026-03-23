import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class LlmSubscriptionListQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ enum: ['active', 'paused', 'cancelled'] })
  @IsOptional()
  @IsIn(['active', 'paused', 'cancelled'])
  status?: 'active' | 'paused' | 'cancelled'
}
