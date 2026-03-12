import { ApiPropertyOptional } from '@nestjs/swagger'
import { PositionSide, PositionStatus } from '@prisma/client'
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class PositionsQueryDto extends BasePaginationRequestDto {
  @ApiPropertyOptional({ description: '涓氬姟鐢ㄦ埛 ID', example: 'usr_123' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiPropertyOptional({ description: '鐢ㄦ埛绛栫暐璐︽埛 ID' })
  @IsOptional()
  @IsString()
  accountId?: string

  @ApiPropertyOptional({ description: '浜ゆ槗瀵?, example: 'BTCUSDT' })
  @IsOptional()
  @IsString()
  symbol?: string

  @ApiPropertyOptional({ description: '浠撲綅鏂瑰悜', enum: PositionSide })
  @IsOptional()
  @IsEnum(PositionSide)
  positionSide?: PositionSide

  @ApiPropertyOptional({ description: '浠撲綅鐘舵€?, enum: PositionStatus })
  @IsOptional()
  @IsEnum(PositionStatus)
  status?: PositionStatus

}
