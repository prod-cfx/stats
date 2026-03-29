import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'
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

  @ApiPropertyOptional({ description: '仅返回已订阅策略' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  subscribedOnly?: boolean

  @ApiPropertyOptional({ description: '排除草稿策略' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  excludeDraft?: boolean
}
