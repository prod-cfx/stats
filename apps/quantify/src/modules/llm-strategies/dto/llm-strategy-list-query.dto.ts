import type { LlmStrategyStatus } from '@ai/shared'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base-pagination.request.dto'

export class LlmStrategyListQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ description: '策略状态筛选', enum: ['draft', 'live', 'archived'] })
  @IsOptional()
  @IsEnum(['draft', 'live', 'archived'])
  status?: LlmStrategyStatus

  @ApiPropertyOptional({ description: '名称或描述关键词模糊搜索' })
  @IsOptional()
  @IsString()
  keyword?: string

  @ApiPropertyOptional({ description: '排序字段，格式: field:direction', example: 'createdAt:desc' })
  @IsOptional()
  @IsString()
  orderBy?: string
}
