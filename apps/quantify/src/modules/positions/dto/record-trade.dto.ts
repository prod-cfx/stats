import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator'
import { PositionSide, TradeSide } from '@/prisma/prisma.types'

// 仅允许大于 0 的正数（禁止 0 和负数），用于 price/quantity/leverage（不含 0）
const POSITIVE_DECIMAL_PATTERN = /^(?:0*[1-9]\d*(?:\.\d+)?|0*\.0*[1-9]\d*)$/
// 仅允许非负数（包含 0），用于 fee（不允许负手续费）
const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+(\.\d+)?$/

export class RecordTradeDto {
  @ApiProperty({ description: '用户策略账户 ID' })
  @IsString()
  @IsNotEmpty()
  userStrategyAccountId!: string

  @ApiProperty({ description: '交易对', example: 'BTCUSDT' })
  @IsString()
  @IsNotEmpty()
  symbol!: string

  @ApiPropertyOptional({ description: '市场标识', example: 'binance:futures' })
  @IsOptional()
  @IsString()
  market?: string

  @ApiProperty({ enum: TradeSide })
  @IsEnum(TradeSide)
  side!: TradeSide

  @ApiProperty({ enum: PositionSide })
  @IsEnum(PositionSide)
  positionSide!: PositionSide

  @ApiProperty({ description: '成交价格', example: '60000.12' })
  @Matches(POSITIVE_DECIMAL_PATTERN, { message: 'price 必须是大于 0 的数字字符串' })
  price!: string

  @ApiProperty({ description: '成交数量', example: '0.01' })
  @Matches(POSITIVE_DECIMAL_PATTERN, { message: 'quantity 必须是大于 0 的数字字符串' })
  quantity!: string

  @ApiPropertyOptional({ description: '手续费', example: '0.1', default: '0' })
  @IsOptional()
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, { message: 'fee 必须是非负数字字符串' })
  fee: string = '0'

  @ApiPropertyOptional({ description: '手续费币种', example: 'USDT' })
  @IsOptional()
  @IsString()
  feeCurrency?: string

  @ApiPropertyOptional({ description: '杠杆倍数', example: '3' })
  @IsOptional()
  @Matches(POSITIVE_DECIMAL_PATTERN, { message: 'leverage 必须是大于 0 的数字字符串' })
  leverage?: string

  @ApiPropertyOptional({ description: '交易所订单 ID' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  orderId?: string

  @ApiPropertyOptional({ description: '外部成交 ID（用于幂等）' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalTradeId?: string

  @ApiPropertyOptional({ description: '行情/交易来源', example: 'BINANCE' })
  @IsOptional()
  @IsString()
  provider?: string

  @ApiProperty({ description: '成交时间 (ISO 8601)' })
  @IsDateString()
  executedAt!: string

  @ApiPropertyOptional({ description: '附加元数据' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}


