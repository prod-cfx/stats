import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base-pagination.request.dto'

export class StrategyPnlDailyQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({
    description: '业务用户 ID',
    example: 'usr_123',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiPropertyOptional({
    description: '返回最近 N 天（覆盖分页）',
    example: 30,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  lastDays?: number
}


