import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional, IsString } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class GetPolymarketMarketsRequestDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ description: '市场分类（如 crypto）' })
  @IsOptional()
  @IsString()
  category?: string

  @ApiPropertyOptional({ description: '是否只返回活跃市场', default: true })
  @IsBoolean()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : value === true || value === 'true',
  )
  @IsOptional()
  onlyActive?: boolean

  @ApiPropertyOptional({ description: '语言（如 zh、zh-CN），不传时返回英文' })
  @IsOptional()
  @IsString()
  locale?: string
}
