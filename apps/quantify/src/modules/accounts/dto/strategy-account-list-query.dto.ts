import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base-pagination.request.dto'

export class StrategyAccountListQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({
    description: '业务用户 ID',
    example: 'usr_123',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiPropertyOptional({
    description: '筛选策略 ID',
    example: 'strategy-grid-btc',
  })
  @IsOptional()
  @IsString()
  strategyId?: string

  @ApiPropertyOptional({
    description: '关键字（支持策略名称模糊匹配）',
    example: 'BTC',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  keyword?: string

  @ApiPropertyOptional({
    description: '是否返回最近的日度收益摘要',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  withDailyStats?: boolean

  @ApiPropertyOptional({
    description: '是否只返回未平仓的策略账户（默认 false）',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  onlyActive?: boolean

  @ApiPropertyOptional({
    description: '筛选计价货币',
    example: 'USDT',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{2,10}$/)
  baseCurrency?: string
}
