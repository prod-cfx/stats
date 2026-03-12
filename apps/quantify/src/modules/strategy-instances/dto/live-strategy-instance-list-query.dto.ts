import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class LiveStrategyInstanceListQueryDto extends BasePaginationRequestDto {
  @ApiProperty({ description: '涓氬姟鐢ㄦ埛 ID', required: false })
  @IsString()
  @IsOptional()
  userId?: string

  @ApiProperty({ description: 'LLM 妯″瀷绛涢€?, required: false })
  @IsString()
  @IsOptional()
  llmModel?: string

  @ApiProperty({ description: '绛栫暐妯℃澘 ID 绛涢€?, required: false })
  @IsString()
  @IsOptional()
  strategyTemplateId?: string

  @ApiProperty({
    description: '鏄惁鍖呭惈缁熻鏁版嵁',
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
