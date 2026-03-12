import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator'

// 浠呭厑璁稿ぇ浜?0 鐨勬鏁?
const POSITIVE_DECIMAL_PATTERN = /^(?:0*[1-9]\d*(?:\.\d+)?|0*\.0*[1-9]\d*)$/

// 瀹氫箟鏋氫妇浠ヤ繚鎸佺被鍨嬪畨鍏?
enum ExchangeId {
  BINANCE = 'binance',
  OKX = 'okx',
  HYPERLIQUID = 'hyperliquid',
}

enum MarketType {
  SPOT = 'spot',
  PERP = 'perp',
}

export class ClosePositionDto {
  @ApiProperty({ description: '涓氬姟鐢ㄦ埛 ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiProperty({ description: '鐢ㄦ埛绛栫暐璐︽埛 ID' })
  @IsString()
  @IsNotEmpty()
  userStrategyAccountId!: string

  @ApiProperty({ description: '浠撲綅 ID' })
  @IsString()
  @IsNotEmpty()
  positionId!: string

  @ApiProperty({
    description: '骞充粨鏁伴噺锛堟墜鏁帮級',
    example: '0.5',
  })
  @Matches(POSITIVE_DECIMAL_PATTERN, { message: 'quantity 蹇呴』鏄ぇ浜?0 鐨勬暟瀛楀瓧绗︿覆' })
  quantity!: string

  @ApiProperty({
    description: '浜ゆ槗鎵€ ID',
    example: 'binance',
    enum: ExchangeId,
  })
  @IsEnum(ExchangeId, { message: 'exchangeId 蹇呴』鏄湁鏁堢殑浜ゆ槗鎵€ID' })
  exchangeId!: ExchangeId

  @ApiProperty({
    description: '甯傚満绫诲瀷',
    example: 'perp',
    enum: MarketType,
  })
  @IsEnum(MarketType, { message: 'marketType 蹇呴』鏄湁鏁堢殑甯傚満绫诲瀷' })
  marketType!: MarketType

  @ApiPropertyOptional({
    description: '璁㈠崟澶囨敞',
    example: '鐢ㄦ埛鎵嬪姩骞充粨',
  })
  @IsOptional()
  @IsString()
  note?: string
}

export class ClosePositionResponseDto {
  @ApiProperty({ description: '鏄惁鎴愬姛' })
  success!: boolean

  @ApiProperty({ description: '璁㈠崟 ID' })
  orderId!: string

  @ApiProperty({ description: '浠撲綅 ID' })
  positionId!: string

  @ApiProperty({ description: '宸叉垚浜ゆ暟閲? })
  filledQuantity!: string

  @ApiPropertyOptional({ description: '鎴愪氦鍧囦环锛堝競浠峰崟鍙兘娌℃湁鎴愪氦浠锋牸锛? })
  averagePrice?: string

  @ApiProperty({ description: '鐘舵€佹秷鎭? })
  message!: string
}
