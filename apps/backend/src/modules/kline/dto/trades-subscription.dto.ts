import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator'

/**
 * Trades 订阅请求 DTO
 */
export class TradesSubscriptionDto {
  @ApiProperty({
    description: '交易所代码',
    example: 'BINANCE',
    enum: ['BINANCE', 'OKX', 'BYBIT'],
  })
  @IsString()
  exchange!: string

  @ApiProperty({
    description: '合约类型',
    example: 'PERPETUAL',
    enum: ['SPOT', 'PERPETUAL'],
  })
  @IsString()
  instrumentType!: string

  @ApiProperty({
    description: '交易对符号',
    example: 'BTCUSDT',
  })
  @IsString()
  symbol!: string

  @ApiPropertyOptional({
    description: '最小成交金额（USD），用于过滤大额成交',
    example: 100000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minValue?: number

  @ApiPropertyOptional({
    description: '返回记录数量限制',
    example: 50,
    default: 50,
    maximum: 200,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number
}
