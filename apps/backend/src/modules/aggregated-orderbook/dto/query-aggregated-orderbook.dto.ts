import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator'
import { MarketType } from '@ai/shared'

export { MarketType }

export class QueryAggregatedOrderbookDto {
  @ApiProperty({ description: '基础资产', example: 'BTC' })
  @IsString()
  base!: string

  @ApiProperty({ description: '市场类型', enum: MarketType, example: 'perp' })
  @IsEnum(MarketType)
  type!: MarketType

  @ApiProperty({
    description: '交易所列表，逗号分隔',
    example: 'binance,okx,bybit',
    required: false,
  })
  @IsOptional()
  @IsString()
  venues?: string

  @ApiProperty({ description: '深度档数', example: 50, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => (value ? Number.parseInt(value, 10) : undefined))
  depth?: number

  @ApiProperty({
    description: '价格聚合档位（美元），例如 1 表示按 $1 分组，10 表示按 $10 分组',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(1000)
  @Transform(({ value }) => (value ? Number.parseFloat(value) : undefined))
  tickSize?: number
}
