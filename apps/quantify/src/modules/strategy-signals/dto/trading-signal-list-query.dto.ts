import { ApiProperty } from '@nestjs/swagger'
import { SignalStatus } from '@prisma/client'
import { IsEnum, IsOptional, IsString } from 'class-validator'

import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class TradingSignalListQueryDto extends BasePaginationRequestDto {
  @ApiProperty({ description: '绛栫暐瀹炰緥 ID 绛涢€夛紙鏃х増绛栫暐锛?, required: false })
  @IsString()
  @IsOptional()
  strategyInstanceId?: string

  @ApiProperty({ description: '绛栫暐妯℃澘 ID 绛涢€夛紙鏃х増绛栫暐锛?, required: false })
  @IsString()
  @IsOptional()
  strategyId?: string

  @ApiProperty({ description: 'LLM 绛栫暐 ID 绛涢€?, required: false })
  @IsString()
  @IsOptional()
  llmStrategyId?: string

  @ApiProperty({ description: 'LLM 绛栫暐瀹炰緥 ID 绛涢€?, required: false })
  @IsString()
  @IsOptional()
  llmStrategyInstanceId?: string

  @ApiProperty({ description: '鏍囩殑浠ｇ爜绛涢€?, required: false })
  @IsString()
  @IsOptional()
  symbolId?: string

  @ApiProperty({
    description: '淇″彿鐘舵€佺瓫閫?,
    enum: SignalStatus,
    required: false,
  })
  @IsEnum(SignalStatus)
  @IsOptional()
  status?: SignalStatus
}
