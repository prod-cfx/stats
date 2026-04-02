import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

import { BasePaginationRequestDto } from '@/common/dto/base-pagination.request.dto'

export class LiveLlmStrategyInstanceListQueryDto extends BasePaginationRequestDto {
  @ApiProperty({ description: '业务用户 ID', required: false })
  @IsString()
  @IsOptional()
  userId?: string

  @ApiProperty({ description: 'LLM 模型筛选', required: false })
  @IsString()
  @IsOptional()
  llmModel?: string

  @ApiProperty({ description: 'LLM 策略 ID 筛选', required: false })
  @IsString()
  @IsOptional()
  strategyId?: string
}
