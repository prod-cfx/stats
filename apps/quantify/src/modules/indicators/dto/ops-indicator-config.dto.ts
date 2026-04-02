import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base-pagination.request.dto'

export const INDICATOR_TIMEFRAMES_DTO = ['1m', '5m', '15m', '1h', '4h', '1d'] as const
export type IndicatorTimeframeDto = (typeof INDICATOR_TIMEFRAMES_DTO)[number]

export const INDICATOR_TYPES_DTO = ['RET', 'MOVING_AVG', 'VOLATILITY', 'VOLUME_RATIO'] as const
export type IndicatorTypeDto = (typeof INDICATOR_TYPES_DTO)[number]

class IndicatorParamsDto {
  @ApiProperty({ description: '指标窗口长度（周期数）', example: 20 })
  @Min(1)
  window!: number
}

export class CreateIndicatorConfigDto {
  @ApiProperty({ description: 'Symbol 主键 ID', format: 'uuid' })
  @IsString()
  symbolId!: string

  @ApiProperty({ description: '时间周期', enum: INDICATOR_TIMEFRAMES_DTO })
  @IsString()
  @IsIn(INDICATOR_TIMEFRAMES_DTO)
  timeframe!: IndicatorTimeframeDto

  @ApiProperty({ description: '指标类型', enum: INDICATOR_TYPES_DTO })
  @IsString()
  @IsIn(INDICATOR_TYPES_DTO)
  type!: IndicatorTypeDto

  @ApiProperty({ description: '配置名称，用于区分同类指标', maxLength: 64 })
  @IsString()
  @MaxLength(64)
  name!: string

  @ApiProperty({ description: '指标参数，目前仅支持 window', type: () => IndicatorParamsDto })
  @ValidateNested()
  @Type(() => IndicatorParamsDto)
  params!: IndicatorParamsDto

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiPropertyOptional({ description: '描述', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string
}

export class UpdateIndicatorConfigDto {
  @ApiPropertyOptional({ description: 'Symbol 主键 ID', format: 'uuid' })
  @IsOptional()
  @IsString()
  symbolId?: string

  @ApiPropertyOptional({ description: '时间周期', enum: INDICATOR_TIMEFRAMES_DTO })
  @IsOptional()
  @IsString()
  @IsIn(INDICATOR_TIMEFRAMES_DTO)
  timeframe?: IndicatorTimeframeDto

  @ApiPropertyOptional({ description: '指标类型', enum: INDICATOR_TYPES_DTO })
  @IsOptional()
  @IsString()
  @IsIn(INDICATOR_TYPES_DTO)
  type?: IndicatorTypeDto

  @ApiPropertyOptional({ description: '配置名称', maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string

  @ApiPropertyOptional({ description: '指标参数，目前仅支持 window', type: () => IndicatorParamsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => IndicatorParamsDto)
  params?: IndicatorParamsDto

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiPropertyOptional({ description: '描述', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string
}

export class IndicatorConfigListQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ description: 'Symbol 代码，如 BTCUSDT' })
  @IsOptional()
  @IsString()
  symbolCode?: string

  @ApiPropertyOptional({ description: '时间周期', enum: ['1m', '5m', '15m', '1h', '4h', '1d'] })
  @IsOptional()
  @IsString()
  @IsIn(INDICATOR_TIMEFRAMES_DTO)
  timeframe?: IndicatorTimeframeDto

  @ApiPropertyOptional({ description: '指标类型', enum: ['RET', 'MOVING_AVG', 'VOLATILITY', 'VOLUME_RATIO'] })
  @IsOptional()
  @IsString()
  @IsIn(INDICATOR_TYPES_DTO)
  type?: IndicatorTypeDto

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean
}


