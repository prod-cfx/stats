import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsString } from 'class-validator'

export class TriggerPositionSyncDto {
  @ApiProperty({ description: '涓氬姟鐢ㄦ埛 ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string

  @ApiProperty({ description: '鐢ㄦ埛绛栫暐璐︽埛 ID' })
  @IsString()
  @IsNotEmpty()
  userStrategyAccountId!: string

  @ApiProperty({ description: '浜ゆ槗鎵€ ID', enum: ['binance', 'okx', 'hyperliquid'] })
  @IsEnum(['binance', 'okx', 'hyperliquid'])
  exchangeId!: 'binance' | 'okx' | 'hyperliquid'

  @ApiProperty({ description: '甯傚満绫诲瀷', enum: ['spot', 'perp'] })
  @IsEnum(['spot', 'perp'])
  marketType!: 'spot' | 'perp'
}

export class PositionSyncResultDto {
  @ApiProperty({ description: '鐢ㄦ埛 ID' })
  userId!: string

  @ApiProperty({ description: '浜ゆ槗鎵€ ID' })
  exchangeId!: string

  @ApiProperty({ description: '甯傚満绫诲瀷' })
  marketType!: string

  @ApiProperty({ description: '鍚屾鏄惁鎴愬姛' })
  success!: boolean

  @ApiProperty({ description: '鍚屾鏃堕棿' })
  syncedAt!: Date

  @ApiProperty({ description: '浜ゆ槗鎵€浠撲綅鏁伴噺' })
  exchangePositions!: number

  @ApiProperty({ description: '鏈湴浠撲綅鏁伴噺' })
  localPositions!: number

  @ApiProperty({ description: '宸紓鍒楄〃', type: [Object] })
  differences!: Array<{
    symbol: string
    positionSide: string
    exchangeQuantity: string
    localQuantity: string
    difference: string
    action: string
  }>

  @ApiPropertyOptional({ description: '閿欒淇℃伅', type: [String] })
  errors?: string[]
}
