import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class LiveLlmStrategyInstanceListQueryDto extends BasePaginationRequestDto {
  @ApiProperty({ description: '涓氬姟鐢ㄦ埛 ID', required: false })
  @IsString()
  @IsOptional()
  userId?: string

  @ApiProperty({ description: 'LLM 妯″瀷绛涢€?, required: false })
  @IsString()
  @IsOptional()
  llmModel?: string

  @ApiProperty({ description: 'LLM 绛栫暐 ID 绛涢€?, required: false })
  @IsString()
  @IsOptional()
  strategyId?: string
}
