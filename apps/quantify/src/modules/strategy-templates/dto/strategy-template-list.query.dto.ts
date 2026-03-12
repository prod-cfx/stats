import type {StrategyStatus} from '../types/strategy-template.types';
import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'

import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'
import {
  STRATEGY_STATUS_VALUES

} from '../types/strategy-template.types'

export class StrategyTemplateListQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ description: '鎸夌姸鎬佺瓫閫?, enum: STRATEGY_STATUS_VALUES })
  @IsOptional()
  @IsIn(STRATEGY_STATUS_VALUES)
  status?: StrategyStatus

  @ApiPropertyOptional({ description: '鍚嶇О鎴栨弿杩板叧閿瘝妯＄硦鎼滅储', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string

  @ApiPropertyOptional({ description: '鑷畾涔夋帓搴忓瓧娈碉紝榛樿鎸夊垱寤烘椂闂村€掑簭', example: 'createdAt:desc' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  orderBy?: string

  @ApiPropertyOptional({ description: '鏄惁浠呰繑鍥炶崏绋?, type: Boolean })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true
    if (value === 'false' || value === false) return false
    return undefined
  })
  onlyDraft?: boolean
}
