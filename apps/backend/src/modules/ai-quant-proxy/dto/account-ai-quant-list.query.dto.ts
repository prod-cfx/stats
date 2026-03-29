import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsOptional } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class AccountAiQuantListQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ enum: ['running', 'stopped', 'draft'] })
  @IsOptional()
  @IsIn(['running', 'stopped', 'draft'])
  status?: 'running' | 'stopped' | 'draft'

  @ApiPropertyOptional({ description: 'Only return subscribed strategies' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  subscribedOnly?: boolean

  @ApiPropertyOptional({ description: 'Exclude draft strategies' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  excludeDraft?: boolean
}
