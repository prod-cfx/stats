import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'

export class WhaleHoldingDto {
  @ApiProperty({ description: '鲸鱼地址（用户地址）', example: '0xWhaleAddress1' })
  @IsString()
  userAddress: string

  @ApiProperty({ description: '币种符号，如 BTC / ETH', example: 'BTC' })
  @IsString()
  symbol: string

  @ApiProperty({
    description: '仓位方向，多头 LONG / 空头 SHORT，根据 positionSize 正负推导',
    example: 'LONG',
    enum: ['LONG', 'SHORT'],
  })
  @IsString()
  side: 'LONG' | 'SHORT'

  @ApiProperty({
    description: '持仓大小（原始数值，正数=多头，负数=空头）',
    example: 123.456,
  })
  @IsNumber()
  positionSize: number

  @ApiProperty({
    description: '持仓名义价值（USD）',
    example: 1000000,
  })
  @IsNumber()
  positionValueUsd: number

  @ApiProperty({
    description: '入场价格',
    example: 50000,
  })
  @IsNumber()
  entryPrice: number

  @ApiProperty({
    description: '清算价格',
    example: 45000,
  })
  @IsNumber()
  liquidationPrice: number

  @ApiProperty({
    description: '该持仓最近一次变动时间（来自 create_time）',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsDateString()
  createTime: string
}

export class QueryWhaleHoldingsDto {
  @ApiProperty({
    description: '币种符号过滤，例如 BTC / ETH；留空表示所有币种',
    required: false,
    example: 'BTC',
  })
  @IsString()
  @IsOptional()
  symbol?: string

  @ApiProperty({
    description: '仅返回名义价值不低于该数值（USD）的持仓，默认 1_000_000',
    required: false,
    example: 1_000_000,
  })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  minPositionValueUsd?: number

  @ApiProperty({
    description: '回溯时间范围（小时），默认 24 小时，最大 168 小时',
    required: false,
    example: 24,
    minimum: 1,
    maximum: 168,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(168)
  timeRangeHours?: number

  @ApiProperty({
    description: '最大返回记录数，默认 100，最大 500',
    required: false,
    example: 100,
    minimum: 1,
    maximum: 500,
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(500)
  limit?: number
}







