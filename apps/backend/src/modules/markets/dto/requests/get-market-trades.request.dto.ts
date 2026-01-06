import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'

export class GetMarketTradesRequestDto extends BasePaginationRequestDto {
  @ApiProperty({
    description: '交易所代码',
    example: 'OKX',
    required: false,
  })
  @IsOptional()
  @IsString()
  exchange?: string

  @ApiProperty({
    description: '合约类型',
    example: 'SPOT',
    enum: ['SPOT', 'PERPETUAL', 'FUTURE'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['SPOT', 'PERPETUAL', 'FUTURE'])
  instrumentType?: 'SPOT' | 'PERPETUAL' | 'FUTURE'

  @ApiProperty({
    description: '交易对符号',
    example: 'BTC-USDT',
    required: false,
  })
  @IsOptional()
  @IsString()
  symbol?: string

  @ApiProperty({
    description: '基础资产',
    example: 'BTC',
    required: false,
  })
  @IsOptional()
  @IsString()
  baseAsset?: string

  @ApiProperty({
    description: '计价资产',
    example: 'USDT',
    required: false,
  })
  @IsOptional()
  @IsString()
  quoteAsset?: string

  @ApiProperty({
    description: '交易方向',
    example: 'buy',
    enum: ['buy', 'sell'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['buy', 'sell'])
  side?: 'buy' | 'sell'

  @ApiProperty({
    description: '开始时间戳（毫秒）',
    example: 1704067200000,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fromTimestamp?: number

  @ApiProperty({
    description: '结束时间戳（毫秒）',
    example: 1704153600000,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  toTimestamp?: number
}

export class GetLatestTradesRequestDto {
  @ApiProperty({
    description: '交易所代码',
    example: 'OKX',
    required: true,
  })
  @IsString()
  exchange!: string

  @ApiProperty({
    description: '合约类型',
    example: 'SPOT',
    enum: ['SPOT', 'PERPETUAL', 'FUTURE'],
    required: true,
  })
  @IsEnum(['SPOT', 'PERPETUAL', 'FUTURE'])
  instrumentType!: 'SPOT' | 'PERPETUAL' | 'FUTURE'

  @ApiProperty({
    description: '交易对符号',
    example: 'BTC-USDT',
    required: true,
  })
  @IsString()
  symbol!: string

  @ApiProperty({
    description: '返回记录数量',
    example: 50,
    default: 50,
    minimum: 1,
    maximum: 200,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number
}

export class GetLargeTradesRequestDto extends GetLatestTradesRequestDto {
  @ApiProperty({
    description: '最小成交金额（USDT）',
    example: 100000,
    default: 100000,
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minValue?: number
}

