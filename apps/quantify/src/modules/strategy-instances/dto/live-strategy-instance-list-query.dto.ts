import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class LiveStrategyInstanceListQueryDto extends BasePaginationRequestDto {
  @ApiProperty({ description: '业务用户 ID', required: false })
  @IsString()
  @IsOptional()
  userId?: string

  @ApiProperty({ description: 'LLM 模型筛选', required: false })
  @IsString()
  @IsOptional()
  llmModel?: string

  @ApiProperty({ description: '策略模板 ID 筛选', required: false })
  @IsString()
  @IsOptional()
  strategyTemplateId?: string

  @ApiProperty({ 
    description: '是否包含统计数据', 
    required: false,
    default: true,
    type: Boolean
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'false' || value === false) return false
    if (value === 'true' || value === true) return true
    return true
  })
  includeStats?: boolean = true
}
