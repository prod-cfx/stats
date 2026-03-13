import type { LlmStrategyInstanceStatus } from '@prisma/client'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class LlmStrategyInstanceListQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ description: '实例状态筛选', enum: ['running', 'paused', 'stopped'] })
  @IsOptional()
  @IsEnum(['running', 'paused', 'stopped'])
  status?: LlmStrategyInstanceStatus

  @ApiPropertyOptional({ description: '所属策略ID筛选' })
  @IsOptional()
  @IsString()
  strategyId?: string

  @ApiPropertyOptional({ description: '排序字段，格式: field:direction', example: 'createdAt:desc' })
  @IsOptional()
  @IsString()
  orderBy?: string
}
