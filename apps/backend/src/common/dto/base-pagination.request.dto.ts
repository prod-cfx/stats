import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'
import { PAGINATION_CONSTANTS } from '../constants/pagination.constants'

export class BasePaginationRequestDto {
  @ApiPropertyOptional({
    description: '页码（从 1 开始）',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '页码必须是整数' })
  @Min(1, { message: '页码必须大于或等于 1' })
  page: number = 1

  @ApiPropertyOptional({
    description: `每页数量（最大 ${PAGINATION_CONSTANTS.MAX_PAGE_SIZE}）`,
    example: PAGINATION_CONSTANTS.DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: PAGINATION_CONSTANTS.MAX_PAGE_SIZE,
    default: PAGINATION_CONSTANTS.DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '每页数量必须是整数' })
  @Min(1, { message: '每页数量必须大于或等于 1' })
  @Max(PAGINATION_CONSTANTS.MAX_PAGE_SIZE, {
    message: `每页数量不能超过 ${PAGINATION_CONSTANTS.MAX_PAGE_SIZE}`,
  })
  limit: number = PAGINATION_CONSTANTS.DEFAULT_PAGE_SIZE
}


