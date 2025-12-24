import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'

export class CreateOrderbookPairConfigDto {
  @ApiProperty({ description: '交易对唯一标识，例如 BTCUSDT.BINANCE.SPOT' })
  @IsString()
  @IsNotEmpty()
  pairId!: string

  @ApiProperty({ description: '交易所/DEX 标识，例如 BINANCE, OKX, UNISWAP_V3' })
  @IsString()
  @IsNotEmpty()
  venue!: string

  @ApiProperty({ description: '交易对符号，例如 BTCUSDT' })
  @IsString()
  @IsNotEmpty()
  symbol!: string

  @ApiProperty({ description: '基础资产，例如 BTC' })
  @IsString()
  @IsNotEmpty()
  baseAsset!: string

  @ApiProperty({ description: '计价资产，例如 USDT' })
  @IsString()
  @IsNotEmpty()
  quoteAsset!: string

  @ApiProperty({ description: '交易场所类型', enum: ['CEX', 'DEX'] })
  @IsEnum(['CEX', 'DEX'])
  venueType!: 'CEX' | 'DEX'

  @ApiProperty({ description: '交易品种类型', enum: ['SPOT', 'PERPETUAL', 'FUTURE'] })
  @IsEnum(['SPOT', 'PERPETUAL', 'FUTURE'])
  instrumentType!: 'SPOT' | 'PERPETUAL' | 'FUTURE'

  @ApiPropertyOptional({ description: '是否启用拉取', default: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean

  @ApiPropertyOptional({ description: '拉取频率（秒），null 表示使用全局默认值', nullable: true })
  @IsInt()
  @IsPositive()
  @IsOptional()
  pullIntervalSeconds?: number | null

  @ApiPropertyOptional({ description: '深度层级（买卖各多少档）', nullable: true })
  @IsInt()
  @Min(5)
  @Max(500)
  @IsOptional()
  depthLevels?: number | null

  @ApiPropertyOptional({ description: '优先级（数字越小优先级越高）', default: 100 })
  @IsInt()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  @IsOptional()
  priority?: number

  @ApiPropertyOptional({
    description: '扩展配置（JSON格式）',
    example: { apiEndpoint: 'https://api.example.com', rateLimit: 100 },
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  metadata?: Record<string, any>

  @ApiPropertyOptional({ description: '备注说明' })
  @IsString()
  @IsOptional()
  description?: string
}

