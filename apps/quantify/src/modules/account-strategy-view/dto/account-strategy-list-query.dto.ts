import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base-pagination.request.dto'

function parseStrictBooleanQuery(value: unknown): unknown {
  if (value === true || value === false) return value
  if (value === 'true') return true
  if (value === 'false') return false
  return value
}

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
  @Transform(({ value }) => parseStrictBooleanQuery(value))
  @IsBoolean()
  subscribedOnly?: boolean

  @ApiPropertyOptional({ description: '排除草稿策略' })
  @IsOptional()
  @Transform(({ value }) => parseStrictBooleanQuery(value))
  @IsBoolean()
  excludeDraft?: boolean
}
