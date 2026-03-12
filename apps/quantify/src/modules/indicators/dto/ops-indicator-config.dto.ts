import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator'

export const INDICATOR_TIMEFRAMES_DTO = ['1m', '5m', '15m', '1h', '4h', '1d'] as const
export type IndicatorTimeframeDto = (typeof INDICATOR_TIMEFRAMES_DTO)[number]

export const INDICATOR_TYPES_DTO = ['RET', 'MOVING_AVG', 'VOLATILITY', 'VOLUME_RATIO'] as const
export type IndicatorTypeDto = (typeof INDICATOR_TYPES_DTO)[number]

class IndicatorParamsDto {
  @ApiProperty({ description: '鎸囨爣绐楀彛闀垮害锛堝懆鏈熸暟锛?, example: 20 })
  @Min(1)
  window!: number
}

export class CreateIndicatorConfigDto {
  @ApiProperty({ description: 'Symbol 涓婚敭 ID', format: 'uuid' })
  @IsString()
  symbolId!: string

  @ApiProperty({ description: '鏃堕棿鍛ㄦ湡', enum: INDICATOR_TIMEFRAMES_DTO })
  @IsString()
  @IsIn(INDICATOR_TIMEFRAMES_DTO)
  timeframe!: IndicatorTimeframeDto

  @ApiProperty({ description: '鎸囨爣绫诲瀷', enum: INDICATOR_TYPES_DTO })
  @IsString()
  @IsIn(INDICATOR_TYPES_DTO)
  type!: IndicatorTypeDto

  @ApiProperty({ description: '閰嶇疆鍚嶇О锛岀敤浜庡尯鍒嗗悓绫绘寚鏍?, maxLength: 64 })
  @IsString()
  @MaxLength(64)
  name!: string

  @ApiProperty({ description: '鎸囨爣鍙傛暟锛岀洰鍓嶄粎鏀寔 window', type: () => IndicatorParamsDto })
  @ValidateNested()
  @Type(() => IndicatorParamsDto)
  params!: IndicatorParamsDto

  @ApiPropertyOptional({ description: '鏄惁鍚敤', default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiPropertyOptional({ description: '鎻忚堪', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string
}

export class UpdateIndicatorConfigDto {
  @ApiPropertyOptional({ description: 'Symbol 涓婚敭 ID', format: 'uuid' })
  @IsOptional()
  @IsString()
  symbolId?: string

  @ApiPropertyOptional({ description: '鏃堕棿鍛ㄦ湡', enum: INDICATOR_TIMEFRAMES_DTO })
  @IsOptional()
  @IsString()
  @IsIn(INDICATOR_TIMEFRAMES_DTO)
  timeframe?: IndicatorTimeframeDto

  @ApiPropertyOptional({ description: '鎸囨爣绫诲瀷', enum: INDICATOR_TYPES_DTO })
  @IsOptional()
  @IsString()
  @IsIn(INDICATOR_TYPES_DTO)
  type?: IndicatorTypeDto

  @ApiPropertyOptional({ description: '閰嶇疆鍚嶇О', maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string

  @ApiPropertyOptional({ description: '鎸囨爣鍙傛暟锛岀洰鍓嶄粎鏀寔 window', type: () => IndicatorParamsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => IndicatorParamsDto)
  params?: IndicatorParamsDto

  @ApiPropertyOptional({ description: '鏄惁鍚敤' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiPropertyOptional({ description: '鎻忚堪', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string
}

export class IndicatorConfigListQueryDto {
  @ApiPropertyOptional({ description: 'Symbol 浠ｇ爜锛屽 BTCUSDT' })
  @IsOptional()
  @IsString()
  symbolCode?: string

  @ApiPropertyOptional({ description: '鏃堕棿鍛ㄦ湡', enum: ['1m', '5m', '15m', '1h', '4h', '1d'] })
  @IsOptional()
  @IsString()
  @IsIn(INDICATOR_TIMEFRAMES_DTO)
  timeframe?: IndicatorTimeframeDto

  @ApiPropertyOptional({ description: '鎸囨爣绫诲瀷', enum: ['RET', 'MOVING_AVG', 'VOLATILITY', 'VOLUME_RATIO'] })
  @IsOptional()
  @IsString()
  @IsIn(INDICATOR_TYPES_DTO)
  type?: IndicatorTypeDto

  @ApiPropertyOptional({ description: '鏄惁鍚敤' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean

  @ApiPropertyOptional({ description: '椤电爜', default: 1 })
  @IsOptional()
  page?: number

  @ApiPropertyOptional({ description: '姣忛〉鏁伴噺', default: 20 })
  @IsOptional()
  limit?: number
}
