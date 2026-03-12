import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PositionSide, TradeSide } from '@prisma/client'
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

// 浠呭厑璁稿ぇ浜?0 鐨勬鏁帮紙绂佹 0 鍜岃礋鏁帮級锛岀敤浜?price/quantity/leverage锛堜笉鍚?0锛?
const POSITIVE_DECIMAL_PATTERN = /^(?:0*[1-9]\d*(?:\.\d+)?|0*\.0*[1-9]\d*)$/
// 浠呭厑璁搁潪璐熸暟锛堝寘鍚?0锛夛紝鐢ㄤ簬 fee锛堜笉鍏佽璐熸墜缁垂锛?
const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+(\.\d+)?$/

export class RecordTradeDto {
  @ApiProperty({ description: '鐢ㄦ埛绛栫暐璐︽埛 ID' })
  @IsString()
  @IsNotEmpty()
  userStrategyAccountId!: string

  @ApiProperty({ description: '浜ゆ槗瀵?, example: 'BTCUSDT' })
  @IsString()
  @IsNotEmpty()
  symbol!: string

  @ApiPropertyOptional({ description: '甯傚満鏍囪瘑', example: 'binance:futures' })
  @IsOptional()
  @IsString()
  market?: string

  @ApiProperty({ enum: TradeSide })
  @IsEnum(TradeSide)
  side!: TradeSide

  @ApiProperty({ enum: PositionSide })
  @IsEnum(PositionSide)
  positionSide!: PositionSide

  @ApiProperty({ description: '鎴愪氦浠锋牸', example: '60000.12' })
  @Matches(POSITIVE_DECIMAL_PATTERN, { message: 'price 蹇呴』鏄ぇ浜?0 鐨勬暟瀛楀瓧绗︿覆' })
  price!: string

  @ApiProperty({ description: '鎴愪氦鏁伴噺', example: '0.01' })
  @Matches(POSITIVE_DECIMAL_PATTERN, { message: 'quantity 蹇呴』鏄ぇ浜?0 鐨勬暟瀛楀瓧绗︿覆' })
  quantity!: string

  @ApiPropertyOptional({ description: '鎵嬬画璐?, example: '0.1', default: '0' })
  @IsOptional()
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, { message: 'fee 蹇呴』鏄潪璐熸暟瀛楀瓧绗︿覆' })
  fee: string = '0'

  @ApiPropertyOptional({ description: '鎵嬬画璐瑰竵绉?, example: 'USDT' })
  @IsOptional()
  @IsString()
  feeCurrency?: string

  @ApiPropertyOptional({ description: '鏉犳潌鍊嶆暟', example: '3' })
  @IsOptional()
  @Matches(POSITIVE_DECIMAL_PATTERN, { message: 'leverage 蹇呴』鏄ぇ浜?0 鐨勬暟瀛楀瓧绗︿覆' })
  leverage?: string

  @ApiPropertyOptional({ description: '浜ゆ槗鎵€璁㈠崟 ID' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  orderId?: string

  @ApiPropertyOptional({ description: '澶栭儴鎴愪氦 ID锛堢敤浜庡箓绛夛級' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalTradeId?: string

  @ApiPropertyOptional({ description: '琛屾儏/浜ゆ槗鏉ユ簮', example: 'BINANCE' })
  @IsOptional()
  @IsString()
  provider?: string

  @ApiProperty({ description: '鎴愪氦鏃堕棿 (ISO 8601)' })
  @IsDateString()
  executedAt!: string

  @ApiPropertyOptional({ description: '闄勫姞鍏冩暟鎹? })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}
