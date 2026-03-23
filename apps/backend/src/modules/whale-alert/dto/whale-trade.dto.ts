import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator'

export enum TradeSide {
  Long = 'Long',
  Short = 'Short',
}

export class WhaleTradeDto {
  @ApiProperty({ description: '鲸鱼地址', example: '0x481234567890abcdef1234567890abcdef1234af' })
  @IsString()
  user_address: string

  @ApiProperty({ description: '币种符号', example: 'BTC' })
  @IsString()
  symbol: string

  @ApiProperty({ description: '交易方向', enum: TradeSide, example: 'Long' })
  @IsEnum(TradeSide)
  side: TradeSide

  @ApiProperty({ description: '交易数量（绝对值）', example: 0.5 })
  @IsNumber()
  trade_size: number

  @ApiProperty({ description: '交易价格（USD）', example: 89881.5 })
  @IsNumber()
  price: number

  @ApiProperty({ description: '交易价值（USD）', example: 44940.75 })
  @IsNumber()
  trade_value_usd: number

  @ApiProperty({ description: '交易时间', example: '2025-01-22T08:00:00.000Z' })
  @IsDateString()
  trade_time: string
}

export class QueryWhaleTradeDto {
  @ApiPropertyOptional({ description: '币种符号过滤', example: 'BTC' })
  @IsString()
  @IsOptional()
  symbol?: string

  @ApiPropertyOptional({ description: '最小交易价值（USD）', example: 1000 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  min_trade_value_usd?: number

  @ApiPropertyOptional({ description: '返回记录上限，默认 50，最大 200', example: 50 })
  @IsInt()
  @IsOptional()
  @IsPositive()
  @Max(200)
  limit?: number

  @ApiPropertyOptional({ description: '起始时间', example: '2025-01-22T00:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  since?: string

  @ApiPropertyOptional({ description: '页码（从 1 开始）', example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number
}
