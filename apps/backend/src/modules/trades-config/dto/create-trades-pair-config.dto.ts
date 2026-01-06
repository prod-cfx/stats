import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator'
import { IsValidMetadata } from '@/common/validation/metadata.validator'

export class CreateTradesPairConfigDto {
  @ApiProperty({ 
    description: '交易对唯一标识，格式: SYMBOL.EXCHANGE.INSTRUMENT_TYPE（全大写），例如 BTC-USDT.OKX.SPOT',
    pattern: '^[A-Z0-9\\-]+\\.[A-Z0-9_]+\\.(SPOT|PERPETUAL|FUTURE)$',
    example: 'BTC-USDT.OKX.SPOT'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9\-]+\.[A-Z0-9_]+\.(SPOT|PERPETUAL|FUTURE)$/, {
    message: 'pairId 必须符合格式: SYMBOL.EXCHANGE.INSTRUMENT_TYPE（全大写），例如 BTC-USDT.OKX.SPOT'
  })
  pairId!: string

  @ApiProperty({ description: '交易所标识，例如 OKX, BINANCE, BYBIT' })
  @IsString()
  @IsNotEmpty()
  exchange!: string

  @ApiProperty({ description: '交易对符号，例如 BTC-USDT, BTC-USDT-SWAP' })
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

  @ApiProperty({ description: '交易品种类型', enum: ['SPOT', 'PERPETUAL', 'FUTURE'] })
  @IsEnum(['SPOT', 'PERPETUAL', 'FUTURE'])
  instrumentType!: 'SPOT' | 'PERPETUAL' | 'FUTURE'

  @ApiPropertyOptional({ description: '是否启用订阅', default: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean

  @ApiPropertyOptional({ 
    description: '优先级（数字越小优先级越高）', 
    type: Number,
    minimum: 1,
    maximum: 1000,
    default: 100 
  })
  @IsInt()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  @IsOptional()
  priority?: number

  @ApiPropertyOptional({
    description: '扩展配置（JSON格式），例如存储交易所特定参数。最大深度5层，最大10KB',
    example: { okxInstId: 'BTC-USDT-SWAP', minTradeValue: 10000 },
  })
  @IsOptional()
  @IsObject()
  @IsValidMetadata({ maxDepth: 5, maxSizeBytes: 10240 })
  metadata?: Record<string, any>

  @ApiPropertyOptional({ description: '备注说明' })
  @IsString()
  @IsOptional()
  description?: string
}

