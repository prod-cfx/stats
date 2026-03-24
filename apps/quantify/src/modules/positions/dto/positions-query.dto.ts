import { PositionSide, PositionStatus } from '@ai/shared'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class PositionsQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ description: '业务用户 ID', example: 'usr_123' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiPropertyOptional({ description: '用户策略账户 ID' })
  @IsOptional()
  @IsString()
  accountId?: string

  @ApiPropertyOptional({ description: '交易对', example: 'BTCUSDT' })
  @IsOptional()
  @IsString()
  symbol?: string

  @ApiPropertyOptional({ description: '仓位方向', enum: PositionSide })
  @IsOptional()
  @IsEnum(PositionSide)
  positionSide?: PositionSide

  @ApiPropertyOptional({ description: '仓位状态', enum: PositionStatus })
  @IsOptional()
  @IsEnum(PositionStatus)
  status?: PositionStatus

}

