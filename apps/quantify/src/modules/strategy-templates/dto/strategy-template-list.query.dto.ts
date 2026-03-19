import type {StrategyStatus} from '../types/strategy-template.types';
import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'

import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'
import {
  STRATEGY_STATUS_VALUES
  
} from '../types/strategy-template.types'

export class StrategyTemplateListQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ description: '按状态筛选', enum: STRATEGY_STATUS_VALUES })
  @IsOptional()
  @IsIn(STRATEGY_STATUS_VALUES)
  status?: StrategyStatus

  @ApiPropertyOptional({ description: '名称或描述关键词模糊搜索', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string

  @ApiPropertyOptional({ description: '自定义排序字段，默认按创建时间倒序', example: 'createdAt:desc' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  orderBy?: string

  @ApiPropertyOptional({ description: '是否仅返回草稿', type: Boolean })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true
    if (value === 'false' || value === false) return false
    return undefined
  })
  onlyDraft?: boolean
}


