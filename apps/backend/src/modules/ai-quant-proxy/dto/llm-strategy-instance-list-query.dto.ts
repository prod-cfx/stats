import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base-pagination.request.dto'

export class LlmStrategyInstanceListQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  llmModel?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  strategyId?: string
}
