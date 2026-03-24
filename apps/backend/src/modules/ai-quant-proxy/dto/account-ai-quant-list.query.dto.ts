import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class AccountAiQuantListQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ enum: ['running', 'stopped', 'draft'] })
  @IsOptional()
  @IsIn(['running', 'stopped', 'draft'])
  status?: 'running' | 'stopped' | 'draft'
}
