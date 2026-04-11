import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { INDICATOR_TIMEFRAMES_DTO, INDICATOR_TYPES_DTO } from './ops-indicator-config.dto'

class IndicatorParamsResponseDto {
  @ApiProperty()
  window!: number
}

export class IndicatorConfigResponseDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  symbolId!: string

  @ApiProperty({ enum: INDICATOR_TIMEFRAMES_DTO })
  timeframe!: string

  @ApiProperty({ enum: INDICATOR_TYPES_DTO })
  type!: string

  @ApiProperty()
  name!: string

  @ApiProperty({ type: IndicatorParamsResponseDto })
  params!: IndicatorParamsResponseDto

  @ApiProperty()
  isEnabled!: boolean

  @ApiPropertyOptional({ nullable: true })
  description?: string | null

  @ApiProperty()
  createdAt!: string

  @ApiProperty()
  updatedAt!: string
}

export class IndicatorConfigCacheReloadResponseDto {
  @ApiProperty()
  success!: boolean
}
