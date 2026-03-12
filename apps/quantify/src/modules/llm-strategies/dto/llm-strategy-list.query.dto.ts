import type { LlmStrategyStatus } from '@prisma/client'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class LlmStrategyListQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ description: '绛栫暐鐘舵€佺瓫閫?, enum: ['draft', 'live', 'archived'] })
  @IsOptional()
  @IsEnum(['draft', 'live', 'archived'])
  status?: LlmStrategyStatus

  @ApiPropertyOptional({ description: '鍚嶇О鎴栨弿杩板叧閿瘝妯＄硦鎼滅储' })
  @IsOptional()
  @IsString()
  keyword?: string

  @ApiPropertyOptional({ description: '鎺掑簭瀛楁锛屾牸寮? field:direction', example: 'createdAt:desc' })
  @IsOptional()
  @IsString()
  orderBy?: string
}
