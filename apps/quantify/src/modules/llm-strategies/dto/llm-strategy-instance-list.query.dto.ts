import type { LlmStrategyInstanceStatus } from '@prisma/client'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class LlmStrategyInstanceListQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ description: '瀹炰緥鐘舵€佺瓫閫?, enum: ['running', 'paused', 'stopped'] })
  @IsOptional()
  @IsEnum(['running', 'paused', 'stopped'])
  status?: LlmStrategyInstanceStatus

  @ApiPropertyOptional({ description: '鎵€灞炵瓥鐣D绛涢€? })
  @IsOptional()
  @IsString()
  strategyId?: string

  @ApiPropertyOptional({ description: '鎺掑簭瀛楁锛屾牸寮? field:direction', example: 'createdAt:desc' })
  @IsOptional()
  @IsString()
  orderBy?: string
}
