import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class AccountStrategyListQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ description: '业务用户 ID' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  userId?: string

  @ApiPropertyOptional({ description: '状态筛选', enum: ['running', 'stopped', 'draft'] })
  @IsString()
  @IsOptional()
  status?: 'running' | 'stopped' | 'draft'
}
