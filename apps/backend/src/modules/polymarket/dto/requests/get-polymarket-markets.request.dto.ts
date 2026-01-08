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
  @Transform(({ value }) => value === true || value === 'true')
  @IsOptional()
  onlyActive?: boolean
}







