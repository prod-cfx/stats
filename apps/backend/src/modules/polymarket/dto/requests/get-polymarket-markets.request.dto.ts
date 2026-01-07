import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class GetPolymarketMarketsRequestDto {
  @ApiPropertyOptional({ description: '市场分类（如 crypto）' })
  @IsOptional()
  @IsString()
  category?: string

  @ApiPropertyOptional({ description: '是否只返回活跃市场', default: true })
  @IsOptional()
  @IsBoolean()
  onlyActive?: boolean

  @ApiPropertyOptional({ description: '分页偏移量', default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number

  @ApiPropertyOptional({ description: '分页数量上限', default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number
}


