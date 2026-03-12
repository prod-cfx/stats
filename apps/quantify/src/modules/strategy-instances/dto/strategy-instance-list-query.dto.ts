import { ApiProperty } from '@nestjs/swagger'
import { StrategyInstanceMode, StrategyInstanceStatus } from '@prisma/client'
import { Transform } from 'class-transformer'
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator'

import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class StrategyInstanceListQueryDto extends BasePaginationRequestDto {
  @ApiProperty({ description: '绛栫暐妯℃澘 ID 绛涢€?, required: false })
  @IsString()
  @IsOptional()
  strategyTemplateId?: string

  @ApiProperty({
    description: '鐘舵€佺瓫閫?,
    enum: StrategyInstanceStatus,
    required: false,
  })
  @IsEnum(StrategyInstanceStatus)
  @IsOptional()
  status?: StrategyInstanceStatus

  @ApiProperty({
    description: '杩愯妯″紡绛涢€夛細BACKTEST=鍘嗗彶鍥炴祴锛孭APER=绾镐笂浜ゆ槗锛孴ESTNET=娴嬭瘯缃戜氦鏄擄紝LIVE=瀹炵洏浜ゆ槗',
    enum: StrategyInstanceMode,
    required: false,
  })
  @IsEnum(StrategyInstanceMode)
  @IsOptional()
  mode?: StrategyInstanceMode

  @ApiProperty({ description: 'LLM 妯″瀷绛涢€?, required: false })
  @IsString()
  @IsOptional()
  llmModel?: string

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
